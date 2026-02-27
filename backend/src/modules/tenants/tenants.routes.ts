import { Router } from "express";
import { getTenantController } from "./tenants.controller";

export const tenantsRoutes = Router();

tenantsRoutes.get("/me", getTenantController);
