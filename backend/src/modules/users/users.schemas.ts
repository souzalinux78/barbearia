import { RoleName } from "@prisma/client";
import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8),
  role: z.nativeEnum(RoleName)
});

export const listUsersSchema = z.object({
  search: z.string().optional()
});
