import { RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from "../../utils/jwt";
import { ensureTenantBillingBootstrap } from "../billing/billing.service";
import { loginSchema, refreshSchema, registerTenantSchema } from "./auth.schemas";

type RegisterTenantInput = ReturnType<typeof registerTenantSchema.parse>;
type LoginInput = ReturnType<typeof loginSchema.parse>;
type RefreshInput = ReturnType<typeof refreshSchema.parse>;

const defaultRoles: RoleName[] = ["OWNER", "ADMIN", "BARBER", "RECEPTION"];

const authPayloadFromUser = (user: { id: string; tenantId: string; role: { name: RoleName } }) => ({
  userId: user.id,
  tenantId: user.tenantId,
  role: user.role.name
});

export const registerTenant = async (input: RegisterTenantInput) => {
  const existingSlug = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug }
  });
  if (existingSlug) {
    throw new HttpError("Slug ja esta em uso.", 409);
  }

  const passwordHash = await hashPassword(input.ownerPassword);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.tenantName,
        slug: input.tenantSlug,
        email: input.tenantEmail,
        phone: input.tenantPhone
      }
    });

    await tx.role.createMany({
      data: defaultRoles.map((name) => ({
        tenantId: tenant.id,
        name
      }))
    });

    const ownerRole = await tx.role.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: "OWNER"
        }
      }
    });

    if (!ownerRole) {
      throw new HttpError("Nao foi possivel criar perfil OWNER.", 500);
    }

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        roleId: ownerRole.id,
        name: input.ownerName,
        email: input.ownerEmail,
        phone: input.ownerPhone,
        passwordHash
      },
      include: { role: true }
    });

    return { tenant, owner };
  });

  await ensureTenantBillingBootstrap(result.tenant.id);

  const payload = authPayloadFromUser(result.owner);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: result.owner.id },
    data: { refreshTokenHash: await hashPassword(refreshToken) }
  });

  return {
    tenant: result.tenant,
    user: {
      id: result.owner.id,
      name: result.owner.name,
      email: result.owner.email,
      role: result.owner.role.name
    },
    accessToken,
    refreshToken
  };
};

export const login = async (input: LoginInput) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug }
  });
  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }

  const user = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: input.email
      }
    },
    include: { role: true }
  });

  if (!user || !user.active) {
    throw new HttpError("Credenciais invalidas.", 401);
  }

  const passwordValid = await comparePassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new HttpError("Credenciais invalidas.", 401);
  }

  const payload = authPayloadFromUser(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: await hashPassword(refreshToken) }
  });

  return {
    tenant,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name
    },
    accessToken,
    refreshToken
  };
};

export const refreshSession = async (input: RefreshInput) => {
  const payload = verifyRefreshToken(input.refreshToken);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true }
  });

  if (!user || !user.refreshTokenHash || !user.active) {
    throw new HttpError("Refresh token invalido.", 401);
  }

  if (user.tenantId !== payload.tenantId) {
    throw new HttpError("Tenant invalido no refresh token.", 401);
  }

  const tokenMatches = await comparePassword(input.refreshToken, user.refreshTokenHash);
  if (!tokenMatches) {
    throw new HttpError("Refresh token invalido.", 401);
  }

  const newPayload = authPayloadFromUser(user);
  const accessToken = generateAccessToken(newPayload);
  const refreshToken = generateRefreshToken(newPayload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: await hashPassword(refreshToken) }
  });

  return {
    accessToken,
    refreshToken
  };
};

export const logout = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null }
  });
};
