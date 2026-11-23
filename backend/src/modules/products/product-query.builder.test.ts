import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { catalogQueries } from "./catalog-queries";
import { ProductQueryBuilder } from "./product-query.builder";
import type { ProductListQuery } from "./product.schemas";

const baseQuery = {
  page: 1,
  pageSize: 20,
} as ProductListQuery;

describe("ProductQueryBuilder (padrão Builder)", () => {
  it("sem filtros: tudo, mais recentes primeiro, 20 por página", () => {
    const args = new ProductQueryBuilder().build();

    assert.deepEqual(args, {
      where: { AND: [] },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    });
  });

  it("ignora passos sem valor", () => {
    const args = new ProductQueryBuilder()
      .active(undefined)
      .search("   ")
      .category(undefined)
      .species(undefined)
      .maxStock(undefined)
      .build();

    assert.deepEqual(args.where, { AND: [] });
  });

  it("busca procura no nome e na descrição, sem diferenciar maiúsculas", () => {
    const args = new ProductQueryBuilder().search(" ração ").build();

    assert.deepEqual(args.where, {
      AND: [
        {
          OR: [
            { name: { contains: "ração", mode: "insensitive" } },
            { description: { contains: "ração", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("espécie inclui produtos sem espécie definida", () => {
    const args = new ProductQueryBuilder().species("GATO").build();

    assert.deepEqual(args.where, {
      AND: [{ OR: [{ species: "GATO" }, { species: null }] }],
    });
  });

  it("estoque máximo aceita zero", () => {
    const args = new ProductQueryBuilder().maxStock(0).build();

    assert.deepEqual(args.where, { AND: [{ stock: { lte: 0 } }] });
  });

  it("paginação calcula skip e take", () => {
    const args = new ProductQueryBuilder().paginate(3, 10).build();

    assert.equal(args.skip, 20);
    assert.equal(args.take, 10);
  });

  it("build não compartilha estado entre chamadas", () => {
    const builder = new ProductQueryBuilder().active(true);
    const first = builder.build();

    builder.search("osso");

    assert.deepEqual(first.where, { AND: [{ active: true }] });
  });
});

describe("catalogQueries (diretor)", () => {
  it("cliente só enxerga produtos ativos", () => {
    const args = catalogQueries.client(baseQuery);

    assert.deepEqual(args.where, { AND: [{ active: true }] });
  });

  it("administrador vê todos quando não filtra o status", () => {
    const args = catalogQueries.admin(baseQuery);

    assert.deepEqual(args.where, { AND: [] });
  });

  it("administrador pode filtrar inativos", () => {
    const args = catalogQueries.admin({ ...baseQuery, active: false });

    assert.deepEqual(args.where, { AND: [{ active: false }] });
  });

  it("cliente não consegue listar inativos pelo filtro", () => {
    const args = catalogQueries.client({ ...baseQuery, active: false });

    assert.deepEqual(args.where, { AND: [{ active: true }] });
  });
});
