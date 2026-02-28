import { RoleName } from "@prisma/client";
import { z } from "zod";

const allowedUserRoles = [
  RoleName.FRANCHISE_OWNER,
  RoleName.UNIT_OWNER,
  RoleName.UNIT_ADMIN,
  RoleName.OWNER,
  RoleName.ADMIN,
  RoleName.BARBER,
  RoleName.RECEPTION
] as const;

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8),
  role: z.enum(allowedUserRoles)
});

export const listUsersSchema = z.object({
  search: z.string().optional()
});
