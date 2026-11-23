import type { OrderStatus } from "@prisma/client";

import { AppError } from "../../../shared/errors/AppError";

import type { OrderContext } from "./order-context";

// Padrão State: cada estado do pedido decide quais ações aceita. Ação não
// prevista no estado atual é rejeitada com 409.
export interface OrderState {
  readonly status: OrderStatus;

  process(context: OrderContext): Promise<void>;
  complete(context: OrderContext): Promise<void>;
  cancel(context: OrderContext): Promise<void>;
}

export type OrderAction =
  | "process"
  | "complete"
  | "cancel";

abstract class BaseOrderState implements OrderState {
  abstract readonly status: OrderStatus;

  protected invalid(action: OrderAction): never {
    throw new AppError(
      `A ação "${action}" não é permitida para um pedido ${this.status}.`,
      409,
      "INVALID_ORDER_STATUS_TRANSITION",
      {
        currentStatus: this.status,
        action,
      },
    );
  }

  async process(_context: OrderContext): Promise<void> {
    this.invalid("process");
  }

  async complete(_context: OrderContext): Promise<void> {
    this.invalid("complete");
  }

  async cancel(_context: OrderContext): Promise<void> {
    this.invalid("cancel");
  }
}

// Aguardando o Mercado Pago. O pagamento (webhook, verificação ou rotina de
// expiração) é quem tira o pedido deste estado, não o administrador.
export class PendingPaymentState extends BaseOrderState {
  readonly status = "PENDING_PAYMENT" as const;
}

export class ConfirmedState extends BaseOrderState {
  readonly status = "CONFIRMED" as const;

  async process(context: OrderContext): Promise<void> {
    await context.transitionTo(new ProcessingState());
  }

  async cancel(context: OrderContext): Promise<void> {
    await context.restoreStock();
    await context.transitionTo(new CancelledState());
  }
}

export class ProcessingState extends BaseOrderState {
  readonly status = "PROCESSING" as const;

  async complete(context: OrderContext): Promise<void> {
    await context.transitionTo(new CompletedState());
  }

  async cancel(context: OrderContext): Promise<void> {
    await context.restoreStock();
    await context.transitionTo(new CancelledState());
  }
}

// Estados finais: nenhuma ação é aceita.
export class CompletedState extends BaseOrderState {
  readonly status = "COMPLETED" as const;
}

export class CancelledState extends BaseOrderState {
  readonly status = "CANCELLED" as const;
}

// Tipado como Record: o compilador acusa erro se o enum OrderStatus ganhar
// um valor sem a classe de estado correspondente.
const states: Record<OrderStatus, () => OrderState> = {
  PENDING_PAYMENT: () => new PendingPaymentState(),
  CONFIRMED: () => new ConfirmedState(),
  PROCESSING: () => new ProcessingState(),
  COMPLETED: () => new CompletedState(),
  CANCELLED: () => new CancelledState(),
};

export const stateFor = (
  status: OrderStatus,
): OrderState => states[status]();
