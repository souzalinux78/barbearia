import { RoleName } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  whatsappConfigUpsertController,
  whatsappSendController,
  whatsappStatusController,
  whatsappTestController,
  whatsappWebhookController
} from "./whatsapp.controller";
import {
  sendWhatsAppSchema,
  testWhatsAppSchema,
  upsertWhatsAppConfigSchema
} from "./whatsapp.schemas";

const whatsappRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false
});

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
});

export const whatsappPublicRoutes = Router();
export const whatsappProtectedRoutes = Router();

whatsappPublicRoutes.post("/webhook", webhookRateLimit, whatsappWebhookController);

whatsappProtectedRoutes.get("/status", whatsappRateLimit, whatsappStatusController);
whatsappProtectedRoutes.put(
  "/config",
  whatsappRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(upsertWhatsAppConfigSchema),
  whatsappConfigUpsertController
);
whatsappProtectedRoutes.post(
  "/send",
  whatsappRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(sendWhatsAppSchema),
  whatsappSendController
);
whatsappProtectedRoutes.post(
  "/test",
  whatsappRateLimit,
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(testWhatsAppSchema),
  whatsappTestController
);
