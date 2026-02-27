import { prisma } from "../../config/prisma";
import { createServiceSchema, listServicesSchema } from "./services.schemas";

type CreateServiceInput = ReturnType<typeof createServiceSchema.parse>;
type ListServicesInput = ReturnType<typeof listServicesSchema.parse>;

export const createService = (tenantId: string, payload: CreateServiceInput) =>
  prisma.service.create({
    data: {
      tenantId,
      name: payload.name,
      description: payload.description,
      durationMin: payload.durationMin,
      price: payload.price,
      active: payload.active ?? true
    }
  });

export const listServices = (tenantId: string, query: ListServicesInput) =>
  prisma.service.findMany({
    where: {
      tenantId,
      ...(query.active === undefined ? {} : { active: query.active })
    },
    orderBy: { name: "asc" }
  });
