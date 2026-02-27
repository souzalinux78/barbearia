import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createClientController, listClientsController } from "./clients.controller";
import { createClientSchema, listClientSchema } from "./clients.schemas";

export const clientsRoutes = Router();

clientsRoutes.get("/", validate(listClientSchema, "query"), listClientsController);
clientsRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.RECEPTION),
  validate(createClientSchema),
  createClientController
);
