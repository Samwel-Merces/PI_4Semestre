import crypto from "crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma";
import { AppError } from "../../shared/errors/AppError";

import {
  orderWithDetailsInclude,
  type PendingCheckout,
} from "./checkout.types";
import { stockService } from "./stock.service";
import type { StockService } from "./stock.service";

// Etapas locais do checkout, numa única transação: valida o carrinho, baixa
// o estoque, cria o pedido (com cópia de nome e preço) e esvazia o carrinho.
export async function reserveCheckout(
  userId: string,
  stock: StockService = stockService,
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

      if (!cart || cart.items.length === 0) {
        throw new AppError(
          "O carrinho está vazio.",
          409,
          "CART_EMPTY",
        );
      }

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
      }

      await stock.reserve(
        transaction,
        cart.items.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
        })),
      );

      const totalInCents = cart.items.reduce(
        (total, item) =>
          total +
          item.quantity * item.product.priceInCents,
        0,
      );

      const order =
        await transaction.order.create({
          data: {
            userId,
            status: "PENDING_PAYMENT",
            totalInCents,

            items: {
              create: cart.items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                imageUrl: item.product.imageUrl,
                unitPriceInCents:
                  item.product.priceInCents,
                quantity: item.quantity,
                subtotalInCents:
                  item.quantity *
                  item.product.priceInCents,
              })),
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
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
