import { LoyaltyProgramType } from "@prisma/client";
import { z } from "zod";

export const crmClientIdParamSchema = z.object({
  id: z.string().uuid()
});

export const crmClientsQuerySchema = z.object({
  search: z.string().trim().optional(),
  segment: z
    .enum([
      "NO_RETURN_30",
      "VIP",
      "NO_SHOW",
      "HIGH_TICKET",
      "INACTIVE",
      "NEW",
      "FREQUENT"
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const crmRetentionQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(15).max(365).default(60)
});

export const crmLtvQuerySchema = z.object({
  top: z.coerce.number().int().positive().max(100).default(20)
});

export const crmChurnRiskQuerySchema = z.object({
  minDaysWithoutVisit: z.coerce.number().int().min(15).max(365).default(30),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const crmVipQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const loyaltyProgramUpsertSchema = z.object({
  active: z.boolean(),
  type: z.nativeEnum(LoyaltyProgramType),
  pointsPerReal: z.coerce.number().positive().max(100).default(1),
  cashbackPercentage: z.coerce.number().min(0).max(100).default(0),
  expirationDays: z.coerce.number().int().min(1).max(720).default(90)
});

export const loyaltyRedeemSchema = z.object({
  clientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  mode: z.enum(["POINTS", "CASHBACK"]),
  amount: z.coerce.number().positive()
});

export const automationPreviewSchema = z.object({
  campaign: z.enum(["INACTIVE_CLIENTS", "EXPIRING_POINTS", "VIP_OFFER"]),
  limit: z.coerce.number().int().positive().max(500).default(50)
});

export type CrmClientsQueryInput = z.infer<typeof crmClientsQuerySchema>;
export type CrmRetentionQueryInput = z.infer<typeof crmRetentionQuerySchema>;
export type CrmLtvQueryInput = z.infer<typeof crmLtvQuerySchema>;
export type CrmChurnRiskQueryInput = z.infer<typeof crmChurnRiskQuerySchema>;
export type CrmVipQueryInput = z.infer<typeof crmVipQuerySchema>;
export type LoyaltyProgramUpsertInput = z.infer<typeof loyaltyProgramUpsertSchema>;
export type LoyaltyRedeemInput = z.infer<typeof loyaltyRedeemSchema>;
export type AutomationPreviewInput = z.infer<typeof automationPreviewSchema>;

