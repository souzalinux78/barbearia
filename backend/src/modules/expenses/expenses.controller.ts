import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createExpense, listExpenses } from "./expenses.service";

export const createExpenseController = asyncHandler(async (req: Request, res: Response) => {
  const expense = await createExpense(req.auth!.tenantId, req.body);
  res.status(201).json(expense);
});

export const listExpensesController = asyncHandler(async (req: Request, res: Response) => {
  const expenses = await listExpenses(req.auth!.tenantId);
  res.status(200).json(expenses);
});
