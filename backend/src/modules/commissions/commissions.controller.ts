import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createCommission, listCommissions } from "./commissions.service";

export const createCommissionController = asyncHandler(async (req: Request, res: Response) => {
  const commission = await createCommission(req.auth!.tenantId, req.body);
  res.status(201).json(commission);
});

export const listCommissionsController = asyncHandler(async (req: Request, res: Response) => {
  const commissions = await listCommissions(req.auth!.tenantId);
  res.status(200).json(commissions);
});
