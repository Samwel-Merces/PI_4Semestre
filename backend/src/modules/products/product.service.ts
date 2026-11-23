import { Prisma, Product } from "@prisma/client";

import { prisma } from "../../database/prisma";
import { AppError } from "../../shared/errors/AppError";

import { catalogQueries } from "./catalog-queries";
import {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from "./product.schemas";

interface ProductResponse extends Product {
  available: boolean;
}

interface ProductPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface ProductListResponse {
  data: ProductResponse[];
  pagination: ProductPagination;
}

export class ProductService {
  static #instance: ProductService;

  private constructor() {}

  public static get instance(): ProductService {
    if (!ProductService.#instance) {
      ProductService.#instance =
        new ProductService();
    }

    return ProductService.#instance;
  }

  private formatProduct(
    product: Product,
  ): ProductResponse {
    return {
      ...product,

      available:
        product.active &&
        product.stock > 0,
    };
  }

  async create(
    data: CreateProductInput,
  ): Promise<ProductResponse> {
    const product = await prisma.product.create({
      data: {
        name: data.name.trim(),
        description:
          data.description.trim(),
        priceInCents:
          data.priceInCents,
        stock: data.stock,
        imageUrl: data.imageUrl.trim(),
        category: data.category,
        species: data.species ?? null,
      },
    });

    return this.formatProduct(product);
  }

  async listActive(
    query: ProductListQuery,
  ): Promise<ProductListResponse> {
    const {
      page,
      pageSize,
    } = query;

    const args =
      catalogQueries.client(query);

    const [products, totalItems] =
      await prisma.$transaction([
        prisma.product.findMany(args),

        prisma.product.count({
          where: args.where,
        }),
      ]);

    const totalPages = Math.ceil(
      totalItems / pageSize,
    );

    return {
      data: products.map((product) =>
        this.formatProduct(product),
      ),

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async listAll(
    query: ProductListQuery,
  ): Promise<ProductListResponse> {
    const {
      page,
      pageSize,
    } = query;

    const args =
      catalogQueries.admin(query);

    const [products, totalItems] =
      await prisma.$transaction([
        prisma.product.findMany(args),

        prisma.product.count({
          where: args.where,
        }),
      ]);

    const totalPages = Math.ceil(
      totalItems / pageSize,
    );

    return {
      data: products.map((product) =>
        this.formatProduct(product),
      ),

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async findActiveById(
    productId: string,
  ): Promise<ProductResponse> {
    const product =
      await prisma.product.findFirst({
        where: {
          id: productId,
          active: true,
        },
      });

    if (!product) {
      throw new AppError(
        "Produto não encontrado.",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }

    return this.formatProduct(product);
  }

  async findByIdForAdmin(
    productId: string,
  ): Promise<ProductResponse> {
    const product =
      await prisma.product.findUnique({
        where: {
          id: productId,
        },
      });

    if (!product) {
      throw new AppError(
        "Produto não encontrado.",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }

    return this.formatProduct(product);
  }

  async update(
    productId: string,
    data: UpdateProductInput,
  ): Promise<ProductResponse> {
    await this.findByIdForAdmin(productId);

    const updateData:
      Prisma.ProductUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name =
        data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description =
        data.description.trim();
    }

    if (data.priceInCents !== undefined) {
      updateData.priceInCents =
        data.priceInCents;
    }

    if (data.stock !== undefined) {
      updateData.stock = data.stock;
    }

    if (data.imageUrl !== undefined) {
      updateData.imageUrl =
        data.imageUrl.trim();
    }

    if (data.category !== undefined) {
      updateData.category =
        data.category;
    }

    if (data.species !== undefined) {
      updateData.species =
        data.species;
    }

    if (data.active !== undefined) {
      updateData.active =
        data.active;
    }

    const product =
      await prisma.product.update({
        where: {
          id: productId,
        },

        data: updateData,
      });

    return this.formatProduct(product);
  }

  async updateStatus(
    productId: string,
    active: boolean,
  ): Promise<ProductResponse> {
    await this.findByIdForAdmin(productId);

    const product =
      await prisma.product.update({
        where: {
          id: productId,
        },

        data: {
          active,
        },
      });

    return this.formatProduct(product);
  }

  async remove(
    productId: string,
  ) {
    await this.findByIdForAdmin(productId);

    await prisma.$transaction([
      prisma.cartItem.deleteMany({
        where: {
          productId,
        },
      }),

      prisma.product.delete({
        where: {
          id: productId,
        },
      }),
    ]);

    return {
      message:
        "Produto excluído com sucesso.",
    };
  }
}

export const productService =
  ProductService.instance;
