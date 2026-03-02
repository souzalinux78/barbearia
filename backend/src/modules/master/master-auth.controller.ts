import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { adminLogin } from "./master-auth.service";
import { AdminLoginInput } from "./master.schemas";

export const adminLoginController = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminLogin(req.body as AdminLoginInput);
  res.status(200).json(result);
});

