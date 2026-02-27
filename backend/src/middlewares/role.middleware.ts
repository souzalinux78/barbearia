import { RoleName } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

export const authorize =
  (...allowedRoles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError("Nao autenticado.", 401));
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(new HttpError("Sem permissao para esta acao.", 403));
      return;
    }

    next();
  };
