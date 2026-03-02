import { Router } from "express";
import { RoleName } from "@prisma/client";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { getTenantController, updateTenantSettingsController } from "./tenants.controller";
import { updateTenantSettingsSchema } from "./tenants.schemas";

export const tenantsRoutes = Router();

tenantsRoutes.get("/me", getTenantController);
tenantsRoutes.patch(
  "/me/settings",
  authorize(
    RoleName.OWNER,
    RoleName.ADMIN,
    RoleName.UNIT_OWNER,
    RoleName.UNIT_ADMIN,
    RoleName.FRANCHISE_OWNER
  ),
  validate(updateTenantSettingsSchema),
  updateTenantSettingsController
);
