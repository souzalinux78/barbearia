import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  automationPreviewController,
  crmChurnRiskController,
  crmClientDetailsController,
  crmClientsController,
  crmLtvController,
  crmOverviewController,
  crmRetentionController,
  crmSegmentsController,
  crmVipController,
  getLoyaltyProgramController,
  redeemLoyaltyController,
  runExpirationController,
  upsertLoyaltyProgramController
} from "./crm.controller";
import {
  automationPreviewSchema,
  crmChurnRiskQuerySchema,
  crmClientIdParamSchema,
  crmClientsQuerySchema,
  crmLtvQuerySchema,
  crmRetentionQuerySchema,
  crmVipQuerySchema,
  loyaltyProgramUpsertSchema,
  loyaltyRedeemSchema
} from "./crm.schemas";

export const crmRoutes = Router();

crmRoutes.get(
  "/clients",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(crmClientsQuerySchema, "query"),
  crmClientsController
);
crmRoutes.get(
  "/client/:id",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(crmClientIdParamSchema, "params"),
  crmClientDetailsController
);
crmRoutes.get(
  "/segments",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  crmSegmentsController
);
crmRoutes.get(
  "/retention",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(crmRetentionQuerySchema, "query"),
  crmRetentionController
);
crmRoutes.get(
  "/ltv",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(crmLtvQuerySchema, "query"),
  crmLtvController
);
crmRoutes.get(
  "/churn-risk",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(crmChurnRiskQuerySchema, "query"),
  crmChurnRiskController
);
crmRoutes.get(
  "/vip",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(crmVipQuerySchema, "query"),
  crmVipController
);
crmRoutes.get(
  "/overview",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  crmOverviewController
);
crmRoutes.get(
  "/loyalty-program",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  getLoyaltyProgramController
);
crmRoutes.put(
  "/loyalty-program",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(loyaltyProgramUpsertSchema),
  upsertLoyaltyProgramController
);
crmRoutes.post(
  "/redeem",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(loyaltyRedeemSchema),
  redeemLoyaltyController
);
crmRoutes.post(
  "/automation/preview",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(automationPreviewSchema),
  automationPreviewController
);
crmRoutes.post(
  "/jobs/expire",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  runExpirationController
);

