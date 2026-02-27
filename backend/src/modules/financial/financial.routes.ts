import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  cashflowController,
  createExpenseController,
  createManualPaymentController,
  dreController,
  listCommissionsController,
  listExpensesController,
  metricsController,
  payCommissionController,
  summaryController,
  updateExpenseController
} from "./financial.controller";
import {
  cashflowQuerySchema,
  commissionIdParamSchema,
  createExpenseSchema,
  createManualPaymentSchema,
  dreQuerySchema,
  expenseIdParamSchema,
  listCommissionsQuerySchema,
  listExpensesQuerySchema,
  metricsQuerySchema,
  payCommissionSchema,
  updateExpenseSchema
} from "./financial.schemas";

export const financialRoutes = Router();

financialRoutes.get(
  "/cashflow",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(cashflowQuerySchema, "query"),
  cashflowController
);
financialRoutes.post(
  "/expense",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(createExpenseSchema),
  createExpenseController
);
financialRoutes.patch(
  "/expense/:id",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(expenseIdParamSchema, "params"),
  validate(updateExpenseSchema),
  updateExpenseController
);
financialRoutes.get(
  "/expenses",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(listExpensesQuerySchema, "query"),
  listExpensesController
);
financialRoutes.get(
  "/commissions",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(listCommissionsQuerySchema, "query"),
  listCommissionsController
);
financialRoutes.patch(
  "/commissions/:id/pay",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(commissionIdParamSchema, "params"),
  validate(payCommissionSchema),
  payCommissionController
);
financialRoutes.get(
  "/dre",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(dreQuerySchema, "query"),
  dreController
);
financialRoutes.get(
  "/summary",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  summaryController
);
financialRoutes.get(
  "/metrics",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(metricsQuerySchema, "query"),
  metricsController
);
financialRoutes.post(
  "/payment",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(createManualPaymentSchema),
  createManualPaymentController
);
