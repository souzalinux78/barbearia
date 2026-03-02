import { api } from "./api";
import { SessionTenant, SessionUser } from "../store/auth.store";
import { BillingGateway, PlanName } from "./billing.service";

export type LoginPayload = {
  tenantSlug: string;
  email: string;
  password: string;
};

export type RegisterPayload = {
  tenantName: string;
  tenantSlug: string;
  tenantEmail?: string;
  tenantPhone?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone?: string;
  billing?: {
    planName: PlanName;
    gateway?: BillingGateway;
  };
};

export type SessionResponse = {
  tenant: SessionTenant;
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

export type RegisterResponse = SessionResponse & {
  checkout?: unknown;
  checkoutWarning?: string | null;
};

export const loginRequest = async (payload: LoginPayload): Promise<SessionResponse> => {
  const { data } = await api.post<SessionResponse>("/auth/login", payload);
  return data;
};

export const registerRequest = async (payload: RegisterPayload): Promise<RegisterResponse> => {
  const { data } = await api.post<RegisterResponse>("/auth/register-tenant", payload);
  return data;
};
