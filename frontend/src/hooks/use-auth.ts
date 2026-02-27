import { useMemo } from "react";
import { useAuthStore } from "../store/auth.store";

export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMemo(
    () => ({
      user,
      tenant,
      isAuthenticated: Boolean(user && accessToken),
      logout: clearSession
    }),
    [accessToken, clearSession, tenant, user]
  );
};
