import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { cashflowQuerySchema, createPaymentSchema } from "./payments.schemas";

type CreatePaymentInput = ReturnType<typeof createPaymentSchema.parse>;
type CashflowInput = ReturnType<typeof cashflowQuerySchema.parse>;

export const createPayment = async (tenantId: string, payload: CreatePaymentInput) => {
  if (payload.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: payload.appointmentId, tenantId }
    });
    if (!appointment) {
      throw new HttpError("Agendamento nao encontrado para este tenant.", 404);
    }
  }

  return prisma.payment.create({
    data: {
      tenantId,
      appointmentId: payload.appointmentId,
      method: payload.method,
      amount: payload.amount,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
      notes: payload.notes
    }
  });
};

export const getCashflow = async (tenantId: string, query: CashflowInput) => {
  const now = new Date();
  const from = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = query.to ? new Date(query.to) : now;

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        tenantId,
        paidAt: {
          gte: from,
          lte: to
        }
      }
    }),
    prisma.expense.findMany({
      where: {
        tenantId,
        paidAt: {
          gte: from,
          lte: to
        }
      }
    })
  ]);

  const inflow = payments.reduce((acc, payment) => acc + Number(payment.amount), 0);
  const outflow = expenses.reduce((acc, expense) => acc + Number(expense.amount), 0);

  const byMethod = payments.reduce<Record<string, number>>((acc, payment) => {
    acc[payment.method] = (acc[payment.method] ?? 0) + Number(payment.amount);
    return acc;
  }, {});

  return {
    period: { from, to },
    inflow,
    outflow,
    balance: inflow - outflow,
    byMethod
  };
};

export const listPayments = (tenantId: string) =>
  prisma.payment.findMany({
    where: { tenantId },
    orderBy: { paidAt: "desc" },
    take: 100
  });
