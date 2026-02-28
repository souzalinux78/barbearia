import { api } from "./api";

export type FranchiseQuery = {
  quick?: "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";
  start?: string;
  end?: string;
  unitId?: string;
  franchiseId?: string;
  city?: string;
  state?: string;
};

export type FranchiseSummary = {
  scope: {
    mode: "GLOBAL" | "FRANCHISE" | "UNIT";
    franchiseId: string | null;
    unitId: string | null;
  };
  period: {
    start: string;
    end: string;
  };
  totals: {
    units: number;
    revenue: number;
    previousRevenue: number;
    growthPercent: number;
    averageRevenuePerUnit: number;
    averageTicket: number;
    averageOccupancy: number;
    projectedRoyalties: number;
  };
};

export type FranchiseRevenue = {
  period: { start: string; end: string };
  revenueByDay: Array<{ date: string; revenue: number }>;
  revenueByUnit: Array<{
    unitId: string;
    unitName: string;
    city: string | null;
    state: string | null;
    revenue: number;
    growthPercent: number;
  }>;
  revenueByRegion: Array<{
    state: string | null;
    city: string | null;
    revenue: number;
    growthPercent: number;
  }>;
};

export type FranchiseUnits = {
  period: { start: string; end: string };
  averageRevenue: number;
  items: Array<{
    unitId: string;
    name: string;
    city: string | null;
    state: string | null;
    franchiseId: string | null;
    franchiseName: string | null;
    revenue: number;
    growthPercent: number;
    retentionRate: number;
    churnRate: number;
    noShowRate: number;
    occupancyRate: number;
    averageTicket: number;
    performance: "GREEN" | "YELLOW" | "RED";
  }>;
};

export type FranchiseRoyalties = {
  period: { start: string; end: string };
  projectedTotal: number;
  pendingTotal: number;
  paidTotal: number;
  items: Array<{
    id: string;
    franchiseId: string;
    franchiseName: string;
    unitId: string;
    unitName: string;
    city: string | null;
    state: string | null;
    periodStart: string;
    periodEnd: string;
    revenue: number;
    royaltyAmount: number;
    paid: boolean;
  }>;
};

export type FranchisePerformance = {
  period: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  metrics: {
    revenueAveragePerUnit: number;
    mostProfitableUnit: { unitId: string; unitName: string; revenue: number } | null;
    highestChurnUnit: { unitId: string; unitName: string; churnRate: number } | null;
    highestRetentionUnit: { unitId: string; unitName: string; retentionRate: number } | null;
    ticketAverageConsolidated: number;
    consolidatedMargin: {
      revenue: number;
      expenses: number;
      commissions: number;
      operationalProfit: number;
      marginPercent: number;
    };
  };
  ranking: Array<{
    unitId: string;
    unitName: string;
    revenue: number;
    growthPercent: number;
    retentionRate: number;
    churnRate: number;
    noShowRate: number;
    performance: "GREEN" | "YELLOW" | "RED";
  }>;
  insights: Array<{ severity: "info" | "warning" | "success"; message: string }>;
};

export const getFranchiseSummary = async (params?: FranchiseQuery): Promise<FranchiseSummary> => {
  const { data } = await api.get<FranchiseSummary>("/franchise/summary", { params });
  return data;
};

export const getFranchiseRevenue = async (params?: FranchiseQuery): Promise<FranchiseRevenue> => {
  const { data } = await api.get<FranchiseRevenue>("/franchise/revenue", { params });
  return data;
};

export const getFranchiseUnits = async (params?: FranchiseQuery): Promise<FranchiseUnits> => {
  const { data } = await api.get<FranchiseUnits>("/franchise/units", { params });
  return data;
};

export const getFranchiseRoyalties = async (
  params?: FranchiseQuery & { paid?: boolean }
): Promise<FranchiseRoyalties> => {
  const { data } = await api.get<FranchiseRoyalties>("/franchise/royalties", { params });
  return data;
};

export const getFranchisePerformance = async (
  params?: FranchiseQuery & { rankingLimit?: number }
): Promise<FranchisePerformance> => {
  const { data } = await api.get<FranchisePerformance>("/franchise/performance", { params });
  return data;
};

