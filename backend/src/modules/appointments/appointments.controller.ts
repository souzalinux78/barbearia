import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  createAppointment,
  listAppointmentsByDay,
  updateAppointmentStatus
} from "./appointments.service";

export const createAppointmentController = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await createAppointment(req.auth!.tenantId, req.body);
  res.status(201).json(appointment);
});

export const listAppointmentsByDayController = asyncHandler(
  async (req: Request, res: Response) => {
    const appointments = await listAppointmentsByDay(req.auth!.tenantId, req.query);
    res.status(200).json(appointments);
  }
);

export const updateAppointmentStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const appointment = await updateAppointmentStatus(
      req.auth!.tenantId,
      String(req.params.id),
      req.body
    );
    res.status(200).json(appointment);
  }
);
