import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createClient, listClients } from "./clients.service";

export const createClientController = asyncHandler(async (req: Request, res: Response) => {
  const client = await createClient(req.auth!.tenantId, req.body);
  res.status(201).json(client);
});

export const listClientsController = asyncHandler(async (req: Request, res: Response) => {
  const clients = await listClients(req.auth!.tenantId, req.query);
  res.status(200).json(clients);
});
