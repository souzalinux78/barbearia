import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  createPublicBookingAppointment,
  getPublicBookingAvailableSlots,
  getPublicBookingContext
} from "./public-booking.service";
import {
  PublicBookingCreateInput,
  PublicBookingSlotsQueryInput,
  PublicBookingTenantParamsInput
} from "./public-booking.schemas";

export const publicBookingContextController = asyncHandler(async (req: Request, res: Response) => {
  const params = req.params as unknown as PublicBookingTenantParamsInput;
  const result = await getPublicBookingContext(params.tenantSlug);
  res.status(200).json(result);
});

export const publicBookingAvailableSlotsController = asyncHandler(async (req: Request, res: Response) => {
  const params = req.params as unknown as PublicBookingTenantParamsInput;
  const query = req.query as unknown as PublicBookingSlotsQueryInput;
  const result = await getPublicBookingAvailableSlots(params.tenantSlug, query);
  res.status(200).json(result);
});

export const publicBookingCreateController = asyncHandler(async (req: Request, res: Response) => {
  const params = req.params as unknown as PublicBookingTenantParamsInput;
  const body = req.body as PublicBookingCreateInput;
  const result = await createPublicBookingAppointment(params.tenantSlug, body);
  res.status(201).json(result);
});
