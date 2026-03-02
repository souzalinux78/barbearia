import rateLimit from "express-rate-limit";
import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/super-admin.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  masterBillingConfigController,
  masterBillingConfigUpdateController,
  masterChurnController,
  masterFunnelController,
  masterImpersonateController,
  masterMrrController,
  masterPlansController,
  masterPlanUpdateController,
  masterPlatformMetricsController,
  masterRevenueController,
  masterRevenueProjectionController,
  masterSummaryController,
  masterTenantByIdController,
  masterTenantStatusController,
  masterTenantsController
} from "./master.controller";
import {
  masterBillingConfigSchema,
  masterFunnelQuerySchema,
  masterImpersonateSchema,
  masterPlanNameParamSchema,
  masterPlanUpdateSchema,
  masterPeriodQuerySchema,
  masterRevenueQuerySchema,
  masterTenantIdParamSchema,
  masterTenantStatusPatchSchema,
  masterTenantsQuerySchema
} from "./master.schemas";

const masterRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false
});

export const masterRoutes = Router();

masterRoutes.use(masterRateLimit);
masterRoutes.use(requireSuperAdmin);

masterRoutes.get("/summary", masterSummaryController);
masterRoutes.get("/mrr", validate(masterPeriodQuerySchema, "query"), masterMrrController);
masterRoutes.get("/churn", validate(masterPeriodQuerySchema, "query"), masterChurnController);
masterRoutes.get("/funnel", validate(masterFunnelQuerySchema, "query"), masterFunnelController);
masterRoutes.get("/plans", masterPlansController);
masterRoutes.put(
  "/plans/:name",
  validate(masterPlanNameParamSchema, "params"),
  validate(masterPlanUpdateSchema),
  masterPlanUpdateController
);
masterRoutes.get("/billing-config", masterBillingConfigController);
masterRoutes.put(
  "/billing-config",
  validate(masterBillingConfigSchema),
  masterBillingConfigUpdateController
);
masterRoutes.get("/tenants", validate(masterTenantsQuerySchema, "query"), masterTenantsController);
masterRoutes.get(
  "/tenants/:id",
  validate(masterTenantIdParamSchema, "params"),
  masterTenantByIdController
);
masterRoutes.patch(
  "/tenant/:id/status",
  validate(masterTenantIdParamSchema, "params"),
  validate(masterTenantStatusPatchSchema),
  masterTenantStatusController
);
masterRoutes.post(
  "/tenant/:id/impersonate",
  validate(masterTenantIdParamSchema, "params"),
  validate(masterImpersonateSchema),
  masterImpersonateController
);
masterRoutes.get(
  "/platform-metrics",
  validate(masterPeriodQuerySchema, "query"),
  masterPlatformMetricsController
);
masterRoutes.get("/revenue", validate(masterRevenueQuerySchema, "query"), masterRevenueController);
masterRoutes.get("/revenue-projection", masterRevenueProjectionController);
