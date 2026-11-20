import { ProductQueryBuilder } from "./product-query.builder";
import type { ProductListQuery } from "./product.schemas";

// Diretor do padrão Builder: define as consultas do catálogo.
export const catalogQueries = {
  // Cliente: só produtos ativos.
  client: (query: ProductListQuery) =>
    new ProductQueryBuilder()
      .active(true)
      .search(query.search)
      .category(query.category)
      .species(query.species)
      .maxStock(query.maxStock)
      .paginate(query.page, query.pageSize)
      .build(),

  // Administrador: todos, com filtro opcional por status.
  admin: (query: ProductListQuery) =>
    new ProductQueryBuilder()
      .active(query.active)
      .search(query.search)
      .category(query.category)
      .species(query.species)
      .maxStock(query.maxStock)
      .paginate(query.page, query.pageSize)
      .build(),
};
