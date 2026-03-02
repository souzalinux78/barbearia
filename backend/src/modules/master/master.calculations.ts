export const calculateRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0 || numerator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
};

export const calculateMrr = (rows: Array<{ price: number; count: number }>): number =>
  Number(rows.reduce((sum, row) => sum + row.price * row.count, 0).toFixed(2));

export const calculateNetGrowth = (newSubscriptions: number, canceledSubscriptions: number): number =>
  newSubscriptions - canceledSubscriptions;

export const calculateGrowthPercent = (
  newSubscriptions: number,
  canceledSubscriptions: number,
  previousBase: number
): number => calculateRate(calculateNetGrowth(newSubscriptions, canceledSubscriptions), previousBase);

export const calculateAverageGrowthRate = (values: number[]): number => {
  if (values.length < 2) {
    return 0;
  }

  const rates: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous <= 0) {
      rates.push(current > 0 ? 100 : 0);
      continue;
    }
    rates.push(((current - previous) / previous) * 100);
  }

  return Number((rates.reduce((sum, value) => sum + value, 0) / rates.length).toFixed(2));
};

export const projectRevenue = (
  currentMrr: number,
  averageGrowthRate: number,
  months = 6
): number[] => {
  const result: number[] = [];
  let cursor = currentMrr;

  for (let index = 0; index < months; index += 1) {
    cursor = cursor * (1 + averageGrowthRate / 100);
    result.push(Number(cursor.toFixed(2)));
  }

  return result;
};

export const resolveTenantStatusTransition = (
  currentActive: boolean,
  targetStatus: "ACTIVE" | "SUSPENDED"
): { previousStatus: "ACTIVE" | "SUSPENDED"; newStatus: "ACTIVE" | "SUSPENDED"; changed: boolean } => {
  const previousStatus = currentActive ? "ACTIVE" : "SUSPENDED";
  const changed = previousStatus !== targetStatus;
  return {
    previousStatus,
    newStatus: targetStatus,
    changed
  };
};

export const canAccessMaster = (role: string): boolean => role === "SUPER_ADMIN";

