import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createUser, getMyUser, listUsers } from "./users.service";

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const user = await getMyUser(req.auth!.userId, req.auth!.tenantId);
  res.status(200).json(user);
});

export const listUsersController = asyncHandler(async (req: Request, res: Response) => {
  const users = await listUsers(req.auth!.tenantId, req.query);
  res.status(200).json(users);
});

export const createUserController = asyncHandler(async (req: Request, res: Response) => {
  const user = await createUser(req.auth!.tenantId, req.body);
  res.status(201).json(user);
});
