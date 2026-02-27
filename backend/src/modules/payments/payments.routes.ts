import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { cashflowController, createPaymentController, listPaymentsController } from "./payments.controller";
import { cashflowQuerySchema, createPaymentSchema } from "./payments.schemas";

export const paymentsRoutes = Router();

paymentsRoutes.get(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  listPaymentsController
);
paymentsRoutes.get(
  "/cashflow",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(cashflowQuerySchema, "query"),
  cashflowController
);
paymentsRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(createPaymentSchema),
  createPaymentController
);
