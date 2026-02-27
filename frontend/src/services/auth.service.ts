import { api } from "./api";
import { SessionTenant, SessionUser } from "../store/auth.store";

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
};

export type SessionResponse = {
  tenant: SessionTenant;
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

export const loginRequest = async (payload: LoginPayload): Promise<SessionResponse> => {
  const { data } = await api.post<SessionResponse>("/auth/login", payload);
  return data;
};

export const registerRequest = async (payload: RegisterPayload): Promise<SessionResponse> => {
  const { data } = await api.post<SessionResponse>("/auth/register-tenant", payload);
  return data;
};
