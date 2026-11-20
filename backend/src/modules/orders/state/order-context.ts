import type { OrderStatus } from "@prisma/client";

import { stateFor } from "./order-state";
import type { OrderAction, OrderState } from "./order-state";

interface OrderItemRef {
  productId: string;
  quantity: number;
}

interface OrderRef {
  id: string;
  status: OrderStatus;
  items: OrderItemRef[];
}

// Operações de persistência que os estados usam. Em produção é o cliente de
// transação do Prisma; nos testes, um objeto em memória.
export interface OrderStore {
  updateOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<void>;

  incrementProductStock(
    productId: string,
    quantity: number,
  ): Promise<void>;
}

// Contexto do padrão State: guarda o estado atual e delega as ações a ele.
export class OrderContext {
  private state: OrderState;

  constructor(
    private readonly store: OrderStore,
    private readonly order: OrderRef,
  ) {
    this.state = stateFor(order.status);
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  process(): Promise<void> {
    return this.state.process(this);
  }

  complete(): Promise<void> {
    return this.state.complete(this);
  }

  cancel(): Promise<void> {
    return this.state.cancel(this);
  }

  perform(action: OrderAction): Promise<void> {
    return this[action]();
  }

  async transitionTo(next: OrderState): Promise<void> {
    await this.store.updateOrderStatus(
      this.order.id,
      next.status,
    );

    this.state = next;
  }

  async restoreStock(): Promise<void> {
    for (const item of this.order.items) {
      await this.store.incrementProductStock(
        item.productId,
        item.quantity,
      );
    }
  }
}
