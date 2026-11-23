import { Prisma } from "@prisma/client";

import { AppError } from "../../shared/errors/AppError";
import { paymentService } from "../payments/payment.service";

import { reserveCheckout } from "./checkout.reservation";
import type { PendingCheckout } from "./checkout.types";

export interface CheckoutResult {
  paymentId: string;
  orderId: string;
  initPoint: string;
}

interface PaymentStarter {
  startPayment(
    checkout: PendingCheckout,
  ): Promise<CheckoutResult>;
}

const MAXIMUM_ATTEMPTS = 3;

// Padrão Facade: uma única operação para o cliente (POST /payments/checkout)
// que coordena o carrinho, o estoque, o pedido e o pagamento.
export class CheckoutFacade {
  constructor(
    private readonly reserve: (
      userId: string,
    ) => Promise<PendingCheckout> = reserveCheckout,
    private readonly payments: PaymentStarter = paymentService,
  ) {}

  async checkout(
    userId: string,
  ): Promise<CheckoutResult> {
    const pending =
      await this.reserveWithRetry(userId);

    // Chamada externa, fora da transação das etapas locais.
    return this.payments.startPayment(pending);
  }

  // Duas compras simultâneas podem conflitar na transação serializável
  // (P2034); nesse caso a reserva é tentada de novo.
  private async reserveWithRetry(
    userId: string,
  ): Promise<PendingCheckout> {
    for (
      let attempt = 1;
      attempt <= MAXIMUM_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.reserve(userId);
      } catch (error) {
        const isWriteConflict =
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034";

        if (
          !isWriteConflict ||
          attempt === MAXIMUM_ATTEMPTS
        ) {
          throw error;
        }
      }
    }

    throw new AppError(
      "Não foi possível iniciar o pagamento.",
      500,
      "PAYMENT_CHECKOUT_FAILED",
    );
  }
}

export const checkoutFacade = new CheckoutFacade();
