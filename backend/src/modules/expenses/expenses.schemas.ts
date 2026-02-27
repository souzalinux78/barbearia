import { z } from "zod";

export const createExpenseSchema = z.object({
  category: z.string().min(2),
  description: z.string().max(500).optional(),
  amount: z.coerce.number().positive(),
  paidAt: z.string().datetime().optional()
});
