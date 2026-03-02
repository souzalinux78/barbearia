import { Prisma, RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  buildExecutiveInsights,
  calculateGrowth,
  calculateLtv,
  calculateRate,
  getPreviousPeriod
} from "./dashboard.calculations";
import { withCache } from "./dashboard.cache";
import {
  AdvancedMetricsQueryInput,
  DashboardPeriodQueryInput,
  ExportQueryInput
} from "./dashboard.schemas";

type DashboardActor = {
  userId: string;
  role: RoleName;
};

type DateRange = {
  start: Date;
  end: Date;
};

type NumericLike = Prisma.Decimal | number | string | null;

const CACHE_TTL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BUSINESS_OPEN_MINUTES = 8 * 60;
const BUSINESS_CLOSE_MINUTES = 20 * 60;
const BUSINESS_MINUTES_PER_DAY = BUSINESS_CLOSE_MINUTES - BUSINESS_OPEN_MINUTES;
const WEEKDAY_PT = [
  "Domingo",
  "Segunda-feira",
  "Terca-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sabado"
];

const startOfDay = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const toDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const toNumber = (value: NumericLike): number => Number(value ?? 0);

const formatDate = (value: Date): string => value.toISOString().slice(0, 10);

const toSqlTimestamp = (value: Date): string => {
  const pad = (input: number, size = 2) => String(input).padStart(size, "0");
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(
    value.getUTCHours()
  )}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}.${pad(value.getUTCMilliseconds(), 3)}`;
};

const resolvePeriod = (query: DashboardPeriodQueryInput): DateRange => {
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

const makeCacheKey = (
  key: string,
  tenantId: string,
  actor: DashboardActor,
  period: DateRange,
  suffix = ""
): string =>
  [
    "dashboard",
    key,
    tenantId,
    actor.role,
    actor.userId,
    period.start.toISOString(),
    period.end.toISOString(),
    suffix
  ].join(":");

const fillDaySeries = (
  period: DateRange,
  rows: Array<{ day_bucket: Date; revenue: NumericLike }>
): Array<{ date: string; revenue: number }> => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(formatDate(row.day_bucket), toNumber(row.revenue));
  });

  const result: Array<{ date: string; revenue: number }> = [];
  for (let cursor = startOfDay(period.start); cursor <= period.end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const key = formatDate(cursor);
    result.push({
      date: key,
      revenue: map.get(key) ?? 0
    });
  }
  return result;
};

export const getRevenueMetrics = async (
  tenantId: string,
  actor: DashboardActor,
  query: DashboardPeriodQueryInput
) => {
  const period = resolvePeriod(query);
  const previousPeriod = getPreviousPeriod(period);
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekStart = startOfDay(new Date(now.getTime() - 6 * DAY_MS));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthsStart = startOfDay(new Date(period.end.getFullYear(), period.end.getMonth() - 5, 1));

  const cacheKey = makeCacheKey("revenue", tenantId, actor, period);

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const paymentActorFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;

    const [totalsRows, byDayRows, byBarberRows, byServiceRows, monthlyRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          revenue_today: NumericLike;
          revenue_week: NumericLike;
          revenue_month: NumericLike;
          revenue_period: NumericLike;
          revenue_previous: NumericLike;
        }>
      >(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${toSqlTimestamp(dayStart)}::timestamp AND ${toSqlTimestamp(dayEnd)}::timestamp THEN p.amount ELSE 0 END), 0) AS revenue_today,
          COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${toSqlTimestamp(weekStart)}::timestamp AND ${toSqlTimestamp(dayEnd)}::timestamp THEN p.amount ELSE 0 END), 0) AS revenue_week,
          COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${toSqlTimestamp(monthStart)}::timestamp AND ${toSqlTimestamp(dayEnd)}::timestamp THEN p.amount ELSE 0 END), 0) AS revenue_month,
          COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp THEN p.amount ELSE 0 END), 0) AS revenue_period,
          COALESCE(SUM(CASE WHEN p.paid_at BETWEEN ${toSqlTimestamp(previousPeriod.start)}::timestamp AND ${toSqlTimestamp(previousPeriod.end)}::timestamp THEN p.amount ELSE 0 END), 0) AS revenue_previous
        FROM payments p
        LEFT JOIN appointments a ON a.id = p.appointment_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'PAGO'::"PaymentStatus"
          ${paymentActorFilter}
      `),
      prisma.$queryRaw<Array<{ day_bucket: Date; revenue: NumericLike }>>(Prisma.sql`
        SELECT
          DATE_TRUNC('day', p.paid_at) AS day_bucket,
          COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        LEFT JOIN appointments a ON a.id = p.appointment_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'PAGO'::"PaymentStatus"
          AND p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
          ${paymentActorFilter}
        GROUP BY DATE_TRUNC('day', p.paid_at)
        ORDER BY day_bucket
      `),
      prisma.$queryRaw<Array<{ barber_id: string; barber_name: string; revenue: NumericLike }>>(Prisma.sql`
        SELECT
          u.id AS barber_id,
          u.name AS barber_name,
          COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        INNER JOIN appointments a ON a.id = p.appointment_id
        INNER JOIN users u ON u.id = a.barber_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'PAGO'::"PaymentStatus"
          AND p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
          ${paymentActorFilter}
        GROUP BY u.id, u.name
        ORDER BY revenue DESC
      `),
      prisma.$queryRaw<Array<{ service_id: string; service_name: string; revenue: NumericLike; sales: bigint }>>(
        Prisma.sql`
          SELECT
            s.id AS service_id,
            s.name AS service_name,
            COALESCE(SUM(aps.price), 0) AS revenue,
            COUNT(*)::bigint AS sales
          FROM appointment_services aps
          INNER JOIN appointments a ON a.id = aps.appointment_id
          INNER JOIN services s ON s.id = aps.service_id
          WHERE aps.tenant_id = ${tenantId}::uuid
            AND a.status = 'FINALIZADO'::"AppointmentStatus"
            AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
            ${actor.role === RoleName.BARBER ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid` : Prisma.empty}
          GROUP BY s.id, s.name
          ORDER BY revenue DESC
        `
      ),
      prisma.$queryRaw<Array<{ month_bucket: Date; revenue: NumericLike }>>(Prisma.sql`
        SELECT
          DATE_TRUNC('month', p.paid_at) AS month_bucket,
          COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        LEFT JOIN appointments a ON a.id = p.appointment_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'PAGO'::"PaymentStatus"
          AND p.paid_at BETWEEN ${toSqlTimestamp(monthsStart)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
          ${paymentActorFilter}
        GROUP BY DATE_TRUNC('month', p.paid_at)
        ORDER BY month_bucket
      `)
    ]);

    const totals = totalsRows[0];
    const revenueToday = toNumber(totals?.revenue_today);
    const revenueWeek = toNumber(totals?.revenue_week);
    const revenueMonth = toNumber(totals?.revenue_month);
    const revenuePeriod = toNumber(totals?.revenue_period);
    const revenuePreviousPeriod = toNumber(totals?.revenue_previous);

    const byDay = fillDaySeries(period, byDayRows);

    const byBarber = byBarberRows.map((row) => ({
      barberId: row.barber_id,
      barberName: row.barber_name,
      revenue: toNumber(row.revenue)
    }));

    const byService = byServiceRows.map((row) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      revenue: toNumber(row.revenue),
      sales: Number(row.sales)
    }));

    const monthlyMap = new Map(
      monthlyRows.map((row) => [formatDate(startOfDay(new Date(row.month_bucket))), toNumber(row.revenue)])
    );

    const monthlyGrowth: Array<{ month: string; revenue: number; growthPercent: number }> = [];
    let previousValue = 0;
    for (let index = 0; index < 6; index += 1) {
      const monthDate = new Date(monthsStart.getFullYear(), monthsStart.getMonth() + index, 1);
      const monthKey = formatDate(monthDate);
      const current = monthlyMap.get(monthKey) ?? 0;
      monthlyGrowth.push({
        month: monthKey.slice(0, 7),
        revenue: current,
        growthPercent: index === 0 ? 0 : calculateGrowth(current, previousValue)
      });
      previousValue = current;
    }

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenuePeriod,
      revenuePreviousPeriod,
      growthPercent: calculateGrowth(revenuePeriod, revenuePreviousPeriod),
      byDay,
      byBarber,
      byService,
      monthlyGrowth
    };
  });
};

export const getClientMetrics = async (
  tenantId: string,
  actor: DashboardActor,
  query: DashboardPeriodQueryInput
) => {
  const period = resolvePeriod(query);
  const cacheKey = makeCacheKey("clients", tenantId, actor, period);
  const now = new Date();
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const appointmentBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;
    const paymentBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;

    const newClientsMonthPromise =
      actor.role === RoleName.BARBER
        ? prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
            WITH first_visit AS (
              SELECT a.client_id, MIN(a.date) AS first_date
              FROM appointments a
              WHERE a.tenant_id = ${tenantId}::uuid
                AND a.client_id IS NOT NULL
                AND a.status = 'FINALIZADO'::"AppointmentStatus"
                AND a.barber_id = ${actor.userId}::uuid
              GROUP BY a.client_id
            )
            SELECT COUNT(*)::bigint AS total
            FROM first_visit
            WHERE first_date BETWEEN ${monthStart} AND ${todayEnd}
          `)
        : prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
            SELECT COUNT(*)::bigint AS total
            FROM clients c
            WHERE c.tenant_id = ${tenantId}::uuid
              AND c.created_at BETWEEN ${monthStart} AND ${todayEnd}
          `);

    const newClientsTodayPromise =
      actor.role === RoleName.BARBER
        ? prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
            WITH first_visit AS (
              SELECT a.client_id, MIN(a.date) AS first_date
              FROM appointments a
              WHERE a.tenant_id = ${tenantId}::uuid
                AND a.client_id IS NOT NULL
                AND a.status = 'FINALIZADO'::"AppointmentStatus"
                AND a.barber_id = ${actor.userId}::uuid
              GROUP BY a.client_id
            )
            SELECT COUNT(*)::bigint AS total
            FROM first_visit
            WHERE first_date BETWEEN ${todayStart} AND ${todayEnd}
          `)
        : prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
            SELECT COUNT(*)::bigint AS total
            FROM clients c
            WHERE c.tenant_id = ${tenantId}::uuid
              AND c.created_at BETWEEN ${todayStart} AND ${todayEnd}
          `);

    const [newClientsMonthRows, newClientsTodayRows, recurringRows, noShowRows, avgReturnRows, ticketRows, vipRows] =
      await Promise.all([
        newClientsMonthPromise,
        newClientsTodayPromise,
        prisma.$queryRaw<Array<{ recurring_clients: bigint; active_clients: bigint }>>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE grouped.visits >= 2)::bigint AS recurring_clients,
            COUNT(*)::bigint AS active_clients
          FROM (
            SELECT a.client_id, COUNT(*) AS visits
            FROM appointments a
            WHERE a.tenant_id = ${tenantId}::uuid
              AND a.client_id IS NOT NULL
              AND a.status = 'FINALIZADO'::"AppointmentStatus"
              AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
              ${appointmentBarberFilter}
            GROUP BY a.client_id
          ) grouped
        `),
        prisma.$queryRaw<Array<{ no_show_count: bigint; total_appointments: bigint }>>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE a.status = 'NO_SHOW'::"AppointmentStatus")::bigint AS no_show_count,
            COUNT(*) FILTER (WHERE a.status <> 'BLOQUEADO'::"AppointmentStatus")::bigint AS total_appointments
          FROM appointments a
          WHERE a.tenant_id = ${tenantId}::uuid
            AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
            ${appointmentBarberFilter}
        `),
        prisma.$queryRaw<Array<{ avg_gap_days: NumericLike }>>(Prisma.sql`
          WITH ordered AS (
            SELECT
              a.client_id,
              a.date,
              LAG(a.date) OVER (PARTITION BY a.client_id ORDER BY a.date) AS prev_date
            FROM appointments a
            WHERE a.tenant_id = ${tenantId}::uuid
              AND a.client_id IS NOT NULL
              AND a.status = 'FINALIZADO'::"AppointmentStatus"
              AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
              ${appointmentBarberFilter}
          ),
          gaps AS (
            SELECT (date - prev_date)::numeric AS gap_days
            FROM ordered
            WHERE prev_date IS NOT NULL
          )
          SELECT COALESCE(AVG(gap_days), 0) AS avg_gap_days
          FROM gaps
        `),
        prisma.$queryRaw<Array<{ total_revenue: NumericLike; paying_clients: bigint }>>(Prisma.sql`
          SELECT
            COALESCE(SUM(p.amount), 0) AS total_revenue,
            COUNT(DISTINCT p.client_id)::bigint AS paying_clients
          FROM payments p
          LEFT JOIN appointments a ON a.id = p.appointment_id
          WHERE p.tenant_id = ${tenantId}::uuid
            AND p.status = 'PAGO'::"PaymentStatus"
            AND p.client_id IS NOT NULL
            AND p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
            ${paymentBarberFilter}
        `),
        prisma.$queryRaw<Array<{ vip_revenue: NumericLike; total_revenue: NumericLike }>>(Prisma.sql`
          SELECT
            COALESCE(SUM(CASE WHEN c.vip_badge THEN p.amount ELSE 0 END), 0) AS vip_revenue,
            COALESCE(SUM(p.amount), 0) AS total_revenue
          FROM payments p
          LEFT JOIN clients c ON c.id = p.client_id
          LEFT JOIN appointments a ON a.id = p.appointment_id
          WHERE p.tenant_id = ${tenantId}::uuid
            AND p.status = 'PAGO'::"PaymentStatus"
            AND p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
            ${paymentBarberFilter}
        `)
      ]);

    const recurring = recurringRows[0] ?? { recurring_clients: 0n, active_clients: 0n };
    const noShow = noShowRows[0] ?? { no_show_count: 0n, total_appointments: 0n };
    const tickets = ticketRows[0] ?? { total_revenue: 0, paying_clients: 0n };
    const vip = vipRows[0] ?? { vip_revenue: 0, total_revenue: 0 };

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      newClientsMonth: Number(newClientsMonthRows[0]?.total ?? 0n),
      newClientsToday: Number(newClientsTodayRows[0]?.total ?? 0n),
      recurringClients: Number(recurring.recurring_clients ?? 0n),
      retentionRate: calculateRate(
        Number(recurring.recurring_clients ?? 0n),
        Number(recurring.active_clients ?? 0n)
      ),
      noShowRate: calculateRate(
        Number(noShow.no_show_count ?? 0n),
        Number(noShow.total_appointments ?? 0n)
      ),
      noShowAppointments: Number(noShow.no_show_count ?? 0n),
      totalAppointments: Number(noShow.total_appointments ?? 0n),
      averageReturnFrequencyDays: Number(toNumber(avgReturnRows[0]?.avg_gap_days).toFixed(2)),
      averageTicketPerClient: Number(
        (
          toNumber(tickets.total_revenue) / Math.max(Number(tickets.paying_clients ?? 0n), 1)
        ).toFixed(2)
      ),
      payingClients: Number(tickets.paying_clients ?? 0n),
      totalRevenue: toNumber(tickets.total_revenue),
      vipRevenue: toNumber(vip.vip_revenue),
      vipSharePercent: calculateRate(toNumber(vip.vip_revenue), toNumber(vip.total_revenue))
    };
  });
};

export const getServiceMetrics = async (
  tenantId: string,
  actor: DashboardActor,
  query: DashboardPeriodQueryInput
) => {
  const period = resolvePeriod(query);
  const cacheKey = makeCacheKey("services", tenantId, actor, period);

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const appointmentBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;

    const [serviceRows, durationRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{ service_id: string; service_name: string; sold_count: bigint; revenue: NumericLike }>
      >(Prisma.sql`
        SELECT
          s.id AS service_id,
          s.name AS service_name,
          COUNT(*)::bigint AS sold_count,
          COALESCE(SUM(aps.price), 0) AS revenue
        FROM appointment_services aps
        INNER JOIN appointments a ON a.id = aps.appointment_id
        INNER JOIN services s ON s.id = aps.service_id
        WHERE aps.tenant_id = ${tenantId}::uuid
          AND a.status = 'FINALIZADO'::"AppointmentStatus"
          AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
          ${appointmentBarberFilter}
        GROUP BY s.id, s.name
        ORDER BY sold_count DESC, revenue DESC
      `),
      prisma.$queryRaw<Array<{ avg_duration_min: NumericLike }>>(Prisma.sql`
        WITH appointment_duration AS (
          SELECT
            a.id,
            COALESCE(SUM(aps.duration_min), 0) AS total_duration_min
          FROM appointments a
          INNER JOIN appointment_services aps ON aps.appointment_id = a.id
          WHERE a.tenant_id = ${tenantId}::uuid
            AND a.status = 'FINALIZADO'::"AppointmentStatus"
            AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
            ${appointmentBarberFilter}
          GROUP BY a.id
        )
        SELECT COALESCE(AVG(total_duration_min), 0) AS avg_duration_min
        FROM appointment_duration
      `)
    ]);

    const mostSold = serviceRows[0]
      ? {
          serviceId: serviceRows[0].service_id,
          serviceName: serviceRows[0].service_name,
          totalSales: Number(serviceRows[0].sold_count)
        }
      : null;

    const mostProfitableRow = [...serviceRows].sort((left, right) => toNumber(right.revenue) - toNumber(left.revenue))[0];
    const mostProfitable = mostProfitableRow
      ? {
          serviceId: mostProfitableRow.service_id,
          serviceName: mostProfitableRow.service_name,
          revenue: toNumber(mostProfitableRow.revenue)
        }
      : null;

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      mostSoldService: mostSold,
      mostProfitableService: mostProfitable,
      averageServiceDurationMin: Number(toNumber(durationRows[0]?.avg_duration_min).toFixed(2)),
      revenueByService: serviceRows.map((row) => ({
        serviceId: row.service_id,
        serviceName: row.service_name,
        totalSales: Number(row.sold_count),
        revenue: toNumber(row.revenue)
      }))
    };
  });
};

export const getBarberMetrics = async (
  tenantId: string,
  actor: DashboardActor,
  query: DashboardPeriodQueryInput
) => {
  const period = resolvePeriod(query);
  const cacheKey = makeCacheKey("barbers", tenantId, actor, period);
  const periodDays = Math.max(1, Math.floor((period.end.getTime() - period.start.getTime()) / DAY_MS) + 1);

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const actorBarberConstraint =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND u.id = ${actor.userId}::uuid`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        barber_id: string;
        barber_name: string;
        revenue: NumericLike;
        commission: NumericLike;
        appointments: bigint;
        booked_minutes: NumericLike;
      }>
    >(Prisma.sql`
      SELECT
        u.id AS barber_id,
        u.name AS barber_name,
        COALESCE(revenue_data.revenue, 0) AS revenue,
        COALESCE(commission_data.commission, 0) AS commission,
        COALESCE(appointment_data.appointments, 0)::bigint AS appointments,
        COALESCE(appointment_data.booked_minutes, 0) AS booked_minutes
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      LEFT JOIN (
        SELECT
          a.barber_id,
          SUM(p.amount) AS revenue
        FROM payments p
        INNER JOIN appointments a ON a.id = p.appointment_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'PAGO'::"PaymentStatus"
          AND p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
        GROUP BY a.barber_id
      ) revenue_data ON revenue_data.barber_id = u.id
      LEFT JOIN (
        SELECT
          c.barber_id,
          SUM(c.amount) AS commission
        FROM commissions c
        WHERE c.tenant_id = ${tenantId}::uuid
          AND c.created_at BETWEEN ${period.start} AND ${period.end}
        GROUP BY c.barber_id
      ) commission_data ON commission_data.barber_id = u.id
      LEFT JOIN (
        SELECT
          a.barber_id,
          COUNT(*) FILTER (WHERE a.status = 'FINALIZADO'::"AppointmentStatus") AS appointments,
          SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60.0)
            FILTER (
              WHERE a.status IN (
                'AGENDADO'::"AppointmentStatus",
                'CONFIRMADO'::"AppointmentStatus",
                'EM_ATENDIMENTO'::"AppointmentStatus",
                'FINALIZADO'::"AppointmentStatus",
                'NO_SHOW'::"AppointmentStatus"
              )
            ) AS booked_minutes
        FROM appointments a
        WHERE a.tenant_id = ${tenantId}::uuid
          AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
        GROUP BY a.barber_id
      ) appointment_data ON appointment_data.barber_id = u.id
      WHERE u.tenant_id = ${tenantId}::uuid
        AND u.active = true
        AND r.name = 'BARBER'::"RoleName"
        ${actorBarberConstraint}
      ORDER BY revenue DESC, appointments DESC, u.name ASC
    `);

    const capacityPerBarber = BUSINESS_MINUTES_PER_DAY * periodDays;
    const mapped = rows.map((row) => {
      const revenue = toNumber(row.revenue);
      const appointments = Number(row.appointments ?? 0n);
      const bookedMinutes = toNumber(row.booked_minutes);
      return {
        barberId: row.barber_id,
        barberName: row.barber_name,
        revenue,
        commission: toNumber(row.commission),
        appointments,
        occupancyRate: Math.min(100, calculateRate(bookedMinutes, capacityPerBarber)),
        averageTicket: appointments > 0 ? Number((revenue / appointments).toFixed(2)) : 0
      };
    });

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      rankingByRevenue: [...mapped].sort((left, right) => right.revenue - left.revenue),
      rankingByCommission: [...mapped].sort((left, right) => right.commission - left.commission),
      rankingByAppointments: [...mapped].sort((left, right) => right.appointments - left.appointments),
      barbers: mapped
    };
  });
};

export const getOccupancyMetrics = async (
  tenantId: string,
  actor: DashboardActor,
  query: DashboardPeriodQueryInput
) => {
  const period = resolvePeriod(query);
  const referenceDay = startOfDay(period.end);
  const weekStart = startOfDay(new Date(referenceDay.getTime() - 6 * DAY_MS));
  const weekEnd = endOfDay(referenceDay);
  const cacheKey = makeCacheKey("occupancy", tenantId, actor, period);

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const appointmentBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;

    const [activeBarbersRows, weekRows, profitableHourRows, profitableWeekdayRows] = await Promise.all([
      actor.role === RoleName.BARBER
        ? Promise.resolve([{ total: 1n }])
        : prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
            SELECT COUNT(*)::bigint AS total
            FROM users u
            INNER JOIN roles r ON r.id = u.role_id
            WHERE u.tenant_id = ${tenantId}::uuid
              AND u.active = true
              AND r.name = 'BARBER'::"RoleName"
          `),
      prisma.$queryRaw<Array<{ date_bucket: Date; booked_minutes: NumericLike; appointments: bigint }>>(Prisma.sql`
        SELECT
          a.date AS date_bucket,
          COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60.0), 0) AS booked_minutes,
          COUNT(*) FILTER (WHERE a.status IN (
            'AGENDADO'::"AppointmentStatus",
            'CONFIRMADO'::"AppointmentStatus",
            'EM_ATENDIMENTO'::"AppointmentStatus",
            'FINALIZADO'::"AppointmentStatus",
            'NO_SHOW'::"AppointmentStatus"
          ))::bigint AS appointments
        FROM appointments a
        WHERE a.tenant_id = ${tenantId}::uuid
          AND a.date BETWEEN ${weekStart} AND ${weekEnd}
          AND a.status IN (
            'AGENDADO'::"AppointmentStatus",
            'CONFIRMADO'::"AppointmentStatus",
            'EM_ATENDIMENTO'::"AppointmentStatus",
            'FINALIZADO'::"AppointmentStatus",
            'NO_SHOW'::"AppointmentStatus"
          )
          ${appointmentBarberFilter}
        GROUP BY a.date
        ORDER BY a.date
      `),
      prisma.$queryRaw<Array<{ hour_bucket: number; revenue: NumericLike }>>(Prisma.sql`
        SELECT
          EXTRACT(HOUR FROM a.start_time)::int AS hour_bucket,
          COALESCE(SUM(aps.price), 0) AS revenue
        FROM appointment_services aps
        INNER JOIN appointments a ON a.id = aps.appointment_id
        WHERE aps.tenant_id = ${tenantId}::uuid
          AND a.status = 'FINALIZADO'::"AppointmentStatus"
          AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
          ${appointmentBarberFilter}
        GROUP BY hour_bucket
        ORDER BY revenue DESC
        LIMIT 1
      `),
      prisma.$queryRaw<Array<{ dow_bucket: number; revenue: NumericLike }>>(Prisma.sql`
        SELECT
          EXTRACT(DOW FROM a.date)::int AS dow_bucket,
          COALESCE(SUM(aps.price), 0) AS revenue
        FROM appointment_services aps
        INNER JOIN appointments a ON a.id = aps.appointment_id
        WHERE aps.tenant_id = ${tenantId}::uuid
          AND a.status = 'FINALIZADO'::"AppointmentStatus"
          AND a.date BETWEEN ${startOfDay(period.start)} AND ${endOfDay(period.end)}
          ${appointmentBarberFilter}
        GROUP BY dow_bucket
        ORDER BY revenue DESC
        LIMIT 1
      `)
    ]);

    const activeBarbers = Math.max(Number(activeBarbersRows[0]?.total ?? 1n), 1);
    const dayCapacity = activeBarbers * BUSINESS_MINUTES_PER_DAY;
    const weekCapacity = dayCapacity * 7;

    const dayMap = new Map(
      weekRows.map((row) => [
        formatDate(row.date_bucket),
        { bookedMinutes: toNumber(row.booked_minutes), appointments: Number(row.appointments) }
      ])
    );

    const weeklySeries: Array<{ date: string; occupancyPercent: number; bookedMinutes: number }> = [];
    let weekBookedMinutes = 0;
    let dayBookedAppointments = 0;
    for (let cursor = weekStart; cursor <= referenceDay; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const key = formatDate(cursor);
      const value = dayMap.get(key);
      const bookedMinutes = value?.bookedMinutes ?? 0;
      weeklySeries.push({
        date: key,
        bookedMinutes,
        occupancyPercent: Number(((bookedMinutes / dayCapacity) * 100).toFixed(2))
      });
      weekBookedMinutes += bookedMinutes;
      if (key === formatDate(referenceDay)) {
        dayBookedAppointments = value?.appointments ?? 0;
      }
    }

    const todayBookedMinutes = dayMap.get(formatDate(referenceDay))?.bookedMinutes ?? 0;
    const topHour = profitableHourRows[0];
    const topWeekday = profitableWeekdayRows[0];

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      occupancyDayPercent: Number(((todayBookedMinutes / dayCapacity) * 100).toFixed(2)),
      occupancyWeekPercent: Number(((weekBookedMinutes / weekCapacity) * 100).toFixed(2)),
      dayBookedAppointments,
      activeBarbers,
      mostProfitableHour: topHour
        ? {
            hour: String(topHour.hour_bucket).padStart(2, "0"),
            revenue: toNumber(topHour.revenue)
          }
        : null,
      mostProfitableWeekday: topWeekday
        ? {
            weekdayIndex: topWeekday.dow_bucket,
            weekdayName: WEEKDAY_PT[topWeekday.dow_bucket] ?? "Sem dados",
            revenue: toNumber(topWeekday.revenue)
          }
        : null,
      weeklySeries
    };
  });
};

export const getAdvancedMetrics = async (
  tenantId: string,
  actor: DashboardActor,
  query: AdvancedMetricsQueryInput
) => {
  const period = resolvePeriod(query);
  const cacheKey = makeCacheKey(
    "advanced",
    tenantId,
    actor,
    period,
    `churn-${query.churnWindowDays}`
  );

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const paymentBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;
    const appointmentBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND a.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;
    const commissionBarberFilter =
      actor.role === RoleName.BARBER
        ? Prisma.sql`AND c.barber_id = ${actor.userId}::uuid`
        : Prisma.empty;

    const churnWindowStart = startOfDay(new Date(period.end.getTime() - (query.churnWindowDays - 1) * DAY_MS));

    const [ltvRows, revenueRows, expenseRows, commissionRows, churnRows] = await Promise.all([
      prisma.$queryRaw<Array<{ avg_revenue_per_client: NumericLike; avg_retention_days: NumericLike }>>(
        Prisma.sql`
          WITH client_revenue AS (
            SELECT
              p.client_id,
              SUM(p.amount) AS total_revenue
            FROM payments p
            LEFT JOIN appointments a ON a.id = p.appointment_id
            WHERE p.tenant_id = ${tenantId}::uuid
              AND p.status = 'PAGO'::"PaymentStatus"
              AND p.client_id IS NOT NULL
              ${paymentBarberFilter}
            GROUP BY p.client_id
          ),
          retention AS (
            SELECT
              a.client_id,
              (MAX(a.date) - MIN(a.date))::numeric AS retention_days
            FROM appointments a
            WHERE a.tenant_id = ${tenantId}::uuid
              AND a.client_id IS NOT NULL
              AND a.status = 'FINALIZADO'::"AppointmentStatus"
              ${appointmentBarberFilter}
            GROUP BY a.client_id
          )
          SELECT
            COALESCE(AVG(cr.total_revenue), 0) AS avg_revenue_per_client,
            COALESCE(AVG(retention.retention_days), 0) AS avg_retention_days
          FROM client_revenue cr
          LEFT JOIN retention ON retention.client_id = cr.client_id
        `
      ),
      prisma.$queryRaw<Array<{ revenue: NumericLike }>>(Prisma.sql`
        SELECT COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        LEFT JOIN appointments a ON a.id = p.appointment_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'PAGO'::"PaymentStatus"
          AND p.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
          ${paymentBarberFilter}
      `),
      actor.role === RoleName.BARBER
        ? Promise.resolve([{ expenses: 0 }])
        : prisma.$queryRaw<Array<{ expenses: NumericLike }>>(Prisma.sql`
            SELECT COALESCE(SUM(e.amount), 0) AS expenses
            FROM expenses e
            WHERE e.tenant_id = ${tenantId}::uuid
              AND e.paid = true
              AND e.paid_at BETWEEN ${toSqlTimestamp(period.start)}::timestamp AND ${toSqlTimestamp(period.end)}::timestamp
          `),
      prisma.$queryRaw<Array<{ commissions: NumericLike }>>(Prisma.sql`
        SELECT COALESCE(SUM(c.amount), 0) AS commissions
        FROM commissions c
        WHERE c.tenant_id = ${tenantId}::uuid
          AND c.created_at BETWEEN ${period.start} AND ${period.end}
          ${commissionBarberFilter}
      `),
      prisma.$queryRaw<Array<{ base_clients: bigint; churned_clients: bigint }>>(Prisma.sql`
        WITH historical_clients AS (
          SELECT DISTINCT a.client_id
          FROM appointments a
          WHERE a.tenant_id = ${tenantId}::uuid
            AND a.client_id IS NOT NULL
            AND a.status = 'FINALIZADO'::"AppointmentStatus"
            AND a.date < ${churnWindowStart}
            ${appointmentBarberFilter}
        ),
        recent_clients AS (
          SELECT DISTINCT a.client_id
          FROM appointments a
          WHERE a.tenant_id = ${tenantId}::uuid
            AND a.client_id IS NOT NULL
            AND a.status = 'FINALIZADO'::"AppointmentStatus"
            AND a.date BETWEEN ${churnWindowStart} AND ${endOfDay(period.end)}
            ${appointmentBarberFilter}
        )
        SELECT
          (SELECT COUNT(*)::bigint FROM historical_clients) AS base_clients,
          (
            SELECT COUNT(*)::bigint
            FROM historical_clients hc
            LEFT JOIN recent_clients rc ON rc.client_id = hc.client_id
            WHERE rc.client_id IS NULL
          ) AS churned_clients
      `)
    ]);

    const ltvBase = ltvRows[0] ?? { avg_revenue_per_client: 0, avg_retention_days: 0 };
    const revenue = toNumber(revenueRows[0]?.revenue);
    const expenses = toNumber(expenseRows[0]?.expenses);
    const commissions = toNumber(commissionRows[0]?.commissions);
    const operationalProfit = revenue - expenses - commissions;
    const marginPercent = calculateRate(operationalProfit, revenue);
    const baseClients = Number(churnRows[0]?.base_clients ?? 0n);
    const churnedClients = Number(churnRows[0]?.churned_clients ?? 0n);

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      churnWindowDays: query.churnWindowDays,
      ltv: {
        averageRevenuePerClient: Number(toNumber(ltvBase.avg_revenue_per_client).toFixed(2)),
        averageRetentionDays: Number(toNumber(ltvBase.avg_retention_days).toFixed(2)),
        value: calculateLtv(
          toNumber(ltvBase.avg_revenue_per_client),
          toNumber(ltvBase.avg_retention_days)
        )
      },
      cac: {
        value: null as number | null,
        status: "PENDING_DATA_PIPELINE",
        notes: "Estrutura pronta para entrada de custos de aquisicao e canal."
      },
      operationalMargin: {
        revenue,
        expenses,
        commissions,
        operationalProfit,
        marginPercent
      },
      churn: {
        windowStart: formatDate(churnWindowStart),
        windowEnd: formatDate(period.end),
        baseClients,
        churnedClients,
        ratePercent: calculateRate(churnedClients, baseClients)
      }
    };
  });
};

export const getDashboardSummary = async (
  tenantId: string,
  actor: DashboardActor,
  query: DashboardPeriodQueryInput
) => {
  const period = resolvePeriod(query);
  const cacheKey = makeCacheKey("summary", tenantId, actor, period);

  return withCache(cacheKey, CACHE_TTL_MS, async () => {
    const [clients, services, occupancy] = await Promise.all([
      getClientMetrics(tenantId, actor, query),
      getServiceMetrics(tenantId, actor, query),
      getOccupancyMetrics(tenantId, actor, query)
    ]);

    const isReception = actor.role === RoleName.RECEPTION;
    const [revenue, barbers, advanced] = isReception
      ? [null, null, null]
      : await Promise.all([
          getRevenueMetrics(tenantId, actor, query),
          getBarberMetrics(tenantId, actor, query),
          getAdvancedMetrics(tenantId, actor, { ...query, churnWindowDays: 60 })
        ]);

    const topBarber = barbers?.rankingByRevenue[0]
      ? {
          name: barbers.rankingByRevenue[0].barberName,
          revenue: barbers.rankingByRevenue[0].revenue
        }
      : null;

    const insights = buildExecutiveInsights({
      topWeekday: occupancy.mostProfitableWeekday?.weekdayName ?? null,
      topBarber,
      totalRevenue: revenue?.revenuePeriod ?? clients.totalRevenue,
      vipRevenue: clients.vipRevenue,
      noShowRate: clients.noShowRate,
      growthPercent: revenue?.growthPercent ?? 0,
      occupancyWeek: occupancy.occupancyWeekPercent
    });

    return {
      period: {
        start: formatDate(period.start),
        end: formatDate(period.end)
      },
      permissions: {
        role: actor.role,
        fullAccess:
          actor.role === RoleName.OWNER ||
          actor.role === RoleName.ADMIN ||
          actor.role === RoleName.UNIT_OWNER ||
          actor.role === RoleName.UNIT_ADMIN ||
          actor.role === RoleName.FRANCHISE_OWNER ||
          actor.role === RoleName.SUPER_ADMIN,
        scopedToSelf: actor.role === RoleName.BARBER,
        limitedView: isReception
      },
      revenue,
      clients,
      services,
      barbers,
      occupancy,
      advancedMetrics: advanced,
      insights
    };
  });
};

export const getDashboardOverviewLegacy = async (
  tenantId: string,
  actor: DashboardActor
) => {
  const [revenue, clients, services, occupancy] = await Promise.all([
    getRevenueMetrics(tenantId, actor, { quick: "7D" }),
    getClientMetrics(tenantId, actor, { quick: "TODAY" }),
    getServiceMetrics(tenantId, actor, { quick: "30D" }),
    getOccupancyMetrics(tenantId, actor, { quick: "TODAY" })
  ]);

  return {
    revenueToday: revenue.revenueToday,
    appointmentsToday: occupancy.dayBookedAppointments,
    newClientsToday: clients.newClientsToday,
    topServices: services.revenueByService.slice(0, 5).map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      total: item.totalSales
    })),
    weeklySeries: revenue.byDay.slice(-7).map((item) => ({
      date: item.date,
      revenue: item.revenue
    }))
  };
};

export const exportDashboardData = async (
  tenantId: string,
  actor: DashboardActor,
  query: ExportQueryInput
) => {
  const period = resolvePeriod(query);

  return {
    status: "NOT_IMPLEMENTED",
    format: query.format,
    tenantId,
    role: actor.role,
    period: {
      start: formatDate(period.start),
      end: formatDate(period.end)
    },
    requestedAt: new Date().toISOString(),
    message: "Estrutura de exportacao preparada para geracao de PDF/Excel em proxima iteracao."
  };
};
