import { Router } from "express";
import { dashboardOverviewController } from "./dashboard.controller";

export const dashboardRoutes = Router();

dashboardRoutes.get("/overview", dashboardOverviewController);
