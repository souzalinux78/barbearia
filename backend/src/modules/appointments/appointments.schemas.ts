import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

export const createAppointmentSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  notes: z.string().max(400).optional(),
  status: z.nativeEnum(AppointmentStatus).optional()
});

export const listAppointmentsByDaySchema = z.object({
  date: z.string().date().optional()
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus)
});

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid()
});
