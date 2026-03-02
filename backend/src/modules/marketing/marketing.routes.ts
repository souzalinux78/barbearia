import rateLimit from "express-rate-limit";
import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { ingestMarketingEventController } from "./marketing.controller";
import { marketingEventSchema } from "./marketing.schemas";

const marketingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

export const marketingPublicRoutes = Router();

marketingPublicRoutes.post(
  "/events",
  marketingRateLimit,
  validate(marketingEventSchema),
  ingestMarketingEventController
);

