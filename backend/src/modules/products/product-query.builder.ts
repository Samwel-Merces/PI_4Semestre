import type { Prisma } from "@prisma/client";

// Padrão Builder: monta passo a passo os argumentos do findMany de produtos.
// Cada passo é opcional e só acrescenta a condição quando recebe um valor.
export class ProductQueryBuilder {
  private readonly conditions: Prisma.ProductWhereInput[] =
    [];

  private orderBy: Prisma.ProductOrderByWithRelationInput =
    { createdAt: "desc" };

  private take = 20;
  private skip = 0;

  active(active?: boolean): this {
    if (active !== undefined) {
      this.conditions.push({ active });
    }

    return this;
  }

  search(term?: string): this {
    const text = term?.trim();

    if (text) {
      this.conditions.push({
        OR: [
          {
            name: {
              contains: text,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: text,
              mode: "insensitive",
            },
          },
        ],
      });
    }

    return this;
  }

  category(
    category?: Prisma.ProductWhereInput["category"],
  ): this {
    if (category) {
      this.conditions.push({ category });
    }

    return this;
  }

  // Produtos sem espécie definida servem para qualquer animal.
  species(
    species?: Prisma.ProductWhereInput["species"],
  ): this {
    if (species) {
      this.conditions.push({
        OR: [{ species }, { species: null }],
      });
    }

    return this;
  }

  maxStock(maxStock?: number): this {
    if (maxStock !== undefined) {
      this.conditions.push({
        stock: { lte: maxStock },
      });
    }

    return this;
  }

  sortBy(
    field: "name" | "priceInCents" | "createdAt",
    direction: Prisma.SortOrder = "asc",
  ): this {
    this.orderBy = { [field]: direction };

    return this;
  }

  paginate(page: number, pageSize: number): this {
    this.take = pageSize;
    this.skip = (page - 1) * pageSize;

    return this;
  }

  build(): {
    where: Prisma.ProductWhereInput;
    orderBy: Prisma.ProductOrderByWithRelationInput;
    skip: number;
    take: number;
  } {
    return {
      where: { AND: [...this.conditions] },
      orderBy: this.orderBy,
      skip: this.skip,
      take: this.take,
    };
  }
}
