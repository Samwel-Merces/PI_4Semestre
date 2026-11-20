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
import {
  MercadoPagoAdapter,
} from "./mercado-pago.adapter";
import type {
  CheckoutResult,
} from "../checkout/checkout.facade";
import type {
  PendingCheckout,
} from "../checkout/checkout.types";
import type {
  GatewayPayment,
  PaymentGateway,
} from "./payment-gateway";

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

  private constructor(
    private readonly gateway: PaymentGateway,
  ) {}

  public static get instance(): PaymentService {
    if (!PaymentService.#instance) {
      PaymentService.#instance =
        new PaymentService(
          new MercadoPagoAdapter(
            mercadoPagoClient,
          ),
        );
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

  // Cria o pagamento no Mercado Pago para um pedido já reservado. Chamado
  // pela fachada de checkout (CheckoutFacade). Se o Mercado Pago falhar, o
  // pedido é cancelado e o estoque reservado volta.
  async startPayment(
    checkout: PendingCheckout,
  ): Promise<CheckoutResult> {
    try {
      const preference =
        await this.gateway.createCheckout({
          externalReference:
            checkout.payment.externalReference,

          notificationUrl:
            this.buildNotificationUrl(),

          returnUrl:
            env.MERCADOPAGO_RETURN_URL,

          payerName:
            checkout.order.user.name,

          items: checkout.order.items.map(
            (item) => ({
              id: item.productId,
              title: item.productName,
              imageUrl: item.imageUrl,
              quantity: item.quantity,
              unitPriceInCents:
                item.unitPriceInCents,
            }),
          ),

          expiresAt: new Date(
            Date.now() +
              CHECKOUT_EXPIRATION_MINUTES *
                60_000,
          ),
        });

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
        initPoint: preference.paymentUrl,
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
      await this.gateway.getPayment(
        providerPaymentId,
      );

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
      const results =
        await this.gateway.findPaymentsByReference(
          payment.externalReference,
        );

      // Um aprovado vale mais que tentativas recusadas antes dele.
      const providerPayment =
        results.find(
          (result) =>
            result.status === "approved",
        ) ?? results[0];

      if (providerPayment?.id) {
        await this.applyProviderPayment(
          providerPayment.id,
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
      const initPoint =
        await this.gateway.getCheckoutUrl(
          payment.preferenceId,
        );

      return {
        initPoint,
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
    providerPayment: GatewayPayment,
  ): Promise<void> {
    if (
      !providerPayment.externalReference ||
      typeof providerPayment.amount !== "number" ||
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
      providerPayment.amount * 100,
    );

    await prisma.$transaction(
      async (transaction) => {
        const payment =
          await transaction.payment.findUnique({
            where: {
              externalReference:
                providerPayment.externalReference!,
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
