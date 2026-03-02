import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const csvUuidArraySchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}, z.array(z.string().uuid()));

const emailOrEmptySchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    return value;
  })
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "Email invalido."
  });

export const publicBookingTenantParamsSchema = z.object({
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/)
});

export const publicBookingSlotsQuerySchema = z
  .object({
    date: z.string().date(),
    barberId: z.string().uuid(),
    serviceId: z.string().uuid().optional(),
    serviceIds: csvUuidArraySchema,
    intervalMin: z.coerce.number().int().positive().max(120).default(15)
  })
  .superRefine((input, context) => {
    if (!input.serviceId && input.serviceIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serviceIds"],
        message: "Informe ao menos um servico."
      });
    }
  });

export const publicBookingCreateSchema = z
  .object({
    clientName: z.string().trim().min(2).max(120),
    clientPhone: z.string().trim().min(8).max(30),
    clientEmail: emailOrEmptySchema,
    barberId: z.string().uuid(),
    serviceId: z.string().uuid().optional(),
    serviceIds: z.array(z.string().uuid()).default([]),
    paymentMethod: z.enum(["PIX", "CARD"]).default("CARD"),
    date: z.string().date(),
    startTime: z.string().regex(timePattern),
    notes: z.string().trim().max(500).optional()
  })
  .superRefine((input, context) => {
    const total = input.serviceIds.length + (input.serviceId ? 1 : 0);
    if (total === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serviceIds"],
        message: "Informe ao menos um servico."
      });
    }
  });

export type PublicBookingTenantParamsInput = z.infer<typeof publicBookingTenantParamsSchema>;
export type PublicBookingSlotsQueryInput = z.infer<typeof publicBookingSlotsQuerySchema>;
export type PublicBookingCreateInput = z.infer<typeof publicBookingCreateSchema>;
