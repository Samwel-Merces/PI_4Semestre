import type { Prisma } from "@prisma/client";

export const orderWithDetailsInclude = {
  items: true,

  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails =
  Prisma.OrderGetPayload<{
    include: typeof orderWithDetailsInclude;
  }>;

// Resultado da reserva: pedido criado aguardando pagamento e o registro de
// pagamento que o Mercado Pago vai atualizar.
export interface PendingCheckout {
  payment: {
    id: string;
    externalReference: string;
  };

  order: OrderWithDetails;
}
