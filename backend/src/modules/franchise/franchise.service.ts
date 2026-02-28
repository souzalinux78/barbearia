import { Prisma, RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  buildScopeFromRole,
  calculateGrowth,
  calculateRate,
  calculateRoyaltyAmount,
  getPerformanceSignal
} from "./franchise.calculations";
import {
  FranchiseQueryInput,
  MonthlyRoyaltyGenerateInput,
  PerformanceQueryInput,
  RoyaltiesQueryInput
} from "./franchise.schemas";

type NumericLike = Prisma.Decimal | string | number | null;

type FranchiseActor = {
  userId: string;
  role: RoleName;
  tenantId: string;
  unitId: string;
  franchiseId: string | null;
};

type DateRange = {
  start: Date;
  end: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BUSINESS_MINUTES_PER_DAY = 12 * 60;
const ROYALTY_SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000;

let royaltyTimer: NodeJS.Timeout | null = null;

const toNumber = (value: NumericLike): number => Number(value ?? 0);

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

const toDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const formatDate = (value: Date): string => value.toISOString().slice(0, 10);

const resolvePeriod = (query: FranchiseQueryInput): DateRange => {
  const now = new Date();
  if (query.start && query.end) {
    return {
      start: startOfDay(toDateOnly(query.start)),
      end: endOfDay(toDateOnly(query.end))
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
        start: startOfDay(new Date(now.getTime() - 6 * DAY_MS)),
        end: endOfDay(now)
      };
    case "30D":
      return {
        start: startOfDay(new Date(now.getTime() - 29 * DAY_MS)),
        end: endOfDay(now)
      };
    case "CUSTOM":
      return {
        start: startOfDay(now),
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

const getPreviousPeriod = (period: DateRange): DateRange => {
  const durationMs = period.end.getTime() - period.start.getTime() + 1;
  const end = new Date(period.start.getTime() - 1);
  const start = new Date(end.getTime() - durationMs + 1);
  return { start, end };
};

const resolveScope = (actor: FranchiseActor) => {
  const scope = buildScopeFromRole({
    role: actor.role,
    franchiseId: actor.franchiseId,
    unitId: actor.unitId
  });

  if (scope.mode === "FRANCHISE" && !scope.franchiseId) {
    throw new HttpError("Conta nao associada a uma franquia.", 403);
  }

  return scope;
};

const getScopeFilters = (scope: ReturnType<typeof resolveScope>, query: FranchiseQueryInput) => {
  const filters: Prisma.Sql[] = [Prisma.sql`u.active = true`];

  if (scope.mode === "FRANCHISE") {
    filters.push(Prisma.sql`u.franchise_id = ${scope.franchiseId}::uuid`);
  }
  if (scope.mode === "UNIT") {
    filters.push(Prisma.sql`u.id = ${scope.unitId}::uuid`);
  }

  if (query.franchiseId) {
    filters.push(Prisma.sql`u.franchise_id = ${query.franchiseId}::uuid`);
  }
  if (query.unitId) {
    filters.push(Prisma.sql`u.id = ${query.unitId}::uuid`);
  }
  if (query.city) {
    filters.push(Prisma.sql`LOWER(COALESCE(u.city, '')) = LOWER(${query.city})`);
  }
  if (query.state) {
    filters.push(Prisma.sql`LOWER(COALESCE(u.state, '')) = LOWER(${query.state})`);
  }

  return filters;
};

const getScopedUnits = async (
  scope: ReturnType<typeof resolveScope>,
  query: FranchiseQueryInput
) => {
  const filters = getScopeFilters(scope, query);

  return prisma.$queryRaw<
    Array<{
      unit_id: string;
      unit_name: string;
      city: string | null;
      state: string | null;
      franchise_id: string | null;
      franchise_name: string | null;
      royalty_percentage: NumericLike;
    }>
  >(Prisma.sql`
    SELECT
      u.id AS unit_id,
      u.name AS unit_name,
      u.city,
      u.state,
      u.franchise_id,
      f.name AS franchise_name,
      f.royalty_percentage
    FROM units u
    LEFT JOIN franchises f ON f.id = u.franchise_id
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY u.name ASC
  `);
};

const getUnitRevenueRows = async (unitIds: string[], period: DateRange, previous: DateRange) => {
  if (!unitIds.length) {
    return [] as Array<{
      unit_id: string;
      revenue_current: NumericLike;
      revenue_previous: NumericLike;
      payments_current: bigint;
    }>;
  }

  return prisma.$queryRaw<
    Array<{
      unit_id: string;
      revenue_current: NumericLike;
      revenue_previous: NumericLike;
      payments_current: bigint;
    }>
  >(Prisma.sql`
    SELECT
      t.unit_id,
      COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${period.start} AND ${period.end} THEN p.amount ELSE 0 END), 0) AS revenue_current,
      COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${previous.start} AND ${previous.end} THEN p.amount ELSE 0 END), 0) AS revenue_previous,
      COUNT(*) FILTER (WHERE p.paid_at BETWEEN ${period.start} AND ${period.end})::bigint AS payments_current
    FROM payments p
    INNER JOIN tenants t ON t.id = p.tenant_id
    WHERE p.status = 'PAGO'::"PaymentStatus"
      AND p.paid_at BETWEEN ${previous.start} AND ${period.end}
      AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
    GROUP BY t.unit_id
  `);
};

const getUnitNoShowRows = async (unitIds: string[], period: DateRange) => {
  if (!unitIds.length) {
    return [] as Array<{ unit_id: string; no_show_count: bigint; total_appointments: bigint }>;
  }

  return prisma.$queryRaw<
    Array<{ unit_id: string; no_show_count: bigint; total_appointments: bigint }>
  >(Prisma.sql`
    SELECT
      t.unit_id,
      COUNT(*) FILTER (WHERE a.status = 'NO_SHOW'::"AppointmentStatus")::bigint AS no_show_count,
      COUNT(*) FILTER (WHERE a.status <> 'BLOQUEADO'::"AppointmentStatus")::bigint AS total_appointments
    FROM appointments a
    INNER JOIN tenants t ON t.id = a.tenant_id
    WHERE a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
      AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
    GROUP BY t.unit_id
  `);
};

const getUnitClientRows = async (unitIds: string[], period: DateRange) => {
  if (!unitIds.length) {
    return [] as Array<{ unit_id: string; base_clients: bigint; retained_clients: bigint; churned_clients: bigint }>;
  }

  const cutoff = new Date(period.end.getTime() - 60 * DAY_MS);
  return prisma.$queryRaw<
    Array<{ unit_id: string; base_clients: bigint; retained_clients: bigint; churned_clients: bigint }>
  >(Prisma.sql`
    SELECT
      t.unit_id,
      COUNT(*) FILTER (WHERE c.visits_count > 0)::bigint AS base_clients,
      COUNT(*) FILTER (
        WHERE c.visits_count > 0
          AND c.last_visit IS NOT NULL
          AND c.last_visit >= ${cutoff}
      )::bigint AS retained_clients,
      COUNT(*) FILTER (
        WHERE c.visits_count > 0
          AND (c.last_visit IS NULL OR c.last_visit < ${cutoff})
      )::bigint AS churned_clients
    FROM clients c
    INNER JOIN tenants t ON t.id = c.tenant_id
    WHERE t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
    GROUP BY t.unit_id
  `);
};

const getUnitOccupancyRows = async (unitIds: string[], period: DateRange) => {
  if (!unitIds.length) {
    return [] as Array<{ unit_id: string; booked_minutes: NumericLike; barbers: bigint }>;
  }

  return prisma.$queryRaw<Array<{ unit_id: string; booked_minutes: NumericLike; barbers: bigint }>>(
    Prisma.sql`
      WITH booked AS (
        SELECT
          t.unit_id,
          COALESCE(
            SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60.0)
              FILTER (
                WHERE a.status IN (
                  'AGENDADO'::"AppointmentStatus",
                  'CONFIRMADO'::"AppointmentStatus",
                  'EM_ATENDIMENTO'::"AppointmentStatus",
                  'FINALIZADO'::"AppointmentStatus",
                  'NO_SHOW'::"AppointmentStatus"
                )
              ),
            0
          ) AS booked_minutes
        FROM appointments a
        INNER JOIN tenants t ON t.id = a.tenant_id
        WHERE a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
          AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        GROUP BY t.unit_id
      ),
      barbers AS (
        SELECT
          t.unit_id,
          COUNT(*)::bigint AS barbers
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        INNER JOIN tenants t ON t.id = u.tenant_id
        WHERE u.active = true
          AND r.name = 'BARBER'::"RoleName"
          AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        GROUP BY t.unit_id
      )
      SELECT
        COALESCE(b.unit_id, br.unit_id) AS unit_id,
        COALESCE(b.booked_minutes, 0) AS booked_minutes,
        COALESCE(br.barbers, 0)::bigint AS barbers
      FROM booked b
      FULL OUTER JOIN barbers br ON br.unit_id = b.unit_id
    `
  );
};

const buildUnitMetrics = async (scope: ReturnType<typeof resolveScope>, query: FranchiseQueryInput) => {
  const period = resolvePeriod(query);
  const previous = getPreviousPeriod(period);
  const periodDays = Math.max(
    1,
    Math.floor((startOfDay(period.end).getTime() - startOfDay(period.start).getTime()) / DAY_MS) + 1
  );
  const units = await getScopedUnits(scope, query);
  const unitIds = units.map((unit) => unit.unit_id);

  const [revenueRows, noShowRows, clientRows, occupancyRows] = await Promise.all([
    getUnitRevenueRows(unitIds, period, previous),
    getUnitNoShowRows(unitIds, period),
    getUnitClientRows(unitIds, period),
    getUnitOccupancyRows(unitIds, period)
  ]);

  const revenueMap = new Map(revenueRows.map((row) => [row.unit_id, row]));
  const noShowMap = new Map(noShowRows.map((row) => [row.unit_id, row]));
  const clientMap = new Map(clientRows.map((row) => [row.unit_id, row]));
  const occupancyMap = new Map(occupancyRows.map((row) => [row.unit_id, row]));

  const mapped = units.map((unit) => {
    const revenue = revenueMap.get(unit.unit_id);
    const noShow = noShowMap.get(unit.unit_id);
    const clients = clientMap.get(unit.unit_id);
    const occupancy = occupancyMap.get(unit.unit_id);

    const revenueCurrent = toNumber(revenue?.revenue_current ?? null);
    const revenuePrevious = toNumber(revenue?.revenue_previous ?? null);
    const paymentsCurrent = Number(revenue?.payments_current ?? 0n);
    const noShowCount = Number(noShow?.no_show_count ?? 0n);
    const totalAppointments = Number(noShow?.total_appointments ?? 0n);
    const baseClients = Number(clients?.base_clients ?? 0n);
    const retainedClients = Number(clients?.retained_clients ?? 0n);
    const churnedClients = Number(clients?.churned_clients ?? 0n);
    const bookedMinutes = toNumber(occupancy?.booked_minutes ?? null);
    const barbers = Math.max(Number(occupancy?.barbers ?? 0n), 1);
    const capacity = barbers * BUSINESS_MINUTES_PER_DAY * periodDays;
    const occupancyRate = calculateRate(bookedMinutes, capacity);

    return {
      unitId: unit.unit_id,
      franchiseId: unit.franchise_id,
      franchiseName: unit.franchise_name,
      name: unit.unit_name,
      city: unit.city,
      state: unit.state,
      royaltyPercentage: toNumber(unit.royalty_percentage),
      revenue: revenueCurrent,
      previousRevenue: revenuePrevious,
      growthPercent: calculateGrowth(revenueCurrent, revenuePrevious),
      paymentsCount: paymentsCurrent,
      averageTicket: paymentsCurrent > 0 ? Number((revenueCurrent / paymentsCurrent).toFixed(2)) : 0,
      noShowRate: calculateRate(noShowCount, totalAppointments),
      noShowCount,
      totalAppointments,
      retentionRate: calculateRate(retainedClients, baseClients),
      churnRate: calculateRate(churnedClients, baseClients),
      occupancyRate
    };
  });

  const averageRevenue =
    mapped.length > 0 ? mapped.reduce((sum, row) => sum + row.revenue, 0) / mapped.length : 0;

  return {
    period,
    previous,
    units: mapped.map((unit) => ({
      ...unit,
      performance: getPerformanceSignal(unit.revenue, averageRevenue)
    })),
    averageRevenue
  };
};

export const getFranchiseSummary = async (actor: FranchiseActor, query: FranchiseQueryInput) => {
  const scope = resolveScope(actor);
  const { units, period } = await buildUnitMetrics(scope, query);

  const totalRevenue = units.reduce((sum, unit) => sum + unit.revenue, 0);
  const previousRevenue = units.reduce((sum, unit) => sum + unit.previousRevenue, 0);
  const totalPayments = units.reduce((sum, unit) => sum + unit.paymentsCount, 0);
  const averageOccupancy =
    units.length > 0
      ? Number((units.reduce((sum, unit) => sum + unit.occupancyRate, 0) / units.length).toFixed(2))
      : 0;
  const projectedRoyalties = units.reduce(
    (sum, unit) => sum + calculateRoyaltyAmount(unit.revenue, unit.royaltyPercentage),
    0
  );

  return {
    scope: {
      mode: scope.mode,
      franchiseId: scope.franchiseId,
      unitId: scope.unitId
    },
    period: {
      start: formatDate(period.start),
      end: formatDate(period.end)
    },
    totals: {
      units: units.length,
      revenue: Number(totalRevenue.toFixed(2)),
      previousRevenue: Number(previousRevenue.toFixed(2)),
      growthPercent: calculateGrowth(totalRevenue, previousRevenue),
      averageRevenuePerUnit:
        units.length > 0 ? Number((totalRevenue / units.length).toFixed(2)) : 0,
      averageTicket: totalPayments > 0 ? Number((totalRevenue / totalPayments).toFixed(2)) : 0,
      averageOccupancy,
      projectedRoyalties: Number(projectedRoyalties.toFixed(2))
    }
  };
};

export const getFranchiseRevenue = async (actor: FranchiseActor, query: FranchiseQueryInput) => {
  const scope = resolveScope(actor);
  const { period, previous, units } = await buildUnitMetrics(scope, query);
  const unitIds = units.map((unit) => unit.unitId);

  let byDay: Array<{ day_bucket: Date; revenue: NumericLike }> = [];
  if (unitIds.length > 0) {
    byDay = await prisma.$queryRaw<Array<{ day_bucket: Date; revenue: NumericLike }>>(Prisma.sql`
      SELECT
        DATE_TRUNC('day', p.paid_at) AS day_bucket,
        COALESCE(SUM(p.amount), 0) AS revenue
      FROM payments p
      INNER JOIN tenants t ON t.id = p.tenant_id
      WHERE p.status = 'PAGO'::"PaymentStatus"
        AND p.paid_at BETWEEN ${period.start} AND ${period.end}
        AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
      GROUP BY DATE_TRUNC('day', p.paid_at)
      ORDER BY day_bucket ASC
    `);
  }

  const dayMap = new Map(byDay.map((row) => [formatDate(new Date(row.day_bucket)), toNumber(row.revenue)]));
  const dailySeries: Array<{ date: string; revenue: number }> = [];
  for (let cursor = startOfDay(period.start); cursor <= period.end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const date = formatDate(cursor);
    dailySeries.push({
      date,
      revenue: dayMap.get(date) ?? 0
    });
  }

  const regionRows =
    unitIds.length === 0
      ? []
      : await prisma.$queryRaw<
          Array<{ state: string | null; city: string | null; current_revenue: NumericLike; previous_revenue: NumericLike }>
        >(Prisma.sql`
          SELECT
            u.state,
            u.city,
            COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${period.start} AND ${period.end} THEN p.amount ELSE 0 END), 0) AS current_revenue,
            COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${previous.start} AND ${previous.end} THEN p.amount ELSE 0 END), 0) AS previous_revenue
          FROM payments p
          INNER JOIN tenants t ON t.id = p.tenant_id
          INNER JOIN units u ON u.id = t.unit_id
          WHERE p.status = 'PAGO'::"PaymentStatus"
            AND p.paid_at BETWEEN ${previous.start} AND ${period.end}
            AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
          GROUP BY u.state, u.city
          ORDER BY current_revenue DESC
        `);

  return {
    period: {
      start: formatDate(period.start),
      end: formatDate(period.end)
    },
    revenueByDay: dailySeries,
    revenueByUnit: units
      .map((unit) => ({
        unitId: unit.unitId,
        unitName: unit.name,
        city: unit.city,
        state: unit.state,
        revenue: unit.revenue,
        growthPercent: unit.growthPercent
      }))
      .sort((left, right) => right.revenue - left.revenue),
    revenueByRegion: regionRows.map((row) => ({
      state: row.state,
      city: row.city,
      revenue: toNumber(row.current_revenue),
      growthPercent: calculateGrowth(toNumber(row.current_revenue), toNumber(row.previous_revenue))
    }))
  };
};

export const getFranchiseUnits = async (actor: FranchiseActor, query: FranchiseQueryInput) => {
  const scope = resolveScope(actor);
  const { period, units, averageRevenue } = await buildUnitMetrics(scope, query);

  return {
    period: {
      start: formatDate(period.start),
      end: formatDate(period.end)
    },
    averageRevenue,
    items: units
      .map((unit) => ({
        unitId: unit.unitId,
        name: unit.name,
        city: unit.city,
        state: unit.state,
        franchiseId: unit.franchiseId,
        franchiseName: unit.franchiseName,
        revenue: unit.revenue,
        growthPercent: unit.growthPercent,
        retentionRate: unit.retentionRate,
        churnRate: unit.churnRate,
        noShowRate: unit.noShowRate,
        occupancyRate: unit.occupancyRate,
        averageTicket: unit.averageTicket,
        performance: unit.performance
      }))
      .sort((left, right) => right.revenue - left.revenue)
  };
};

const defaultRoyaltyMonth = () => {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    month: previousMonth.getMonth() + 1,
    year: previousMonth.getFullYear()
  };
};

export const generateMonthlyRoyalties = async (
  payload: MonthlyRoyaltyGenerateInput = {}
) => {
  const monthMeta = payload.month && payload.year ? payload : defaultRoyaltyMonth();
  const periodStart = startOfDay(new Date(monthMeta.year!, monthMeta.month! - 1, 1));
  const periodEnd = endOfDay(new Date(monthMeta.year!, monthMeta.month!, 0));

  const rows = await prisma.$queryRaw<
    Array<{ franchise_id: string; unit_id: string; royalty_percentage: NumericLike; revenue: NumericLike }>
  >(Prisma.sql`
    SELECT
      u.franchise_id,
      u.id AS unit_id,
      f.royalty_percentage,
      COALESCE(SUM(p.amount), 0) AS revenue
    FROM units u
    INNER JOIN franchises f ON f.id = u.franchise_id
    LEFT JOIN tenants t ON t.unit_id = u.id
    LEFT JOIN payments p
      ON p.tenant_id = t.id
      AND p.status = 'PAGO'::"PaymentStatus"
      AND p.paid_at BETWEEN ${periodStart} AND ${periodEnd}
    WHERE u.active = true
      AND u.franchise_id IS NOT NULL
    GROUP BY u.franchise_id, u.id, f.royalty_percentage
  `);

  const operations = rows.map((row) => {
    const revenue = toNumber(row.revenue);
    const royaltyAmount = calculateRoyaltyAmount(revenue, toNumber(row.royalty_percentage));
    return prisma.royalty.upsert({
      where: {
        unitId_periodStart_periodEnd: {
          unitId: row.unit_id,
          periodStart,
          periodEnd
        }
      },
      create: {
        franchiseId: row.franchise_id,
        unitId: row.unit_id,
        periodStart,
        periodEnd,
        revenue,
        royaltyAmount,
        paid: false
      },
      update: {
        revenue,
        royaltyAmount
      }
    });
  });

  await prisma.$transaction(operations);

  return {
    month: monthMeta.month,
    year: monthMeta.year,
    generated: operations.length,
    period: {
      start: formatDate(periodStart),
      end: formatDate(periodEnd)
    }
  };
};

export const getFranchiseRoyalties = async (actor: FranchiseActor, query: RoyaltiesQueryInput) => {
  const scope = resolveScope(actor);
  const period = resolvePeriod(query);
  const { units } = await buildUnitMetrics(scope, query);
  const unitIds = units.map((unit) => unit.unitId);

  if (!unitIds.length) {
    return {
      period: { start: formatDate(period.start), end: formatDate(period.end) },
      projectedTotal: 0,
      pendingTotal: 0,
      paidTotal: 0,
      items: []
    };
  }

  const royaltyRows = await prisma.royalty.findMany({
    where: {
      unitId: { in: unitIds },
      periodStart: {
        gte: startOfDay(period.start)
      },
      periodEnd: {
        lte: endOfDay(period.end)
      },
      ...(query.paid === undefined ? {} : { paid: query.paid })
    },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true
        }
      },
      franchise: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ periodEnd: "desc" }, { unit: { name: "asc" } }]
  });

  const projectedTotal = units.reduce(
    (sum, unit) => sum + calculateRoyaltyAmount(unit.revenue, unit.royaltyPercentage),
    0
  );

  const paidTotal = royaltyRows
    .filter((row) => row.paid)
    .reduce((sum, row) => sum + Number(row.royaltyAmount), 0);
  const pendingTotal = royaltyRows
    .filter((row) => !row.paid)
    .reduce((sum, row) => sum + Number(row.royaltyAmount), 0);

  return {
    period: { start: formatDate(period.start), end: formatDate(period.end) },
    projectedTotal: Number(projectedTotal.toFixed(2)),
    pendingTotal: Number(pendingTotal.toFixed(2)),
    paidTotal: Number(paidTotal.toFixed(2)),
    items: royaltyRows.map((row) => ({
      id: row.id,
      franchiseId: row.franchiseId,
      franchiseName: row.franchise.name,
      unitId: row.unitId,
      unitName: row.unit.name,
      city: row.unit.city,
      state: row.unit.state,
      periodStart: formatDate(row.periodStart),
      periodEnd: formatDate(row.periodEnd),
      revenue: Number(row.revenue),
      royaltyAmount: Number(row.royaltyAmount),
      paid: row.paid
    }))
  };
};

export const getFranchisePerformance = async (
  actor: FranchiseActor,
  query: PerformanceQueryInput
) => {
  const scope = resolveScope(actor);
  const { period, previous, units, averageRevenue } = await buildUnitMetrics(scope, query);
  const ranking = [...units]
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, query.rankingLimit);

  const mostProfitable = ranking[0] ?? null;
  const highestChurn = [...units].sort((left, right) => right.churnRate - left.churnRate)[0] ?? null;
  const highestRetention = [...units].sort((left, right) => right.retentionRate - left.retentionRate)[0] ?? null;

  const unitIds = units.map((unit) => unit.unitId);
  const [expenseRows, commissionRows] = await Promise.all([
    unitIds.length === 0
      ? Promise.resolve([{ total: 0 }])
      : prisma.$queryRaw<Array<{ total: NumericLike }>>(Prisma.sql`
          SELECT COALESCE(SUM(e.amount), 0) AS total
          FROM expenses e
          INNER JOIN tenants t ON t.id = e.tenant_id
          WHERE e.paid = true
            AND e.paid_at BETWEEN ${period.start} AND ${period.end}
            AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        `),
    unitIds.length === 0
      ? Promise.resolve([{ total: 0 }])
      : prisma.$queryRaw<Array<{ total: NumericLike }>>(Prisma.sql`
          SELECT COALESCE(SUM(c.amount), 0) AS total
          FROM commissions c
          INNER JOIN tenants t ON t.id = c.tenant_id
          WHERE c.created_at BETWEEN ${period.start} AND ${period.end}
            AND t.unit_id IN (${Prisma.join(unitIds.map((id) => Prisma.sql`${id}::uuid`), ", ")})
        `)
  ]);

  const totalRevenue = units.reduce((sum, unit) => sum + unit.revenue, 0);
  const totalPayments = units.reduce((sum, unit) => sum + unit.paymentsCount, 0);
  const totalExpenses = toNumber(expenseRows[0]?.total ?? null);
  const totalCommissions = toNumber(commissionRows[0]?.total ?? null);
  const operationalProfit = totalRevenue - totalExpenses - totalCommissions;
  const marginPercent = calculateRate(operationalProfit, totalRevenue);

  const revenueDrop = [...units]
    .filter((unit) => unit.growthPercent < 0)
    .sort((left, right) => left.growthPercent - right.growthPercent)[0];
  const highestNoShow = [...units].sort((left, right) => right.noShowRate - left.noShowRate)[0];
  const highestGrowth = [...units].sort((left, right) => right.growthPercent - left.growthPercent)[0];
  const belowTarget = [...units].find((unit) => unit.revenue < averageRevenue * 0.7);

  const insights: Array<{ severity: "info" | "warning" | "success"; message: string }> = [];
  if (revenueDrop) {
    insights.push({
      severity: "warning",
      message: `Unidade ${revenueDrop.name} teve queda de ${Math.abs(revenueDrop.growthPercent)}% na receita.`
    });
  }
  if (highestNoShow && highestNoShow.noShowRate >= 10) {
    insights.push({
      severity: "warning",
      message: `Unidade ${highestNoShow.name} esta com no-show de ${highestNoShow.noShowRate}%.`
    });
  }
  if (highestGrowth && highestGrowth.growthPercent > 0) {
    insights.push({
      severity: "success",
      message: `Unidade ${highestGrowth.name} lidera crescimento com ${highestGrowth.growthPercent}%.`
    });
  }
  if (belowTarget) {
    insights.push({
      severity: "info",
      message: `Unidade ${belowTarget.name} esta abaixo da meta media de receita.`
    });
  }
  if (insights.length === 0) {
    insights.push({
      severity: "info",
      message: "Sem alertas criticos de performance no periodo."
    });
  }

  return {
    period: {
      start: formatDate(period.start),
      end: formatDate(period.end),
      previousStart: formatDate(previous.start),
      previousEnd: formatDate(previous.end)
    },
    metrics: {
      revenueAveragePerUnit: units.length > 0 ? Number((totalRevenue / units.length).toFixed(2)) : 0,
      mostProfitableUnit: mostProfitable
        ? {
            unitId: mostProfitable.unitId,
            unitName: mostProfitable.name,
            revenue: mostProfitable.revenue
          }
        : null,
      highestChurnUnit: highestChurn
        ? {
            unitId: highestChurn.unitId,
            unitName: highestChurn.name,
            churnRate: highestChurn.churnRate
          }
        : null,
      highestRetentionUnit: highestRetention
        ? {
            unitId: highestRetention.unitId,
            unitName: highestRetention.name,
            retentionRate: highestRetention.retentionRate
          }
        : null,
      ticketAverageConsolidated:
        totalPayments > 0 ? Number((totalRevenue / totalPayments).toFixed(2)) : 0,
      consolidatedMargin: {
        revenue: Number(totalRevenue.toFixed(2)),
        expenses: Number(totalExpenses.toFixed(2)),
        commissions: Number(totalCommissions.toFixed(2)),
        operationalProfit: Number(operationalProfit.toFixed(2)),
        marginPercent
      }
    },
    ranking: ranking.map((unit) => ({
      unitId: unit.unitId,
      unitName: unit.name,
      revenue: unit.revenue,
      growthPercent: unit.growthPercent,
      retentionRate: unit.retentionRate,
      churnRate: unit.churnRate,
      noShowRate: unit.noShowRate,
      performance: unit.performance
    })),
    insights
  };
};

export const startFranchiseSchedulers = () => {
  if (royaltyTimer) {
    return;
  }

  royaltyTimer = setInterval(() => {
    generateMonthlyRoyalties().catch(() => null);
  }, ROYALTY_SWEEP_INTERVAL_MS);
};

export const stopFranchiseSchedulers = () => {
  if (!royaltyTimer) {
    return;
  }
  clearInterval(royaltyTimer);
  royaltyTimer = null;
};
