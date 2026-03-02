import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/app-layout";
import { MasterLayout } from "../layouts/master-layout";
import { useAuthStore } from "../store/auth.store";
import { RequireAuth } from "./require-auth";
import { RequireMasterAuth } from "./require-master-auth";
import { LoginPage } from "../pages/login-page";
import { RegisterPage } from "../pages/register-page";
import { LandingPage } from "../pages/landing-page";
import { ClientsPage } from "../pages/clients-page";
import { ServicesPage } from "../pages/services-page";
import { ProductsPage } from "../pages/products-page";
import { SettingsPage } from "../pages/settings-page";
import { UsersPage } from "../pages/users-page";

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
const DashboardFranchisePage = lazy(() =>
  import("../pages/franchise/DashboardFranchise").then((module) => ({ default: module.DashboardFranchisePage }))
);
const FranchiseUnitsPage = lazy(() =>
  import("../pages/franchise/Units").then((module) => ({ default: module.FranchiseUnitsPage }))
);
const FranchiseUnitDetailsPage = lazy(() =>
  import("../pages/franchise/UnitDetails").then((module) => ({ default: module.FranchiseUnitDetailsPage }))
);
const FranchiseRoyaltiesPage = lazy(() =>
  import("../pages/franchise/Royalties").then((module) => ({ default: module.FranchiseRoyaltiesPage }))
);
const AutomationRulesPage = lazy(() =>
  import("../pages/automation/Rules").then((module) => ({ default: module.AutomationRulesPage }))
);
const WhatsAppConfigPage = lazy(() =>
  import("../pages/automation/WhatsAppConfig").then((module) => ({ default: module.WhatsAppConfigPage }))
);
const AutomationMessagesPage = lazy(() =>
  import("../pages/automation/Messages").then((module) => ({ default: module.AutomationMessagesPage }))
);
const AutomationMetricsPage = lazy(() =>
  import("../pages/automation/Metrics").then((module) => ({ default: module.AutomationMetricsPage }))
);
const DashboardPerformancePage = lazy(() =>
  import("../pages/performance/DashboardPerformance").then((module) => ({
    default: module.DashboardPerformancePage
  }))
);
const RankingPerformancePage = lazy(() =>
  import("../pages/performance/Ranking").then((module) => ({ default: module.RankingPerformancePage }))
);
const GoalsPerformancePage = lazy(() =>
  import("../pages/performance/Goals").then((module) => ({ default: module.GoalsPerformancePage }))
);
const BadgesPerformancePage = lazy(() =>
  import("../pages/performance/Badges").then((module) => ({ default: module.BadgesPerformancePage }))
);
const ChallengesPerformancePage = lazy(() =>
  import("../pages/performance/Challenges").then((module) => ({
    default: module.ChallengesPerformancePage
  }))
);
const LoginMasterPage = lazy(() =>
  import("../pages/master/LoginMaster").then((module) => ({ default: module.LoginMasterPage }))
);
const PublicBookingPage = lazy(() =>
  import("../pages/booking/PublicBookingPage").then((module) => ({ default: module.PublicBookingPage }))
);
const DashboardMasterPage = lazy(() =>
  import("../pages/master/DashboardMaster").then((module) => ({ default: module.DashboardMasterPage }))
);
const MasterMetricsPage = lazy(() =>
  import("../pages/master/Metrics").then((module) => ({ default: module.MasterMetricsPage }))
);
const MasterRevenuePage = lazy(() =>
  import("../pages/master/Revenue").then((module) => ({ default: module.MasterRevenuePage }))
);
const MasterChurnPage = lazy(() =>
  import("../pages/master/Churn").then((module) => ({ default: module.MasterChurnPage }))
);
const MasterAlertsPage = lazy(() =>
  import("../pages/master/Alerts").then((module) => ({ default: module.MasterAlertsPage }))
);
const MasterBillingConfigPage = lazy(() =>
  import("../pages/master/BillingConfig").then((module) => ({ default: module.MasterBillingConfigPage }))
);
const MasterPlansPage = lazy(() =>
  import("../pages/master/Plans").then((module) => ({ default: module.MasterPlansPage }))
);
const MasterTenantsPage = lazy(() =>
  import("../pages/master/Tenants").then((module) => ({ default: module.MasterTenantsPage }))
);

const RootEntry = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  return accessToken ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

export const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<div className="p-4 text-sm text-slate-300">Carregando...</div>}>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/acessar" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/checkout" element={<RegisterPage />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/master/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<LoginMasterPage />} />
        <Route path="/booking/:tenantSlug" element={<PublicBookingPage />} />

        <Route element={<RequireMasterAuth />}>
          <Route element={<MasterLayout />}>
            <Route path="/master" element={<DashboardMasterPage />} />
            <Route path="/master/metrics" element={<MasterMetricsPage />} />
            <Route path="/master/revenue" element={<MasterRevenuePage />} />
            <Route path="/master/churn" element={<MasterChurnPage />} />
            <Route path="/master/alerts" element={<MasterAlertsPage />} />
            <Route path="/master/billing" element={<MasterBillingConfigPage />} />
            <Route path="/master/plans" element={<MasterPlansPage />} />
            <Route path="/master/tenants" element={<MasterTenantsPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/appointments" element={<DailyView />} />
            <Route path="/appointments/week" element={<WeeklyView />} />
            <Route path="/appointments/new" element={<NewAppointment />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/crm/clients" element={<CrmClientsPage />} />
            <Route path="/crm/client/:id" element={<CrmClientDetailsPage />} />
            <Route path="/crm/segments" element={<CrmSegmentsPage />} />
            <Route path="/crm/loyalty" element={<LoyaltyDashboardPage />} />
            <Route path="/franchise" element={<DashboardFranchisePage />} />
            <Route path="/franchise/units" element={<FranchiseUnitsPage />} />
            <Route path="/franchise/units/:id" element={<FranchiseUnitDetailsPage />} />
            <Route path="/franchise/royalties" element={<FranchiseRoyaltiesPage />} />
            <Route path="/automation/rules" element={<AutomationRulesPage />} />
            <Route path="/automation/whatsapp" element={<WhatsAppConfigPage />} />
            <Route path="/automation/messages" element={<AutomationMessagesPage />} />
            <Route path="/automation/metrics" element={<AutomationMetricsPage />} />
            <Route path="/performance" element={<DashboardPerformancePage />} />
            <Route path="/performance/ranking" element={<RankingPerformancePage />} />
            <Route path="/performance/goals" element={<GoalsPerformancePage />} />
            <Route path="/performance/badges" element={<BadgesPerformancePage />} />
            <Route path="/performance/challenges" element={<ChallengesPerformancePage />} />
            <Route path="/finance" element={<DashboardFinancial />} />
            <Route path="/finance/cashflow" element={<CashFlow />} />
            <Route path="/finance/expenses" element={<Expenses />} />
            <Route path="/finance/commissions" element={<Commissions />} />
            <Route path="/finance/dre" element={<DRE />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/billing/plans" element={<Plans />} />
            <Route path="/billing/subscription" element={<Subscription />} />
            <Route path="/billing/history" element={<BillingHistory />} />
            <Route path="/billing/upgrade" element={<Upgrade />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/offline" element={<OfflinePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
