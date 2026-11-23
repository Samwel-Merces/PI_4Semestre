import { api } from './api';

import type {
  Order,
} from '../types/order';

export interface CheckoutPreference {
  paymentId: string;
  orderId: string;
  initPoint: string;
}

export const paymentService = {
  async createCheckout(): Promise<CheckoutPreference> {
    const response =
      await api.post<CheckoutPreference>(
        '/payments/checkout',
        {},
      );

    return response.data;
  },

  // Confere o pagamento direto no Mercado Pago e devolve o pedido
  // atualizado. Cobre o caso de o webhook não ter chegado.
  async syncOrderPayment(
    orderId: string,
  ): Promise<Order> {
    const response =
      await api.post<Order>(
        `/payments/orders/${orderId}/sync`,
        {},
      );

    return response.data;
  },

  async resumeOrderPayment(
    orderId: string,
  ): Promise<{ initPoint: string }> {
    const response =
      await api.post<{ initPoint: string }>(
        `/payments/orders/${orderId}/resume`,
        {},
      );

    return response.data;
  },
};
