import { api } from "./api";

export type DashboardOverview = {
  revenueToday: number;
  appointmentsToday: number;
  newClientsToday: number;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    total: number;
  }>;
  weeklySeries: Array<{
    date: string;
    revenue: number;
  }>;
};

export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const { data } = await api.get<DashboardOverview>("/dashboard/overview");
  return data;
};
