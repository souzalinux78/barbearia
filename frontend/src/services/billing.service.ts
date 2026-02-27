import { api } from "./api";

export type PlanName = "FREE" | "PRO" | "PREMIUM";
export type BillingGateway = "STRIPE" | "PIX";
export type SubscriptionStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "TRIALING";

export type BillingPlan = {
  id: string;
  name: PlanName;
  price: string;
  maxUsers: number;
  maxBarbers: number;
  maxAppointmentsMonth: number;
  features: Record<string, boolean>;
};

export type BillingSubscription = {
  id: string;
  tenantId: string;
  planId: string;
  pendingPlanId: string | null;
  gateway: BillingGateway;
  externalSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: BillingPlan;
  pendingPlan?: BillingPlan | null;
};

export type BillingStatusResponse = {
  subscription: BillingSubscription;
  blocked: boolean;
  warning3Days: boolean;
  daysToRenewal: number;
};

export type BillingHistoryResponse = {
  items: Array<{
    id: string;
    amount: string;
    status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
    gateway: BillingGateway;
    paidAt: string | null;
    createdAt: string;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export const getBillingPlans = async (): Promise<BillingPlan[]> => {
  const { data } = await api.get<BillingPlan[]>("/billing/plans");
  return data;
};

export const getBillingStatus = async (): Promise<BillingStatusResponse> => {
  const { data } = await api.get<BillingStatusResponse>("/billing/status");
  return data;
};

export const subscribePlan = async (planName: PlanName) => {
  const { data } = await api.post("/billing/subscribe", { planName });
  return data;
};

export const cancelSubscription = async (immediate = false) => {
  const { data } = await api.post("/billing/cancel", { immediate });
  return data;
};

export const getBillingHistory = async (
  page = 1,
  pageSize = 20
): Promise<BillingHistoryResponse> => {
  const { data } = await api.get<BillingHistoryResponse>("/billing/history", {
    params: { page, pageSize }
  });
  return data;
};
