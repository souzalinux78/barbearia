import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { createProduct, listProducts } from "./products.service";

export const createProductController = asyncHandler(async (req: Request, res: Response) => {
  const product = await createProduct(req.auth!.tenantId, req.body);
  res.status(201).json(product);
});

export const listProductsController = asyncHandler(async (req: Request, res: Response) => {
  const products = await listProducts(req.auth!.tenantId);
  res.status(200).json(products);
});
