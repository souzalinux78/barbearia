import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { getCurrentTenant, updateTenantSettings } from "./tenants.service";
import { UpdateTenantSettingsInput } from "./tenants.schemas";

export const getTenantController = asyncHandler(async (req: Request, res: Response) => {
  const tenant = await getCurrentTenant(req.auth!.tenantId);
  res.status(200).json(tenant);
});

export const updateTenantSettingsController = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body as UpdateTenantSettingsInput;
  const tenant = await updateTenantSettings(req.auth!.tenantId, payload);
  res.status(200).json(tenant);
});
