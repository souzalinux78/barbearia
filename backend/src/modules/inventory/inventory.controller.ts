import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createInventoryMovement, listInventoryMovements } from "./inventory.service";

export const createInventoryMovementController = asyncHandler(
  async (req: Request, res: Response) => {
    const movement = await createInventoryMovement(req.auth!.tenantId, req.auth!.userId, req.body);
    res.status(201).json(movement);
  }
);

export const listInventoryMovementController = asyncHandler(
  async (req: Request, res: Response) => {
    const movements = await listInventoryMovements(req.auth!.tenantId, req.query);
    res.status(200).json(movements);
  }
);
