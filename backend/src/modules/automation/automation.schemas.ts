import { AutomationRuleType, WhatsAppDirection } from "@prisma/client";
import { z } from "zod";

export const automationTypeParamSchema = z.object({
  type: z.nativeEnum(AutomationRuleType)
});

export const updateAutomationRuleSchema = z
  .object({
    active: z.boolean().optional(),
    delayMinutes: z.coerce.number().int().min(0).max(60 * 24).optional(),
    templateMessage: z.string().min(3).max(1000).optional()
  })
  .refine(
    (input) =>
      input.active !== undefined ||
      input.delayMinutes !== undefined ||
      input.templateMessage !== undefined,
    { message: "Informe pelo menos um campo para atualizacao." }
  );

export const listAutomationMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: z.nativeEnum(AutomationRuleType).optional(),
  direction: z.nativeEnum(WhatsAppDirection).optional(),
  clientId: z.string().uuid().optional()
});

export const automationMetricsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(180).default(30)
});

export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
export type ListAutomationMessagesQueryInput = z.infer<typeof listAutomationMessagesQuerySchema>;
export type AutomationMetricsQueryInput = z.infer<typeof automationMetricsQuerySchema>;
