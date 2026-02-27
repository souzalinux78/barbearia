import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid()
});

export const createAppointmentSchema = z.object({
  clientId: z.string().uuid().optional(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).optional(),
  date: z.string().date(),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  price: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  reminderSent: z.boolean().optional()
});

export const listAppointmentsByDaySchema = z.object({
  date: z.string().date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const listAppointmentsWeekSchema = z.object({
  startDate: z.string().date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(100)
});

export const updateAppointmentSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  barberId: z.string().uuid().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).optional(),
  date: z.string().date().optional(),
  startTime: z.string().regex(timePattern).optional(),
  endTime: z.string().regex(timePattern).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  price: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  reminderSent: z.boolean().optional()
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  notes: z.string().max(500).optional()
});

export const availableSlotsSchema = z.object({
  date: z.string().date(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  serviceIds: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",") : [])),
  intervalMin: z.coerce.number().int().positive().max(120).default(15)
});

export const occupancySchema = z.object({
  date: z.string().date().optional()
});

export const upcomingSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const noShowStatsSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional()
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type ListAppointmentsByDayInput = z.infer<typeof listAppointmentsByDaySchema>;
export type ListAppointmentsWeekInput = z.infer<typeof listAppointmentsWeekSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type AvailableSlotsInput = z.infer<typeof availableSlotsSchema>;
export type OccupancyInput = z.infer<typeof occupancySchema>;
export type UpcomingInput = z.infer<typeof upcomingSchema>;
export type NoShowStatsInput = z.infer<typeof noShowStatsSchema>;
