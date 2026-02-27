import { InventoryMovementType } from "@prisma/client";
import { z } from "zod";

export const createInventoryMovementSchema = z.object({
  productId: z.string().uuid(),
  type: z.nativeEnum(InventoryMovementType),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().max(300).optional(),
  unitCost: z.coerce.number().nonnegative().optional()
});

export const listInventoryMovementSchema = z.object({
  productId: z.string().uuid().optional()
});
