import rateLimit from "express-rate-limit";
import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminLoginController } from "./master-auth.controller";
import { adminLoginSchema } from "./master.schemas";

const masterAuthRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

export const masterAuthRoutes = Router();

masterAuthRoutes.post("/login", masterAuthRateLimit, validate(adminLoginSchema), adminLoginController);

