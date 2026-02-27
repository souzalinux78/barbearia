import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(400).optional(),
  durationMin: z.coerce.number().int().min(5),
  price: z.coerce.number().positive(),
  active: z.boolean().optional()
});

export const listServicesSchema = z.object({
  active: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === "true";
    })
});
