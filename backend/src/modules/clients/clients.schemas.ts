import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  birthDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional()
});

export const listClientSchema = z.object({
  search: z.string().optional()
});
