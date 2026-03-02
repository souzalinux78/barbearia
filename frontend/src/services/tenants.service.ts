import { api } from "./api";

export type TenantSettings = {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  servicePixKey?: string | null;
  bookingEnabled: boolean;
  bookingStartTime: string;
  bookingEndTime: string;
  bookingWorkingDays: number[];
};

export type UpdateTenantSettingsPayload = {
  name?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  servicePixKey?: string;
  bookingEnabled?: boolean;
  bookingStartTime?: string;
  bookingEndTime?: string;
  bookingWorkingDays?: number[];
};

export const getTenantMe = async (): Promise<TenantSettings> => {
  const { data } = await api.get<TenantSettings>("/tenants/me");
  return data;
};

export const updateTenantSettings = async (
  payload: UpdateTenantSettingsPayload
): Promise<TenantSettings> => {
  const { data } = await api.patch<TenantSettings>("/tenants/me/settings", payload);
  return data;
};
