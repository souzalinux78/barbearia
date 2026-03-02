import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { hashPassword } from "../utils/password";

const argsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const parseArgs = () => {
  const args = process.argv.slice(2);
  const emailIndex = args.findIndex((arg) => arg === "--email");
  const passwordIndex = args.findIndex((arg) => arg === "--password");

  const email = emailIndex >= 0 ? args[emailIndex + 1] : "";
  const password = passwordIndex >= 0 ? args[passwordIndex + 1] : "";

  return argsSchema.parse({ email, password });
};

const main = async () => {
  try {
    const input = parseArgs();
    const passwordHash = await hashPassword(input.password);

    const existing = await prisma.saaSAdmin.findUnique({
      where: { email: input.email },
      select: { id: true }
    });

    if (existing) {
      await prisma.saaSAdmin.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: RoleName.SUPER_ADMIN
        }
      });
      // eslint-disable-next-line no-console
      console.log(`SUPER_ADMIN atualizado: ${input.email}`);
      return;
    }

    await prisma.saaSAdmin.create({
      data: {
        email: input.email,
        passwordHash,
        role: RoleName.SUPER_ADMIN
      }
    });

    // eslint-disable-next-line no-console
    console.log(`SUPER_ADMIN criado: ${input.email}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line no-console
      console.error(
        "Uso: npm run master:create-admin -- --email master@dominio.com --password SuaSenhaForte123!"
      );
    } else {
      // eslint-disable-next-line no-console
      console.error("Falha ao criar/atualizar SUPER_ADMIN:", error);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void main();
