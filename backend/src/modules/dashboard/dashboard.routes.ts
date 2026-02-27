import { RoleName } from "@prisma/client";
import { Router } from "express";
import { checkPlanLimits } from "../../middlewares/plan-limits.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  dashboardAdvancedMetricsController,
  dashboardBarbersController,
  dashboardClientsController,
  dashboardExportController,
  dashboardOccupancyController,
  dashboardOverviewController,
  dashboardRevenueController,
  dashboardServicesController,
  dashboardSummaryController
} from "./dashboard.controller";
import {
  advancedMetricsQuerySchema,
  dashboardPeriodQuerySchema,
  exportQuerySchema
} from "./dashboard.schemas";

export const dashboardRoutes = Router();

dashboardRoutes.get(
  "/summary",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(dashboardPeriodQuerySchema, "query"),
  dashboardSummaryController
);

dashboardRoutes.get(
  "/revenue",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(dashboardPeriodQuerySchema, "query"),
  dashboardRevenueController
);

dashboardRoutes.get(
  "/clients",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(dashboardPeriodQuerySchema, "query"),
  dashboardClientsController
);

dashboardRoutes.get(
  "/services",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(dashboardPeriodQuerySchema, "query"),
  dashboardServicesController
);

dashboardRoutes.get(
  "/barbers",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(dashboardPeriodQuerySchema, "query"),
  dashboardBarbersController
);

dashboardRoutes.get(
  "/occupancy",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(dashboardPeriodQuerySchema, "query"),
  dashboardOccupancyController
);

dashboardRoutes.get(
  "/advanced-metrics",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  checkPlanLimits({ requiredFeature: "premium_analytics" }),
  validate(advancedMetricsQuerySchema, "query"),
  dashboardAdvancedMetricsController
);

dashboardRoutes.get(
  "/export",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(exportQuerySchema, "query"),
  dashboardExportController
);

dashboardRoutes.get(
  "/overview",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  dashboardOverviewController
);
