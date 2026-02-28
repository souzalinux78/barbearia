import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { sanitizeMiddleware } from "./middlewares/sanitize.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";

export const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(","),
    credentials: true
  })
);

app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use("/api/v1/billing/webhook/stripe", express.raw({ type: "application/json", limit: "1mb" }));
app.use("/api/v1/billing/webhook/pix", express.raw({ type: "application/json", limit: "1mb" }));
app.use("/api/v1/whatsapp/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(sanitizeMiddleware);

app.use("/api/v1", apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
