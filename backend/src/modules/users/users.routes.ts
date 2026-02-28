import { Router } from "express";
import { RoleName } from "@prisma/client";
import { authorize } from "../../middlewares/role.middleware";
import { checkPlanLimits } from "../../middlewares/plan-limits.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createUserSchema, listUsersSchema } from "./users.schemas";
import { createUserController, listUsersController, meController } from "./users.controller";

export const usersRoutes = Router();

usersRoutes.get("/me", meController);
usersRoutes.get(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.UNIT_OWNER, RoleName.UNIT_ADMIN, RoleName.FRANCHISE_OWNER),
  validate(listUsersSchema, "query"),
  listUsersController
);
usersRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.UNIT_OWNER, RoleName.UNIT_ADMIN, RoleName.FRANCHISE_OWNER),
  checkPlanLimits({ enforceUsers: true, enforceBarbersByBodyRole: true }),
  validate(createUserSchema),
  createUserController
);
