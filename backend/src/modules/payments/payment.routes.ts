import { Router } from "express";

import {
  authMiddleware,
} from "../../middlewares/auth.middleware";
import {
  validate,
} from "../../middlewares/validation.middleware";

import {
  paymentController,
} from "./payment.controller";
import {
  orderIdParamsSchema,
} from "../orders/order.schemas";

import {
  createCheckoutSchema,
} from "./payment.schemas";

const paymentRoutes = Router();

paymentRoutes.post(
  "/webhook",
  paymentController.receiveWebhook.bind(
    paymentController,
  ),
);

paymentRoutes.use(authMiddleware);

paymentRoutes.post(
  "/checkout",
  validate(createCheckoutSchema),
  paymentController.createCheckout.bind(
    paymentController,
  ),
);

paymentRoutes.post(
  "/orders/:orderId/sync",
  validate(orderIdParamsSchema, "params"),
  paymentController.syncOrderPayment.bind(
    paymentController,
  ),
);

paymentRoutes.post(
  "/orders/:orderId/resume",
  validate(orderIdParamsSchema, "params"),
  paymentController.resumeOrderPayment.bind(
    paymentController,
  ),
);

export { paymentRoutes };
