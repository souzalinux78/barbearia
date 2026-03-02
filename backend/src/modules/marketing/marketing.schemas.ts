import { z } from "zod";

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const marketingEventSchema = z
  .object({
    eventName: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9_]+$/i, "eventName invalido."),
    eventPath: z.string().trim().min(1).max(240),
    sessionId: z.string().trim().min(8).max(120),
    tenantId: z.string().uuid().optional(),
    source: z.string().trim().max(80).optional(),
    referrer: z.string().trim().max(500).optional(),
    userAgent: z.string().trim().max(400).optional(),
    metadata: z.record(z.string().min(1).max(60), metadataValueSchema).optional()
  })
  .superRefine((input, context) => {
    if (input.metadata && Object.keys(input.metadata).length > 40) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metadata"],
        message: "metadata excede o limite de campos."
      });
    }
  });

export type MarketingEventInput = z.infer<typeof marketingEventSchema>;

