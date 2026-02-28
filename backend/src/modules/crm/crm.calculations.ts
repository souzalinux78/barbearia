type RfmClass = "Campeoes" | "Leais" | "Potenciais" | "Em risco" | "Perdidos";
type ChurnRisk = "baixo" | "medio" | "alto";

const round2 = (value: number): number => Number(value.toFixed(2));

const DAY_MS = 24 * 60 * 60 * 1000;

export const calculatePointsEarned = (amountPaid: number, pointsPerReal: number): number => {
  if (amountPaid <= 0 || pointsPerReal <= 0) {
    return 0;
  }
  return round2(amountPaid * pointsPerReal);
};

export const calculateCashbackEarned = (amountPaid: number, cashbackPercentage: number): number => {
  if (amountPaid <= 0 || cashbackPercentage <= 0) {
    return 0;
  }
  return round2((amountPaid * cashbackPercentage) / 100);
};

export const calculateLtvByClient = (input: {
  totalSpent: number;
  firstSeenAt: Date;
  referenceDate?: Date;
}): number => {
  const referenceDate = input.referenceDate ?? new Date();
  const activeDays = Math.max(1, Math.round((referenceDate.getTime() - input.firstSeenAt.getTime()) / DAY_MS));
  return round2(input.totalSpent / activeDays);
};

export const calculateChurnRatePercent = (baseClients: number, churnedClients: number): number => {
  if (baseClients <= 0 || churnedClients <= 0) {
    return 0;
  }
  return round2((churnedClients / baseClients) * 100);
};

export const getDaysSince = (value: Date | null | undefined, referenceDate = new Date()): number => {
  if (!value) {
    return 9999;
  }
  return Math.max(0, Math.floor((referenceDate.getTime() - value.getTime()) / DAY_MS));
};

const recencyScore = (daysSinceLastVisit: number): number => {
  if (daysSinceLastVisit <= 15) {
    return 5;
  }
  if (daysSinceLastVisit <= 30) {
    return 4;
  }
  if (daysSinceLastVisit <= 60) {
    return 3;
  }
  if (daysSinceLastVisit <= 90) {
    return 2;
  }
  return 1;
};

const frequencyScore = (visitsCount: number): number => {
  if (visitsCount >= 12) {
    return 5;
  }
  if (visitsCount >= 8) {
    return 4;
  }
  if (visitsCount >= 5) {
    return 3;
  }
  if (visitsCount >= 3) {
    return 2;
  }
  return 1;
};

const monetaryScore = (totalSpent: number): number => {
  if (totalSpent >= 1500) {
    return 5;
  }
  if (totalSpent >= 900) {
    return 4;
  }
  if (totalSpent >= 500) {
    return 3;
  }
  if (totalSpent >= 250) {
    return 2;
  }
  return 1;
};

export const classifyRfm = (input: {
  daysSinceLastVisit: number;
  visitsCount: number;
  totalSpent: number;
}): { recency: number; frequency: number; monetary: number; score: string; segment: RfmClass } => {
  const recency = recencyScore(input.daysSinceLastVisit);
  const frequency = frequencyScore(input.visitsCount);
  const monetary = monetaryScore(input.totalSpent);
  const score = `${recency}${frequency}${monetary}`;

  let segment: RfmClass = "Potenciais";
  if (recency >= 4 && frequency >= 4 && monetary >= 4) {
    segment = "Campeoes";
  } else if (recency >= 3 && frequency >= 4) {
    segment = "Leais";
  } else if (recency <= 2 && (frequency >= 3 || monetary >= 3)) {
    segment = "Em risco";
  } else if (recency === 1 && frequency <= 2) {
    segment = "Perdidos";
  }

  return { recency, frequency, monetary, score, segment };
};

export const calculateVipIds = (rows: Array<{ clientId: string; totalSpent: number }>): string[] => {
  const paidRows = rows.filter((row) => row.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent);
  if (!paidRows.length) {
    return [];
  }

  const vipCount = Math.max(1, Math.ceil(paidRows.length * 0.2));
  return paidRows.slice(0, vipCount).map((row) => row.clientId);
};

export const classifyChurnRisk = (input: {
  daysSinceLastVisit: number;
  noShowCount: number;
}): ChurnRisk => {
  if (input.daysSinceLastVisit >= 60 || input.noShowCount >= 3) {
    return "alto";
  }
  if (input.daysSinceLastVisit >= 30 || input.noShowCount >= 2) {
    return "medio";
  }
  return "baixo";
};

export const isolateTenantRows = <T extends { tenantId: string }>(rows: T[], tenantId: string): T[] => {
  return rows.filter((row) => row.tenantId === tenantId);
};

export const shouldExpireByLastVisit = (input: {
  lastVisit: Date | null;
  expirationDays: number;
  referenceDate?: Date;
}): boolean => {
  if (!input.lastVisit || input.expirationDays <= 0) {
    return false;
  }
  const referenceDate = input.referenceDate ?? new Date();
  const cutoff = new Date(referenceDate.getTime() - input.expirationDays * DAY_MS);
  return input.lastVisit.getTime() <= cutoff.getTime();
};
