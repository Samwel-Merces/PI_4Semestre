import {
  MercadoPagoConfig,
  Payment,
  Preference,
} from "mercadopago";

import type {
  CreateCheckoutRequest,
  GatewayCheckout,
  GatewayPayment,
  PaymentGateway,
} from "./payment-gateway";

interface ProviderPaymentResponse {
  id?: number | string;
  external_reference?: string;
  transaction_amount?: number;
  status?: string;
}

export function toGatewayPayment(
  response: ProviderPaymentResponse,
): GatewayPayment {
  return {
    id: String(response.id ?? ""),
    externalReference: response.external_reference,
    amount: response.transaction_amount,
    status: response.status,
  };
}

// Adapter: traduz o PaymentGateway para as chamadas do SDK do Mercado Pago
// (Checkout Pro, API de Preferences).
export class MercadoPagoAdapter implements PaymentGateway {
  private readonly preferences: Preference;
  private readonly payments: Payment;

  constructor(config: MercadoPagoConfig) {
    this.preferences = new Preference(config);
    this.payments = new Payment(config);
  }

  async createCheckout(
    request: CreateCheckoutRequest,
  ): Promise<GatewayCheckout> {
    const preference = await this.preferences.create({
      body: {
        external_reference: request.externalReference,
        notification_url: request.notificationUrl,

        back_urls: {
          success: request.returnUrl,
          pending: request.returnUrl,
          failure: request.returnUrl,
        },

        auto_return: "approved",

        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: request.expiresAt.toISOString(),

        // O e-mail do cliente não é enviado: com credenciais de teste,
        // um e-mail que não é de usuário de teste faz o Mercado Pago
        // recusar o pagamento ("uma das partes é de teste"). O cliente
        // informa o e-mail na própria página do Mercado Pago.
        payer: {
          name: request.payerName,
        },

        items: request.items.map((item) => ({
          id: item.id,
          title: item.title,
          picture_url: item.imageUrl,
          quantity: item.quantity,
          currency_id: "BRL",
          unit_price: item.unitPriceInCents / 100,
        })),
      },
    });

    if (!preference.id || !preference.init_point) {
      throw new Error("Resposta incompleta do Mercado Pago.");
    }

    return {
      id: preference.id,
      paymentUrl: preference.init_point,
    };
  }

  async getCheckoutUrl(checkoutId: string): Promise<string> {
    const preference = await this.preferences.get({
      preferenceId: checkoutId,
    });

    if (!preference.init_point) {
      throw new Error("Preferência sem link de pagamento.");
    }

    return preference.init_point;
  }

  async getPayment(paymentId: string): Promise<GatewayPayment> {
    return toGatewayPayment(
      await this.payments.get({ id: paymentId }),
    );
  }

  async findPaymentsByReference(
    externalReference: string,
  ): Promise<GatewayPayment[]> {
    const search = await this.payments.search({
      options: {
        external_reference: externalReference,
        sort: "date_last_updated",
        criteria: "desc",
      },
    });

    return (search.results ?? []).map(toGatewayPayment);
  }
}
