// Interface-alvo do padrão Adapter: o que o PetShop precisa de um provedor
// de pagamento, sem depender do SDK do Mercado Pago.
export interface CheckoutItem {
  id: string;
  title: string;
  imageUrl: string;
  quantity: number;
  unitPriceInCents: number;
}

export interface CreateCheckoutRequest {
  externalReference: string;
  notificationUrl: string;
  returnUrl: string;
  payerName: string;
  items: CheckoutItem[];
  expiresAt: Date;
}

export interface GatewayCheckout {
  id: string;
  paymentUrl: string;
}

// Pagamento como o provedor o informa. `status` é o texto original do
// provedor, gravado em providerStatus.
export interface GatewayPayment {
  id: string;
  externalReference?: string;
  amount?: number;
  status?: string;
}

export interface PaymentGateway {
  createCheckout(
    request: CreateCheckoutRequest,
  ): Promise<GatewayCheckout>;

  getCheckoutUrl(checkoutId: string): Promise<string>;

  getPayment(paymentId: string): Promise<GatewayPayment>;

  findPaymentsByReference(
    externalReference: string,
  ): Promise<GatewayPayment[]>;
}
