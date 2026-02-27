import { env } from "./config/env";
import { app } from "./app";
import { prisma } from "./config/prisma";

const bootstrap = async (): Promise<void> => {
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API running on port ${env.PORT}`);
  });
};

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start API:", error);
  await prisma.$disconnect();
  process.exit(1);
});
