import {
  OrderStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../database/prisma";
import { AppError } from "../../shared/errors/AppError";

import { OrderContext } from "./state/order-context";
import type { OrderAction } from "./state/order-state";

import {
  OrderListQuery,
  UpdateOrderStatusInput,
} from "./order.schemas";

const orderInclude = {
  items: true,

  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetails =
  Prisma.OrderGetPayload<{
    include: typeof orderInclude;
  }>;

interface PaginatedOrders {
  data: OrderWithDetails[];

  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// Ação do padrão State que corresponde a cada status pedido pelo
// administrador. CONFIRMED não tem ação: só o pagamento confirma um pedido.
const statusActions: Partial<
  Record<OrderStatus, OrderAction>
> = {
  PROCESSING: "process",
  COMPLETED: "complete",
  CANCELLED: "cancel",
};

export class OrderService {
  static #instance: OrderService;

  private constructor() {}

  public static get instance(): OrderService {
    if (!OrderService.#instance) {
      OrderService.#instance =
        new OrderService();
    }

    return OrderService.#instance;
  }

  async listForUser(
    userId: string,
    query: OrderListQuery,
  ): Promise<PaginatedOrders> {
    const {
      page,
      pageSize,
      status,
    } = query;

    const skip =
      (page - 1) * pageSize;

    const where:
      Prisma.OrderWhereInput = {
        userId,
        ...(status ? { status } : {}),
      };

    const [orders, totalItems] =
      await prisma.$transaction([
        prisma.order.findMany({
          where,
          include: orderInclude,

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: pageSize,
        }),

        prisma.order.count({
          where,
        }),
      ]);

    return {
      data: orders,

      pagination: {
        page,
        pageSize,
        totalItems,

        totalPages: Math.ceil(
          totalItems / pageSize,
        ),
      },
    };
  }

  async listForAdmin(
    query: OrderListQuery,
  ): Promise<PaginatedOrders> {
    const {
      page,
      pageSize,
      status,
    } = query;

    const skip =
      (page - 1) * pageSize;

    const where:
      Prisma.OrderWhereInput =
        status ? { status } : {};

    const [orders, totalItems] =
      await prisma.$transaction([
        prisma.order.findMany({
          where,
          include: orderInclude,

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: pageSize,
        }),

        prisma.order.count({
          where,
        }),
      ]);

    return {
      data: orders,

      pagination: {
        page,
        pageSize,
        totalItems,

        totalPages: Math.ceil(
          totalItems / pageSize,
        ),
      },
    };
  }

  async findForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderWithDetails> {
    const order =
      await prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
        },

        include: orderInclude,
      });

    if (!order) {
      throw new AppError(
        "Pedido não encontrado.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    return order;
  }

  async findForAdmin(
    orderId: string,
  ): Promise<OrderWithDetails> {
    const order =
      await prisma.order.findUnique({
        where: {
          id: orderId,
        },

        include: orderInclude,
      });

    if (!order) {
      throw new AppError(
        "Pedido não encontrado.",
        404,
        "ORDER_NOT_FOUND",
      );
    }

    return order;
  }

  async updateStatus(
    orderId: string,
    data: UpdateOrderStatusInput,
  ): Promise<OrderWithDetails> {
    return prisma.$transaction(
      async (transaction) => {
        const order =
          await transaction.order.findUnique({
            where: {
              id: orderId,
            },

            include: {
              items: true,
            },
          });

        if (!order) {
          throw new AppError(
            "Pedido não encontrado.",
            404,
            "ORDER_NOT_FOUND",
          );
        }

        const newStatus =
          data.status as OrderStatus;

        if (
          newStatus === order.status
        ) {
          return transaction.order.findUniqueOrThrow({
            where: {
              id: order.id,
            },

            include: orderInclude,
          });
        }

        const action =
          statusActions[newStatus];

        if (!action) {
          throw new AppError(
            `Não é permitido alterar o pedido de ${order.status} para ${newStatus}.`,
            409,
            "INVALID_ORDER_STATUS_TRANSITION",
            {
              currentStatus:
                order.status,

              requestedStatus:
                newStatus,
            },
          );
        }

        // Padrão State: o estado atual do pedido decide se a ação é aceita
        // e aplica a transição (devolvendo o estoque ao cancelar).
        const context = new OrderContext(
          {
            updateOrderStatus: async (
              id,
              status,
            ) => {
              await transaction.order.update({
                where: { id },
                data: { status },
              });
            },

            incrementProductStock: async (
              productId,
              quantity,
            ) => {
              await transaction.product.updateMany({
                where: { id: productId },
                data: {
                  stock: {
                    increment: quantity,
                  },
                },
              });
            },
          },
          order,
        );

        await context.perform(action);

        return transaction.order.findUniqueOrThrow({
          where: {
            id: order.id,
          },

          include: orderInclude,
        });
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,

        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}

export const orderService =
  OrderService.instance;
