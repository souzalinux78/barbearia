import { PlanName } from "@prisma/client";
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const masterPeriodQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12)
});

export const masterFunnelQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30)
});

export const masterRevenueQuerySchema = z.object({
  period: z.enum(["monthly", "yearly"]).default("monthly")
});

export const masterTenantStatusFilterSchema = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "PAST_DUE",
  "CANCELED",
  "TRIALING"
]);

export const masterTenantsQuerySchema = z.object({
  search: z.string().trim().optional(),
  plan: z.nativeEnum(PlanName).optional(),
  status: masterTenantStatusFilterSchema.optional(),
  state: z.string().trim().min(2).max(2).optional(),
  franchiseId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const masterTenantIdParamSchema = z.object({
  id: z.string().uuid()
});

export const masterPlanNameParamSchema = z.object({
  name: z.nativeEnum(PlanName)
});

export const masterPlanUpdateSchema = z.object({
  price: z.coerce.number().min(0).max(99999),
  maxUsers: z.coerce.number().int().min(1).max(5000),
  maxBarbers: z.coerce.number().int().min(1).max(5000),
  maxAppointmentsMonth: z.coerce.number().int().min(1).max(500000),
  features: z
    .record(z.string().trim().regex(/^[a-z0-9_]{2,40}$/), z.boolean())
    .refine((value) => Object.keys(value).length <= 60, "Muitas features no payload.")
});

export const masterTenantStatusPatchSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().max(300).optional(),
  planId: z.string().uuid().optional()
});

export const masterImpersonateSchema = z.object({
  reason: z.string().trim().max(300).optional()
});

export const masterBillingConfigSchema = z
  .object({
    stripeActive: z.boolean().default(false),
    pixActive: z.boolean().default(false),
    stripeSecretKey: z.string().trim().optional(),
    stripeWebhookSecret: z.string().trim().optional(),
    pixApiKey: z.string().trim().optional(),
    pixWebhookSecret: z.string().trim().optional()
  })
  .superRefine((input, context) => {
    if (input.stripeActive && input.pixActive) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stripeActive"],
        message: "Apenas um gateway pode estar ativo por vez."
      });
    }
  });

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type MasterPeriodQueryInput = z.infer<typeof masterPeriodQuerySchema>;
export type MasterFunnelQueryInput = z.infer<typeof masterFunnelQuerySchema>;
export type MasterRevenueQueryInput = z.infer<typeof masterRevenueQuerySchema>;
export type MasterTenantsQueryInput = z.infer<typeof masterTenantsQuerySchema>;
export type MasterPlanNameParamInput = z.infer<typeof masterPlanNameParamSchema>;
export type MasterPlanUpdateInput = z.infer<typeof masterPlanUpdateSchema>;
export type MasterTenantStatusPatchInput = z.infer<typeof masterTenantStatusPatchSchema>;
export type MasterImpersonateInput = z.infer<typeof masterImpersonateSchema>;
export type MasterBillingConfigInput = z.infer<typeof masterBillingConfigSchema>;
