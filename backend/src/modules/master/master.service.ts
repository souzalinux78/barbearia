import { PaymentStatus, PlanName, Prisma, RoleName, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { generateAccessToken } from "../../utils/jwt";
import {
  calculateAverageGrowthRate,
  calculateGrowthPercent,
  calculateMrr,
  calculateNetGrowth,
  calculateRate,
  projectRevenue,
  resolveTenantStatusTransition
} from "./master.calculations";
import {
  MasterBillingConfigInput,
  MasterFunnelQueryInput,
  MasterImpersonateInput,
  MasterPlanUpdateInput,
  MasterPeriodQueryInput,
  MasterRevenueQueryInput,
  MasterTenantStatusPatchInput,
  MasterTenantsQueryInput
} from "./master.schemas";

type MasterScope = {
  adminId: string;
  email: string;
  role: "SUPER_ADMIN";
};

const DAY_MS = 24 * 60 * 60 * 1000;

type MonthWindow = {
  monthStart: Date;
  monthEnd: Date;
};

const CACHE_TTL_MS = 60 * 1000;
const cacheStore = new Map<string, { value: unknown; expiresAt: number }>();

const getCached = <T>(key: string): T | null => {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value as T;
};

const setCached = (key: string, value: unknown, ttlMs = CACHE_TTL_MS) => {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
};

const toNumber = (value: Prisma.Decimal | number | string | null | undefined): number => Number(value ?? 0);

const startOfMonth = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);
const endOfMonth = (value: Date): Date => new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
const formatMonth = (value: Date): string => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
const formatDate = (value: Date): string => value.toISOString().slice(0, 10);

const getLastMonthWindows = (months: number): MonthWindow[] => {
  const now = new Date();
  const windows: MonthWindow[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const ref = new Date(now.getFullYear(), now.getMonth() - index, 1);
    windows.push({
      monthStart: startOfMonth(ref),
      monthEnd: endOfMonth(ref)
    });
  }
  return windows;
};

const resolveMasterTenantStatus = (tenant: {
  unit: { active: boolean };
  subscription: { status: SubscriptionStatus } | null;
}): "ACTIVE" | "SUSPENDED" | "PAST_DUE" | "CANCELED" | "TRIALING" => {
  if (!tenant.unit.active) {
    return "SUSPENDED";
  }
  if (!tenant.subscription) {
    return "TRIALING";
  }
  if (tenant.subscription.status === SubscriptionStatus.ACTIVE) {
    return "ACTIVE";
  }
  if (
    tenant.subscription.status === SubscriptionStatus.PAST_DUE ||
    tenant.subscription.status === SubscriptionStatus.INCOMPLETE
  ) {
    return "PAST_DUE";
  }
  if (tenant.subscription.status === SubscriptionStatus.CANCELED) {
    return "CANCELED";
  }
  return "TRIALING";
};

const getMonthlySnapshot = async (window: MonthWindow) => {
  const [mrrRows, activeSubscriptions, newSubscriptions, canceledSubscriptions] = await Promise.all([
    prisma.$queryRaw<Array<{ price: Prisma.Decimal; count: bigint }>>(Prisma.sql`
      SELECT p.price, COUNT(*)::bigint AS count
      FROM subscriptions s
      INNER JOIN plans p ON p.id = s.plan_id
      WHERE s.created_at <= ${window.monthEnd}
        AND (
          s.status <> 'CANCELED'::"SubscriptionStatus"
          OR s.updated_at > ${window.monthEnd}
        )
      GROUP BY p.price
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM subscriptions s
      WHERE s.created_at <= ${window.monthEnd}
        AND (
          s.status <> 'CANCELED'::"SubscriptionStatus"
          OR s.updated_at > ${window.monthEnd}
        )
    `),
    prisma.subscription.count({
      where: {
        createdAt: {
          gte: window.monthStart,
          lte: window.monthEnd
        }
      }
    }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.CANCELED,
        updatedAt: {
          gte: window.monthStart,
          lte: window.monthEnd
        }
      }
    })
  ]);

  const mrr = calculateMrr(
    mrrRows.map((row) => ({
      price: toNumber(row.price),
      count: Number(row.count)
    }))
  );

  return {
    month: formatMonth(window.monthStart),
    monthStart: window.monthStart,
    monthEnd: window.monthEnd,
    mrr,
    activeSubscriptions: Number(activeSubscriptions[0]?.count ?? 0n),
    newSubscriptions,
    canceledSubscriptions
  };
};

const getMonthlySnapshots = async (months: number) => {
  const cacheKey = `master-snapshots-${months}`;
  const cached = getCached<
    Array<{
      month: string;
      monthStart: Date;
      monthEnd: Date;
      mrr: number;
      activeSubscriptions: number;
      newSubscriptions: number;
      canceledSubscriptions: number;
    }>
  >(cacheKey);
  if (cached) {
    return cached;
  }

  const windows = getLastMonthWindows(months);
  const snapshots = await Promise.all(windows.map((window) => getMonthlySnapshot(window)));
  setCached(cacheKey, snapshots);
  return snapshots;
};

const getCurrentMonthSummary = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = now;
  const previousMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const previousBase = await prisma.subscription.count({
    where: {
      createdAt: {
        lt: monthStart
      }
    }
  });

  const [activeRows, pastDueSubscriptions, canceledInMonth, newInMonth, activeTenants, totalUnits, totalUsers] =
    await Promise.all([
      prisma.subscription.groupBy({
        by: ["planId"],
        where: {
          status: SubscriptionStatus.ACTIVE
        },
        _count: {
          _all: true
        }
      }),
      prisma.subscription.count({
        where: {
          status: {
            in: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE]
          }
        }
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.CANCELED,
          updatedAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      }),
      prisma.tenant.count({
        where: {
          unit: {
            active: true
          }
        }
      }),
      prisma.unit.count({
        where: {
          active: true
        }
      }),
      prisma.user.count({
        where: {
          active: true
        }
      })
    ]);

  const plans = await prisma.plan.findMany({
    select: {
      id: true,
      name: true,
      price: true
    }
  });
  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const revenueByPlan = activeRows
    .map((row) => {
      const plan = planMap.get(row.planId);
      const count = row._count._all;
      const price = toNumber(plan?.price);
      return {
        planId: row.planId,
        planName: plan?.name ?? null,
        subscriptions: count,
        mrr: Number((count * price).toFixed(2))
      };
    })
    .sort((left, right) => right.mrr - left.mrr);

  const totalMrr = Number(revenueByPlan.reduce((sum, row) => sum + row.mrr, 0).toFixed(2));
  const totalActiveSubscriptions = revenueByPlan.reduce((sum, row) => sum + row.subscriptions, 0);
  const churnRate = calculateRate(canceledInMonth, previousBase);
  const growthPercent = calculateGrowthPercent(newInMonth, canceledInMonth, Math.max(previousBase, 1));
  const netGrowth = calculateNetGrowth(newInMonth, canceledInMonth);
  const arpu =
    totalActiveSubscriptions > 0 ? Number((totalMrr / totalActiveSubscriptions).toFixed(2)) : 0;
  const avgLtv =
    churnRate > 0 ? Number((arpu / (churnRate / 100)).toFixed(2)) : Number((arpu * 12).toFixed(2));

  const retentionRows = await prisma.$queryRaw<Array<{ avg_days: Prisma.Decimal | null }>>(Prisma.sql`
    SELECT AVG(
      EXTRACT(EPOCH FROM (
        (CASE WHEN s.status = 'CANCELED'::"SubscriptionStatus" THEN s.updated_at ELSE NOW() END) - s.created_at
      )) / 86400.0
    ) AS avg_days
    FROM subscriptions s
    WHERE s.created_at >= ${previousMonthStart}
  `);
  const avgRetentionDays = Number(Number(retentionRows[0]?.avg_days ?? 0).toFixed(2));

  const [revenueByFranchiseRows, revenueByRegionRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ franchise_id: string | null; franchise_name: string | null; revenue: Prisma.Decimal }>
    >(Prisma.sql`
      SELECT
        u.franchise_id,
        f.name AS franchise_name,
        COALESCE(SUM(p.amount), 0) AS revenue
      FROM payments p
      INNER JOIN tenants t ON t.id = p.tenant_id
      INNER JOIN units u ON u.id = t.unit_id
      LEFT JOIN franchises f ON f.id = u.franchise_id
      WHERE p.status = 'PAGO'::"PaymentStatus"
        AND p.paid_at BETWEEN ${monthStart} AND ${monthEnd}
      GROUP BY u.franchise_id, f.name
      ORDER BY revenue DESC
    `),
    prisma.$queryRaw<Array<{ state: string | null; revenue: Prisma.Decimal }>>(Prisma.sql`
      SELECT
        u.state,
        COALESCE(SUM(p.amount), 0) AS revenue
      FROM payments p
      INNER JOIN tenants t ON t.id = p.tenant_id
      INNER JOIN units u ON u.id = t.unit_id
      WHERE p.status = 'PAGO'::"PaymentStatus"
        AND p.paid_at BETWEEN ${monthStart} AND ${monthEnd}
      GROUP BY u.state
      ORDER BY revenue DESC
    `)
  ]);

  const webhookErrors = await prisma.billingLog.count({
    where: {
      level: "ERROR",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    }
  });

  const alerts: Array<{ severity: "info" | "warning" | "danger"; message: string }> = [];
  if (churnRate >= 10) {
    alerts.push({ severity: "danger", message: "Alta taxa de churn no periodo." });
  }
  if (totalActiveSubscriptions > 0 && pastDueSubscriptions / totalActiveSubscriptions >= 0.2) {
    alerts.push({ severity: "warning", message: "Muitas contas inadimplentes na base." });
  }
  if (growthPercent < 0) {
    alerts.push({ severity: "warning", message: "Queda de crescimento na plataforma." });
  }
  if (webhookErrors >= 5) {
    alerts.push({ severity: "danger", message: "Falhas recorrentes em webhooks de pagamento." });
  }
  if (!alerts.length) {
    alerts.push({ severity: "info", message: "Sem alertas criticos no momento." });
  }

  return {
    month: formatMonth(monthStart),
    totalMrr,
    totalActiveSubscriptions,
    churnRate,
    growthPercent,
    netGrowth,
    activeTenants,
    pastDueSubscriptions,
    totalUnits,
    totalUsers,
    arpu,
    avgLtv,
    avgRetentionDays,
    revenueByPlan,
    revenueByFranchise: revenueByFranchiseRows.map((row) => ({
      franchiseId: row.franchise_id,
      franchiseName: row.franchise_name ?? "Independente",
      revenue: toNumber(row.revenue)
    })),
    revenueByRegion: revenueByRegionRows.map((row) => ({
      state: row.state ?? "N/A",
      revenue: toNumber(row.revenue)
    })),
    alerts
  };
};

export const getMasterSummary = async (_scope: MasterScope) => {
  const cacheKey = "master-summary";
  const cached = getCached<unknown>(cacheKey);
  if (cached) {
    return cached;
  }
  const result = await getCurrentMonthSummary();
  setCached(cacheKey, result);
  return result;
};

export const getMasterMrr = async (_scope: MasterScope, query: MasterPeriodQueryInput) => {
  const snapshots = await getMonthlySnapshots(query.months);

  const withGrowth = snapshots.map((row, index) => ({
    ...row,
    growthPercent:
      index === 0
        ? 0
        : snapshots[index - 1].mrr > 0
          ? Number((((row.mrr - snapshots[index - 1].mrr) / snapshots[index - 1].mrr) * 100).toFixed(2))
          : row.mrr > 0
            ? 100
            : 0
  }));

  await Promise.all(
    withGrowth.map((row) =>
      prisma.platformMetric.upsert({
        where: {
          month: row.monthStart
        },
        create: {
          month: row.monthStart,
          totalMrr: row.mrr,
          totalActiveSubscriptions: row.activeSubscriptions,
          totalChurn: calculateRate(row.canceledSubscriptions, Math.max(row.activeSubscriptions, 1)),
          totalNewSubscriptions: row.newSubscriptions
        },
        update: {
          totalMrr: row.mrr,
          totalActiveSubscriptions: row.activeSubscriptions,
          totalChurn: calculateRate(row.canceledSubscriptions, Math.max(row.activeSubscriptions, 1)),
          totalNewSubscriptions: row.newSubscriptions
        }
      })
    )
  );

  return {
    months: withGrowth.map((row) => ({
      month: row.month,
      mrr: row.mrr,
      activeSubscriptions: row.activeSubscriptions,
      newSubscriptions: row.newSubscriptions,
      canceledSubscriptions: row.canceledSubscriptions,
      growthPercent: row.growthPercent
    }))
  };
};

export const getMasterChurn = async (_scope: MasterScope, query: MasterPeriodQueryInput) => {
  const snapshots = await getMonthlySnapshots(query.months);
  return {
    months: snapshots.map((row) => ({
      month: row.month,
      canceledSubscriptions: row.canceledSubscriptions,
      activeBase: row.activeSubscriptions,
      churnRate: calculateRate(row.canceledSubscriptions, Math.max(row.activeSubscriptions, 1))
    }))
  };
};

export const getMasterFunnel = async (_scope: MasterScope, query: MasterFunnelQueryInput) => {
  const cacheKey = `master-funnel-${query.days}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) {
    return cached;
  }

  const now = new Date();
  const since = new Date(now.getTime() - query.days * DAY_MS);

  const [stepsRows, paidRows, dailyRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        landing_views: bigint;
        checkout_clicks: bigint;
        register_starts: bigint;
        register_success: bigint;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (
          WHERE me.event_name = 'page_view'
            AND COALESCE(me.metadata->>'page', '') = 'landing'
        )::bigint AS landing_views,
        COUNT(*) FILTER (
          WHERE me.event_name = 'landing_cta_click'
            AND COALESCE(me.metadata->>'action', '') = 'checkout'
        )::bigint AS checkout_clicks,
        COUNT(*) FILTER (
          WHERE me.event_name = 'register_submit'
        )::bigint AS register_starts,
        COUNT(*) FILTER (
          WHERE me.event_name = 'register_success'
        )::bigint AS register_success
      FROM marketing_events me
      WHERE me.created_at >= ${since}
    `),
    prisma.$queryRaw<Array<{ paid_tenants: bigint }>>(Prisma.sql`
      SELECT COUNT(DISTINCT bh.tenant_id)::bigint AS paid_tenants
      FROM billing_history bh
      WHERE bh.status = 'PAID'::"BillingPaymentStatus"
        AND bh.paid_at IS NOT NULL
        AND bh.amount > 0
        AND bh.paid_at >= ${since}
    `),
    prisma.$queryRaw<
      Array<{
        day: Date;
        landing_views: bigint;
        register_success: bigint;
        paid_tenants: bigint;
      }>
    >(Prisma.sql`
      WITH days AS (
        SELECT generate_series(
          DATE_TRUNC('day', ${since}::timestamp),
          DATE_TRUNC('day', NOW()::timestamp),
          INTERVAL '1 day'
        )::date AS day
      ),
      event_agg AS (
        SELECT
          DATE_TRUNC('day', me.created_at)::date AS day,
          COUNT(*) FILTER (
            WHERE me.event_name = 'page_view'
              AND COALESCE(me.metadata->>'page', '') = 'landing'
          )::bigint AS landing_views,
          COUNT(*) FILTER (
            WHERE me.event_name = 'register_success'
          )::bigint AS register_success
        FROM marketing_events me
        WHERE me.created_at >= ${since}
        GROUP BY DATE_TRUNC('day', me.created_at)::date
      ),
      paid_agg AS (
        SELECT
          DATE_TRUNC('day', bh.paid_at)::date AS day,
          COUNT(DISTINCT bh.tenant_id)::bigint AS paid_tenants
        FROM billing_history bh
        WHERE bh.status = 'PAID'::"BillingPaymentStatus"
          AND bh.paid_at IS NOT NULL
          AND bh.amount > 0
          AND bh.paid_at >= ${since}
        GROUP BY DATE_TRUNC('day', bh.paid_at)::date
      )
      SELECT
        days.day AS day,
        COALESCE(event_agg.landing_views, 0)::bigint AS landing_views,
        COALESCE(event_agg.register_success, 0)::bigint AS register_success,
        COALESCE(paid_agg.paid_tenants, 0)::bigint AS paid_tenants
      FROM days
      LEFT JOIN event_agg ON event_agg.day = days.day
      LEFT JOIN paid_agg ON paid_agg.day = days.day
      ORDER BY days.day ASC
    `)
  ]);

  const steps = stepsRows[0] ?? {
    landing_views: 0n,
    checkout_clicks: 0n,
    register_starts: 0n,
    register_success: 0n
  };

  const funnel = {
    landingViews: Number(steps.landing_views),
    checkoutClicks: Number(steps.checkout_clicks),
    registerStarts: Number(steps.register_starts),
    registerSuccess: Number(steps.register_success),
    paidTenants: Number(paidRows[0]?.paid_tenants ?? 0n)
  };

  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;

  const result = {
    days: query.days,
    funnel,
    conversion: {
      visitToCheckout: rate(funnel.checkoutClicks, funnel.landingViews),
      checkoutToRegisterStart: rate(funnel.registerStarts, funnel.checkoutClicks),
      registerStartToSuccess: rate(funnel.registerSuccess, funnel.registerStarts),
      registerSuccessToPaid: rate(funnel.paidTenants, funnel.registerSuccess),
      visitToPaid: rate(funnel.paidTenants, funnel.landingViews)
    },
    daily: dailyRows.map((row) => ({
      day: formatDate(new Date(row.day)),
      landingViews: Number(row.landing_views),
      registerSuccess: Number(row.register_success),
      paidTenants: Number(row.paid_tenants)
    }))
  };

  setCached(cacheKey, result);
  return result;
};

export const getMasterPlans = async (_scope: MasterScope) => {
  const plans = await prisma.plan.findMany({
    orderBy: {
      createdAt: "asc"
    }
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: Number(plan.price),
    maxUsers: plan.maxUsers,
    maxBarbers: plan.maxBarbers,
    maxAppointmentsMonth: plan.maxAppointmentsMonth,
    features:
      plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
        ? Object.fromEntries(
            Object.entries(plan.features as Record<string, unknown>).map(([key, value]) => [
              key,
              Boolean(value)
            ])
          )
        : {}
  }));
};

export const updateMasterPlan = async (
  _scope: MasterScope,
  planName: PlanName,
  payload: MasterPlanUpdateInput
) => {
  const existing = await prisma.plan.findUnique({
    where: {
      name: planName
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new HttpError("Plano nao encontrado.", 404);
  }

  const updated = await prisma.plan.update({
    where: {
      name: planName
    },
    data: {
      price: payload.price,
      maxUsers: payload.maxUsers,
      maxBarbers: payload.maxBarbers,
      maxAppointmentsMonth: payload.maxAppointmentsMonth,
      features: payload.features
    }
  });

  cacheStore.clear();

  return {
    id: updated.id,
    name: updated.name,
    price: Number(updated.price),
    maxUsers: updated.maxUsers,
    maxBarbers: updated.maxBarbers,
    maxAppointmentsMonth: updated.maxAppointmentsMonth,
    features:
      updated.features && typeof updated.features === "object" && !Array.isArray(updated.features)
        ? Object.fromEntries(
            Object.entries(updated.features as Record<string, unknown>).map(([key, value]) => [
              key,
              Boolean(value)
            ])
          )
        : {}
  };
};

export const getMasterTenants = async (_scope: MasterScope, query: MasterTenantsQueryInput) => {
  const monthStart = startOfMonth(new Date());
  const monthEnd = new Date();

  const where: Prisma.TenantWhereInput = {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { slug: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(query.state
      ? {
          unit: {
            state: {
              equals: query.state.toUpperCase()
            }
          }
        }
      : {}),
    ...(query.franchiseId
      ? {
          unit: {
            franchiseId: query.franchiseId
          }
        }
      : {}),
    ...(query.plan
      ? {
          subscription: {
            plan: {
              name: query.plan
            }
          }
        }
      : {}),
    ...(query.status === "SUSPENDED"
      ? {
          unit: {
            active: false
          }
        }
      : {}),
    ...(query.status === "ACTIVE"
      ? {
          unit: { active: true },
          subscription: { status: SubscriptionStatus.ACTIVE }
        }
      : {}),
    ...(query.status === "PAST_DUE"
      ? {
          unit: { active: true },
          subscription: {
            status: {
              in: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE]
            }
          }
        }
      : {}),
    ...(query.status === "CANCELED"
      ? {
          unit: { active: true },
          subscription: { status: SubscriptionStatus.CANCELED }
        }
      : {}),
    ...(query.status === "TRIALING"
      ? {
          unit: { active: true },
          subscription: { status: SubscriptionStatus.TRIALING }
        }
      : {})
  };

  const [rows, total, plans] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        unit: {
          include: {
            franchise: true
          }
        },
        subscription: {
          include: {
            plan: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.tenant.count({ where }),
    prisma.plan.findMany({
      select: {
        id: true,
        name: true
      }
    })
  ]);

  const tenantIds = rows.map((row) => row.id);
  const [monthlyRevenueRows, lastPaymentRows] = await Promise.all([
    tenantIds.length
      ? prisma.payment.groupBy({
          by: ["tenantId"],
          where: {
            tenantId: {
              in: tenantIds
            },
            status: PaymentStatus.PAGO,
            paidAt: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          _sum: {
            amount: true
          }
        })
      : Promise.resolve([]),
    tenantIds.length
      ? prisma.payment.groupBy({
          by: ["tenantId"],
          where: {
            tenantId: {
              in: tenantIds
            },
            status: PaymentStatus.PAGO
          },
          _max: {
            paidAt: true
          }
        })
      : Promise.resolve([])
  ]);
  const revenueMap = new Map(monthlyRevenueRows.map((item) => [item.tenantId, toNumber(item._sum.amount)]));
  const lastPaymentMap = new Map(
    lastPaymentRows.map((item) => [item.tenantId, item._max.paidAt?.toISOString() ?? null])
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
      status: resolveMasterTenantStatus(row),
      monthlyRevenue: revenueMap.get(row.id) ?? 0,
      usersCount: row._count.users,
      lastPaymentAt: lastPaymentMap.get(row.id) ?? null,
      subscription: row.subscription
        ? {
            id: row.subscription.id,
            status: row.subscription.status,
            planId: row.subscription.planId,
            planName: row.subscription.plan.name,
            price: toNumber(row.subscription.plan.price),
            currentPeriodEnd: row.subscription.currentPeriodEnd.toISOString().slice(0, 10)
          }
        : null,
      unit: {
        id: row.unit.id,
        name: row.unit.name,
        city: row.unit.city,
        state: row.unit.state,
        active: row.unit.active,
        franchiseId: row.unit.franchiseId,
        franchiseName: row.unit.franchise?.name ?? null
      }
    })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    },
    planOptions: plans.map((plan) => ({
      id: plan.id,
      name: plan.name
    }))
  };
};

export const getMasterTenantById = async (_scope: MasterScope, tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId
    },
    include: {
      unit: {
        include: {
          franchise: true
        }
      },
      subscription: {
        include: {
          plan: true
        }
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }

  const [statusLogs, impersonations, lastPayment] = await Promise.all([
    prisma.tenantStatusLog.findMany({
      where: {
        tenantId
      },
      include: {
        admin: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    }),
    prisma.impersonationLog.findMany({
      where: {
        tenantId
      },
      include: {
        admin: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    }),
    prisma.payment.aggregate({
      where: {
        tenantId,
        status: PaymentStatus.PAGO
      },
      _max: {
        paidAt: true
      }
    })
  ]);

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    email: tenant.email,
    phone: tenant.phone,
    createdAt: tenant.createdAt.toISOString(),
    status: resolveMasterTenantStatus(tenant),
    lastPaymentAt: lastPayment._max.paidAt?.toISOString() ?? null,
    subscription: tenant.subscription
      ? {
          id: tenant.subscription.id,
          status: tenant.subscription.status,
          planId: tenant.subscription.planId,
          planName: tenant.subscription.plan.name,
          price: toNumber(tenant.subscription.plan.price),
          currentPeriodStart: tenant.subscription.currentPeriodStart.toISOString().slice(0, 10),
          currentPeriodEnd: tenant.subscription.currentPeriodEnd.toISOString().slice(0, 10)
        }
      : null,
    unit: {
      id: tenant.unit.id,
      name: tenant.unit.name,
      city: tenant.unit.city,
      state: tenant.unit.state,
      active: tenant.unit.active,
      franchiseId: tenant.unit.franchiseId,
      franchiseName: tenant.unit.franchise?.name ?? null
    },
    users: tenant.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      active: user.active
    })),
    statusLogs: statusLogs.map((log) => ({
      id: log.id,
      previousStatus: log.previousStatus,
      newStatus: log.newStatus,
      reason: log.reason,
      adminEmail: log.admin?.email ?? null,
      createdAt: log.createdAt.toISOString()
    })),
    impersonationLogs: impersonations.map((log) => ({
      id: log.id,
      adminEmail: log.admin.email,
      createdAt: log.createdAt.toISOString()
    }))
  };
};

export const updateMasterTenantStatus = async (
  scope: MasterScope,
  tenantId: string,
  payload: MasterTenantStatusPatchInput
) => {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId
    },
    include: {
      unit: true,
      subscription: true
    }
  });
  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }

  if (payload.planId) {
    const plan = await prisma.plan.findUnique({
      where: {
        id: payload.planId
      },
      select: {
        id: true
      }
    });
    if (!plan) {
      throw new HttpError("Plano informado nao existe.", 422);
    }
    if (!tenant.subscription) {
      throw new HttpError("Tenant nao possui assinatura para alteracao de plano.", 422);
    }
  }

  const statusTransition = resolveTenantStatusTransition(tenant.unit.active, payload.status);

  await prisma.$transaction(async (tx) => {
    if (statusTransition.changed) {
      await tx.unit.update({
        where: {
          id: tenant.unitId
        },
        data: {
          active: payload.status === "ACTIVE"
        }
      });

      if (tenant.subscription) {
        await tx.subscription.update({
          where: {
            id: tenant.subscription.id
          },
          data: {
            status:
              payload.status === "ACTIVE" ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAST_DUE
          }
        });
      }
    }

    if (payload.planId && tenant.subscription) {
      await tx.subscription.update({
        where: {
          id: tenant.subscription.id
        },
        data: {
          planId: payload.planId
        }
      });
      await tx.tenant.update({
        where: {
          id: tenant.id
        },
        data: {
          planId: payload.planId
        }
      });
    }

    await tx.tenantStatusLog.create({
      data: {
        tenantId: tenant.id,
        adminId: scope.adminId,
        previousStatus: statusTransition.previousStatus,
        newStatus: statusTransition.newStatus,
        reason: payload.reason
      }
    });
  });

  cacheStore.clear();
  return getMasterTenantById(scope, tenantId);
};

export const getMasterPlatformMetrics = async (_scope: MasterScope, query: MasterPeriodQueryInput) => {
  await getMasterMrr(_scope, query);
  const rows = await prisma.platformMetric.findMany({
    orderBy: {
      month: "desc"
    },
    take: query.months
  });
  return {
    items: rows
      .map((row) => ({
        month: formatDate(row.month),
        totalMrr: toNumber(row.totalMrr),
        totalActiveSubscriptions: row.totalActiveSubscriptions,
        totalChurn: toNumber(row.totalChurn),
        totalNewSubscriptions: row.totalNewSubscriptions,
        createdAt: row.createdAt.toISOString()
      }))
      .reverse()
  };
};

export const getMasterRevenueProjection = async (_scope: MasterScope) => {
  const snapshots = await getMonthlySnapshots(6);
  const recentMrr = snapshots.map((row) => row.mrr);
  const currentMrr = recentMrr[recentMrr.length - 1] ?? 0;
  const averageGrowthRate = calculateAverageGrowthRate(recentMrr.slice(-4));
  const projected = projectRevenue(currentMrr, averageGrowthRate, 6);

  const nextMonths = Array.from({ length: 6 }).map((_, index) => {
    const ref = new Date(new Date().getFullYear(), new Date().getMonth() + index + 1, 1);
    return formatMonth(ref);
  });

  return {
    currentMrr,
    averageGrowthRate,
    projection: projected.map((value, index) => ({
      month: nextMonths[index],
      projectedMrr: value
    }))
  };
};

export const getMasterRevenue = async (_scope: MasterScope, query: MasterRevenueQueryInput) => {
  if (query.period === "yearly") {
    const rows = await prisma.$queryRaw<Array<{ year: number; total_revenue: Prisma.Decimal }>>(Prisma.sql`
      SELECT EXTRACT(YEAR FROM bh.paid_at)::int AS year, COALESCE(SUM(bh.amount), 0) AS total_revenue
      FROM billing_history bh
      WHERE bh.status = 'PAID'::"BillingPaymentStatus"
        AND bh.paid_at IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM bh.paid_at)
      ORDER BY year ASC
    `);

    return {
      period: "yearly",
      revenue: rows.map((row) => ({
        label: String(row.year),
        amount: toNumber(row.total_revenue)
      })),
      totalRevenue: Number(rows.reduce((sum, row) => sum + toNumber(row.total_revenue), 0).toFixed(2))
    };
  }

  const rows = await prisma.$queryRaw<Array<{ month: Date; total_revenue: Prisma.Decimal }>>(Prisma.sql`
    SELECT DATE_TRUNC('month', bh.paid_at) AS month, COALESCE(SUM(bh.amount), 0) AS total_revenue
    FROM billing_history bh
    WHERE bh.status = 'PAID'::"BillingPaymentStatus"
      AND bh.paid_at IS NOT NULL
      AND bh.paid_at >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
    GROUP BY DATE_TRUNC('month', bh.paid_at)
    ORDER BY month ASC
  `);

  let cumulative = 0;
  const revenue = rows.map((row) => {
    const amount = toNumber(row.total_revenue);
    cumulative += amount;
    return {
      label: formatMonth(new Date(row.month)),
      amount,
      cumulative: Number(cumulative.toFixed(2))
    };
  });

  const summary = await getCurrentMonthSummary();
  return {
    period: "monthly",
    revenue,
    totalRevenue: Number(revenue.reduce((sum, row) => sum + row.amount, 0).toFixed(2)),
    byPlan: summary.revenueByPlan,
    byFranchise: summary.revenueByFranchise
  };
};

export const getMasterBillingConfig = async (_scope: MasterScope) => {
  const config = await prisma.paymentGatewayConfig.findFirst({
    where: {
      tenantId: null
    }
  });

  return {
    target: "GLOBAL" as const,
    stripeActive: config?.stripeActive ?? false,
    pixActive: config?.pixActive ?? false,
    stripeSecretKey: config?.stripeSecretKey ?? "",
    stripeWebhookSecret: config?.stripeWebhookSecret ?? "",
    pixApiKey: config?.pixApiKey ?? "",
    pixWebhookSecret: config?.pixWebhookSecret ?? "",
    updatedAt: config?.updatedAt?.toISOString() ?? null
  };
};

export const updateMasterBillingConfig = async (
  _scope: MasterScope,
  payload: MasterBillingConfigInput
) => {
  if (payload.stripeActive && payload.pixActive) {
    throw new HttpError("Apenas um gateway pode estar ativo por vez.", 422);
  }

  const current = await prisma.paymentGatewayConfig.findFirst({
    where: {
      tenantId: null
    },
    select: {
      id: true
    }
  });

  const updated = current
    ? await prisma.paymentGatewayConfig.update({
        where: {
          id: current.id
        },
        data: {
          stripeActive: payload.stripeActive,
          pixActive: payload.pixActive,
          stripeSecretKey: payload.stripeSecretKey || null,
          stripeWebhookSecret: payload.stripeWebhookSecret || null,
          pixApiKey: payload.pixApiKey || null,
          pixWebhookSecret: payload.pixWebhookSecret || null
        }
      })
    : await prisma.paymentGatewayConfig.create({
        data: {
          tenantId: null,
          stripeActive: payload.stripeActive,
          pixActive: payload.pixActive,
          stripeSecretKey: payload.stripeSecretKey || null,
          stripeWebhookSecret: payload.stripeWebhookSecret || null,
          pixApiKey: payload.pixApiKey || null,
          pixWebhookSecret: payload.pixWebhookSecret || null
        }
      });

  return {
    target: "GLOBAL" as const,
    stripeActive: updated.stripeActive,
    pixActive: updated.pixActive,
    stripeSecretKey: updated.stripeSecretKey ?? "",
    stripeWebhookSecret: updated.stripeWebhookSecret ?? "",
    pixApiKey: updated.pixApiKey ?? "",
    pixWebhookSecret: updated.pixWebhookSecret ?? "",
    updatedAt: updated.updatedAt.toISOString()
  };
};

export const impersonateTenant = async (
  scope: MasterScope,
  tenantId: string,
  _payload: MasterImpersonateInput
) => {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId
    },
    include: {
      users: {
        where: {
          active: true
        },
        include: {
          role: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  if (!tenant) {
    throw new HttpError("Tenant nao encontrado para impersonacao.", 404);
  }

  const priority = [
    RoleName.UNIT_OWNER,
    RoleName.OWNER,
    RoleName.UNIT_ADMIN,
    RoleName.ADMIN,
    RoleName.RECEPTION,
    RoleName.BARBER
  ];
  const selectedUser = priority
    .map((role) => tenant.users.find((user) => user.role.name === role))
    .find(Boolean);

  if (!selectedUser) {
    throw new HttpError("Nenhum usuario ativo encontrado para impersonacao.", 422);
  }

  const accessToken = generateAccessToken({
    userId: selectedUser.id,
    tenantId: tenant.id,
    role: selectedUser.role.name
  });

  await prisma.impersonationLog.create({
    data: {
      adminId: scope.adminId,
      tenantId: tenant.id
    }
  });

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug
    },
    user: {
      id: selectedUser.id,
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role.name
    },
    accessToken
  };
};
