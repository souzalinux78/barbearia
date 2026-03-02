import { BillingGateway, PlanName } from "@prisma/client";
import { z } from "zod";

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  tenantEmail: z.string().email().optional(),
  tenantPhone: z.string().min(8).optional(),
  tenantCnpj: z.string().min(8).optional(),
  tenantAddress: z.string().min(5).optional(),
  tenantCity: z.string().min(2).optional(),
  tenantState: z.string().min(2).max(2).optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerPhone: z.string().min(8).optional(),
  billing: z
    .object({
      planName: z.nativeEnum(PlanName),
      gateway: z.nativeEnum(BillingGateway).optional()
    })
    .optional()
});

export const loginSchema = z.object({
  tenantSlug: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(30)
});
