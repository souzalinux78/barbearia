import { Router } from "express";
import { RoleName } from "@prisma/client";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createServiceController, listServicesController } from "./services.controller";
import { createServiceSchema, listServicesSchema } from "./services.schemas";

export const servicesRoutes = Router();

servicesRoutes.get("/", validate(listServicesSchema, "query"), listServicesController);
servicesRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN, RoleName.UNIT_OWNER, RoleName.UNIT_ADMIN),
  validate(createServiceSchema),
  createServiceController
);
