import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { login, logout, refreshSession, registerTenant } from "./auth.service";

export const registerTenantController = asyncHandler(async (req: Request, res: Response) => {
  const data = await registerTenant(req.body);
  res.status(201).json(data);
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const data = await login(req.body);
  res.status(200).json(data);
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const data = await refreshSession(req.body);
  res.status(200).json(data);
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  await logout(req.auth!.userId);
  res.status(204).send();
});
