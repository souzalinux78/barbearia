import { z } from "zod";

const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10)
  })
});

export const subscribeSchema = z.object({
  subscription: webPushSubscriptionSchema
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url().startsWith("https://")
});

const messageSchema = z.object({
  title: z.string().min(2).max(80),
  body: z.string().min(2).max(240),
  route: z.string().min(1).max(200).startsWith("/").default("/dashboard"),
  icon: z.string().optional()
});

export const sendSchema = messageSchema;

export const sendToTenantSchema = messageSchema.extend({
  tenantId: z.string().uuid().optional()
});

export const sendToUserSchema = messageSchema.extend({
  userId: z.string().uuid()
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
export type SendInput = z.infer<typeof sendSchema>;
export type SendToTenantInput = z.infer<typeof sendToTenantSchema>;
export type SendToUserInput = z.infer<typeof sendToUserSchema>;
