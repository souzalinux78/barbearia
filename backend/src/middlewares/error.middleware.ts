import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

type ErrorWithStatus = Error & { statusCode?: number };

export const errorMiddleware = (
  error: ErrorWithStatus,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      message: error.message
    });
    return;
  }

  const status = error.statusCode ?? 500;
  const message = status >= 500 ? "Erro interno do servidor." : error.message;

  res.status(status).json({ message });
};
