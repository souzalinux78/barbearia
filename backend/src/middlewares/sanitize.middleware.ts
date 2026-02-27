import { NextFunction, Request, Response } from "express";

const sanitize = (input: unknown): unknown => {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === "string") {
    return input.replace(/[<>]/g, "").trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitize);
  }

  if (input && typeof input === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (key.startsWith("$")) {
        continue;
      }
      output[key] = sanitize(value);
    }
    return output;
  }

  return input;
};

export const sanitizeMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  req.body = sanitize(req.body);
  req.query = sanitize(req.query) as Request["query"];
  req.params = sanitize(req.params) as Request["params"];
  next();
};
