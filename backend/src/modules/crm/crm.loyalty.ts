import {
  LoyaltyProgramType,
  LoyaltyTransactionType,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { sendToTenant } from "../notifications/notifications.service";
import {
  calculateCashbackEarned,
  calculatePointsEarned,
  calculateVipIds
} from "./crm.calculations";
import {
  LoyaltyProgramUpsertInput,
  LoyaltyRedeemInput
} from "./crm.schemas";

type DbClient = PrismaClient | Prisma.TransactionClient;

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

let expirationTimer: NodeJS.Timeout | null = null;

const fireAndForget = (promise: Promise<unknown>) => {
  promise.catch(() => null);
};

const defaultProgramCreate = (tenantId: string) => ({
  tenantId,
  active: false,
  type: LoyaltyProgramType.POINTS,
  pointsPerReal: 1,
  cashbackPercentage: 0,
  expirationDays: 90
});

export const getLoyaltyProgram = async (tenantId: string, db: DbClient = prisma) => {
  const program = await db.loyaltyProgram.upsert({
    where: { tenantId },
    create: defaultProgramCreate(tenantId),
    update: {},
    select: {
      id: true,
      tenantId: true,
      active: true,
      type: true,
      pointsPerReal: true,
      cashbackPercentage: true,
      expirationDays: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return {
    ...program,
    pointsPerReal: Number(program.pointsPerReal),
    cashbackPercentage: Number(program.cashbackPercentage)
  };
};

export const upsertLoyaltyProgram = async (
  tenantId: string,
  payload: LoyaltyProgramUpsertInput,
  db: DbClient = prisma
) => {
  const updated = await db.loyaltyProgram.upsert({
    where: { tenantId },
    create: {
      tenantId,
      active: payload.active,
      type: payload.type,
      pointsPerReal: payload.pointsPerReal,
      cashbackPercentage: payload.cashbackPercentage,
      expirationDays: payload.expirationDays
    },
    update: {
      active: payload.active,
      type: payload.type,
      pointsPerReal: payload.pointsPerReal,
      cashbackPercentage: payload.cashbackPercentage,
      expirationDays: payload.expirationDays
    }
  });

  return {
    ...updated,
    pointsPerReal: Number(updated.pointsPerReal),
    cashbackPercentage: Number(updated.cashbackPercentage)
  };
};

export const refreshVipFlags = async (tenantId: string, db: DbClient = prisma) => {
  const clients = await db.client.findMany({
    where: { tenantId },
    select: {
      id: true,
      totalSpent: true
    }
  });

  const vipIds = calculateVipIds(
    clients.map((client) => ({
      clientId: client.id,
      totalSpent: Number(client.totalSpent)
    }))
  );

  await db.client.updateMany({
    where: { tenantId },
    data: {
      vip: false,
      vipBadge: false
    }
  });

  if (vipIds.length > 0) {
    await db.client.updateMany({
      where: {
        tenantId,
        id: { in: vipIds }
      },
      data: {
        vip: true,
        vipBadge: true
      }
    });
  }

  return {
    vipCount: vipIds.length
  };
};

export const applyFinalizationLoyalty = async (
  db: DbClient,
  input: {
    tenantId: string;
    clientId: string;
    appointmentId: string;
    amountPaid: number;
    paidAt: Date;
  }
) => {
  const program = await db.loyaltyProgram.findFirst({
    where: {
      tenantId: input.tenantId
    }
  });

  await db.client.update({
    where: {
      id: input.clientId
    },
    data: {
      totalSpent: {
        increment: input.amountPaid
      },
      visitsCount: {
        increment: 1
      },
      lastVisit: input.paidAt
    }
  });

  if (!program?.active) {
    await refreshVipFlags(input.tenantId, db);
    return {
      applied: false,
      mode: null as "POINTS" | "CASHBACK" | null,
      earnedAmount: 0
    };
  }

  const existing = await db.loyaltyTransaction.findFirst({
    where: {
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      clientId: input.clientId,
      type: LoyaltyTransactionType.EARN
    }
  });

  if (existing) {
    return {
      applied: true,
      mode: program.type,
      earnedAmount: Number(existing.amount)
    };
  }

  if (program.type === LoyaltyProgramType.POINTS) {
    const earnedPoints = calculatePointsEarned(input.amountPaid, Number(program.pointsPerReal));
    if (earnedPoints > 0) {
      await db.client.update({
        where: { id: input.clientId },
        data: {
          loyaltyPoints: {
            increment: earnedPoints
          }
        }
      });

      await db.loyaltyTransaction.create({
        data: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          appointmentId: input.appointmentId,
          type: LoyaltyTransactionType.EARN,
          amount: earnedPoints
        }
      });
    }

    await refreshVipFlags(input.tenantId, db);
    return {
      applied: true,
      mode: "POINTS" as const,
      earnedAmount: earnedPoints
    };
  }

  const earnedCashback = calculateCashbackEarned(input.amountPaid, Number(program.cashbackPercentage));
  if (earnedCashback > 0) {
    await db.client.update({
      where: { id: input.clientId },
      data: {
        cashbackBalance: {
          increment: earnedCashback
        }
      }
    });

    await db.loyaltyTransaction.create({
      data: {
        tenantId: input.tenantId,
        clientId: input.clientId,
        appointmentId: input.appointmentId,
        type: LoyaltyTransactionType.EARN,
        amount: earnedCashback
      }
    });
  }

  await refreshVipFlags(input.tenantId, db);
  return {
    applied: true,
    mode: "CASHBACK" as const,
    earnedAmount: earnedCashback
  };
};

export const applyManualPaymentClientSpend = async (
  db: DbClient,
  input: {
    tenantId: string;
    clientId: string;
    amountPaid: number;
  }
) => {
  await db.client.update({
    where: { id: input.clientId },
    data: {
      totalSpent: {
        increment: input.amountPaid
      }
    }
  });

  await refreshVipFlags(input.tenantId, db);
};

export const redeemLoyaltyBalance = async (
  tenantId: string,
  payload: LoyaltyRedeemInput,
  db: DbClient = prisma
) => {
  const [client, appointment, program] = await Promise.all([
    db.client.findFirst({
      where: {
        tenantId,
        id: payload.clientId
      }
    }),
    payload.appointmentId
      ? db.appointment.findFirst({
          where: {
            tenantId,
            id: payload.appointmentId
          },
          select: {
            id: true,
            clientId: true,
            price: true,
            notes: true
          }
        })
      : Promise.resolve(null),
    db.loyaltyProgram.findFirst({
      where: {
        tenantId
      }
    })
  ]);

  if (!client) {
    throw new HttpError("Cliente nao encontrado para este tenant.", 404);
  }

  if (appointment && appointment.clientId !== payload.clientId) {
    throw new HttpError("Agendamento nao pertence ao cliente informado.", 422);
  }

  const pointsPerReal = Number(program?.pointsPerReal ?? 1);
  const cashbackPercentage = Number(program?.cashbackPercentage ?? 0);
  const isPoints = payload.mode === "POINTS";
  const available = isPoints ? Number(client.loyaltyPoints) : Number(client.cashbackBalance);

  if (payload.amount > available) {
    throw new HttpError("Saldo insuficiente para resgate.", 422);
  }

  const discountApplied = isPoints
    ? Number((payload.amount / Math.max(pointsPerReal, 0.01)).toFixed(2))
    : Number(payload.amount.toFixed(2));

  const updatedClient = await db.client.update({
    where: { id: client.id },
    data: isPoints
      ? {
          loyaltyPoints: {
            decrement: payload.amount
          }
        }
      : {
          cashbackBalance: {
            decrement: payload.amount
          }
        },
    select: {
      id: true,
      loyaltyPoints: true,
      cashbackBalance: true
    }
  });

  await db.loyaltyTransaction.create({
    data: {
      tenantId,
      clientId: client.id,
      appointmentId: appointment?.id,
      type: LoyaltyTransactionType.REDEEM,
      amount: payload.amount
    }
  });

  let appointmentNetPrice: number | null = null;
  if (appointment) {
    const rawCurrentPrice = Number(appointment.price);
    const nextPrice = Math.max(0, Number((rawCurrentPrice - discountApplied).toFixed(2)));
    const updated = await db.appointment.update({
      where: { id: appointment.id },
      data: {
        price: nextPrice,
        notes: `${appointment.notes ? `${appointment.notes}\n` : ""}Desconto fidelidade aplicado: R$ ${discountApplied.toFixed(2)} (${payload.mode}).`
      },
      select: {
        price: true
      }
    });
    appointmentNetPrice = Number(updated.price);
  }

  return {
    clientId: updatedClient.id,
    mode: payload.mode,
    amountRedeemed: Number(payload.amount.toFixed(2)),
    discountApplied,
    pointsPerReal,
    cashbackPercentage,
    appointmentNetPrice,
    balances: {
      loyaltyPoints: Number(updatedClient.loyaltyPoints),
      cashbackBalance: Number(updatedClient.cashbackBalance)
    }
  };
};

export const runLoyaltyExpirationSweep = async () => {
  const now = new Date();
  const programs = await prisma.loyaltyProgram.findMany({
    where: {
      active: true,
      expirationDays: {
        gt: 0
      }
    },
    select: {
      tenantId: true,
      type: true,
      expirationDays: true
    }
  });

  let expiredTransactions = 0;

  for (const program of programs) {
    const cutoff = new Date(now.getTime() - program.expirationDays * 24 * 60 * 60 * 1000);

    const clients = await prisma.client.findMany({
      where: {
        tenantId: program.tenantId,
        lastVisit: {
          lte: cutoff
        },
        ...(program.type === LoyaltyProgramType.POINTS
          ? {
              loyaltyPoints: {
                gt: 0
              }
            }
          : {
              cashbackBalance: {
                gt: 0
              }
            })
      },
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        cashbackBalance: true
      }
    });

    for (const client of clients) {
      const amountToExpire =
        program.type === LoyaltyProgramType.POINTS
          ? Number(client.loyaltyPoints)
          : Number(client.cashbackBalance);
      if (amountToExpire <= 0) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.client.update({
          where: { id: client.id },
          data:
            program.type === LoyaltyProgramType.POINTS
              ? { loyaltyPoints: 0 }
              : { cashbackBalance: 0 }
        });

        await tx.loyaltyTransaction.create({
          data: {
            tenantId: program.tenantId,
            clientId: client.id,
            type: LoyaltyTransactionType.EXPIRE,
            amount: amountToExpire
          }
        });
      });

      expiredTransactions += 1;
    }

    if (clients.length > 0) {
      fireAndForget(
        sendToTenant(program.tenantId, {
          title: "Saldo fidelidade expirado",
          body: `${clients.length} cliente(s) com saldo expirado automaticamente.`,
          route: "/crm/loyalty"
        })
      );
    }
  }

  return {
    checkedPrograms: programs.length,
    expiredTransactions
  };
};

export const startCrmSchedulers = () => {
  if (expirationTimer) {
    return;
  }
  expirationTimer = setInterval(() => {
    runLoyaltyExpirationSweep().catch(() => null);
  }, SWEEP_INTERVAL_MS);
};

export const stopCrmSchedulers = () => {
  if (!expirationTimer) {
    return;
  }
  clearInterval(expirationTimer);
  expirationTimer = null;
};

