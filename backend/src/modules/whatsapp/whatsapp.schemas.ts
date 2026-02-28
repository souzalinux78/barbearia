import { AutomationRuleType, WhatsAppProvider } from "@prisma/client";
import { z } from "zod";

export const upsertWhatsAppConfigSchema = z.object({
  provider: z.nativeEnum(WhatsAppProvider),
  apiUrl: z.string().url(),
  apiKey: z.string().min(8),
  phoneNumber: z.string().min(8).max(25),
  active: z.boolean().default(true)
});

export const sendWhatsAppSchema = z.object({
  clientId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  appointmentId: z.string().uuid().optional(),
  automationType: z.nativeEnum(AutomationRuleType).optional(),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24).default(0)
});

export const testWhatsAppSchema = z.object({
  clientId: z.string().uuid().optional(),
  phoneNumber: z.string().min(8).max(25).optional(),
  message: z.string().min(1).max(500).default("Teste de conexao WhatsApp - Barbearia Premium")
});

export const webhookPayloadSchema = z.object({
  tenantId: z.string().uuid().optional(),
  phoneNumber: z.string().min(8).max(25).optional(),
  to: z.string().min(8).max(25).optional(),
  from: z.string().min(8).max(25).optional(),
  clientPhone: z.string().min(8).max(25).optional(),
  event: z.enum(["message_received", "status_update"]).default("message_received"),
  message: z.string().max(1000).optional(),
  messageId: z.string().optional(),
  status: z.enum(["queued", "sent", "delivered", "failed", "received"]).optional(),
  metadata: z.record(z.any()).optional()
});

export type UpsertWhatsAppConfigInput = z.infer<typeof upsertWhatsAppConfigSchema>;
export type SendWhatsAppInput = z.infer<typeof sendWhatsAppSchema>;
export type TestWhatsAppInput = z.infer<typeof testWhatsAppSchema>;
export type WhatsAppWebhookInput = z.infer<typeof webhookPayloadSchema>;
