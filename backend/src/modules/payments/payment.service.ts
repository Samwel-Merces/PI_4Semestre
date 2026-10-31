import crypto from "crypto";

import {
  Preference,
  Payment,
} from "mercadopago";
import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "../../database/prisma";
import {
  env,
} from "../../config/env";
import {
  AppError,
} from "../../shared/errors/AppError";

import {
  mercadoPagoClient,
} from "./mercado-pago.client";

const orderWithDetailsInclude = {
  items: true,

  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetails =
  Prisma.OrderGetPayload<{
    include: typeof orderWithDetailsInclude;
  }>;

interface PendingCheckout {
  payment: {
    id: string;
    externalReference: string;
  };

  order: OrderWithDetails;
}

// Prazo para pagar depois do checkout. Passado esse prazo, o Mercado Pago
// recusa o pagamento e a rotina de expiração libera o estoque reservado.
export const CHECKOUT_EXPIRATION_MINUTES = 30;

// Folga antes de cancelar, para não atropelar um pagamento feito no limite
// do prazo cujo webhook ainda está a caminho.
const ABANDONED_CHECKOUT_GRACE_MINUTES = 5;

type ProviderPaymentStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "in_mediation"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export class PaymentService {
  static #instance: PaymentService;

  private readonly preferenceClient =
    new Preference(mercadoPagoClient);

  private readonly paymentClient =
    new Payment(mercadoPagoClient);

  private constructor() {}

  public static get instance(): PaymentService {
    if (!PaymentService.#instance) {
      PaymentService.#instance =
        new PaymentService();
    }

    return PaymentService.#instance;
  }

  // Sem "source_news=webhooks", o Mercado Pago também envia notificações
  // no formato IPN antigo (?id=...&topic=payment|merchant_order). Elas não
  // passam na validação de assinatura e seriam reenviadas sem parar.
  private buildNotificationUrl(): string {
    const url = new URL(
      env.MERCADOPAGO_WEBHOOK_URL,
    );

    url.searchParams.set(
      "source_news",
      "webhooks",
    );

    return url.toString();
  }

  private async reserveCheckout(
    userId: string,
  ): Promise<PendingCheckout> {
    return prisma.$transaction(
      async (transaction) => {
        const cart =
          await transaction.cart.findUnique({
            where: {
              userId,
            },

            include: {
              items: {
                include: {
                  product: true,
                },

                orderBy: {
                  productId: "asc",
                },
              },
            },
          });

        if (
          !cart ||
          cart.items.length === 0
        ) {
          throw new AppError(
            "O carrinho está vazio.",
            409,
            "CART_EMPTY",
          );
        }

        let totalInCents = 0;

        for (const item of cart.items) {
          if (!item.product.active) {
            throw new AppError(
              `O produto "${item.product.name}" está indisponível.`,
              409,
              "PRODUCT_UNAVAILABLE",
              {
                productId: item.product.id,
              },
            );
          }

          const stockReservation =
            await transaction.product.updateMany({
              where: {
                id: item.productId,
                active: true,

                stock: {
                  gte: item.quantity,
                },
              },

              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });

          if (stockReservation.count !== 1) {
            throw new AppError(
              `O estoque do produto "${item.product.name}" foi alterado. Atualize o carrinho e tente novamente.`,
              409,
              "INSUFFICIENT_STOCK",
              {
                productId: item.product.id,
              },
            );
          }

          totalInCents +=
            item.quantity *
            item.product.priceInCents;
        }

        const order =
          await transaction.order.create({
            data: {
              userId,
              status: "PENDING_PAYMENT",
              totalInCents,

              items: {
                create: cart.items.map(
                  (item) => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    imageUrl: item.product.imageUrl,
                    unitPriceInCents:
                      item.product.priceInCents,
                    quantity: item.quantity,
                    subtotalInCents:
                      item.quantity *
                      item.product.priceInCents,
                  }),
                ),
              },
            },

            include: orderWithDetailsInclude,
          });

        const payment =
          await transaction.payment.create({
            data: {
              orderId: order.id,
              provider: "MERCADO_PAGO",
              amountInCents: totalInCents,
              externalReference:
                `payment_${crypto.randomUUID()}`,
            },

            select: {
              id: true,
              externalReference: true,
            },
          });

        await transaction.cartItem.deleteMany({
          where: {
            cartId: cart.id,
          },
        });

        return {
          payment,
          order,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  // Cancela um pagamento que nunca chegou a ser feito. Se o pedido ainda
  // aguarda pagamento, ele é cancelado e o estoque reservado volta.
  private async cancelPendingPayment(
    paymentId: string,
    providerStatus: string,
  ): Promise<void> {
    await prisma.$transaction(
      async (transaction) => {
        const payment =
          await transaction.payment.findUnique({
            where: {
              id: paymentId,
            },

            include: {
              order: {
                include: {
                  items: true,
                },
              },
            },
          });

        if (
          !payment ||
          payment.status !== "PENDING"
        ) {
          return;
        }

        await transaction.payment.update({
          where: {
            id: payment.id,
          },

          data: {
            status: "CANCELLED",
            providerStatus,
          },
        });

        if (
          payment.order.status !==
          "PENDING_PAYMENT"
        ) {
          return;
        }

        for (const item of payment.order.items) {
          await transaction.product.update({
            where: {
              id: item.productId,
            },

            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        await transaction.order.update({
          where: {
            id: payment.orderId,
          },

          data: {
            status: "CANCELLED",
          },
        });
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  async createCheckout(userId: string) {
    const maximumAttempts = 3;
    let checkout: PendingCheckout | null = null;

    for (
      let attempt = 1;
      attempt <= maximumAttempts;
      attempt += 1
    ) {
      try {
        checkout = await this.reserveCheckout(userId);
        break;
      } catch (error) {
        const isWriteConflict =
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034";

        if (
          !isWriteConflict ||
          attempt === maximumAttempts
        ) {
          throw error;
        }
      }
    }

    if (!checkout) {
      throw new AppError(
        "Não foi possível iniciar o pagamento.",
        500,
        "PAYMENT_CHECKOUT_FAILED",
      );
    }

    try {
      const preference =
        await this.preferenceClient.create({
          body: {
            external_reference:
              checkout.payment.externalReference,

            notification_url:
              this.buildNotificationUrl(),

            back_urls: {
              success:
                env.MERCADOPAGO_RETURN_URL,
              pending:
                env.MERCADOPAGO_RETURN_URL,
              failure:
                env.MERCADOPAGO_RETURN_URL,
            },

            auto_return: "approved",

            expires: true,
            expiration_date_from:
              new Date().toISOString(),
            expiration_date_to:
              new Date(
                Date.now() +
                  CHECKOUT_EXPIRATION_MINUTES *
                    60_000,
              ).toISOString(),

            // O e-mail do cliente não é enviado: com credenciais de teste,
            // um e-mail que não é de usuário de teste faz o Mercado Pago
            // recusar o pagamento ("uma das partes é de teste"). O cliente
            // informa o e-mail na própria página do Mercado Pago.
            payer: {
              name: checkout.order.user.name,
            },
            items: checkout.order.items.map(
              (item) => ({
                id: item.productId,
                title: item.productName,
                picture_url: item.imageUrl,
                quantity: item.quantity,
                currency_id: "BRL",
                unit_price:
                  item.unitPriceInCents / 100,
              }),
            ),
          },
        });

      if (!preference.id || !preference.init_point) {
        throw new Error(
          "Resposta incompleta do Mercado Pago.",
        );
      }

      await prisma.payment.update({
        where: {
          id: checkout.payment.id,
        },

        data: {
          preferenceId: preference.id,
          providerStatus: "preference_created",
        },
      });

      return {
        paymentId: checkout.payment.id,
        orderId: checkout.order.id,
        initPoint: preference.init_point,
      };
    } catch (error) {
      await this.cancelPendingPayment(
        checkout.payment.id,
        "preference_creation_failed",
      );

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Não foi possível iniciar o pagamento no Mercado Pago.",
        502,
        "MERCADO_PAGO_PREFERENCE_CREATION_FAILED",
      );
    }
  }

  async synchronizeWebhookPayment(
    providerPaymentId: string,
  ): Promise<void> {
    const providerPayment =
      await this.paymentClient.get({
        id: providerPaymentId,
      });

    await this.applyProviderPayment(
      providerPaymentId,
      providerPayment,
    );
  }

  // Plano B do webhook: quando o cliente volta do Mercado Pago, o app pede
  // para conferir o pagamento. Os pagamentos ainda pendentes do pedido são
  // buscados no Mercado Pago pela referência externa e atualizados com as
  // mesmas regras do webhook.
  async synchronizeOrderPayment(
    userId: string,
    orderId: string,
  ): Promise<void> {
    const order =
      await prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
        },

        include: {
          payments: {
            where: {
              status: "PENDING",
            },
          },
        },
      });

    if (!order) {
      throw new AppError(
        "Pedido não encontrado.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    if (order.status !== "PENDING_PAYMENT") {
      return;
    }

    for (const payment of order.payments) {
      const search =
        await this.paymentClient.search({
          options: {
            external_reference:
              payment.externalReference,
            sort: "date_last_updated",
            criteria: "desc",
          },
        });

      const results = search.results ?? [];

      // Um aprovado vale mais que tentativas recusadas antes dele.
      const providerPayment =
        results.find(
          (result) =>
            result.status === "approved",
        ) ?? results[0];

      if (providerPayment?.id) {
        await this.applyProviderPayment(
          String(providerPayment.id),
          providerPayment,
        );
      }
    }
  }

  // Devolve o link do Mercado Pago de um pedido que ainda não foi pago.
  // Confere o pagamento antes, para não mandar pagar de novo um pedido
  // cujo webhook só não chegou.
  async resumeOrderPayment(
    userId: string,
    orderId: string,
  ): Promise<{ initPoint: string }> {
    await this.synchronizeOrderPayment(
      userId,
      orderId,
    );

    const order =
      await prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
        },

        include: {
          payments: {
            where: {
              status: "PENDING",
              preferenceId: {
                not: null,
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            take: 1,
          },
        },
      });

    if (!order) {
      throw new AppError(
        "Pedido não encontrado.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    const payment = order.payments[0];

    if (
      order.status !== "PENDING_PAYMENT" ||
      !payment?.preferenceId
    ) {
      throw new AppError(
        "Este pedido não está aguardando pagamento.",
        409,
        "ORDER_NOT_AWAITING_PAYMENT",
      );
    }

    const expiresAt =
      payment.createdAt.getTime() +
      CHECKOUT_EXPIRATION_MINUTES * 60_000;

    if (Date.now() > expiresAt) {
      throw new AppError(
        "O prazo para pagamento deste pedido expirou. Faça um novo pedido.",
        409,
        "CHECKOUT_EXPIRED",
      );
    }

    try {
      const preference =
        await this.preferenceClient.get({
          preferenceId: payment.preferenceId,
        });

      if (!preference.init_point) {
        throw new Error(
          "Preferência sem link de pagamento.",
        );
      }

      return {
        initPoint: preference.init_point,
      };
    } catch {
      throw new AppError(
        "Não foi possível retomar o pagamento deste pedido.",
        502,
        "MERCADO_PAGO_PREFERENCE_UNAVAILABLE",
      );
    }
  }

  // Cancela os pedidos cujo prazo de pagamento passou sem nenhuma tentativa
  // registrada no Mercado Pago, devolvendo o estoque. Pedidos com pagamento
  // em andamento (ex.: boleto em aberto) ficam para o webhook resolver.
  // Devolve quantos pedidos foram cancelados.
  async expireAbandonedCheckouts(): Promise<number> {
    const cutoff = new Date(
      Date.now() -
        (CHECKOUT_EXPIRATION_MINUTES +
          ABANDONED_CHECKOUT_GRACE_MINUTES) *
          60_000,
    );

    const orders =
      await prisma.order.findMany({
        where: {
          status: "PENDING_PAYMENT",
          createdAt: {
            lt: cutoff,
          },
        },

        select: {
          id: true,
          userId: true,
        },
      });

    let expiredOrders = 0;

    for (const order of orders) {
      try {
        await this.synchronizeOrderPayment(
          order.userId,
          order.id,
        );

        const pendingPayments =
          await prisma.payment.findMany({
            where: {
              orderId: order.id,
              status: "PENDING",
            },

            select: {
              id: true,
              providerPaymentId: true,
            },
          });

        const hasPaymentInProgress =
          pendingPayments.some(
            (payment) =>
              payment.providerPaymentId !== null,
          );

        if (
          pendingPayments.length === 0 ||
          hasPaymentInProgress
        ) {
          continue;
        }

        for (const payment of pendingPayments) {
          await this.cancelPendingPayment(
            payment.id,
            "expired",
          );
        }

        expiredOrders += 1;
      } catch (error) {
        console.error(
          `Não foi possível expirar o pedido ${order.id}.`,
          error,
        );
      }
    }

    return expiredOrders;
  }

  private async applyProviderPayment(
    providerPaymentId: string,
    providerPayment: {
      external_reference?: string;
      transaction_amount?: number;
      status?: string;
    },
  ): Promise<void> {
    if (
      !providerPayment.external_reference ||
      typeof providerPayment.transaction_amount !== "number" ||
      !providerPayment.status
    ) {
      return;
    }

    const paymentStatus =
      providerPayment.status as ProviderPaymentStatus;

    const statusMapping = {
      approved: {
        paymentStatus: "APPROVED",
        orderStatus: "CONFIRMED",
        releasesStock: false,
      },
      pending: {
        paymentStatus: "PENDING",
        orderStatus: "PENDING_PAYMENT",
        releasesStock: false,
      },
      in_process: {
        paymentStatus: "PENDING",
        orderStatus: "PENDING_PAYMENT",
        releasesStock: false,
      },
      in_mediation: {
        paymentStatus: "PENDING",
        orderStatus: "PENDING_PAYMENT",
        releasesStock: false,
      },
      authorized: {
        paymentStatus: "PENDING",
        orderStatus: "PENDING_PAYMENT",
        releasesStock: false,
      },
      rejected: {
        paymentStatus: "REJECTED",
        orderStatus: "CANCELLED",
        releasesStock: true,
      },
      cancelled: {
        paymentStatus: "CANCELLED",
        orderStatus: "CANCELLED",
        releasesStock: true,
      },
      refunded: {
        paymentStatus: "REFUNDED",
        orderStatus: "CANCELLED",
        releasesStock: false,
      },
      charged_back: {
        paymentStatus: "REJECTED",
        orderStatus: "CANCELLED",
        releasesStock: false,
      },
    } as const;

    const mapping =
      statusMapping[paymentStatus];

    if (!mapping) {
      return;
    }

    const amountInCents = Math.round(
      providerPayment.transaction_amount * 100,
    );

    await prisma.$transaction(
      async (transaction) => {
        const payment =
          await transaction.payment.findUnique({
            where: {
              externalReference:
                providerPayment.external_reference!,
            },

            include: {
              order: {
                include: {
                  items: true,
                },
              },
            },
          });

        if (
          !payment ||
          payment.amountInCents !== amountInCents
        ) {
          return;
        }

        const isOutdatedPendingNotification =
          mapping.paymentStatus === "PENDING" &&
          payment.status !== "PENDING";

        if (isOutdatedPendingNotification) {
          return;
        }

        await transaction.payment.update({
          where: {
            id: payment.id,
          },

          data: {
            providerPaymentId,
            providerStatus: providerPayment.status,
            status: mapping.paymentStatus,
          },
        });

        if (
          mapping.releasesStock &&
          payment.status === "PENDING" &&
          payment.order.status === "PENDING_PAYMENT"
        ) {
          for (const item of payment.order.items) {
            await transaction.product.update({
              where: {
                id: item.productId,
              },

              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
          }
        }

        if (
          payment.order.status === "PENDING_PAYMENT" ||
          mapping.orderStatus === "CANCELLED"
        ) {
          await transaction.order.update({
            where: {
              id: payment.orderId,
            },

            data: {
              status: mapping.orderStatus,
            },
          });
        }
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}

export const paymentService =
  PaymentService.instance;
