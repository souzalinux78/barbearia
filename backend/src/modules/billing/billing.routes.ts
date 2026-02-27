import { RoleName } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  cancelController,
  historyController,
  listPlansController,
  pixWebhookController,
  statusController,
  stripeWebhookController,
  subscribeController,
  upsertGatewayConfigController
} from "./billing.controller";
import {
  billingHistoryQuerySchema,
  cancelSchema,
  gatewayConfigUpsertSchema,
  subscribeSchema
} from "./billing.schemas";

const billingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

export const billingPublicRoutes = Router();
export const billingProtectedRoutes = Router();

billingPublicRoutes.post("/webhook/stripe", webhookRateLimit, stripeWebhookController);
billingPublicRoutes.post("/webhook/pix", webhookRateLimit, pixWebhookController);

billingProtectedRoutes.get("/plans", billingRateLimit, listPlansController);
billingProtectedRoutes.post(
  "/subscribe",
  billingRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(subscribeSchema),
  subscribeController
);
billingProtectedRoutes.post(
  "/cancel",
  billingRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(cancelSchema),
  cancelController
);
billingProtectedRoutes.get("/status", billingRateLimit, statusController);
billingProtectedRoutes.get(
  "/history",
  billingRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(billingHistoryQuerySchema, "query"),
  historyController
);
billingProtectedRoutes.post(
  "/gateway-config",
  billingRateLimit,
  authorize(RoleName.OWNER),
  validate(gatewayConfigUpsertSchema),
  upsertGatewayConfigController
);
