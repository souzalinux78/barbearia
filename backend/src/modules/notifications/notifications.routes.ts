import { RoleName } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  pushSendController,
  pushSendToTenantController,
  pushSendToUserController,
  pushSubscribeController,
  pushUnsubscribeController,
  vapidPublicKeyController
} from "./notifications.controller";
import {
  sendSchema,
  sendToTenantSchema,
  sendToUserSchema,
  subscribeSchema,
  unsubscribeSchema
} from "./notifications.schemas";

const notificationsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false
});

export const notificationsRoutes = Router();

notificationsRoutes.get("/vapid-public-key", notificationsRateLimit, vapidPublicKeyController);
notificationsRoutes.post(
  "/subscribe",
  notificationsRateLimit,
  validate(subscribeSchema),
  pushSubscribeController
);
notificationsRoutes.post(
  "/unsubscribe",
  notificationsRateLimit,
  validate(unsubscribeSchema),
  pushUnsubscribeController
);
notificationsRoutes.post(
  "/send",
  notificationsRateLimit,
  validate(sendSchema),
  pushSendController
);
notificationsRoutes.post(
  "/send-to-tenant",
  notificationsRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(sendToTenantSchema),
  pushSendToTenantController
);
notificationsRoutes.post(
  "/send-to-user",
  notificationsRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(sendToUserSchema),
  pushSendToUserController
);
