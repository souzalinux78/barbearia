import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
  listAppointmentsByDaySchema,
  updateAppointmentStatusSchema
} from "./appointments.schemas";
import {
  createAppointmentController,
  listAppointmentsByDayController,
  updateAppointmentStatusController
} from "./appointments.controller";

export const appointmentsRoutes = Router();

appointmentsRoutes.get("/", validate(listAppointmentsByDaySchema, "query"), listAppointmentsByDayController);
appointmentsRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(createAppointmentSchema),
  createAppointmentController
);
appointmentsRoutes.patch(
  "/:id/status",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER, RoleName.RECEPTION),
  validate(appointmentIdParamSchema, "params"),
  validate(updateAppointmentStatusSchema),
  updateAppointmentStatusController
);
