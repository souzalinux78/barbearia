import { api } from "./api";

export type CrmClientSegmentKey =
  | "NO_RETURN_30"
  | "VIP"
  | "NO_SHOW"
  | "HIGH_TICKET"
  | "INACTIVE"
  | "NEW"
  | "FREQUENT";

export type CrmClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vip: boolean;
  loyaltyPoints: number;
  cashbackBalance: number;
  totalSpent: number;
  visitsCount: number;
  lastVisit: string | null;
  createdAt: string;
  noShowCount: number;
  churnRisk: "baixo" | "medio" | "alto";
  rfm: {
    recency: number;
    frequency: number;
    monetary: number;
    score: string;
    segment: "Campeoes" | "Leais" | "Potenciais" | "Em risco" | "Perdidos";
  };
};

export type CrmClientsResponse = {
  items: CrmClient[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type CrmClientDetailsResponse = {
  client: CrmClient & {
    averageReturnDays: number;
    ltv: number;
  };
  appointments: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    price: number;
    barber: { id: string; name: string };
    service: { id: string; name: string } | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    paidAt: string;
    notes: string | null;
  }>;
  loyaltyTransactions: Array<{
    id: string;
    type: "EARN" | "REDEEM" | "EXPIRE";
    amount: number;
    appointmentId: string | null;
    createdAt: string;
  }>;
};

export type CrmSegmentsResponse = {
  totalClients: number;
  segments: Array<{
    key: CrmClientSegmentKey;
    label: string;
    count: number;
  }>;
};

export type CrmRetentionResponse = {
  windowDays: number;
  cards: {
    retentionRate: number;
    churnRate: number;
    activeClients: number;
    inactiveClients: number;
    vipRevenue: number;
  };
  topClients: Array<{
    id: string;
    name: string;
    vip: boolean;
    totalSpent: number;
    visitsCount: number;
    lastVisit: string | null;
  }>;
};

export type CrmLtvResponse = {
  averageLtv: number;
  clients: Array<{
    id: string;
    name: string;
    totalSpent: number;
    visitsCount: number;
    activeSince: string;
    ltv: number;
  }>;
};

export type CrmChurnRiskResponse = {
  items: Array<{
    id: string;
    name: string;
    totalSpent: number;
    visitsCount: number;
    noShowCount: number;
    daysSinceLastVisit: number;
    risk: "baixo" | "medio" | "alto";
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type CrmVipResponse = {
  summary: {
    vipClients: number;
    vipRevenue: number;
    vipSharePercent: number;
  };
  items: Array<{
    id: string;
    name: string;
    totalSpent: number;
    visitsCount: number;
    lastVisit: string | null;
    loyaltyPoints: number;
    cashbackBalance: number;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type LoyaltyProgramResponse = {
  id: string;
  tenantId: string;
  active: boolean;
  type: "POINTS" | "CASHBACK";
  pointsPerReal: number;
  cashbackPercentage: number;
  expirationDays: number;
  createdAt: string;
  updatedAt: string;
};

export const getCrmClients = async (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  segment?: CrmClientSegmentKey;
}): Promise<CrmClientsResponse> => {
  const { data } = await api.get<CrmClientsResponse>("/crm/clients", { params });
  return data;
};

export const getCrmClientDetails = async (id: string): Promise<CrmClientDetailsResponse> => {
  const { data } = await api.get<CrmClientDetailsResponse>(`/crm/client/${id}`);
  return data;
};

export const getCrmSegments = async (): Promise<CrmSegmentsResponse> => {
  const { data } = await api.get<CrmSegmentsResponse>("/crm/segments");
  return data;
};

export const getCrmRetention = async (windowDays = 60): Promise<CrmRetentionResponse> => {
  const { data } = await api.get<CrmRetentionResponse>("/crm/retention", {
    params: { windowDays }
  });
  return data;
};

export const getCrmLtv = async (top = 20): Promise<CrmLtvResponse> => {
  const { data } = await api.get<CrmLtvResponse>("/crm/ltv", {
    params: { top }
  });
  return data;
};

export const getCrmChurnRisk = async (
  params?: {
    minDaysWithoutVisit?: number;
    page?: number;
    pageSize?: number;
  }
): Promise<CrmChurnRiskResponse> => {
  const { data } = await api.get<CrmChurnRiskResponse>("/crm/churn-risk", {
    params
  });
  return data;
};

export const getCrmVip = async (
  params?: {
    page?: number;
    pageSize?: number;
  }
): Promise<CrmVipResponse> => {
  const { data } = await api.get<CrmVipResponse>("/crm/vip", { params });
  return data;
};

export const getLoyaltyProgram = async (): Promise<LoyaltyProgramResponse> => {
  const { data } = await api.get<LoyaltyProgramResponse>("/crm/loyalty-program");
  return data;
};

export const updateLoyaltyProgram = async (payload: {
  active: boolean;
  type: "POINTS" | "CASHBACK";
  pointsPerReal: number;
  cashbackPercentage: number;
  expirationDays: number;
}) => {
  const { data } = await api.put<LoyaltyProgramResponse>("/crm/loyalty-program", payload);
  return data;
};

export const redeemLoyalty = async (payload: {
  clientId: string;
  appointmentId?: string;
  mode: "POINTS" | "CASHBACK";
  amount: number;
}) => {
  const { data } = await api.post("/crm/redeem", payload);
  return data;
};

export const previewCrmAutomation = async (payload: {
  campaign: "INACTIVE_CLIENTS" | "EXPIRING_POINTS" | "VIP_OFFER";
  limit?: number;
}) => {
  const { data } = await api.post("/crm/automation/preview", payload);
  return data;
};

