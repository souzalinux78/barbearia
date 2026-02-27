import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createProductSchema } from "./products.schemas";

type CreateProductInput = ReturnType<typeof createProductSchema.parse>;

export const createProduct = async (tenantId: string, payload: CreateProductInput) => {
  if (payload.sku) {
    const existing = await prisma.product.findFirst({
      where: {
        tenantId,
        sku: payload.sku
      }
    });
    if (existing) {
      throw new HttpError("SKU ja cadastrado neste tenant.", 409);
    }
  }

  return prisma.product.create({
    data: {
      tenantId,
      name: payload.name,
      sku: payload.sku,
      price: payload.price,
      cost: payload.cost,
      stockQuantity: payload.stockQuantity ?? 0,
      minStock: payload.minStock ?? 0,
      active: payload.active ?? true
    }
  });
};

export const listProducts = (tenantId: string) =>
  prisma.product.findMany({
    where: {
      tenantId
    },
    orderBy: {
      name: "asc"
    }
  });
