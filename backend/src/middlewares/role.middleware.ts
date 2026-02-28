import { RoleName } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

const roleAliases: Partial<Record<RoleName, RoleName[]>> = {
  OWNER: [RoleName.UNIT_OWNER],
  ADMIN: [RoleName.UNIT_ADMIN],
  UNIT_OWNER: [RoleName.OWNER],
  UNIT_ADMIN: [RoleName.ADMIN]
};

const expandRoleSet = (roles: RoleName[]): Set<RoleName> => {
  const expanded = new Set<RoleName>();
  roles.forEach((role) => {
    expanded.add(role);
    (roleAliases[role] ?? []).forEach((alias) => expanded.add(alias));
  });
  return expanded;
};

export const authorize =
  (...allowedRoles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError("Nao autenticado.", 401));
      return;
    }

    if (req.auth.role === RoleName.SUPER_ADMIN) {
      next();
      return;
    }

    const allowed = expandRoleSet(allowedRoles);
    const currentRoleVariants = expandRoleSet([req.auth.role]);
    const canAccess = [...currentRoleVariants].some((role) => allowed.has(role));

    if (!canAccess) {
      next(new HttpError("Sem permissao para esta acao.", 403));
      return;
    }

    next();
  };
