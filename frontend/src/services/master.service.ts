import { masterApi } from "./master-api";
import axios from "axios";

export type MasterSummaryResponse = {
  month: string;
  totalMrr: number;
  totalActiveSubscriptions: number;
  churnRate: number;
  growthPercent: number;
  netGrowth: number;
  activeTenants: number;
  pastDueSubscriptions: number;
  totalUnits: number;
  totalUsers: number;
  arpu: number;
  avgLtv: number;
  avgRetentionDays: number;
  revenueByPlan: Array<{
    planId: string;
    planName: string | null;
    subscriptions: number;
    mrr: number;
  }>;
  revenueByFranchise: Array<{
    franchiseId: string | null;
    franchiseName: string;
    revenue: number;
  }>;
  revenueByRegion: Array<{
    state: string;
    revenue: number;
  }>;
  alerts: Array<{
    severity: "info" | "warning" | "danger";
    message: string;
  }>;
};

export type MasterMrrResponse = {
  months: Array<{
    month: string;
    mrr: number;
    activeSubscriptions: number;
    newSubscriptions: number;
    canceledSubscriptions: number;
    growthPercent: number;
  }>;
};

export type MasterChurnResponse = {
  months: Array<{
    month: string;
    canceledSubscriptions: number;
    activeBase: number;
    churnRate: number;
  }>;
};

export type MasterTenantsResponse = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    email: string | null;
    createdAt: string;
    status: "ACTIVE" | "SUSPENDED" | "PAST_DUE" | "CANCELED" | "TRIALING";
    monthlyRevenue: number;
    usersCount: number;
    lastPaymentAt: string | null;
    subscription: {
      id: string;
      status: string;
      planId: string;
      planName: string;
      price: number;
      currentPeriodEnd: string;
    } | null;
    unit: {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      active: boolean;
      franchiseId: string | null;
      franchiseName: string | null;
    };
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
  planOptions: Array<{
    id: string;
    name: string;
  }>;
};

export type MasterTenantDetails = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  status: string;
  lastPaymentAt: string | null;
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
    price: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  unit: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    active: boolean;
    franchiseId: string | null;
    franchiseName: string | null;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
  }>;
  statusLogs: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    reason: string | null;
    adminEmail: string | null;
    createdAt: string;
  }>;
  impersonationLogs: Array<{
    id: string;
    adminEmail: string;
    createdAt: string;
  }>;
};

export type MasterRevenueProjectionResponse = {
  currentMrr: number;
  averageGrowthRate: number;
  projection: Array<{
    month: string;
    projectedMrr: number;
  }>;
};

export type MasterPlatformMetricsResponse = {
  items: Array<{
    month: string;
    totalMrr: number;
    totalActiveSubscriptions: number;
    totalChurn: number;
    totalNewSubscriptions: number;
    createdAt: string;
  }>;
};

export type MasterRevenueResponse = {
  period: "monthly" | "yearly";
  revenue: Array<{
    label: string;
    amount: number;
    cumulative?: number;
  }>;
  totalRevenue: number;
  byPlan?: Array<{
    planId: string;
    planName: string | null;
    subscriptions: number;
    mrr: number;
  }>;
  byFranchise?: Array<{
    franchiseId: string | null;
    franchiseName: string;
    revenue: number;
  }>;
};

export type MasterBillingConfigResponse = {
  target: "GLOBAL";
  stripeActive: boolean;
  pixActive: boolean;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  pixApiKey: string;
  pixWebhookSecret: string;
  updatedAt: string | null;
};

export type MasterPlan = {
  id: string;
  name: "FREE" | "PRO" | "PREMIUM";
  price: number;
  maxUsers: number;
  maxBarbers: number;
  maxAppointmentsMonth: number;
  features: Record<string, boolean>;
};

export type MasterFunnelResponse = {
  days: number;
  funnel: {
    landingViews: number;
    checkoutClicks: number;
    registerStarts: number;
    registerSuccess: number;
    paidTenants: number;
  };
  conversion: {
    visitToCheckout: number;
    checkoutToRegisterStart: number;
    registerStartToSuccess: number;
    registerSuccessToPaid: number;
    visitToPaid: number;
  };
  daily: Array<{
    day: string;
    landingViews: number;
    registerSuccess: number;
    paidTenants: number;
  }>;
};

export type MasterBillingPlanName = "FREE" | "PRO" | "PREMIUM";
export type MasterBillingGateway = "STRIPE" | "PIX";

export const getMasterSummary = async () => {
  const { data } = await masterApi.get<MasterSummaryResponse>("/master/summary");
  return data;
};

export const getMasterMrr = async (months = 12) => {
  const { data } = await masterApi.get<MasterMrrResponse>("/master/mrr", {
    params: { months }
  });
  return data;
};

export const getMasterChurn = async (months = 12) => {
  const { data } = await masterApi.get<MasterChurnResponse>("/master/churn", {
    params: { months }
  });
  return data;
};

export const getMasterTenants = async (params?: {
  search?: string;
  plan?: "FREE" | "PRO" | "PREMIUM";
  status?: "ACTIVE" | "SUSPENDED" | "PAST_DUE" | "CANCELED" | "TRIALING";
  state?: string;
  franchiseId?: string;
  page?: number;
  pageSize?: number;
}) => {
  const { data } = await masterApi.get<MasterTenantsResponse>("/master/tenants", { params });
  return data;
};

export const getMasterTenantById = async (tenantId: string) => {
  const { data } = await masterApi.get<MasterTenantDetails>(`/master/tenants/${tenantId}`);
  return data;
};

export const updateMasterTenantStatus = async (
  tenantId: string,
  payload: {
    status: "ACTIVE" | "SUSPENDED";
    reason?: string;
    planId?: string;
  }
) => {
  const { data } = await masterApi.patch<MasterTenantDetails>(`/master/tenant/${tenantId}/status`, payload);
  return data;
};

export const getMasterPlatformMetrics = async (months = 12) => {
  const { data } = await masterApi.get<MasterPlatformMetricsResponse>("/master/platform-metrics", {
    params: { months }
  });
  return data;
};

export const getMasterRevenueProjection = async () => {
  const { data } = await masterApi.get<MasterRevenueProjectionResponse>("/master/revenue-projection");
  return data;
};

export const getMasterFunnel = async (days = 30) => {
  const { data } = await masterApi.get<MasterFunnelResponse>("/master/funnel", {
    params: { days }
  });
  return data;
};

export const getMasterRevenue = async (period: "monthly" | "yearly") => {
  const { data } = await masterApi.get<MasterRevenueResponse>("/master/revenue", { params: { period } });
  return data;
};

export const getMasterBillingConfig = async () => {
  const { data } = await masterApi.get<MasterBillingConfigResponse>("/master/billing-config");
  return data;
};

export const getMasterPlans = async () => {
  const { data } = await masterApi.get<MasterPlan[]>("/master/plans");
  return data;
};

export const updateMasterPlan = async (
  planName: "FREE" | "PRO" | "PREMIUM",
  payload: {
    price: number;
    maxUsers: number;
    maxBarbers: number;
    maxAppointmentsMonth: number;
    features: Record<string, boolean>;
  }
) => {
  const { data } = await masterApi.put<MasterPlan>(`/master/plans/${planName}`, payload);
  return data;
};

export const updateMasterBillingConfig = async (payload: {
  stripeActive: boolean;
  pixActive: boolean;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  pixApiKey?: string;
  pixWebhookSecret?: string;
}) => {
  const { data } = await masterApi.put<MasterBillingConfigResponse>("/master/billing-config", payload);
  return data;
};

export const impersonateMasterTenant = async (tenantId: string, reason?: string) => {
  const { data } = await masterApi.post(`/master/tenant/${tenantId}/impersonate`, { reason });
  return data as {
    tenant: { id: string; name: string; slug: string };
    user: {
      id: string;
      name: string;
      email: string;
      role:
        | "SUPER_ADMIN"
        | "FRANCHISE_OWNER"
        | "UNIT_OWNER"
        | "UNIT_ADMIN"
        | "OWNER"
        | "ADMIN"
        | "BARBER"
        | "RECEPTION";
    };
    accessToken: string;
  };
};

export const createMasterTenantBillingCheckout = async (input: {
  tenantId: string;
  planName: MasterBillingPlanName;
  gateway: MasterBillingGateway;
  pixKey?: string;
}) => {
  const impersonation = await impersonateMasterTenant(input.tenantId, "cobranca_master");
  const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
  const tenantApi = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${impersonation.accessToken}`
    }
  });

  await tenantApi.post("/billing/gateway-config", {
    target: "TENANT",
    stripeActive: input.gateway === "STRIPE",
    pixActive: input.gateway === "PIX",
    pixApiKey: input.gateway === "PIX" ? input.pixKey : undefined
  });

  const { data } = await tenantApi.post("/billing/subscribe", {
    planName: input.planName
  });

  return data as {
    status: string;
    gateway: MasterBillingGateway;
    pix?: {
      qrCode: string;
      copyPasteCode: string;
    };
  };
};
