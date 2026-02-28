import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  handleWhatsAppWebhook,
  getWhatsAppStatus,
  sendWhatsAppMessage,
  sendWhatsAppTest,
  upsertWhatsAppConfig
} from "./whatsapp.service";
import {
  SendWhatsAppInput,
  TestWhatsAppInput,
  UpsertWhatsAppConfigInput,
  webhookPayloadSchema
} from "./whatsapp.schemas";

export const whatsappStatusController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getWhatsAppStatus(req.auth!.tenantId);
  res.status(200).json(result);
});

export const whatsappConfigUpsertController = asyncHandler(async (req: Request, res: Response) => {
  const result = await upsertWhatsAppConfig(req.auth!.tenantId, req.body as UpsertWhatsAppConfigInput);
  res.status(200).json(result);
});

export const whatsappSendController = asyncHandler(async (req: Request, res: Response) => {
  const result = await sendWhatsAppMessage(req.auth!.tenantId, req.body as SendWhatsAppInput);
  res.status(200).json(result);
});

export const whatsappTestController = asyncHandler(async (req: Request, res: Response) => {
  const result = await sendWhatsAppTest(req.auth!.tenantId, req.body as TestWhatsAppInput);
  res.status(200).json(result);
});

export const whatsappWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-whatsapp-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ message: "Header x-whatsapp-signature ausente." });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const parsedPayload = webhookPayloadSchema.parse(JSON.parse(rawBody.toString("utf-8")));
  const result = await handleWhatsAppWebhook(rawBody, signature, parsedPayload);
  res.status(200).json(result);
});
