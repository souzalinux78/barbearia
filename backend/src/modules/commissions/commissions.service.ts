import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createCommissionSchema } from "./commissions.schemas";

type CreateCommissionInput = ReturnType<typeof createCommissionSchema.parse>;

export const createCommission = async (tenantId: string, payload: CreateCommissionInput) => {
  const user = await prisma.user.findFirst({
    where: { id: payload.userId, tenantId }
  });

  if (!user) {
    throw new HttpError("Profissional nao encontrado para este tenant.", 404);
  }

  if (payload.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: payload.appointmentId, tenantId }
    });
    if (!appointment) {
      throw new HttpError("Agendamento nao encontrado para este tenant.", 404);
    }
  }

  return prisma.commission.create({
    data: {
      tenantId,
      userId: payload.userId,
      appointmentId: payload.appointmentId,
      amount: payload.amount,
      paid: payload.paid ?? false
    }
  });
};

export const listCommissions = (tenantId: string) =>
  prisma.commission.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
