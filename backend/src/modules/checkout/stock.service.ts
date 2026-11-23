import type { Prisma } from "@prisma/client";

import { AppError } from "../../shared/errors/AppError";

export interface StockItem {
  productId: string;
  productName: string;
  quantity: number;
}

// Subsistema da fachada de checkout: reserva de estoque.
export class StockService {
  // Baixa o estoque dentro da transação do checkout. A condição `gte`
  // no updateMany impede estoque negativo mesmo com compras simultâneas.
  async reserve(
    transaction: Prisma.TransactionClient,
    items: StockItem[],
  ): Promise<void> {
    for (const item of items) {
      const reservation =
        await transaction.product.updateMany({
          where: {
            id: item.productId,
            active: true,

            stock: {
              gte: item.quantity,
            },
          },

          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

      if (reservation.count !== 1) {
        throw new AppError(
          `O estoque do produto "${item.productName}" foi alterado. Atualize o carrinho e tente novamente.`,
          409,
          "INSUFFICIENT_STOCK",
          {
            productId: item.productId,
          },
        );
      }
    }
  }
}

export const stockService = new StockService();
