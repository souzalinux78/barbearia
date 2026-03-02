import { RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { comparePassword } from "../../utils/password";
import { generateMasterAccessToken } from "../../utils/master-jwt";
import { AdminLoginInput } from "./master.schemas";

export const adminLogin = async (payload: AdminLoginInput) => {
  const admin = await prisma.saaSAdmin.findUnique({
    where: {
      email: payload.email
    }
  });

  if (!admin) {
    throw new HttpError("Credenciais de admin invalidas.", 401);
  }
  if (admin.role !== RoleName.SUPER_ADMIN) {
    throw new HttpError("Perfil sem permissao master.", 403);
  }

  const passwordValid = await comparePassword(payload.password, admin.passwordHash);
  if (!passwordValid) {
    throw new HttpError("Credenciais de admin invalidas.", 401);
  }

  const accessToken = generateMasterAccessToken({
    adminId: admin.id,
    email: admin.email,
    role: RoleName.SUPER_ADMIN
  });

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role
    },
    accessToken
  };
};
