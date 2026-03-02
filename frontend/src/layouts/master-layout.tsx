import { NavLink, Outlet } from "react-router-dom";
import { useMasterAuthStore } from "../store/master-auth.store";

const masterNavItems = [
  { to: "/master", label: "Dashboard" },
  { to: "/master/metrics", label: "Metricas" },
  { to: "/master/revenue", label: "Receita" },
  { to: "/master/churn", label: "Churn" },
  { to: "/master/alerts", label: "Alertas" },
  { to: "/master/billing", label: "Cobranca" },
  { to: "/master/plans", label: "Planos" },
  { to: "/master/tenants", label: "Tenants" }
];

export const MasterLayout = () => {
  const admin = useMasterAuthStore((state) => state.admin);
  const clearSession = useMasterAuthStore((state) => state.clearSession);

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="hidden w-64 shrink-0 border-r border-sky-400/20 bg-[#0b1a2e]/90 px-4 py-6 md:flex md:flex-col">
        <h1 className="mb-6 text-xl font-bold text-sky-100">Painel Master</h1>
        <nav className="flex-1 space-y-1">
          {masterNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/master"}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-sky-500/25 font-semibold text-sky-100"
                    : "text-slate-300 hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="rounded-xl border border-white/10 bg-[#13243b]/80 p-3">
          <p className="text-xs text-slate-300">{admin?.email}</p>
          <button
            onClick={clearSession}
            className="mt-2 w-full rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-200"
          >
            Sair do Master
          </button>
        </div>
      </aside>

      <main className="w-full px-4 py-4 md:px-8 md:py-6">
        <div className="mb-3 flex gap-2 md:hidden">
          {masterNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/master"}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-xs font-semibold ${
                  isActive ? "bg-sky-500/30 text-sky-100" : "border border-white/20 text-slate-300"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <Outlet />
      </main>
    </div>
  );
};
