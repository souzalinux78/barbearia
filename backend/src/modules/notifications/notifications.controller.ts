import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";
import {
  SendInput,
  SendToTenantInput,
  SendToUserInput,
  SubscribeInput,
  UnsubscribeInput
} from "./notifications.schemas";
import {
  canSendManagementNotification,
  getVapidPublicKey,
  sendToMyDevices,
  sendToTenant,
  sendToUser,
  subscribePush,
  unsubscribePush
} from "./notifications.service";

export const pushSubscribeController = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscribePush(
    req.auth!.tenantId,
    req.auth!.userId,
    req.body as SubscribeInput,
    req.headers.origin
  );
  res.status(201).json(result);
});

export const pushUnsubscribeController = asyncHandler(async (req: Request, res: Response) => {
  const result = await unsubscribePush(
    req.auth!.tenantId,
    req.auth!.userId,
    (req.body as UnsubscribeInput).endpoint
  );
  res.status(200).json(result);
});

export const pushSendController = asyncHandler(async (req: Request, res: Response) => {
  const result = await sendToMyDevices(
    req.auth!.tenantId,
    req.auth!.userId,
    req.body as SendInput
  );
  res.status(200).json(result);
});

export const pushSendToTenantController = asyncHandler(async (req: Request, res: Response) => {
  if (!canSendManagementNotification(req.auth!.role)) {
    throw new HttpError("Sem permissao para envio em massa.", 403);
  }

  const result = await sendToTenant(req.auth!.tenantId, req.body as SendToTenantInput);
  res.status(200).json(result);
});

export const pushSendToUserController = asyncHandler(async (req: Request, res: Response) => {
  if (!canSendManagementNotification(req.auth!.role)) {
    throw new HttpError("Sem permissao para envio direcionado.", 403);
  }

  const result = await sendToUser(req.auth!.tenantId, req.body as SendToUserInput);
  res.status(200).json(result);
});

export const vapidPublicKeyController = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    publicKey: getVapidPublicKey()
  });
});
