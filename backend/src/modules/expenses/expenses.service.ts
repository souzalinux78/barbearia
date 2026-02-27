import { prisma } from "../../config/prisma";
import { createExpenseSchema } from "./expenses.schemas";

type CreateExpenseInput = ReturnType<typeof createExpenseSchema.parse>;

export const createExpense = (tenantId: string, payload: CreateExpenseInput) =>
  prisma.expense.create({
    data: {
      tenantId,
      category: payload.category,
      description: payload.description,
      amount: payload.amount,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date()
    }
  });

export const listExpenses = (tenantId: string) =>
  prisma.expense.findMany({
    where: {
      tenantId
    },
    orderBy: {
      paidAt: "desc"
    },
    take: 100
  });
