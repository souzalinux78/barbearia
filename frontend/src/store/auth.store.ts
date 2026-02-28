import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SessionUser = {
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

export type SessionTenant = {
  id: string;
  name: string;
  slug: string;
};

type AuthState = {
  user: SessionUser | null;
  tenant: SessionTenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (data: {
    user: SessionUser;
    tenant: SessionTenant;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      setSession: (data) =>
        set({
          user: data.user,
          tenant: data.tenant,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        }),
      setAccessToken: (token) => set({ accessToken: token }),
      clearSession: () =>
        set({
          user: null,
          tenant: null,
          accessToken: null,
          refreshToken: null
        })
    }),
    {
      name: "barbearia-auth-storage"
    }
  )
);
