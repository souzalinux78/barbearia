import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createPayment, getCashflow, listPayments } from "./payments.service";

export const createPaymentController = asyncHandler(async (req: Request, res: Response) => {
  const payment = await createPayment(req.auth!.tenantId, req.body);
  res.status(201).json(payment);
});

export const listPaymentsController = asyncHandler(async (req: Request, res: Response) => {
  const payments = await listPayments(req.auth!.tenantId);
  res.status(200).json(payments);
});

export const cashflowController = asyncHandler(async (req: Request, res: Response) => {
  const report = await getCashflow(req.auth!.tenantId, req.query);
  res.status(200).json(report);
});
