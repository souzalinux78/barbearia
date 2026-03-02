import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MasterAdminSession = {
  id: string;
  email: string;
  role: "SUPER_ADMIN";
};

type MasterAuthState = {
  admin: MasterAdminSession | null;
  accessToken: string | null;
  setSession: (payload: { admin: MasterAdminSession; accessToken: string }) => void;
  clearSession: () => void;
};

export const useMasterAuthStore = create<MasterAuthState>()(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      setSession: (payload) =>
        set({
          admin: payload.admin,
          accessToken: payload.accessToken
        }),
      clearSession: () =>
        set({
          admin: null,
          accessToken: null
        })
    }),
    {
      name: "barbearia-master-auth-storage"
    }
  )
);

