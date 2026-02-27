import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createInventoryMovementController,
  listInventoryMovementController
} from "./inventory.controller";
import { createInventoryMovementSchema, listInventoryMovementSchema } from "./inventory.schemas";

export const inventoryRoutes = Router();

inventoryRoutes.get(
  "/movements",
  validate(listInventoryMovementSchema, "query"),
  listInventoryMovementController
);
inventoryRoutes.post(
  "/movements",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(createInventoryMovementSchema),
  createInventoryMovementController
);
