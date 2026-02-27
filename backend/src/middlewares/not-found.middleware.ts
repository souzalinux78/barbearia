import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(`Rota ${req.method} ${req.originalUrl} nao encontrada.`, 404));
};
