import { AppointmentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  createAppointmentSchema,
  listAppointmentsByDaySchema,
  updateAppointmentStatusSchema
} from "./appointments.schemas";

type CreateAppointmentInput = ReturnType<typeof createAppointmentSchema.parse>;
type ListAppointmentsByDayInput = ReturnType<typeof listAppointmentsByDaySchema.parse>;
type UpdateAppointmentStatusInput = ReturnType<typeof updateAppointmentStatusSchema.parse>;

export const createAppointment = async (tenantId: string, payload: CreateAppointmentInput) => {
  const [client, service, barber] = await Promise.all([
    prisma.client.findFirst({ where: { id: payload.clientId, tenantId } }),
    prisma.service.findFirst({ where: { id: payload.serviceId, tenantId } }),
    prisma.user.findFirst({ where: { id: payload.barberId, tenantId } })
  ]);

  if (!client || !service || !barber) {
    throw new HttpError("Cliente, servico ou barbeiro invalidos para este tenant.", 400);
  }

  return prisma.appointment.create({
    data: {
      tenantId,
      clientId: payload.clientId,
      serviceId: payload.serviceId,
      barberId: payload.barberId,
      startAt: new Date(payload.startAt),
      endAt: payload.endAt ? new Date(payload.endAt) : undefined,
      notes: payload.notes,
      status: payload.status ?? AppointmentStatus.AGENDADO
    },
    include: {
      client: true,
      service: true,
      barber: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
};

export const listAppointmentsByDay = async (
  tenantId: string,
  query: ListAppointmentsByDayInput
) => {
  const referenceDate = query.date ? new Date(query.date) : new Date();
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  return prisma.appointment.findMany({
    where: {
      tenantId,
      startAt: {
        gte: start,
        lte: end
      }
    },
    include: {
      client: true,
      service: true,
      barber: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      startAt: "asc"
    }
  });
};

export const updateAppointmentStatus = async (
  tenantId: string,
  appointmentId: string,
  payload: UpdateAppointmentStatusInput
) => {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      tenantId
    }
  });

  if (!appointment) {
    throw new HttpError("Agendamento nao encontrado para este tenant.", 404);
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: payload.status
    }
  });
};
