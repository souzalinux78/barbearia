import { z } from "zod";

export const createCommissionSchema = z.object({
  userId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  paid: z.boolean().optional()
});
