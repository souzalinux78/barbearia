import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMasterAuthStore } from "../store/master-auth.store";

export const RequireMasterAuth = () => {
  const accessToken = useMasterAuthStore((state) => state.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

