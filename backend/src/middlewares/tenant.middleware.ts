import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/http-error";

export const tenantMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.auth?.tenantId) {
    next(new HttpError("Tenant nao identificado no token.", 401));
    return;
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: {
        id: req.auth.tenantId
      },
      select: {
        id: true
      }
    });

    if (!tenant) {
      next(new HttpError("Tenant invalido.", 401));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
