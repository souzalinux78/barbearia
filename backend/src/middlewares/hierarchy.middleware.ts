import { RoleName } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/http-error";

const normalizeRole = (role: RoleName): RoleName => {
  if (role === RoleName.OWNER) {
    return RoleName.UNIT_OWNER;
  }
  if (role === RoleName.ADMIN) {
    return RoleName.UNIT_ADMIN;
  }
  return role;
};

export const hierarchyMiddleware = async (
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
        id: true,
        unitId: true,
        unit: {
          select: {
            active: true,
            franchiseId: true
          }
        }
      }
    });

    if (!tenant) {
      next(new HttpError("Tenant invalido.", 401));
      return;
    }

    if (!tenant.unit.active) {
      next(new HttpError("Unidade desativada.", 403));
      return;
    }

    req.hierarchy = {
      tenantId: tenant.id,
      unitId: tenant.unitId,
      franchiseId: tenant.unit.franchiseId,
      role: req.auth.role,
      normalizedRole: normalizeRole(req.auth.role)
    };

    next();
  } catch (error) {
    next(error);
  }
};

