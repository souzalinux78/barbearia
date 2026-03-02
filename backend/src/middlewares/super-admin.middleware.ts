import { NextFunction, Request, Response } from "express";
import { RoleName } from "@prisma/client";
import { HttpError } from "../utils/http-error";
import { verifyMasterAccessToken } from "../utils/master-jwt";

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    next(new HttpError("Token admin nao informado.", 401));
    return;
  }

  const token = authorization.split(" ")[1];
  if (!token) {
    next(new HttpError("Token admin invalido.", 401));
    return;
  }

  try {
    const payload = verifyMasterAccessToken(token);
    if (payload.role !== RoleName.SUPER_ADMIN) {
      next(new HttpError("Acesso restrito ao SUPER_ADMIN.", 403));
      return;
    }
    req.masterAuth = payload;
    next();
  } catch {
    next(new HttpError("Token admin expirado ou invalido.", 401));
  }
};

