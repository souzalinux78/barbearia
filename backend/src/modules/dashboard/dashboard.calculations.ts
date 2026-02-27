export type DateRange = {
  start: Date;
  end: Date;
};

export type DashboardInsight = {
  severity: "info" | "success" | "warning";
  message: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const calculateRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
};

export const calculateGrowth = (current: number, previous: number): number => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

export const getPreviousPeriod = (period: DateRange): DateRange => {
  const durationMs = period.end.getTime() - period.start.getTime() + 1;
  const end = new Date(period.start.getTime() - 1);
  const start = new Date(end.getTime() - durationMs + 1);
  return { start, end };
};

export const calculateLtv = (averageRevenuePerClient: number, averageRetentionDays: number): number => {
  const retentionInMonths = averageRetentionDays > 0 ? averageRetentionDays / 30 : 0;
  return Number((averageRevenuePerClient * retentionInMonths).toFixed(2));
};

export const buildExecutiveInsights = (input: {
  topWeekday?: string | null;
  topBarber?: { name: string; revenue: number } | null;
  totalRevenue: number;
  vipRevenue?: number;
  noShowRate: number;
  growthPercent: number;
  occupancyWeek: number;
}): DashboardInsight[] => {
  const insights: DashboardInsight[] = [];

  if (input.topWeekday) {
    insights.push({
      severity: "info",
      message: `${input.topWeekday} e o dia mais lucrativo da semana.`
    });
  }

  if (input.topBarber && input.totalRevenue > 0) {
    const share = calculateRate(input.topBarber.revenue, input.totalRevenue);
    insights.push({
      severity: "success",
      message: `${input.topBarber.name} gera ${share}% da receita no periodo selecionado.`
    });
  }

  if (input.vipRevenue !== undefined && input.totalRevenue > 0) {
    const vipShare = calculateRate(input.vipRevenue, input.totalRevenue);
    insights.push({
      severity: vipShare >= 35 ? "success" : "info",
      message: `Clientes VIP representam ${vipShare}% do faturamento.`
    });
  }

  if (input.noShowRate > 10) {
    insights.push({
      severity: "warning",
      message: `A taxa de no-show esta em ${input.noShowRate}% e exige acao imediata.`
    });
  }

  if (input.growthPercent >= 10) {
    insights.push({
      severity: "success",
      message: `Crescimento de ${input.growthPercent}% vs periodo anterior.`
    });
  } else if (input.growthPercent < 0) {
    insights.push({
      severity: "warning",
      message: `Queda de ${Math.abs(input.growthPercent)}% vs periodo anterior.`
    });
  }

  if (input.occupancyWeek < 55) {
    insights.push({
      severity: "warning",
      message: `A ocupacao semanal esta em ${input.occupancyWeek}%, abaixo do ideal.`
    });
  }

  if (insights.length === 0) {
    insights.push({
      severity: "info",
      message: "Sem alertas criticos no periodo atual."
    });
  }

  return insights.slice(0, 6);
};

export const averageDaysBetweenDates = (dates: Date[]): number => {
  if (dates.length < 2) {
    return 0;
  }

  const ordered = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let total = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    total += (ordered[index].getTime() - ordered[index - 1].getTime()) / DAY_IN_MS;
  }
  return Number((total / (ordered.length - 1)).toFixed(2));
};

export const filterTenantRecords = <T extends { tenantId: string }>(
  rows: T[],
  tenantId: string
): T[] => rows.filter((row) => row.tenantId === tenantId);
