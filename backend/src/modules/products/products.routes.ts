import { RoleName } from "@prisma/client";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createProductController, listProductsController } from "./products.controller";
import { createProductSchema } from "./products.schemas";

export const productsRoutes = Router();

productsRoutes.get("/", listProductsController);
productsRoutes.post(
  "/",
  authorize(RoleName.OWNER, RoleName.ADMIN),
  validate(createProductSchema),
  createProductController
);
