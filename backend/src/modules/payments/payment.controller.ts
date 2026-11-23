import {
  Request,
  Response,
} from "express";
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from "mercadopago";

import {
  env,
} from "../../config/env";
import {
  AppError,
} from "../../shared/errors/AppError";

import {
  orderService,
} from "../orders/order.service";

import {
  paymentService,
} from "./payment.service";

function getQueryStringValue(
  value: unknown,
): string | string[] | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  ) {
    return value;
  }

  return undefined;
}

function getWebhookDataId(
  req: Request,
): string | string[] | undefined {
  const candidates = [
    req.query["data.id"],
    req.query.id,
    req.body?.data?.id,
    req.body?.id,
  ];

  for (const candidate of candidates) {
    const value = getQueryStringValue(candidate);

    if (value) {
      return value;
    }
  }

  return undefined;
}

export class PaymentController {
  static #instance: PaymentController;

  private constructor() {}

  public static get instance(): PaymentController {
    if (!PaymentController.#instance) {
      PaymentController.#instance =
        new PaymentController();
    }

    return PaymentController.#instance;
  }

  async createCheckout(
    req: Request,
    res: Response,
  ) {
    const checkout =
      await paymentService.createCheckout(
        req.user!.userId,
      );

    return res.status(201).json(checkout);
  }

  async syncOrderPayment(
    req: Request,
    res: Response,
  ) {
    const orderId =
      req.params.orderId as string;

    await paymentService.synchronizeOrderPayment(
      req.user!.userId,
      orderId,
    );

    const order =
      await orderService.findForUser(
        req.user!.userId,
        orderId,
      );

    return res.status(200).json(order);
  }

  async resumeOrderPayment(
    req: Request,
    res: Response,
  ) {
    const result =
      await paymentService.resumeOrderPayment(
        req.user!.userId,
        req.params.orderId as string,
      );

    return res.status(200).json(result);
  }

  async receiveWebhook(
    req: Request,
    res: Response,
  ) {
    const dataId = getWebhookDataId(req);

    try {
      WebhookSignatureValidator.validate({
        xSignature: req.headers["x-signature"],
        xRequestId: req.headers["x-request-id"],
        dataId,
        secret: env.MERCADOPAGO_WEBHOOK_SECRET,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        console.warn(
          "Assinatura do webhook Mercado Pago rejeitada.",
          {
            hasSignature: Boolean(
              req.headers["x-signature"],
            ),
            hasRequestId: Boolean(
              req.headers["x-request-id"],
            ),
            hasDataId: Boolean(dataId),
            type:
              req.body?.type ??
              req.query.type ??
              req.query.topic,
            action: req.body?.action,
            reason: error.reason,
            queryKeys: Object.keys(req.query),
          },
        );

        throw new AppError(
          "Assinatura do webhook inválida.",
          401,
          "INVALID_MERCADOPAGO_WEBHOOK_SIGNATURE",
        );
      }

      throw error;
    }

    const providerPaymentId =
      Array.isArray(dataId)
        ? dataId[0]
        : dataId;

    if (!providerPaymentId) {
      throw new AppError(
        "Identificador do pagamento não foi informado.",
        400,
        "MERCADOPAGO_WEBHOOK_PAYMENT_ID_REQUIRED",
      );
    }

    await paymentService.synchronizeWebhookPayment(
      providerPaymentId,
    );

    return res.sendStatus(200);
  }
}

export const paymentController =
  PaymentController.instance;
