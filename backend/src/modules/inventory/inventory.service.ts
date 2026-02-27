import { InventoryMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  createInventoryMovementSchema,
  listInventoryMovementSchema
} from "./inventory.schemas";

type CreateInventoryMovementInput = ReturnType<typeof createInventoryMovementSchema.parse>;
type ListInventoryMovementInput = ReturnType<typeof listInventoryMovementSchema.parse>;

const getStockDelta = (type: InventoryMovementType, quantity: number): number => {
  if (type === InventoryMovementType.IN) {
    return quantity;
  }
  if (type === InventoryMovementType.OUT) {
    return -quantity;
  }
  return quantity;
};

export const createInventoryMovement = async (
  tenantId: string,
  userId: string,
  payload: CreateInventoryMovementInput
) =>
  prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: payload.productId,
        tenantId
      }
    });

    if (!product) {
      throw new HttpError("Produto nao encontrado para este tenant.", 404);
    }

    const delta = getStockDelta(payload.type, payload.quantity);
    const nextStock = product.stockQuantity + delta;
    if (nextStock < 0) {
      throw new HttpError("Estoque insuficiente para esta saida.", 400);
    }

    await tx.product.update({
      where: { id: product.id },
      data: {
        stockQuantity: nextStock
      }
    });

    return tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: payload.productId,
        performedById: userId,
        type: payload.type,
        quantity: payload.quantity,
        reason: payload.reason,
        unitCost: payload.unitCost
      },
      include: {
        product: true
      }
    });
  });

export const listInventoryMovements = (tenantId: string, query: ListInventoryMovementInput) =>
  prisma.inventoryMovement.findMany({
    where: {
      tenantId,
      ...(query.productId ? { productId: query.productId } : {})
    },
    include: {
      product: true,
      performedBy: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
