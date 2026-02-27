import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { getCurrentTenant } from "./tenants.service";

export const getTenantController = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await getCurrentTenant(req.auth!.tenantId);
  res.status(200).json(tenant);
});
