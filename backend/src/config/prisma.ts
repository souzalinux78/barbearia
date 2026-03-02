import { PrismaClient } from "@prisma/client";

// Defensive guard: some environments (PM2/global OS vars) set PRISMA_CLIENT_ENGINE_TYPE=client,
// which forces Accelerate/Data Proxy mode and breaks direct postgresql:// DATABASE_URL.
if (process.env.PRISMA_CLIENT_ENGINE_TYPE === "client") {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
});
