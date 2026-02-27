import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  loginController,
  logoutController,
  refreshController,
  registerTenantController
} from "./auth.controller";
import { loginSchema, refreshSchema, registerTenantSchema } from "./auth.schemas";

export const authRoutes = Router();

authRoutes.post("/register-tenant", validate(registerTenantSchema), registerTenantController);
authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.post("/refresh", validate(refreshSchema), refreshController);
authRoutes.post("/logout", authMiddleware, logoutController);
