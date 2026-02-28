import { RoleName } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  automationMessagesController,
  automationMetricsController,
  automationRuleUpdateController,
  automationRulesController,
  automationRunSweepController
} from "./automation.controller";
import {
  automationMetricsQuerySchema,
  automationTypeParamSchema,
  listAutomationMessagesQuerySchema,
  updateAutomationRuleSchema
} from "./automation.schemas";

const automationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

export const automationRoutes = Router();

automationRoutes.get(
  "/rules",
  automationRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  automationRulesController
);
automationRoutes.patch(
  "/rules/:type",
  automationRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(automationTypeParamSchema, "params"),
  validate(updateAutomationRuleSchema),
  automationRuleUpdateController
);
automationRoutes.get(
  "/messages",
  automationRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION, RoleName.BARBER),
  validate(listAutomationMessagesQuerySchema, "query"),
  automationMessagesController
);
automationRoutes.get(
  "/metrics",
  automationRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(automationMetricsQuerySchema, "query"),
  automationMetricsController
);
automationRoutes.post(
  "/run-sweep",
  automationRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  automationRunSweepController
);
