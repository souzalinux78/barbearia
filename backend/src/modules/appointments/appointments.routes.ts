import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  appointmentIdParamSchema,
  availableSlotsSchema,
  createAppointmentSchema,
  listAppointmentsByDaySchema,
  listAppointmentsWeekSchema,
  noShowStatsSchema,
  occupancySchema,
  upcomingSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema
} from "./appointments.schemas";
import {
  availableSlotsController,
  createAppointmentController,
  dayOccupancyController,
  deleteAppointmentController,
  listAppointmentsByDayController,
  listBarbersController,
  listAppointmentsByWeekController,
  noShowStatsController,
  upcomingAppointmentsController,
  updateAppointmentController,
  updateAppointmentStatusController
} from "./appointments.controller";

export const appointmentsRoutes = Router();

appointmentsRoutes.get("/", validate(listAppointmentsByDaySchema, "query"), listAppointmentsByDayController);
appointmentsRoutes.get("/week", validate(listAppointmentsWeekSchema, "query"), listAppointmentsByWeekController);
appointmentsRoutes.get(
  "/available-slots",
  validate(availableSlotsSchema, "query"),
  availableSlotsController
);
appointmentsRoutes.get("/barbers", listBarbersController);
appointmentsRoutes.get("/occupancy", validate(occupancySchema, "query"), dayOccupancyController);
appointmentsRoutes.get("/upcoming", validate(upcomingSchema, "query"), upcomingAppointmentsController);
appointmentsRoutes.get("/no-show-stats", validate(noShowStatsSchema, "query"), noShowStatsController);

appointmentsRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION, RoleName.BARBER),
  validate(createAppointmentSchema),
  createAppointmentController
);
appointmentsRoutes.patch(
  "/:id",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION, RoleName.BARBER),
  validate(appointmentIdParamSchema, "params"),
  validate(updateAppointmentSchema),
  updateAppointmentController
);
appointmentsRoutes.delete(
  "/:id",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.BARBER),
  validate(appointmentIdParamSchema, "params"),
  deleteAppointmentController
);
appointmentsRoutes.patch(
  "/:id/status",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION, RoleName.BARBER),
  validate(appointmentIdParamSchema, "params"),
  validate(updateAppointmentStatusSchema),
  updateAppointmentStatusController
);
