import { BillingGateway, PlanName } from "@prisma/client";
import { z } from "zod";

export const subscribeSchema = z.object({
  planName: z.nativeEnum(PlanName)
});

export const cancelSchema = z.object({
  immediate: z.boolean().optional().default(false)
});

export const billingHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const stripeWebhookBodySchema = z.object({
  id: z.string(),
  type: z.string()
});

export const pixWebhookBodySchema = z.object({
  event: z.enum(["pagamento_confirmado", "pagamento_vencido"]),
  externalSubscriptionId: z.string().min(3),
  amount: z.coerce.number().nonnegative().optional(),
  paidAt: z.string().datetime().optional()
});

export const gatewayConfigSchema = z
  .object({
    stripeActive: z.boolean().default(false),
    pixActive: z.boolean().default(false),
    stripeSecretKey: z.string().optional(),
    stripeWebhookSecret: z.string().optional(),
    pixApiKey: z.string().optional(),
    pixWebhookSecret: z.string().optional()
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

const gatewayConfigBaseSchema = z.object({
  stripeActive: z.boolean().default(false),
  pixActive: z.boolean().default(false),
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  pixApiKey: z.string().optional(),
  pixWebhookSecret: z.string().optional(),
  target: z.enum(["TENANT", "GLOBAL"]).default("TENANT")
});

export const gatewayConfigUpsertSchema = gatewayConfigBaseSchema.superRefine((input, context) => {
  if (input.stripeActive && input.pixActive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stripeActive"],
      message: "Apenas um gateway pode estar ativo por vez."
    });
  }
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type BillingHistoryQueryInput = z.infer<typeof billingHistoryQuerySchema>;
export type PixWebhookInput = z.infer<typeof pixWebhookBodySchema>;
export type GatewayConfigInput = z.infer<typeof gatewayConfigUpsertSchema>;

export const isSupportedGateway = (gateway: string): gateway is BillingGateway =>
  gateway === BillingGateway.STRIPE || gateway === BillingGateway.PIX;
