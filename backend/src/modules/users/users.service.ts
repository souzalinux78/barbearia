import { RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { hashPassword } from "../../utils/password";
import { HttpError } from "../../utils/http-error";
import { createUserSchema, listUsersSchema } from "./users.schemas";

type CreateUserInput = ReturnType<typeof createUserSchema.parse>;
type ListUsersInput = ReturnType<typeof listUsersSchema.parse>;

export const getMyUser = async (userId: string, tenantId: string) =>
  prisma.user.findFirst({
    where: {
      id: userId,
      tenantId
    },
    include: {
      role: true
    }
  });

export const listUsers = async (tenantId: string, query: ListUsersInput) =>
  prisma.user.findMany({
    where: {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      role: true
    },
    orderBy: { createdAt: "desc" }
  });

export const createUser = async (tenantId: string, payload: CreateUserInput) => {
  let role = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId,
        name: payload.role as RoleName
      }
    }
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        tenantId,
        name: payload.role as RoleName
      }
    });
  }

  const existing = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId,
        email: payload.email
      }
    }
  });

  if (existing) {
    throw new HttpError("Email ja cadastrado neste tenant.", 409);
  }

  return prisma.user.create({
    data: {
      tenantId,
      roleId: role.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      passwordHash: await hashPassword(payload.password)
    },
    include: { role: true }
  });
};
