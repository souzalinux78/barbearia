import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const createPaymentSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod),
  amount: z.coerce.number().positive(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().max(400).optional()
});

export const cashflowQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional()
});
