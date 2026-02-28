import {
  BadgeRuleType,
  Goal,
  GoalPeriod,
  GoalType,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RoleName
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { sendToUser } from "../notifications/notifications.service";
import { HttpError } from "../../utils/http-error";
import {
  calculateProgressPercentage,
  calculateRankingScore,
  endOfDay,
  resolvePeriod,
  sortRanking,
  startOfDay
} from "./gamification.calculations";
import {
  CreateChallengeInput,
  CreateGoalInput,
  GamificationBadgesQueryInput,
  GamificationChallengesQueryInput,
  GamificationGoalsQueryInput,
  GamificationProgressQueryInput,
  GamificationRankingQueryInput
} from "./gamification.schemas";

type DbClient = PrismaClient | Prisma.TransactionClient;

type GamificationActor = {
  tenantId: string;
  userId: string;
  role: RoleName;
  unitId: string;
  franchiseId: string | null;
};

type GoalWithProgress = Goal & {
  progress: {
    currentValue: Prisma.Decimal;
    percentage: Prisma.Decimal;
  } | null;
};

type ScopedRanking = {
  scope: "UNIT" | "FRANCHISE";
  tenantIds: string[];
};

type GoalMetricInput = {
  tenantId: string;
  unitId: string | null;
  userId: string | null;
  type: GoalType;
  startDate: Date;
  endDate: Date;
};

const fireNotification = (operation: Promise<unknown>) => {
  operation.catch(() => null);
};

const rankingMemory = new Map<string, number>();

const toNumber = (value: Prisma.Decimal | number | null | undefined): number => Number(value ?? 0);

const mapGoal = (goal: GoalWithProgress) => ({
  id: goal.id,
  tenantId: goal.tenantId,
  unitId: goal.unitId,
  userId: goal.userId,
  type: goal.type,
  period: goal.period,
  targetValue: toNumber(goal.targetValue),
  startDate: goal.startDate.toISOString().slice(0, 10),
  endDate: goal.endDate.toISOString().slice(0, 10),
  createdAt: goal.createdAt.toISOString(),
  progress: {
    currentValue: toNumber(goal.progress?.currentValue),
    percentage: toNumber(goal.progress?.percentage)
  }
});

const getScopeTenantIds = async (
  actor: GamificationActor,
  scope: "UNIT" | "FRANCHISE"
): Promise<string[]> => {
  if (scope === "UNIT") {
    const rows = await prisma.tenant.findMany({
      where: {
        unitId: actor.unitId
      },
      select: {
        id: true
      }
    });
    return rows.map((row) => row.id);
  }

  if (!actor.franchiseId) {
    return [actor.tenantId];
  }

  const rows = await prisma.tenant.findMany({
    where: {
      unit: {
        franchiseId: actor.franchiseId
      }
    },
    select: {
      id: true
    }
  });
  return rows.map((row) => row.id);
};

const resolveScopedRanking = async (actor: GamificationActor): Promise<{
  unit: ScopedRanking;
  franchise: ScopedRanking | null;
}> => {
  const unitTenantIds = await getScopeTenantIds(actor, "UNIT");
  if (!actor.franchiseId) {
    return {
      unit: {
        scope: "UNIT",
        tenantIds: unitTenantIds
      },
      franchise: null
    };
  }

  const franchiseTenantIds = await getScopeTenantIds(actor, "FRANCHISE");
  return {
    unit: {
      scope: "UNIT",
      tenantIds: unitTenantIds
    },
    franchise: {
      scope: "FRANCHISE",
      tenantIds: franchiseTenantIds
    }
  };
};

const assertCanCreate = (actor: GamificationActor) => {
  const allowed = new Set<RoleName>([
    RoleName.OWNER,
    RoleName.UNIT_OWNER,
    RoleName.ADMIN,
    RoleName.UNIT_ADMIN,
    RoleName.SUPER_ADMIN
  ]);
  if (!allowed.has(actor.role)) {
    throw new HttpError("Sem permissao para criar metas e desafios.", 403);
  }
};

const buildGoalWhere = (
  actor: GamificationActor,
  query: GamificationGoalsQueryInput
): Prisma.GoalWhereInput => {
  const where: Prisma.GoalWhereInput = {
    tenantId: actor.tenantId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.periodType ? { period: query.periodType } : {})
  };

  if (query.start && query.end) {
    where.AND = [
      {
        startDate: {
          lte: new Date(`${query.end}T00:00:00.000Z`)
        }
      },
      {
        endDate: {
          gte: new Date(`${query.start}T00:00:00.000Z`)
        }
      }
    ];
  }

  if (actor.role === RoleName.BARBER) {
    where.userId = actor.userId;
  }

  return where;
};

const getGoalMetricValue = async (tx: DbClient, input: GoalMetricInput): Promise<number> => {
  const periodStart = startOfDay(input.startDate);
  const periodEnd = endOfDay(input.endDate);
  const appointmentWhere: Prisma.AppointmentWhereInput = {
    tenantId: input.tenantId,
    status: "FINALIZADO",
    date: {
      gte: periodStart,
      lte: periodEnd
    },
    ...(input.userId ? { barberId: input.userId } : {})
  };
  const paymentWhere: Prisma.PaymentWhereInput = {
    tenantId: input.tenantId,
    status: PaymentStatus.PAGO,
    paidAt: {
      gte: periodStart,
      lte: periodEnd
    },
    ...(input.userId
      ? {
          appointment: {
            barberId: input.userId
          }
        }
      : {})
  };

  if (input.type === GoalType.APPOINTMENTS) {
    return tx.appointment.count({
      where: appointmentWhere
    });
  }

  if (input.type === GoalType.SERVICES) {
    const count = await tx.appointmentService.count({
      where: {
        tenantId: input.tenantId,
        appointment: appointmentWhere
      }
    });
    return count;
  }

  if (input.type === GoalType.REVENUE) {
    const aggregate = await tx.payment.aggregate({
      where: paymentWhere,
      _sum: {
        amount: true
      }
    });
    return toNumber(aggregate._sum.amount);
  }

  if (input.type === GoalType.TICKET_AVG) {
    const [sum, count] = await Promise.all([
      tx.payment.aggregate({
        where: paymentWhere,
        _sum: {
          amount: true
        }
      }),
      tx.payment.count({
        where: paymentWhere
      })
    ]);
    const total = toNumber(sum._sum.amount);
    return count > 0 ? Number((total / count).toFixed(2)) : 0;
  }

  const rows = await tx.$queryRaw<Array<{ upsell_count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS upsell_count
    FROM (
      SELECT a.id
      FROM appointments a
      INNER JOIN appointment_services aps ON aps.appointment_id = a.id
      WHERE a.tenant_id = ${input.tenantId}::uuid
        AND a.status = 'FINALIZADO'::"AppointmentStatus"
        AND a.date BETWEEN ${periodStart} AND ${periodEnd}
        ${input.userId ? Prisma.sql`AND a.barber_id = ${input.userId}::uuid` : Prisma.empty}
      GROUP BY a.id
      HAVING COUNT(aps.id) >= 2
    ) q
  `);

  return Number(rows[0]?.upsell_count ?? 0n);
};

const awardPoints = async (
  tx: DbClient,
  input: {
    tenantId: string;
    userId: string;
    points: number;
    reason: string;
    referenceId?: string | null;
  }
) => {
  const existing = await tx.gamificationPoint.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      reason: input.reason,
      referenceId: input.referenceId ?? null
    },
    select: {
      id: true
    }
  });
  if (existing) {
    return false;
  }

  await tx.gamificationPoint.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      points: input.points,
      reason: input.reason,
      referenceId: input.referenceId ?? undefined
    }
  });
  return true;
};

const syncSingleGoalProgress = async (
  tx: DbClient,
  goal: Goal,
  options?: {
    notifyOnReached?: boolean;
  }
) => {
  const metricValue = await getGoalMetricValue(tx, {
    tenantId: goal.tenantId,
    unitId: goal.unitId,
    userId: goal.userId,
    type: goal.type,
    startDate: goal.startDate,
    endDate: goal.endDate
  });
  const percentage = calculateProgressPercentage(metricValue, toNumber(goal.targetValue));
  const existing = await tx.goalProgress.findUnique({
    where: {
      goalId: goal.id
    },
    select: {
      percentage: true
    }
  });

  await tx.goalProgress.upsert({
    where: {
      goalId: goal.id
    },
    create: {
      goalId: goal.id,
      currentValue: metricValue,
      percentage
    },
    update: {
      currentValue: metricValue,
      percentage
    }
  });

  const previousPercentage = toNumber(existing?.percentage);
  const reachedNow = previousPercentage < 100 && percentage >= 100;
  if (reachedNow && goal.userId) {
    if (goal.period === GoalPeriod.DAILY) {
      await awardPoints(tx, {
        tenantId: goal.tenantId,
        userId: goal.userId,
        points: 50,
        reason: "GOAL_DAILY_ACHIEVED",
        referenceId: goal.id
      });
    }

    if (goal.period === GoalPeriod.MONTHLY) {
      await awardPoints(tx, {
        tenantId: goal.tenantId,
        userId: goal.userId,
        points: 100,
        reason: "GOAL_MONTHLY_ACHIEVED",
        referenceId: goal.id
      });
    }
  }

  if (reachedNow && goal.userId && options?.notifyOnReached) {
    fireNotification(
      sendToUser(goal.tenantId, {
        userId: goal.userId,
        title: "Meta atingida",
        body: `Voce concluiu a meta de ${goal.type}.`,
        route: "/performance/goals"
      })
    );
  }

  return {
    currentValue: metricValue,
    percentage,
    reachedNow
  };
};

const evaluateAndGrantBadges = async (
  tx: DbClient,
  input: { tenantId: string; userId: string }
): Promise<string[]> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [badges, existingBadges, finalizedCount, ticketAvg] = await Promise.all([
    tx.badge.findMany({
      where: {
        tenantId: input.tenantId
      }
    }),
    tx.userBadge.findMany({
      where: {
        userId: input.userId,
        badge: {
          tenantId: input.tenantId
        }
      },
      select: {
        badgeId: true
      }
    }),
    tx.appointment.count({
      where: {
        tenantId: input.tenantId,
        barberId: input.userId,
        status: "FINALIZADO"
      }
    }),
    tx.payment.aggregate({
      where: {
        tenantId: input.tenantId,
        status: PaymentStatus.PAGO,
        paidAt: {
          gte: monthStart,
          lte: now
        },
        appointment: {
          barberId: input.userId
        }
      },
      _avg: {
        amount: true
      }
    })
  ]);

  const existingSet = new Set(existingBadges.map((item) => item.badgeId));
  const upsellRows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT a.id
      FROM appointments a
      INNER JOIN appointment_services aps ON aps.appointment_id = a.id
      WHERE a.tenant_id = ${input.tenantId}::uuid
        AND a.barber_id = ${input.userId}::uuid
        AND a.status = 'FINALIZADO'::"AppointmentStatus"
      GROUP BY a.id
      HAVING COUNT(aps.id) >= 2
    ) q
  `);
  const upsellCount = Number(upsellRows[0]?.count ?? 0n);

  const goalRows = await tx.goal.findMany({
    where: {
      tenantId: input.tenantId,
      userId: input.userId,
      period: GoalPeriod.MONTHLY
    },
    include: {
      progress: {
        select: {
          percentage: true
        }
      }
    },
    orderBy: {
      endDate: "desc"
    },
    take: 3
  });
  const metaMasterCount = goalRows.filter((item) => toNumber(item.progress?.percentage) >= 100).length;

  const revenueRows = await tx.$queryRaw<Array<{ barber_id: string; amount: Prisma.Decimal }>>(Prisma.sql`
    SELECT a.barber_id, COALESCE(SUM(a.price), 0) AS amount
    FROM appointments a
    WHERE a.tenant_id = ${input.tenantId}::uuid
      AND a.status = 'FINALIZADO'::"AppointmentStatus"
      AND a.date BETWEEN ${startOfDay(monthStart)} AND ${endOfDay(now)}
    GROUP BY a.barber_id
    ORDER BY amount DESC
  `);
  const isMonthChampion = revenueRows[0]?.barber_id === input.userId;

  const granted: string[] = [];
  for (const badge of badges) {
    if (existingSet.has(badge.id)) {
      continue;
    }

    const threshold = toNumber(badge.ruleValue);
    let achieved = false;
    if (badge.ruleType === BadgeRuleType.META_MASTER) {
      achieved = metaMasterCount >= threshold;
    } else if (badge.ruleType === BadgeRuleType.UPSELL_KING) {
      achieved = upsellCount >= threshold;
    } else if (badge.ruleType === BadgeRuleType.APPOINTMENTS_100) {
      achieved = finalizedCount >= threshold;
    } else if (badge.ruleType === BadgeRuleType.TICKET_HIGH) {
      achieved = toNumber(ticketAvg._avg.amount) >= threshold;
    } else if (badge.ruleType === BadgeRuleType.MONTH_CHAMPION) {
      achieved = isMonthChampion;
    }

    if (!achieved) {
      continue;
    }

    await tx.userBadge.create({
      data: {
        userId: input.userId,
        badgeId: badge.id
      }
    });
    granted.push(badge.name);
  }

  return granted;
};

const evaluateChallengesAndGrantPoints = async (
  tx: DbClient,
  input: { tenantId: string; userId: string; referenceDate: Date }
): Promise<string[]> => {
  const challenges = await tx.challenge.findMany({
    where: {
      tenantId: input.tenantId,
      active: true,
      startDate: {
        lte: input.referenceDate
      },
      endDate: {
        gte: input.referenceDate
      }
    }
  });
  const completed: string[] = [];

  for (const challenge of challenges) {
    const currentValue = await getGoalMetricValue(tx, {
      tenantId: challenge.tenantId,
      unitId: null,
      userId: input.userId,
      type: challenge.targetType,
      startDate: challenge.startDate,
      endDate: challenge.endDate
    });
    if (currentValue < toNumber(challenge.targetValue)) {
      continue;
    }

    const granted = await awardPoints(tx, {
      tenantId: challenge.tenantId,
      userId: input.userId,
      points: challenge.rewardPoints,
      reason: "CHALLENGE_COMPLETED",
      referenceId: `${challenge.id}:${input.userId}`
    });
    if (granted) {
      completed.push(challenge.name);
    }
  }

  return completed;
};

const buildRankingForTenantIds = async (
  tenantIds: string[],
  period: { start: Date; end: Date },
  limit: number
) => {
  if (!tenantIds.length) {
    return [] as Array<{
      userId: string;
      userName: string;
      points: number;
      revenue: number;
      goalsHit: number;
      score: number;
      position: number;
      medal: "GOLD" | "SILVER" | "BRONZE" | "NONE";
    }>;
  }

  const [users, pointsRows, appointmentRows, goalsRows] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId: { in: tenantIds },
        active: true,
        role: {
          name: RoleName.BARBER
        }
      },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.gamificationPoint.groupBy({
      by: ["userId"],
      where: {
        tenantId: {
          in: tenantIds
        },
        createdAt: {
          gte: startOfDay(period.start),
          lte: endOfDay(period.end)
        }
      },
      _sum: {
        points: true
      }
    }),
    prisma.appointment.groupBy({
      by: ["barberId"],
      where: {
        tenantId: {
          in: tenantIds
        },
        status: "FINALIZADO",
        date: {
          gte: startOfDay(period.start),
          lte: endOfDay(period.end)
        }
      },
      _sum: {
        price: true
      }
    }),
    prisma.$queryRaw<Array<{ user_id: string; total: bigint }>>(Prisma.sql`
      SELECT g.user_id, COUNT(*)::bigint AS total
      FROM goals g
      INNER JOIN goal_progress gp ON gp.goal_id = g.id
      WHERE g.tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        AND g.user_id IS NOT NULL
        AND g.end_date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
        AND gp.percentage >= 100
      GROUP BY g.user_id
    `)
  ]);

  const pointsMap = new Map(pointsRows.map((row) => [row.userId, Number(row._sum.points ?? 0)]));
  const revenueMap = new Map(appointmentRows.map((row) => [row.barberId, toNumber(row._sum.price)]));
  const goalsMap = new Map(goalsRows.map((row) => [row.user_id, Number(row.total)]));

  const sorted = sortRanking(
    users.map((user) => ({
      userId: user.id,
      userName: user.name,
      points: pointsMap.get(user.id) ?? 0,
      revenue: revenueMap.get(user.id) ?? 0,
      goalsHit: goalsMap.get(user.id) ?? 0
    }))
  )
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      score: calculateRankingScore(row),
      position: index + 1,
      medal: index === 0 ? "GOLD" : index === 1 ? "SILVER" : index === 2 ? "BRONZE" : "NONE"
    }));

  return sorted;
};

const getChallengeProgressByType = async (
  tenantId: string,
  targetType: GoalType,
  startDate: Date,
  endDate: Date,
  userIds: string[]
) => {
  if (!userIds.length) {
    return new Map<string, number>();
  }

  if (targetType === GoalType.APPOINTMENTS) {
    const rows = await prisma.appointment.groupBy({
      by: ["barberId"],
      where: {
        tenantId,
        status: "FINALIZADO",
        barberId: {
          in: userIds
        },
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate)
        }
      },
      _count: {
        _all: true
      }
    });
    return new Map(rows.map((row) => [row.barberId, row._count._all]));
  }

  if (targetType === GoalType.REVENUE || targetType === GoalType.TICKET_AVG) {
    const rows = await prisma.$queryRaw<
      Array<{ user_id: string; total_amount: Prisma.Decimal; payments_count: bigint }>
    >(Prisma.sql`
      SELECT
        a.barber_id AS user_id,
        COALESCE(SUM(p.amount), 0) AS total_amount,
        COUNT(*)::bigint AS payments_count
      FROM payments p
      INNER JOIN appointments a ON a.id = p.appointment_id
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.status = 'PAGO'::"PaymentStatus"
        AND p.paid_at BETWEEN ${startOfDay(startDate)} AND ${endOfDay(endDate)}
        AND a.barber_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
      GROUP BY a.barber_id
    `);
    return new Map(
      rows.map((row) => [
        row.user_id,
        targetType === GoalType.REVENUE
          ? toNumber(row.total_amount)
          : Number(row.payments_count) > 0
            ? Number((toNumber(row.total_amount) / Number(row.payments_count)).toFixed(2))
            : 0
      ])
    );
  }

  if (targetType === GoalType.SERVICES) {
    const rows = await prisma.$queryRaw<Array<{ user_id: string; total_services: bigint }>>(Prisma.sql`
      SELECT a.barber_id AS user_id, COUNT(aps.id)::bigint AS total_services
      FROM appointment_services aps
      INNER JOIN appointments a ON a.id = aps.appointment_id
      WHERE a.tenant_id = ${tenantId}::uuid
        AND a.status = 'FINALIZADO'::"AppointmentStatus"
        AND a.date BETWEEN ${startOfDay(startDate)} AND ${endOfDay(endDate)}
        AND a.barber_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
      GROUP BY a.barber_id
    `);
    return new Map(rows.map((row) => [row.user_id, Number(row.total_services)]));
  }

  const rows = await prisma.$queryRaw<Array<{ user_id: string; total_upsell: bigint }>>(Prisma.sql`
    SELECT q.user_id, COUNT(*)::bigint AS total_upsell
    FROM (
      SELECT a.id, a.barber_id AS user_id
      FROM appointments a
      INNER JOIN appointment_services aps ON aps.appointment_id = a.id
      WHERE a.tenant_id = ${tenantId}::uuid
        AND a.status = 'FINALIZADO'::"AppointmentStatus"
        AND a.date BETWEEN ${startOfDay(startDate)} AND ${endOfDay(endDate)}
        AND a.barber_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
      GROUP BY a.id, a.barber_id
      HAVING COUNT(aps.id) >= 2
    ) q
    GROUP BY q.user_id
  `);
  return new Map(rows.map((row) => [row.user_id, Number(row.total_upsell)]));
};

const notifyRankingClimbIfNeeded = async (input: {
  tenantId: string;
  unitId: string;
  userId: string;
  franchiseId: string | null;
}) => {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const actor: GamificationActor = {
    tenantId: input.tenantId,
    userId: input.userId,
    unitId: input.unitId,
    franchiseId: input.franchiseId,
    role: RoleName.BARBER
  };
  const { unit } = await resolveScopedRanking(actor);
  const ranking = await buildRankingForTenantIds(
    unit.tenantIds,
    { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now },
    200
  );
  const currentPosition = ranking.findIndex((row) => row.userId === input.userId) + 1;
  if (currentPosition <= 0) {
    return;
  }

  const memoryKey = `${input.tenantId}:${input.userId}:${monthKey}`;
  const previous = rankingMemory.get(memoryKey);
  rankingMemory.set(memoryKey, currentPosition);
  if (previous && currentPosition < previous) {
    fireNotification(
      sendToUser(input.tenantId, {
        userId: input.userId,
        title: "Ranking atualizado",
        body: `Voce subiu para a posicao #${currentPosition}.`,
        route: "/performance/ranking"
      })
    );
  }
};

export const getGamificationGoals = async (
  actor: GamificationActor,
  query: GamificationGoalsQueryInput
) => {
  const where = buildGoalWhere(actor, query);
  const [rows, total] = await Promise.all([
    prisma.goal.findMany({
      where,
      include: {
        progress: {
          select: {
            currentValue: true,
            percentage: true
          }
        }
      },
      orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.goal.count({ where })
  ]);

  const filtered = query.onlyOpen
    ? rows.filter((goal) => toNumber(goal.progress?.percentage) < 100 && goal.endDate >= startOfDay(new Date()))
    : rows;

  return {
    items: filtered.map((goal) => mapGoal(goal)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const getGamificationProgress = async (
  actor: GamificationActor,
  query: GamificationProgressQueryInput
) => {
  const period = resolvePeriod(query);
  const where: Prisma.GoalWhereInput = {
    tenantId: actor.tenantId,
    ...(query.type ? { type: query.type } : {}),
    startDate: {
      lte: period.end
    },
    endDate: {
      gte: period.start
    },
    ...(actor.role === RoleName.BARBER ? { userId: actor.userId } : {})
  };

  const goals = await prisma.goal.findMany({
    where,
    include: {
      progress: {
        select: {
          currentValue: true,
          percentage: true
        }
      }
    },
    orderBy: [{ endDate: "asc" }, { createdAt: "desc" }]
  });

  const totalGoals = goals.length;
  const reachedGoals = goals.filter((goal) => toNumber(goal.progress?.percentage) >= 100).length;
  const averageProgress =
    totalGoals > 0
      ? Number(
          (
            goals.reduce((sum, goal) => sum + toNumber(goal.progress?.percentage), 0) / totalGoals
          ).toFixed(2)
        )
      : 0;

  const pointsAgg = await prisma.gamificationPoint.aggregate({
    where: {
      tenantId: actor.tenantId,
      ...(actor.role === RoleName.BARBER ? { userId: actor.userId } : {}),
      createdAt: {
        gte: period.start,
        lte: period.end
      }
    },
    _sum: {
      points: true
    }
  });

  const { unit } = await resolveScopedRanking(actor);
  const unitRanking = await buildRankingForTenantIds(unit.tenantIds, period, 200);
  const myPosition = unitRanking.find((row) => row.userId === actor.userId)?.position ?? null;

  return {
    period: {
      start: period.start.toISOString().slice(0, 10),
      end: period.end.toISOString().slice(0, 10)
    },
    summary: {
      totalGoals,
      reachedGoals,
      averageProgress,
      points: Number(pointsAgg._sum.points ?? 0),
      myPosition
    },
    goals: goals.map(mapGoal)
  };
};

export const getGamificationRanking = async (
  actor: GamificationActor,
  query: GamificationRankingQueryInput
) => {
  const period = resolvePeriod(query);
  const { unit, franchise } = await resolveScopedRanking(actor);

  const [unitRanking, franchiseRanking] = await Promise.all([
    buildRankingForTenantIds(unit.tenantIds, period, query.limit),
    franchise ? buildRankingForTenantIds(franchise.tenantIds, period, query.limit) : Promise.resolve([])
  ]);

  return {
    period: {
      start: period.start.toISOString().slice(0, 10),
      end: period.end.toISOString().slice(0, 10)
    },
    unitRanking,
    franchiseRanking
  };
};

export const getGamificationBadges = async (
  actor: GamificationActor,
  query: GamificationBadgesQueryInput
) => {
  const targetUserId = query.userId ?? (actor.role === RoleName.BARBER ? actor.userId : undefined);
  if (actor.role === RoleName.BARBER && targetUserId !== actor.userId) {
    throw new HttpError("Barbeiro so pode acessar os proprios badges.", 403);
  }

  const [badges, userBadges] = await Promise.all([
    prisma.badge.findMany({
      where: {
        tenantId: actor.tenantId
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.userBadge.findMany({
      where: {
        ...(targetUserId
          ? { userId: targetUserId }
          : {
              user: {
                tenantId: actor.tenantId
              }
            }),
        badge: {
          tenantId: actor.tenantId
        }
      },
      include: {
        badge: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        achievedAt: "desc"
      }
    })
  ]);

  return {
    catalog: badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      ruleType: badge.ruleType,
      ruleValue: toNumber(badge.ruleValue),
      createdAt: badge.createdAt.toISOString()
    })),
    earned: userBadges.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: item.user.name,
      badgeId: item.badgeId,
      badgeName: item.badge.name,
      badgeIcon: item.badge.icon,
      achievedAt: item.achievedAt.toISOString()
    }))
  };
};

export const getGamificationChallenges = async (
  actor: GamificationActor,
  query: GamificationChallengesQueryInput
) => {
  const period = resolvePeriod(query);
  const challenges = await prisma.challenge.findMany({
    where: {
      tenantId: actor.tenantId,
      ...(query.activeOnly ? { active: true } : {}),
      startDate: {
        lte: period.end
      },
      endDate: {
        gte: period.start
      }
    },
    orderBy: [{ active: "desc" }, { endDate: "asc" }]
  });

  const participants = await prisma.user.findMany({
    where: {
      tenantId: actor.tenantId,
      active: true,
      role: {
        name: RoleName.BARBER
      },
      ...(actor.role === RoleName.BARBER ? { id: actor.userId } : {})
    },
    select: {
      id: true,
      name: true
    }
  });
  const participantIds = participants.map((item) => item.id);

  const items = [];
  for (const challenge of challenges) {
    const valueMap = await getChallengeProgressByType(
      actor.tenantId,
      challenge.targetType,
      challenge.startDate,
      challenge.endDate,
      participantIds
    );

    const progressRows = participants.map((participant) => {
      const currentValue = valueMap.get(participant.id) ?? 0;
      const percentage = calculateProgressPercentage(currentValue, toNumber(challenge.targetValue));
      return {
        userId: participant.id,
        userName: participant.name,
        currentValue,
        percentage,
        achieved: percentage >= 100
      };
    });

    const doneCount = progressRows.filter((row) => row.achieved).length;
    items.push({
      id: challenge.id,
      name: challenge.name,
      description: challenge.description,
      targetType: challenge.targetType,
      targetValue: toNumber(challenge.targetValue),
      rewardPoints: challenge.rewardPoints,
      active: challenge.active,
      startDate: challenge.startDate.toISOString().slice(0, 10),
      endDate: challenge.endDate.toISOString().slice(0, 10),
      completionRate:
        progressRows.length > 0 ? Number(((doneCount / progressRows.length) * 100).toFixed(2)) : 0,
      participants: progressRows
    });
  }

  return {
    period: {
      start: period.start.toISOString().slice(0, 10),
      end: period.end.toISOString().slice(0, 10)
    },
    items
  };
};

export const createGamificationGoal = async (actor: GamificationActor, payload: CreateGoalInput) => {
  assertCanCreate(actor);

  if (payload.userId) {
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        tenantId: actor.tenantId,
        active: true
      },
      select: { id: true }
    });
    if (!user) {
      throw new HttpError("Usuario alvo da meta nao pertence ao tenant.", 422);
    }
  }

  if (payload.unitId) {
    const unit = await prisma.unit.findFirst({
      where: {
        id: payload.unitId,
        ...(actor.franchiseId ? { franchiseId: actor.franchiseId } : {})
      },
      select: {
        id: true
      }
    });
    if (!unit) {
      throw new HttpError("Unidade alvo da meta nao encontrada para este escopo.", 422);
    }
  }

  const goal = await prisma.goal.create({
    data: {
      tenantId: actor.tenantId,
      unitId: payload.unitId,
      userId: payload.userId,
      type: payload.type,
      targetValue: payload.targetValue,
      period: payload.period,
      startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
      endDate: new Date(`${payload.endDate}T00:00:00.000Z`)
    }
  });

  await prisma.$transaction(async (tx) => {
    await syncSingleGoalProgress(tx, goal);
  });

  const withProgress = await prisma.goal.findUnique({
    where: {
      id: goal.id
    },
    include: {
      progress: {
        select: {
          currentValue: true,
          percentage: true
        }
      }
    }
  });

  return mapGoal(withProgress as GoalWithProgress);
};

export const createGamificationChallenge = async (
  actor: GamificationActor,
  payload: CreateChallengeInput
) => {
  assertCanCreate(actor);

  const challenge = await prisma.challenge.create({
    data: {
      tenantId: actor.tenantId,
      name: payload.name,
      description: payload.description,
      targetType: payload.targetType,
      targetValue: payload.targetValue,
      rewardPoints: payload.rewardPoints,
      startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
      endDate: new Date(`${payload.endDate}T00:00:00.000Z`),
      active: payload.active
    }
  });

  return {
    id: challenge.id,
    tenantId: challenge.tenantId,
    name: challenge.name,
    description: challenge.description,
    targetType: challenge.targetType,
    targetValue: toNumber(challenge.targetValue),
    rewardPoints: challenge.rewardPoints,
    startDate: challenge.startDate.toISOString().slice(0, 10),
    endDate: challenge.endDate.toISOString().slice(0, 10),
    active: challenge.active,
    createdAt: challenge.createdAt.toISOString()
  };
};

export const processGamificationForAppointmentFinalized = async (input: {
  tenantId: string;
  appointmentId: string;
  barberId: string;
}) => {
  const now = new Date();
  const txResult = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.appointmentId,
        status: "FINALIZADO"
      },
      include: {
        appointmentServices: {
          select: {
            id: true
          }
        },
        tenant: {
          select: {
            unitId: true,
            unit: {
              select: {
                franchiseId: true
              }
            }
          }
        }
      }
    });
    if (!appointment) {
      return null;
    }

    await awardPoints(tx, {
      tenantId: input.tenantId,
      userId: input.barberId,
      points: 10,
      reason: "APPOINTMENT_FINISHED",
      referenceId: input.appointmentId
    });

    const servicesCount = appointment.appointmentServices.length;
    if (servicesCount >= 2) {
      await awardPoints(tx, {
        tenantId: input.tenantId,
        userId: input.barberId,
        points: 20,
        reason: "UPSELL_SERVICE",
        referenceId: input.appointmentId
      });
    }

    const goals = await tx.goal.findMany({
      where: {
        tenantId: input.tenantId,
        startDate: {
          lte: appointment.date
        },
        endDate: {
          gte: appointment.date
        },
        type: {
          in: [
            GoalType.APPOINTMENTS,
            GoalType.SERVICES,
            GoalType.UPSELL,
            GoalType.REVENUE,
            GoalType.TICKET_AVG
          ]
        },
        OR: [{ userId: null }, { userId: input.barberId }],
        AND: [
          {
            OR: [{ unitId: null }, { unitId: appointment.tenant.unitId }]
          }
        ]
      }
    });

    const reachedGoals: Goal[] = [];
    for (const goal of goals) {
      const sync = await syncSingleGoalProgress(tx, goal);
      if (sync.reachedNow && goal.userId) {
        reachedGoals.push(goal);
      }
    }

    const [grantedBadges, completedChallenges] = await Promise.all([
      evaluateAndGrantBadges(tx, {
        tenantId: input.tenantId,
        userId: input.barberId
      }),
      evaluateChallengesAndGrantPoints(tx, {
        tenantId: input.tenantId,
        userId: input.barberId,
        referenceDate: appointment.date
      })
    ]);

    return {
      unitId: appointment.tenant.unitId,
      franchiseId: appointment.tenant.unit.franchiseId,
      reachedGoals: reachedGoals.map((goal) => goal.type),
      grantedBadges,
      completedChallenges
    };
  });

  if (!txResult) {
    return null;
  }

  if (txResult.reachedGoals.length) {
    fireNotification(
      sendToUser(input.tenantId, {
        userId: input.barberId,
        title: "Meta atingida",
        body: `Voce concluiu ${txResult.reachedGoals.length} meta(s) hoje.`,
        route: "/performance/goals"
      })
    );
  }

  if (txResult.grantedBadges.length) {
    fireNotification(
      sendToUser(input.tenantId, {
        userId: input.barberId,
        title: "Badge conquistada",
        body: `Nova badge: ${txResult.grantedBadges[0]}.`,
        route: "/performance/badges"
      })
    );
  }

  if (txResult.completedChallenges.length) {
    fireNotification(
      sendToUser(input.tenantId, {
        userId: input.barberId,
        title: "Desafio concluido",
        body: `Desafio finalizado: ${txResult.completedChallenges[0]}.`,
        route: "/performance/challenges"
      })
    );
  }

  await notifyRankingClimbIfNeeded({
    tenantId: input.tenantId,
    userId: input.barberId,
    unitId: txResult.unitId,
    franchiseId: txResult.franchiseId
  });

  return {
    processedAt: now.toISOString(),
    ...txResult
  };
};

export const processGamificationForPaymentConfirmed = async (input: {
  tenantId: string;
  paymentId: string;
}) => {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.paymentId,
        status: PaymentStatus.PAGO
      },
      include: {
        appointment: {
          select: {
            barberId: true
          }
        },
        tenant: {
          select: {
            unitId: true
          }
        }
      }
    });
    if (!payment) {
      return;
    }

    const referenceDate = payment.paidAt;
    const goals = await tx.goal.findMany({
      where: {
        tenantId: input.tenantId,
        startDate: {
          lte: referenceDate
        },
        endDate: {
          gte: referenceDate
        },
        type: {
          in: [GoalType.REVENUE, GoalType.TICKET_AVG]
        },
        OR: [
          {
            userId: null
          },
          ...(payment.appointment?.barberId ? [{ userId: payment.appointment.barberId }] : [])
        ],
        AND: [
          {
            OR: [{ unitId: null }, { unitId: payment.tenant.unitId }]
          }
        ]
      }
    });

    for (const goal of goals) {
      await syncSingleGoalProgress(tx, goal, { notifyOnReached: true });
    }
  });
};

export type { GamificationActor };
