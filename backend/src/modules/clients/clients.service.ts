import { prisma } from "../../config/prisma";
import { createClientSchema, listClientSchema } from "./clients.schemas";

type CreateClientInput = ReturnType<typeof createClientSchema.parse>;
type ListClientInput = ReturnType<typeof listClientSchema.parse>;

export const createClient = (tenantId: string, payload: CreateClientInput) =>
  prisma.client.create({
    data: {
      tenantId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      birthDate: payload.birthDate ? new Date(payload.birthDate) : undefined,
      notes: payload.notes
    }
  });

export const listClients = (tenantId: string, query: ListClientInput) =>
  prisma.client.findMany({
    where: {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: {
      createdAt: "desc"
    }
  });
