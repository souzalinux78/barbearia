import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { HttpError } from "../utils/http-error";

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    next(new HttpError("Token nao informado.", 401));
    return;
  }

  const token = authorization.split(" ")[1];
  if (!token) {
    next(new HttpError("Token invalido.", 401));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    next();
  } catch {
    next(new HttpError("Token expirado ou invalido.", 401));
  }
};
