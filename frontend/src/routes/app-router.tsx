import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/app-layout";
import { RequireAuth } from "./require-auth";
import { LoginPage } from "../pages/login-page";
import { ClientsPage } from "../pages/clients-page";
import { ServicesPage } from "../pages/services-page";
import { ProductsPage } from "../pages/products-page";
import { SettingsPage } from "../pages/settings-page";

const DashboardPage = lazy(() =>
  import("../pages/dashboard-page").then((module) => ({ default: module.DashboardPage }))
);
const DailyView = lazy(() => import("../pages/appointments/DailyView").then((module) => ({ default: module.DailyView })));
const WeeklyView = lazy(() => import("../pages/appointments/WeeklyView").then((module) => ({ default: module.WeeklyView })));
const NewAppointment = lazy(() =>
  import("../pages/appointments/NewAppointment").then((module) => ({ default: module.NewAppointment }))
);
const DashboardFinancial = lazy(() =>
  import("../pages/financial/DashboardFinancial").then((module) => ({ default: module.DashboardFinancial }))
);
const CashFlow = lazy(() =>
  import("../pages/financial/CashFlow").then((module) => ({ default: module.CashFlow }))
);
const Expenses = lazy(() =>
  import("../pages/financial/Expenses").then((module) => ({ default: module.Expenses }))
);
const Commissions = lazy(() =>
  import("../pages/financial/Commissions").then((module) => ({ default: module.Commissions }))
);
const DRE = lazy(() => import("../pages/financial/DRE").then((module) => ({ default: module.DRE })));
const Plans = lazy(() =>
  import("../pages/billing/Plans").then((module) => ({ default: module.Plans }))
);
const Subscription = lazy(() =>
  import("../pages/billing/Subscription").then((module) => ({ default: module.Subscription }))
);
const BillingHistory = lazy(() =>
  import("../pages/billing/BillingHistory").then((module) => ({ default: module.BillingHistory }))
);
const Upgrade = lazy(() =>
  import("../pages/billing/Upgrade").then((module) => ({ default: module.Upgrade }))
);
const OfflinePage = lazy(() =>
  import("../pages/Offline").then((module) => ({ default: module.OfflinePage }))
);
const CrmClientsPage = lazy(() =>
  import("../pages/crm/Clients").then((module) => ({ default: module.CrmClientsPage }))
);
const CrmClientDetailsPage = lazy(() =>
  import("../pages/crm/ClientDetails").then((module) => ({ default: module.CrmClientDetailsPage }))
);
const CrmSegmentsPage = lazy(() =>
  import("../pages/crm/Segments").then((module) => ({ default: module.CrmSegmentsPage }))
);
const LoyaltyDashboardPage = lazy(() =>
  import("../pages/crm/LoyaltyDashboard").then((module) => ({ default: module.LoyaltyDashboardPage }))
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
            <Route path="/crm/clients" element={<CrmClientsPage />} />
            <Route path="/crm/client/:id" element={<CrmClientDetailsPage />} />
            <Route path="/crm/segments" element={<CrmSegmentsPage />} />
            <Route path="/crm/loyalty" element={<LoyaltyDashboardPage />} />
            <Route path="/finance" element={<DashboardFinancial />} />
            <Route path="/finance/cashflow" element={<CashFlow />} />
            <Route path="/finance/expenses" element={<Expenses />} />
            <Route path="/finance/commissions" element={<Commissions />} />
            <Route path="/finance/dre" element={<DRE />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/billing/plans" element={<Plans />} />
            <Route path="/billing/subscription" element={<Subscription />} />
            <Route path="/billing/history" element={<BillingHistory />} />
            <Route path="/billing/upgrade" element={<Upgrade />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/offline" element={<OfflinePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
