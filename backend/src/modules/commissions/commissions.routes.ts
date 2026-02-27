import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createCommissionController, listCommissionsController } from "./commissions.controller";
import { createCommissionSchema } from "./commissions.schemas";

export const commissionsRoutes = Router();

commissionsRoutes.get("/", authorize(RoleName.OWNER, RoleName.ADMIN), listCommissionsController);
commissionsRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(createCommissionSchema),
  createCommissionController
);
