import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  AvailableSlotsInput,
  ListAppointmentsByDayInput,
  ListAppointmentsWeekInput,
  NoShowStatsInput,
  OccupancyInput,
  UpcomingInput
} from "./appointments.schemas";
import {
  createAppointment,
  deleteAppointment,
  getAvailableSlots,
  listBarberOptions,
  getDayOccupancy,
  getNoShowStats,
  getUpcomingAppointments,
  listAppointmentsByDay,
  listAppointmentsByWeek,
  updateAppointment,
  updateAppointmentStatus
} from "./appointments.service";

export const createAppointmentController = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await createAppointment(req.auth!.tenantId, req.body);
  res.status(201).json(appointment);
});

export const listAppointmentsByDayController = asyncHandler(async (req: Request, res: Response) => {
  const appointments = await listAppointmentsByDay(
    req.auth!.tenantId,
    req.query as unknown as ListAppointmentsByDayInput
  );
  res.status(200).json(appointments);
});

export const listAppointmentsByWeekController = asyncHandler(async (req: Request, res: Response) => {
  const appointments = await listAppointmentsByWeek(
    req.auth!.tenantId,
    req.query as unknown as ListAppointmentsWeekInput
  );
  res.status(200).json(appointments);
});

export const updateAppointmentController = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await updateAppointment(req.auth!.tenantId, String(req.params.id), req.body, {
    userId: req.auth!.userId,
    role: req.auth!.role
  });
  res.status(200).json(appointment);
});

export const deleteAppointmentController = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await deleteAppointment(req.auth!.tenantId, String(req.params.id), {
    userId: req.auth!.userId,
    role: req.auth!.role
  });
  res.status(200).json(appointment);
});

export const updateAppointmentStatusController = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await updateAppointmentStatus(
    req.auth!.tenantId,
    String(req.params.id),
    req.body,
    {
      userId: req.auth!.userId,
      role: req.auth!.role
    }
  );
  res.status(200).json(appointment);
});

export const availableSlotsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAvailableSlots(req.auth!.tenantId, req.query as unknown as AvailableSlotsInput);
  res.status(200).json(result);
});

export const dayOccupancyController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDayOccupancy(req.auth!.tenantId, req.query as unknown as OccupancyInput);
  res.status(200).json(result);
});

export const upcomingAppointmentsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getUpcomingAppointments(req.auth!.tenantId, req.query as unknown as UpcomingInput);
  res.status(200).json(result);
});

export const noShowStatsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getNoShowStats(req.auth!.tenantId, req.query as unknown as NoShowStatsInput);
  res.status(200).json(result);
});

export const listBarbersController = asyncHandler(async (req: Request, res: Response) => {
  const result = await listBarberOptions(req.auth!.tenantId);
  res.status(200).json(result);
});
