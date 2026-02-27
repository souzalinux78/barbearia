import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/app-layout";
import { RequireAuth } from "./require-auth";
import { LoginPage } from "../pages/login-page";
import { DashboardPage } from "../pages/dashboard-page";
import { ClientsPage } from "../pages/clients-page";
import { FinancePage } from "../pages/finance-page";
import { ServicesPage } from "../pages/services-page";
import { ProductsPage } from "../pages/products-page";
import { SettingsPage } from "../pages/settings-page";

const DailyView = lazy(() => import("../pages/appointments/DailyView").then((module) => ({ default: module.DailyView })));
const WeeklyView = lazy(() => import("../pages/appointments/WeeklyView").then((module) => ({ default: module.WeeklyView })));
const NewAppointment = lazy(() =>
  import("../pages/appointments/NewAppointment").then((module) => ({ default: module.NewAppointment }))
);

export const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<div className="p-4 text-sm text-slate-300">Carregando...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/appointments" element={<DailyView />} />
            <Route path="/appointments/week" element={<WeeklyView />} />
            <Route path="/appointments/new" element={<NewAppointment />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
