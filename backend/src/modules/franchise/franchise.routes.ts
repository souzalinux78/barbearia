import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  franchiseGenerateRoyaltiesController,
  franchisePerformanceController,
  franchiseRevenueController,
  franchiseRoyaltiesController,
  franchiseSummaryController,
  franchiseUnitsController
} from "./franchise.controller";
import {
  franchiseQuerySchema,
  monthlyRoyaltyGenerateSchema,
  performanceQuerySchema,
  royaltiesQuerySchema
} from "./franchise.schemas";

export const franchiseRoutes = Router();

const franchiseReadRoles = [
  RoleName.SUPER_ADMIN,
  RoleName.FRANCHISE_OWNER,
  RoleName.UNIT_OWNER,
  RoleName.UNIT_ADMIN,
  RoleName.OWNER,
  RoleName.ADMIN
] as const;

franchiseRoutes.get(
  "/summary",
  authorize(...franchiseReadRoles),
  validate(franchiseQuerySchema, "query"),
  franchiseSummaryController
);
franchiseRoutes.get(
  "/revenue",
  authorize(...franchiseReadRoles),
  validate(franchiseQuerySchema, "query"),
  franchiseRevenueController
);
franchiseRoutes.get(
  "/units",
  authorize(...franchiseReadRoles),
  validate(franchiseQuerySchema, "query"),
  franchiseUnitsController
);
franchiseRoutes.get(
  "/royalties",
  authorize(...franchiseReadRoles),
  validate(royaltiesQuerySchema, "query"),
  franchiseRoyaltiesController
);
franchiseRoutes.get(
  "/performance",
  authorize(...franchiseReadRoles),
  validate(performanceQuerySchema, "query"),
  franchisePerformanceController
);
franchiseRoutes.post(
  "/royalties/generate",
  authorize(RoleName.SUPER_ADMIN, RoleName.FRANCHISE_OWNER, RoleName.OWNER),
  validate(monthlyRoyaltyGenerateSchema),
  franchiseGenerateRoyaltiesController
);

