import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgresql://") ||
        value.startsWith("postgres://") ||
        value.startsWith("prisma://") ||
        value.startsWith("prisma+postgres://"),
      "DATABASE_URL invalida. Use postgres://, postgresql://, prisma:// ou prisma+postgres://."
    ),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  MASTER_JWT_SECRET: z.string().default(""),
  MASTER_JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  MARKETING_EVENT_SALT: z.string().default("marketing_event_salt_change_me"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  DEFAULT_PIX_API_KEY: z.string().default("SANDBOX"),
  DEFAULT_PIX_WEBHOOK_SECRET: z.string().default("pix_webhook_secret_change_me"),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:suporte@barbeariapremium.app")
});

export const env = envSchema.parse(process.env);
