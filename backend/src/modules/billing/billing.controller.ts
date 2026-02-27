import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  cancelSubscription,
  getBillingHistory,
  getBillingStatus,
  handlePixWebhook,
  handleStripeWebhook,
  listPlans,
  subscribeTenant,
  upsertGatewayConfig
} from "./billing.service";
import {
  BillingHistoryQueryInput,
  CancelInput,
  GatewayConfigInput,
  pixWebhookBodySchema,
  PixWebhookInput,
  SubscribeInput
} from "./billing.schemas";

export const listPlansController = asyncHandler(async (_req: Request, res: Response) => {
  const plans = await listPlans();
  res.status(200).json(plans);
});

export const subscribeController = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscribeTenant(req.auth!.tenantId, req.body as SubscribeInput);
  res.status(200).json(result);
});

export const cancelController = asyncHandler(async (req: Request, res: Response) => {
  const result = await cancelSubscription(req.auth!.tenantId, req.body as CancelInput);
  res.status(200).json(result);
});

export const statusController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getBillingStatus(req.auth!.tenantId);
  res.status(200).json(result);
});

export const historyController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getBillingHistory(
    req.auth!.tenantId,
    req.query as unknown as BillingHistoryQueryInput
  );
  res.status(200).json(result);
});

export const upsertGatewayConfigController = asyncHandler(async (req: Request, res: Response) => {
  const result = await upsertGatewayConfig(req.auth!.tenantId, req.body as GatewayConfigInput);
  res.status(200).json(result);
});

export const stripeWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ message: "Header stripe-signature ausente." });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const result = await handleStripeWebhook(rawBody, signature);
  res.status(200).json(result);
});

export const pixWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-pix-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ message: "Header x-pix-signature ausente." });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const payload = pixWebhookBodySchema.parse(JSON.parse(rawBody.toString("utf-8"))) as PixWebhookInput;
  const result = await handlePixWebhook(rawBody, signature, payload);
  res.status(200).json(result);
});
