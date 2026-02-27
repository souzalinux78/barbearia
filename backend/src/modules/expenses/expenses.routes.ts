import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createExpenseController, listExpensesController } from "./expenses.controller";
import { createExpenseSchema } from "./expenses.schemas";

export const expensesRoutes = Router();

expensesRoutes.get("/", authorize(RoleName.OWNER, RoleName.ADMIN), listExpensesController);
expensesRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(createExpenseSchema),
  createExpenseController
);
