import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createService, listServices } from "./services.service";

export const createServiceController = asyncHandler(async (req: Request, res: Response) => {
  const service = await createService(req.auth!.tenantId, req.body);
  res.status(201).json(service);
});

export const listServicesController = asyncHandler(async (req: Request, res: Response) => {
  const services = await listServices(req.auth!.tenantId, req.query);
  res.status(200).json(services);
});
