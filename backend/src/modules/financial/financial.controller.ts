import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  createExpense,
  createManualPayment,
  getCashflow,
  getDre,
  getFinancialMetrics,
  getFinancialSummary,
  listCommissions,
  listExpenses,
  payCommission,
  updateExpense
} from "./financial.service";
import {
  CashflowQueryInput,
  CreateExpenseInput,
  DreQueryInput,
  ListCommissionsQueryInput,
  ListExpensesQueryInput,
  ManualPaymentInput,
  MetricsQueryInput,
  PayCommissionInput,
  UpdateExpenseInput
} from "./financial.schemas";

export const cashflowController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCashflow(req.auth!.tenantId, req.query as unknown as CashflowQueryInput);
  res.status(200).json(result);
});

export const createExpenseController = asyncHandler(async (req: Request, res: Response) => {
  const result = await createExpense(req.auth!.tenantId, req.body as CreateExpenseInput);
  res.status(201).json(result);
});

export const updateExpenseController = asyncHandler(async (req: Request, res: Response) => {
  const result = await updateExpense(
    req.auth!.tenantId,
    String(req.params.id),
    req.body as UpdateExpenseInput
  );
  res.status(200).json(result);
});

export const listExpensesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await listExpenses(req.auth!.tenantId, req.query as unknown as ListExpensesQueryInput);
  res.status(200).json(result);
});

export const listCommissionsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await listCommissions(
    req.auth!.tenantId,
    { role: req.auth!.role, userId: req.auth!.userId },
    req.query as unknown as ListCommissionsQueryInput
  );
  res.status(200).json(result);
});

export const payCommissionController = asyncHandler(async (req: Request, res: Response) => {
  const result = await payCommission(
    req.auth!.tenantId,
    String(req.params.id),
    req.body as PayCommissionInput
  );
  res.status(200).json(result);
});

export const dreController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDre(req.auth!.tenantId, req.query as unknown as DreQueryInput);
  res.status(200).json(result);
});

export const summaryController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFinancialSummary(req.auth!.tenantId);
  res.status(200).json(result);
});

export const metricsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFinancialMetrics(req.auth!.tenantId, req.query as unknown as MetricsQueryInput);
  res.status(200).json(result);
});

export const createManualPaymentController = asyncHandler(async (req: Request, res: Response) => {
  const result = await createManualPayment(req.auth!.tenantId, req.body as ManualPaymentInput);
  res.status(201).json(result);
});
