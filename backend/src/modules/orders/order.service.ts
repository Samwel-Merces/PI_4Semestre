import {
  OrderStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../database/prisma";
import { AppError } from "../../shared/errors/AppError";

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

  private getAllowedStatuses(
    currentStatus: OrderStatus,
  ): OrderStatus[] {
    const transitions:
      Record<
        OrderStatus,
        OrderStatus[]
      > = {
        PENDING_PAYMENT: [],

        CONFIRMED: [
          "PROCESSING",
          "CANCELLED",
        ],

        PROCESSING: [
          "COMPLETED",
          "CANCELLED",
        ],

        COMPLETED: [],

        CANCELLED: [],
      };

    return transitions[currentStatus];
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

        const allowedStatuses =
          this.getAllowedStatuses(
            order.status,
          );

        if (
          !allowedStatuses.includes(
            newStatus,
          )
        ) {
          throw new AppError(
            `Não é permitido alterar o pedido de ${order.status} para ${newStatus}.`,
            409,
            "INVALID_ORDER_STATUS_TRANSITION",
            {
              currentStatus:
                order.status,

              requestedStatus:
                newStatus,

              allowedStatuses,
            },
          );
        }

        if (
          newStatus === "CANCELLED"
        ) {
          for (const item of order.items) {
            await transaction.product.updateMany({
              where: {
                id: item.productId,
              },

              data: {
                stock: {
                  increment:
                    item.quantity,
                },
              },
            });
          }
        }

        return transaction.order.update({
          where: {
            id: order.id,
          },

          data: {
            status: newStatus,
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
