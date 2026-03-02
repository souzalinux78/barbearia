import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import {
  publicBookingAvailableSlotsController,
  publicBookingContextController,
  publicBookingCreateController
} from "./public-booking.controller";
import {
  publicBookingCreateSchema,
  publicBookingSlotsQuerySchema,
  publicBookingTenantParamsSchema
} from "./public-booking.schemas";

export const publicBookingRoutes = Router();

publicBookingRoutes.get(
  "/:tenantSlug/context",
  validate(publicBookingTenantParamsSchema, "params"),
  publicBookingContextController
);

publicBookingRoutes.get(
  "/:tenantSlug/available-slots",
  validate(publicBookingTenantParamsSchema, "params"),
  validate(publicBookingSlotsQuerySchema, "query"),
  publicBookingAvailableSlotsController
);

publicBookingRoutes.post(
  "/:tenantSlug/appointments",
  validate(publicBookingTenantParamsSchema, "params"),
  validate(publicBookingCreateSchema),
  publicBookingCreateController
);
