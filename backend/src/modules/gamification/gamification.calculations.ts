export type QuickRange = "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const calculateProgressPercentage = (currentValue: number, targetValue: number): number => {
  if (targetValue <= 0) {
    return 0;
  }
  return Number(Math.min(999, (currentValue / targetValue) * 100).toFixed(2));
};

export const calculateRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0 || numerator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
};

export const startOfDay = (value: Date): Date => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const endOfDay = (value: Date): Date => {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
};

export const resolvePeriod = (
  input: { quick?: QuickRange; start?: string; end?: string },
  now = new Date()
): { start: Date; end: Date } => {
  if (input.start && input.end) {
    return {
      start: startOfDay(new Date(`${input.start}T00:00:00.000Z`)),
      end: endOfDay(new Date(`${input.end}T00:00:00.000Z`))
    };
  }

  switch (input.quick) {
    case "TODAY":
      return { start: startOfDay(now), end: endOfDay(now) };
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
      return { start: startOfDay(now), end: endOfDay(now) };
    case "MONTH":
    default:
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: endOfDay(now)
      };
  }
};

export const isolateTenantRows = <T extends { tenantId: string }>(rows: T[], tenantId: string): T[] =>
  rows.filter((row) => row.tenantId === tenantId);

export type RankingRow = {
  userId: string;
  userName: string;
  revenue: number;
  points: number;
  goalsHit: number;
};

export const calculateRankingScore = (row: RankingRow): number =>
  Number((row.points * 1 + row.revenue * 0.05 + row.goalsHit * 30).toFixed(2));

export const sortRanking = (rows: RankingRow[]): RankingRow[] =>
  [...rows].sort((left, right) => {
    const scoreDiff = calculateRankingScore(right) - calculateRankingScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    if (right.revenue !== left.revenue) {
      return right.revenue - left.revenue;
    }
    if (right.points !== left.points) {
      return right.points - left.points;
    }
    if (right.goalsHit !== left.goalsHit) {
      return right.goalsHit - left.goalsHit;
    }
    return left.userName.localeCompare(right.userName);
  });

