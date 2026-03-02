import { z } from "zod";
import { parseTimeToMinutes } from "../appointments/appointments.rules";
import { isValidPixKey, normalizePixKey } from "../../utils/pix";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const updateTenantSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().min(8).max(30).optional().or(z.literal("")),
    logoUrl: z.string().trim().url().optional().or(z.literal("")),
    servicePixKey: z.string().trim().optional().or(z.literal("")),
    bookingEnabled: z.boolean().optional(),
    bookingStartTime: z.string().regex(timePattern).optional(),
    bookingEndTime: z.string().regex(timePattern).optional(),
    bookingWorkingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional()
  })
  .superRefine((input, ctx) => {
    const start = input.bookingStartTime;
    const end = input.bookingEndTime;
    if (start && end && parseTimeToMinutes(end) <= parseTimeToMinutes(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookingEndTime"],
        message: "Horario final deve ser maior que o inicial."
      });
    }

    if (input.servicePixKey && input.servicePixKey.trim().length > 0) {
      const normalized = normalizePixKey(input.servicePixKey);
      if (!isValidPixKey(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["servicePixKey"],
          message: "Chave PIX de recebimento invalida."
        });
      }
    }
  });

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
