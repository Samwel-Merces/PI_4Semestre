import "dotenv/config";

import bcrypt from "bcrypt";
import {
  OrderStatus,
  PaymentStatus,
  PetSize,
  Prisma,
  PrismaClient,
  ProductCategory,
  Species,
  UserRole,
} from "@prisma/client";

/*
 * Seed de desenvolvimento/demonstração.
 *
 * Idempotente: todos os registros usam chaves fixas
 * (e-mail para usuários e UUIDs fixos para o restante),
 * e cada escrita é um upsert. Rodar duas vezes não duplica dados.
 */

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

const unsplash = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?w=600&q=80`;

function readPassword(
  variable: string,
  fallback: string,
): string {
  const password =
    process.env[variable] ?? fallback;

  /*
   * Mesma regra de tamanho do registerSchema.
   */
  if (
    password.length < 8 ||
    password.length > 72
  ) {
    throw new Error(
      `${variable} deve possuir entre 8 e 72 caracteres.`,
    );
  }

  return password;
}

function daysAgo(days: number): Date {
  return new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  );
}

const users = [
  {
    name: "Administrador Demo",
    email: "admin@example.com",
    phone: "11999990001",
    role: UserRole.ADMIN,
    password: readPassword(
      "SEED_ADMIN_PASSWORD",
      "Admin@123",
    ),
  },
  {
    name: "Cliente Demo",
    email: "cliente@example.com",
    phone: "11999990002",
    role: UserRole.CLIENTE,
    password: readPassword(
      "SEED_CLIENT_PASSWORD",
      "Cliente@123",
    ),
  },
] as const;

const products = [
  {
    id: "5eed0000-0000-4000-8000-000000000101",
    name: "Ração Premium Cães Adultos 15kg",
    description:
      "Ração completa para cães adultos de porte médio e grande, com proteínas selecionadas e ômega 3.",
    priceInCents: 18990,
    baseStock: 30,
    imageUrl: unsplash("1589924691995-400dc9ecc119"),
    category: ProductCategory.RACAO,
    species: Species.CAO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000102",
    name: "Ração Gatos Castrados 10kg",
    description:
      "Ração para gatos castrados com controle de peso e auxílio na saúde do trato urinário.",
    priceInCents: 15990,
    baseStock: 25,
    imageUrl: unsplash("1514888286974-6c03e2ca1dba"),
    category: ProductCategory.RACAO,
    species: Species.GATO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000103",
    name: "Petisco Biscoito Osso 500g",
    description:
      "Biscoitos crocantes em formato de osso, ideais para recompensa durante o adestramento.",
    priceInCents: 2490,
    baseStock: 80,
    imageUrl: unsplash("1568640347023-a616a30bc3bd"),
    category: ProductCategory.PETISCOS,
    species: Species.CAO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000104",
    name: "Shampoo Neutro Pet 500ml",
    description:
      "Shampoo de pH neutro para cães e gatos, sem parabenos e com fragrância suave.",
    priceInCents: 3290,
    baseStock: 40,
    imageUrl: unsplash("1516734212186-a967f81ad0d7"),
    category: ProductCategory.HIGIENE,
    species: null,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000105",
    name: "Areia Higiênica Grãos Finos 4kg",
    description:
      "Areia aglomerante de grãos finos, com alto poder de absorção e controle de odores.",
    priceInCents: 2890,
    baseStock: 50,
    imageUrl: unsplash("1520087619250-584c0cbd35e8"),
    category: ProductCategory.HIGIENE,
    species: Species.GATO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000106",
    name: "Brinquedo Pelúcia Mordedor",
    description:
      "Pelúcia resistente com apito interno, indicada para cães de todos os portes.",
    priceInCents: 2990,
    baseStock: 35,
    imageUrl: unsplash("1591946614720-90a587da4a36"),
    category: ProductCategory.BRINQUEDOS,
    species: Species.CAO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000107",
    name: "Arranhador Torre para Gatos",
    description:
      "Arranhador em sisal com dois andares e plataforma de descanso.",
    priceInCents: 14990,
    baseStock: 10,
    imageUrl: unsplash("1592194996308-7b43878e84a6"),
    category: ProductCategory.BRINQUEDOS,
    species: Species.GATO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000108",
    name: "Coleira Ajustável Nylon M",
    description:
      "Coleira de nylon com fivela de engate rápido e argola para identificação.",
    priceInCents: 3990,
    baseStock: 45,
    imageUrl: unsplash("1583337130417-3346a1be7dee"),
    category: ProductCategory.ACESSORIOS,
    species: Species.CAO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000109",
    name: "Gaiola Completa para Hamster",
    description:
      "Gaiola com roda de exercício, bebedouro e casinha, ideal para hamsters e pequenos roedores.",
    priceInCents: 21990,
    baseStock: 8,
    imageUrl: unsplash("1425082661705-1834bfd09dca"),
    category: ProductCategory.ACESSORIOS,
    species: Species.OUTRO,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000110",
    name: "Vermífugo Cães até 10kg",
    description:
      "Vermífugo de amplo espectro em comprimidos para cães de até 10kg. Consulte o veterinário.",
    priceInCents: 4590,
    baseStock: 20,
    imageUrl: unsplash("1587300003388-59208cc962cb"),
    category: ProductCategory.FARMACIA,
    species: Species.CAO,
  },
];

const services = [
  {
    id: "5eed0000-0000-4000-8000-000000000201",
    name: "Banho",
    description:
      "Banho com shampoo neutro, secagem, escovação e limpeza de ouvidos.",
    durationMinutes: 60,
    priceSmallInCents: 4500,
    priceMediumInCents: 6000,
    priceLargeInCents: 8000,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000202",
    name: "Tosa Higiênica",
    description:
      "Tosa das regiões íntimas, patas e rosto, com corte de unhas.",
    durationMinutes: 30,
    priceSmallInCents: 3500,
    priceMediumInCents: 4500,
    priceLargeInCents: 5500,
  },
  {
    id: "5eed0000-0000-4000-8000-000000000203",
    name: "Banho e Tosa Completa",
    description:
      "Banho completo seguido de tosa na máquina ou tesoura conforme a raça.",
    durationMinutes: 120,
    priceSmallInCents: 8000,
    priceMediumInCents: 11000,
    priceLargeInCents: 15000,
  },
];

const pets = [
  {
    id: "5eed0000-0000-4000-8000-000000000301",
    name: "Thor",
    species: Species.CAO,
    breed: "Golden Retriever",
    size: PetSize.M,
    birthDate: new Date("2021-05-10"),
    weightKg: 28.5,
    notes: "Muito dócil. Tem medo de secador.",
  },
  {
    id: "5eed0000-0000-4000-8000-000000000302",
    name: "Mia",
    species: Species.GATO,
    breed: "SRD",
    size: PetSize.P,
    birthDate: new Date("2022-09-01"),
    weightKg: 4.2,
    notes: null,
  },
];

/*
 * Pedidos de exemplo. O pagamento segue o mesmo estado
 * que o webhook do Mercado Pago deixaria:
 * - aprovado -> pedido CONFIRMED (depois avançado pelo admin);
 * - recusado -> pedido CANCELLED e estoque devolvido.
 */
const orders: {
  id: string;
  status: OrderStatus;
  createdDaysAgo: number;
  payment: {
    id: string;
    externalReference: string;
    status: PaymentStatus;
    providerStatus: string;
  };
  items: {
    id: string;
    productId: string;
    quantity: number;
  }[];
}[] = [
  {
    id: "5eed0000-0000-4000-8000-000000000401",
    status: OrderStatus.COMPLETED,
    createdDaysAgo: 20,
    payment: {
      id: "5eed0000-0000-4000-8000-000000000501",
      externalReference:
        "payment_5eed0000-0000-4000-8000-000000000501",
      status: PaymentStatus.APPROVED,
      providerStatus: "approved",
    },
    items: [
      {
        id: "5eed0000-0000-4000-8000-000000000601",
        productId: products[0].id,
        quantity: 1,
      },
      {
        id: "5eed0000-0000-4000-8000-000000000602",
        productId: products[2].id,
        quantity: 2,
      },
    ],
  },
  {
    id: "5eed0000-0000-4000-8000-000000000402",
    status: OrderStatus.CANCELLED,
    createdDaysAgo: 10,
    payment: {
      id: "5eed0000-0000-4000-8000-000000000502",
      externalReference:
        "payment_5eed0000-0000-4000-8000-000000000502",
      status: PaymentStatus.REJECTED,
      providerStatus: "rejected",
    },
    items: [
      {
        id: "5eed0000-0000-4000-8000-000000000603",
        productId: products[1].id,
        quantity: 1,
      },
    ],
  },
  {
    id: "5eed0000-0000-4000-8000-000000000403",
    status: OrderStatus.PROCESSING,
    createdDaysAgo: 5,
    payment: {
      id: "5eed0000-0000-4000-8000-000000000503",
      externalReference:
        "payment_5eed0000-0000-4000-8000-000000000503",
      status: PaymentStatus.APPROVED,
      providerStatus: "approved",
    },
    items: [
      {
        id: "5eed0000-0000-4000-8000-000000000604",
        productId: products[4].id,
        quantity: 2,
      },
      {
        id: "5eed0000-0000-4000-8000-000000000605",
        productId: products[6].id,
        quantity: 1,
      },
    ],
  },
  {
    id: "5eed0000-0000-4000-8000-000000000404",
    status: OrderStatus.CONFIRMED,
    createdDaysAgo: 1,
    payment: {
      id: "5eed0000-0000-4000-8000-000000000504",
      externalReference:
        "payment_5eed0000-0000-4000-8000-000000000504",
      status: PaymentStatus.APPROVED,
      providerStatus: "approved",
    },
    items: [
      {
        id: "5eed0000-0000-4000-8000-000000000606",
        productId: products[3].id,
        quantity: 1,
      },
      {
        id: "5eed0000-0000-4000-8000-000000000607",
        productId: products[5].id,
        quantity: 1,
      },
      {
        id: "5eed0000-0000-4000-8000-000000000608",
        productId: products[7].id,
        quantity: 1,
      },
    ],
  },
];

/*
 * Quantidade de cada produto reservada por pedidos não cancelados.
 * O estoque inicial já desconta essas unidades, como se os pedidos
 * tivessem passado pelo checkout.
 */
function reservedQuantity(productId: string): number {
  return orders
    .filter(
      (order) =>
        order.status !== OrderStatus.CANCELLED,
    )
    .flatMap((order) => order.items)
    .filter((item) => item.productId === productId)
    .reduce(
      (total, item) => total + item.quantity,
      0,
    );
}

async function main() {
  const passwordHashes = await Promise.all(
    users.map((user) =>
      bcrypt.hash(user.password, BCRYPT_COST),
    ),
  );

  await prisma.$transaction(
    async (transaction) => {
      const userIds: Record<string, string> = {};

      for (const [index, user] of users.entries()) {
        const savedUser =
          await transaction.user.upsert({
            where: {
              email: user.email,
            },

            /*
             * A senha não é sobrescrita para não desfazer
             * uma troca feita pelo próprio usuário.
             */
            update: {
              role: user.role,
            },

            create: {
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              passwordHash: passwordHashes[index],
            },
          });

        userIds[user.email] = savedUser.id;
      }

      const clientId =
        userIds["cliente@example.com"];

      for (const product of products) {
        const { baseStock, ...catalogData } =
          product;

        /*
         * Estoque e status ativo só são definidos na criação,
         * para não descontar pedidos duas vezes nem desfazer
         * alterações feitas pelo admin.
         */
        await transaction.product.upsert({
          where: {
            id: product.id,
          },

          update: {
            name: catalogData.name,
            description: catalogData.description,
            priceInCents: catalogData.priceInCents,
            imageUrl: catalogData.imageUrl,
            category: catalogData.category,
            species: catalogData.species,
          },

          create: {
            ...catalogData,
            stock:
              baseStock -
              reservedQuantity(product.id),
          },
        });
      }

      for (const service of services) {
        const { id, ...data } = service;

        await transaction.service.upsert({
          where: {
            id,
          },

          update: data,

          create: service,
        });
      }

      for (const pet of pets) {
        const { id, ...data } = pet;

        await transaction.pet.upsert({
          where: {
            id,
          },

          update: data,

          create: {
            ...pet,
            userId: clientId,
          },
        });
      }

      for (const order of orders) {
        const createdAt = daysAgo(
          order.createdDaysAgo,
        );

        const items = order.items.map((item) => {
          const product = products.find(
            (candidate) =>
              candidate.id === item.productId,
          )!;

          return {
            id: item.id,
            productId: product.id,
            productName: product.name,
            imageUrl: product.imageUrl,
            unitPriceInCents: product.priceInCents,
            quantity: item.quantity,
            subtotalInCents:
              item.quantity * product.priceInCents,
          };
        });

        const totalInCents = items.reduce(
          (total, item) =>
            total + item.subtotalInCents,
          0,
        );

        /*
         * Pedidos são histórico: se já existem,
         * nada é alterado.
         */
        await transaction.order.upsert({
          where: {
            id: order.id,
          },

          update: {},

          create: {
            id: order.id,
            userId: clientId,
            status: order.status,
            totalInCents,
            createdAt,

            items: {
              create: items,
            },

            payments: {
              create: {
                id: order.payment.id,
                provider: "MERCADO_PAGO",
                status: order.payment.status,
                amountInCents: totalInCents,
                externalReference:
                  order.payment.externalReference,
                providerStatus:
                  order.payment.providerStatus,
                createdAt,
              },
            },
          },
        });
      }
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,
      maxWait: 5000,
      timeout: 30000,
    },
  );

  const [
    userCount,
    productCount,
    serviceCount,
    petCount,
    orderCount,
    paymentCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.service.count(),
    prisma.pet.count(),
    prisma.order.count(),
    prisma.payment.count(),
  ]);

  console.log("Seed concluído.", {
    users: userCount,
    products: productCount,
    services: serviceCount,
    pets: petCount,
    orders: orderCount,
    payments: paymentCount,
  });
}

main()
  .catch((error) => {
    console.error("Falha ao executar o seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
