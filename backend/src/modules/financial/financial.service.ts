import { PaymentStatus, Prisma, RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  calculateCommissionAmount,
  calculateDre
} from "./financial.calculations";
import {
  CashflowQueryInput,
  CreateExpenseInput,
  DreQueryInput,
  ListCommissionsQueryInput,
  ListExpensesQueryInput,
  ManualPaymentInput,
  MetricsQueryInput,
  PayCommissionInput,
  UpdateExpenseInput
} from "./financial.schemas";

type AuthActor = {
  userId: string;
  role: RoleName;
};

type DateRange = {
  start: Date;
  end: Date;
};

const startOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const resolvePeriod = (query: { start?: string; end?: string; quick?: string }): DateRange => {
  const now = new Date();

  if (query.start && query.end) {
    return {
      start: startOfDay(toDate(query.start)),
      end: endOfDay(toDate(query.end))
    };
  }

  switch (query.quick) {
    case "TODAY":
      return {
        start: startOfDay(now),
        end: endOfDay(now)
      };
    case "7D":
      return {
        start: startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
        end: endOfDay(now)
      };
    case "30D":
      return {
        start: startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)),
        end: endOfDay(now)
      };
    case "MONTH":
    default:
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: endOfDay(now)
      };
  }
};

const paginate = <T>(items: T[], page: number, pageSize: number) => {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      total
    }
  };
};

export const createManualPayment = async (tenantId: string, payload: ManualPaymentInput) => {
  const client = await prisma.client.findFirst({
    where: {
      tenantId,
      id: payload.clientId
    }
  });
  if (!client) {
    throw new HttpError("Cliente nao encontrado para este tenant.", 404);
  }

  if (payload.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        tenantId,
        id: payload.appointmentId
      }
    });
    if (!appointment) {
      throw new HttpError("Agendamento nao encontrado para este tenant.", 404);
    }
  }

  return prisma.payment.create({
    data: {
      tenantId,
      appointmentId: payload.appointmentId,
      clientId: payload.clientId,
      method: payload.method,
      status: payload.status,
      amount: payload.amount,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
      notes: payload.notes
    }
  });
};

export const getCashflow = async (tenantId: string, query: CashflowQueryInput) => {
  const period = resolvePeriod(query);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PAGO,
        paidAt: {
          gte: period.start,
          lte: period.end
        }
      },
      include: {
        client: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        paidAt: "desc"
      }
    }),
    prisma.expense.findMany({
      where: {
        tenantId,
        paid: true,
        paidAt: {
          gte: period.start,
          lte: period.end
        }
      },
      orderBy: {
        paidAt: "desc"
      }
    })
  ]);

  const inflow = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outflow = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const byMethod = payments.reduce<Record<string, number>>((acc, payment) => {
    acc[payment.method] = (acc[payment.method] ?? 0) + Number(payment.amount);
    return acc;
  }, {});

  const entries = [
    ...payments.map((payment) => ({
      id: payment.id,
      type: "ENTRADA" as const,
      source: "PAYMENT" as const,
      amount: Number(payment.amount),
      date: payment.paidAt,
      description: payment.notes ?? `Pagamento de ${payment.client?.name ?? "cliente sem cadastro"}`,
      method: payment.method
    })),
    ...expenses.map((expense) => ({
      id: expense.id,
      type: "SAIDA" as const,
      source: "EXPENSE" as const,
      amount: Number(expense.amount),
      date: expense.paidAt ?? expense.createdAt,
      description: expense.description,
      method: null
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const paged = paginate(entries, query.page, query.pageSize);

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString()
    },
    inflow,
    outflow,
    balance: inflow - outflow,
    byMethod,
    ...paged
  };
};

export const createExpense = async (tenantId: string, payload: CreateExpenseInput) => {
  return prisma.expense.create({
    data: {
      tenantId,
      description: payload.description,
      category: payload.category,
      amount: payload.amount,
      type: payload.type,
      dueDate: toDate(payload.dueDate),
      paid: payload.paid ?? false,
      paidAt: payload.paid ? payload.paidAt ? new Date(payload.paidAt) : new Date() : null
    }
  });
};

export const updateExpense = async (
  tenantId: string,
  expenseId: string,
  payload: UpdateExpenseInput
) => {
  const expense = await prisma.expense.findFirst({
    where: {
      tenantId,
      id: expenseId
    }
  });
  if (!expense) {
    throw new HttpError("Despesa nao encontrada.", 404);
  }

  return prisma.expense.update({
    where: { id: expenseId },
    data: {
      description: payload.description,
      category: payload.category,
      amount: payload.amount,
      type: payload.type,
      dueDate: payload.dueDate ? toDate(payload.dueDate) : undefined,
      paid: payload.paid,
      paidAt:
        payload.paid === undefined
          ? payload.paidAt
            ? new Date(payload.paidAt)
            : undefined
          : payload.paid
            ? payload.paidAt
              ? new Date(payload.paidAt)
              : new Date()
            : null
    }
  });
};

export const listExpenses = async (tenantId: string, query: ListExpensesQueryInput) => {
  const period = resolvePeriod(query);
  const where: Prisma.ExpenseWhereInput = {
    tenantId,
    ...(query.paid === undefined ? {} : { paid: query.paid }),
    ...(query.type ? { type: query.type } : {}),
    dueDate: {
      gte: period.start,
      lte: period.end
    }
  };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ paid: "asc" }, { dueDate: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.expense.count({ where })
  ]);

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const listCommissions = async (
  tenantId: string,
  actor: AuthActor,
  query: ListCommissionsQueryInput
) => {
  const period = resolvePeriod(query);
  const where: Prisma.CommissionWhereInput = {
    tenantId,
    createdAt: {
      gte: period.start,
      lte: period.end
    },
    ...(actor.role === RoleName.BARBER ? { barberId: actor.userId } : {})
  };

  const [items, total] = await Promise.all([
    prisma.commission.findMany({
      where,
      include: {
        barber: {
          select: {
            id: true,
            name: true
          }
        },
        appointment: {
          select: {
            id: true,
            date: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.commission.count({ where })
  ]);

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const payCommission = async (
  tenantId: string,
  commissionId: string,
  payload: PayCommissionInput
) => {
  const commission = await prisma.commission.findFirst({
    where: {
      tenantId,
      id: commissionId
    },
    include: {
      appointment: {
        select: {
          price: true
        }
      }
    }
  });
  if (!commission) {
    throw new HttpError("Comissao nao encontrada.", 404);
  }

  const percentage = payload.percentage ?? Number(commission.percentage);
  const amountFromPercentage = commission.appointment
    ? calculateCommissionAmount(Number(commission.appointment.price), percentage)
    : Number(commission.amount);
  const amount = payload.amount ?? amountFromPercentage;

  return prisma.commission.update({
    where: {
      id: commissionId
    },
    data: {
      paid: payload.paid,
      percentage,
      amount
    }
  });
};

export const getDre = async (tenantId: string, query: DreQueryInput) => {
  const period = {
    start: startOfDay(toDate(query.start)),
    end: endOfDay(toDate(query.end))
  };

  const [revenueAgg, expenseAgg, commissionAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        tenantId,
        status: PaymentStatus.PAGO,
        paidAt: {
          gte: period.start,
          lte: period.end
        }
      }
    }),
    prisma.expense.aggregate({
      _sum: {
        amount: true
      },
      where: {
        tenantId,
        paid: true,
        paidAt: {
          gte: period.start,
          lte: period.end
        }
      }
    }),
    prisma.commission.aggregate({
      _sum: {
        amount: true
      },
      where: {
        tenantId,
        createdAt: {
          gte: period.start,
          lte: period.end
        }
      }
    })
  ]);

  return {
    period: {
      start: period.start.toISOString().slice(0, 10),
      end: period.end.toISOString().slice(0, 10)
    },
    ...calculateDre({
      revenue: Number(revenueAgg._sum.amount ?? 0),
      expenses: Number(expenseAgg._sum.amount ?? 0),
      commissions: Number(commissionAgg._sum.amount ?? 0)
    })
  };
};

export const getFinancialSummary = async (tenantId: string) => {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const [dailyRevenueAgg, monthlyRevenueAgg, monthlyExpenseAgg, monthlyCommissionsAgg, monthlyPayments, revenueByMethod] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          tenantId,
          status: PaymentStatus.PAGO,
          paidAt: { gte: dayStart, lte: dayEnd }
        }
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          tenantId,
          status: PaymentStatus.PAGO,
          paidAt: { gte: monthStart, lte: dayEnd }
        }
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          tenantId,
          paid: true,
          paidAt: { gte: monthStart, lte: dayEnd }
        }
      }),
      prisma.commission.aggregate({
        _sum: { amount: true },
        where: {
          tenantId,
          createdAt: { gte: monthStart, lte: dayEnd }
        }
      }),
      prisma.payment.findMany({
        where: {
          tenantId,
          status: PaymentStatus.PAGO,
          paidAt: { gte: monthStart, lte: dayEnd }
        },
        select: {
          amount: true,
          appointment: {
            select: {
              barber: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: {
          tenantId,
          status: PaymentStatus.PAGO,
          paidAt: { gte: monthStart, lte: dayEnd }
        },
        _sum: {
          amount: true
        }
      })
    ]);

  const faturamentoMes = Number(monthlyRevenueAgg._sum.amount ?? 0);
  const despesasMes = Number(monthlyExpenseAgg._sum.amount ?? 0);
  const comissoesMes = Number(monthlyCommissionsAgg._sum.amount ?? 0);
  const lucroMes = faturamentoMes - despesasMes - comissoesMes;
  const ticketMedio =
    monthlyRevenueAgg._count.id > 0 ? Number((faturamentoMes / monthlyRevenueAgg._count.id).toFixed(2)) : 0;

  const rankingMap = new Map<string, { barberId: string; barberName: string; amount: number }>();
  monthlyPayments.forEach((payment) => {
    const barber = payment.appointment?.barber;
    if (!barber) {
      return;
    }
    const current = rankingMap.get(barber.id) ?? {
      barberId: barber.id,
      barberName: barber.name,
      amount: 0
    };
    current.amount += Number(payment.amount);
    rankingMap.set(barber.id, current);
  });

  const rankingBarbers = Array.from(rankingMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    faturamentoDia: Number(dailyRevenueAgg._sum.amount ?? 0),
    faturamentoMes,
    despesasMes,
    lucroMes,
    ticketMedio,
    receitaPorMetodo: revenueByMethod.map((item) => ({
      method: item.method,
      amount: Number(item._sum.amount ?? 0)
    })),
    rankingBarbers
  };
};

export const getFinancialMetrics = async (tenantId: string, query: MetricsQueryInput) => {
  const period = resolvePeriod(query);
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [periodPayments, currentMonthRevenue, previousMonthRevenue] = await Promise.all([
    prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PAGO,
        paidAt: {
          gte: period.start,
          lte: period.end
        }
      },
      include: {
        appointment: {
          select: {
            barber: {
              select: {
                id: true,
                name: true
              }
            },
            appointmentServices: {
              select: {
                price: true,
                service: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        paidAt: "asc"
      }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        tenantId,
        status: PaymentStatus.PAGO,
        paidAt: { gte: currentMonthStart, lte: now }
      }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        tenantId,
        status: PaymentStatus.PAGO,
        paidAt: { gte: previousMonthStart, lte: previousMonthEnd }
      }
    })
  ]);

  const totalRevenue = periodPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const ticketMedio = periodPayments.length > 0 ? Number((totalRevenue / periodPayments.length).toFixed(2)) : 0;

  const currentMonth = Number(currentMonthRevenue._sum.amount ?? 0);
  const previousMonth = Number(previousMonthRevenue._sum.amount ?? 0);
  const growthPercent =
    previousMonth > 0 ? Number((((currentMonth - previousMonth) / previousMonth) * 100).toFixed(2)) : 0;

  const revenuePerDayMap = new Map<string, number>();
  const revenueByBarberMap = new Map<string, { barberId: string; barberName: string; amount: number }>();
  const revenueByServiceMap = new Map<string, { serviceId: string; serviceName: string; amount: number }>();

  periodPayments.forEach((payment) => {
    const day = payment.paidAt.toISOString().slice(0, 10);
    revenuePerDayMap.set(day, (revenuePerDayMap.get(day) ?? 0) + Number(payment.amount));

    const barber = payment.appointment?.barber;
    if (barber) {
      const current = revenueByBarberMap.get(barber.id) ?? {
        barberId: barber.id,
        barberName: barber.name,
        amount: 0
      };
      current.amount += Number(payment.amount);
      revenueByBarberMap.set(barber.id, current);
    }

    payment.appointment?.appointmentServices.forEach((row) => {
      const current = revenueByServiceMap.get(row.service.id) ?? {
        serviceId: row.service.id,
        serviceName: row.service.name,
        amount: 0
      };
      current.amount += Number(row.price);
      revenueByServiceMap.set(row.service.id, current);
    });
  });

  return {
    period: {
      start: period.start.toISOString().slice(0, 10),
      end: period.end.toISOString().slice(0, 10)
    },
    ticketMedio,
    crescimentoMesAnterior: growthPercent,
    receitaPorDia: Array.from(revenuePerDayMap.entries()).map(([date, amount]) => ({ date, amount })),
    receitaPorBarbeiro: Array.from(revenueByBarberMap.values()).sort((a, b) => b.amount - a.amount),
    receitaPorServico: Array.from(revenueByServiceMap.values()).sort((a, b) => b.amount - a.amount)
  };
};
