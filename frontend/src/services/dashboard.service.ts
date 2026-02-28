import { api } from "./api";

export type DashboardQuickFilter = "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";

export type DashboardPeriod = {
  quick?: DashboardQuickFilter;
  start?: string;
  end?: string;
};

export type DashboardSummary = {
  period: { start: string; end: string };
  permissions: {
    role:
      | "SUPER_ADMIN"
      | "FRANCHISE_OWNER"
      | "UNIT_OWNER"
      | "UNIT_ADMIN"
      | "OWNER"
      | "ADMIN"
      | "BARBER"
      | "RECEPTION";
    fullAccess: boolean;
    scopedToSelf: boolean;
    limitedView: boolean;
  };
  revenue: DashboardRevenue | null;
  clients: DashboardClients;
  services: DashboardServices;
  barbers: DashboardBarbers | null;
  occupancy: DashboardOccupancy;
  advancedMetrics: DashboardAdvancedMetrics | null;
  insights: Array<{ severity: "info" | "success" | "warning"; message: string }>;
};

export type DashboardRevenue = {
  period: { start: string; end: string };
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  revenuePeriod: number;
  revenuePreviousPeriod: number;
  growthPercent: number;
  byDay: Array<{ date: string; revenue: number }>;
  byBarber: Array<{ barberId: string; barberName: string; revenue: number }>;
  byService: Array<{ serviceId: string; serviceName: string; revenue: number; sales: number }>;
  monthlyGrowth: Array<{ month: string; revenue: number; growthPercent: number }>;
};

export type DashboardClients = {
  period: { start: string; end: string };
  newClientsMonth: number;
  newClientsToday: number;
  recurringClients: number;
  retentionRate: number;
  noShowRate: number;
  noShowAppointments: number;
  totalAppointments: number;
  averageReturnFrequencyDays: number;
  averageTicketPerClient: number;
  payingClients: number;
  totalRevenue: number;
  vipRevenue: number;
  vipSharePercent: number;
};

export type DashboardServices = {
  period: { start: string; end: string };
  mostSoldService: { serviceId: string; serviceName: string; totalSales: number } | null;
  mostProfitableService: { serviceId: string; serviceName: string; revenue: number } | null;
  averageServiceDurationMin: number;
  revenueByService: Array<{
    serviceId: string;
    serviceName: string;
    totalSales: number;
    revenue: number;
  }>;
};

export type DashboardBarbers = {
  period: { start: string; end: string };
  rankingByRevenue: DashboardBarberRow[];
  rankingByCommission: DashboardBarberRow[];
  rankingByAppointments: DashboardBarberRow[];
  barbers: DashboardBarberRow[];
};

export type DashboardBarberRow = {
  barberId: string;
  barberName: string;
  revenue: number;
  commission: number;
  appointments: number;
  occupancyRate: number;
  averageTicket: number;
};

export type DashboardOccupancy = {
  period: { start: string; end: string };
  occupancyDayPercent: number;
  occupancyWeekPercent: number;
  dayBookedAppointments: number;
  activeBarbers: number;
  mostProfitableHour: { hour: string; revenue: number } | null;
  mostProfitableWeekday: { weekdayIndex: number; weekdayName: string; revenue: number } | null;
  weeklySeries: Array<{ date: string; occupancyPercent: number; bookedMinutes: number }>;
};

export type DashboardAdvancedMetrics = {
  period: { start: string; end: string };
  churnWindowDays: number;
  ltv: {
    averageRevenuePerClient: number;
    averageRetentionDays: number;
    value: number;
  };
  cac: {
    value: number | null;
    status: string;
    notes: string;
  };
  operationalMargin: {
    revenue: number;
    expenses: number;
    commissions: number;
    operationalProfit: number;
    marginPercent: number;
  };
  churn: {
    windowStart: string;
    windowEnd: string;
    baseClients: number;
    churnedClients: number;
    ratePercent: number;
  };
};

export type DashboardOverviewLegacy = {
  revenueToday: number;
  appointmentsToday: number;
  newClientsToday: number;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    total: number;
  }>;
  weeklySeries: Array<{ date: string; revenue: number }>;
};

const toParams = (period?: DashboardPeriod) => ({
  quick: period?.quick,
  start: period?.start,
  end: period?.end
});

export const getDashboardSummary = async (period?: DashboardPeriod): Promise<DashboardSummary> => {
  const { data } = await api.get<DashboardSummary>("/dashboard/summary", { params: toParams(period) });
  return data;
};

export const getDashboardRevenue = async (period?: DashboardPeriod): Promise<DashboardRevenue> => {
  const { data } = await api.get<DashboardRevenue>("/dashboard/revenue", { params: toParams(period) });
  return data;
};

export const getDashboardClients = async (period?: DashboardPeriod): Promise<DashboardClients> => {
  const { data } = await api.get<DashboardClients>("/dashboard/clients", { params: toParams(period) });
  return data;
};

export const getDashboardServices = async (period?: DashboardPeriod): Promise<DashboardServices> => {
  const { data } = await api.get<DashboardServices>("/dashboard/services", { params: toParams(period) });
  return data;
};

export const getDashboardBarbers = async (period?: DashboardPeriod): Promise<DashboardBarbers> => {
  const { data } = await api.get<DashboardBarbers>("/dashboard/barbers", { params: toParams(period) });
  return data;
};

export const getDashboardOccupancy = async (period?: DashboardPeriod): Promise<DashboardOccupancy> => {
  const { data } = await api.get<DashboardOccupancy>("/dashboard/occupancy", { params: toParams(period) });
  return data;
};

export const getDashboardAdvancedMetrics = async (
  period?: DashboardPeriod,
  churnWindowDays = 60
): Promise<DashboardAdvancedMetrics> => {
  const { data } = await api.get<DashboardAdvancedMetrics>("/dashboard/advanced-metrics", {
    params: {
      ...toParams(period),
      churnWindowDays
    }
  });
  return data;
};

export const exportDashboard = async (format: "pdf" | "excel", period?: DashboardPeriod) => {
  const { data } = await api.get("/dashboard/export", {
    params: {
      ...toParams(period),
      format
    }
  });
  return data;
};

export const getDashboardOverview = async (): Promise<DashboardOverviewLegacy> => {
  const { data } = await api.get<DashboardOverviewLegacy>("/dashboard/overview");
  return data;
};
