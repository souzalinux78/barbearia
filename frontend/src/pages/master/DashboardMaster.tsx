import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getMasterFunnel,
  getMasterMrr,
  getMasterRevenueProjection,
  getMasterSummary
} from "../../services/master.service";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const DashboardMasterPage = () => {
  const summaryQuery = useQuery({
    queryKey: ["master-summary"],
    queryFn: getMasterSummary
  });
  const mrrQuery = useQuery({
    queryKey: ["master-mrr"],
    queryFn: () => getMasterMrr(12)
  });
  const projectionQuery = useQuery({
    queryKey: ["master-projection"],
    queryFn: getMasterRevenueProjection
  });
  const funnelQuery = useQuery({
    queryKey: ["master-funnel", 30],
    queryFn: () => getMasterFunnel(30)
  });

  const isLoading =
    summaryQuery.isLoading || mrrQuery.isLoading || projectionQuery.isLoading || funnelQuery.isLoading;
  const summary = summaryQuery.data;
  const mrr = mrrQuery.data;
  const projection = projectionQuery.data;
  const funnel = funnelQuery.data;

  if (isLoading || !summary || !mrr || !projection || !funnel) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const mrrMax = Math.max(...mrr.months.map((row) => row.mrr), 1);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-sky-100">Dashboard Master SaaS</h1>
        <p className="text-sm text-slate-400">Visao executiva global da plataforma.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-sky-500/35 bg-[#0f2036]/80">
          <p className="text-xs uppercase tracking-wide text-slate-400">MRR atual</p>
          <p className="mt-1 text-2xl font-bold text-sky-200">{currency.format(summary.totalMrr)}</p>
        </Card>
        <Card className={summary.growthPercent >= 0 ? "border-emerald-500/35" : "border-rose-500/35"}>
          <p className="text-xs uppercase tracking-wide text-slate-400">Crescimento</p>
          <p className={`mt-1 text-2xl font-bold ${summary.growthPercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {summary.growthPercent}%
          </p>
        </Card>
        <Card className="border-rose-500/35">
          <p className="text-xs uppercase tracking-wide text-slate-400">Churn</p>
          <p className="mt-1 text-2xl font-bold text-rose-300">{summary.churnRate}%</p>
        </Card>
        <Card className="border-white/15">
          <p className="text-xs uppercase tracking-wide text-slate-400">Barbearias ativas</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{summary.activeTenants}</p>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-400">Inadimplentes</p>
          <p className="text-xl font-semibold text-amber-300">{summary.pastDueSubscriptions}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Total unidades</p>
          <p className="text-xl font-semibold text-slate-100">{summary.totalUnits}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">ARPU</p>
          <p className="text-xl font-semibold text-sky-200">{currency.format(summary.arpu)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">LTV medio</p>
          <p className="text-xl font-semibold text-emerald-300">{currency.format(summary.avgLtv)}</p>
        </Card>
      </section>

      <Card title="MRR por mes">
        <div className="space-y-2">
          {mrr.months.map((row) => (
            <div key={row.month}>
              <div className="mb-1 flex justify-between text-xs text-slate-300">
                <span>{row.month}</span>
                <span>{currency.format(row.mrr)}</span>
              </div>
              <div className="h-2 rounded-full bg-charcoal">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                  style={{ width: `${Math.max(5, (row.mrr / mrrMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Funil comercial (${funnel.days} dias)`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-slate-400">Visitas landing</p>
            <p className="text-xl font-semibold text-slate-100">{funnel.funnel.landingViews}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Clique checkout</p>
            <p className="text-xl font-semibold text-slate-100">{funnel.funnel.checkoutClicks}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Cadastro iniciado</p>
            <p className="text-xl font-semibold text-slate-100">{funnel.funnel.registerStarts}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Cadastro concluido</p>
            <p className="text-xl font-semibold text-slate-100">{funnel.funnel.registerSuccess}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Pagantes</p>
            <p className="text-xl font-semibold text-emerald-300">{funnel.funnel.paidTenants}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <p className="rounded-lg border border-white/10 bg-charcoal/40 px-3 py-2 text-xs text-slate-300">
            Visita -&gt; Checkout: <span className="font-semibold text-sky-200">{funnel.conversion.visitToCheckout}%</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-charcoal/40 px-3 py-2 text-xs text-slate-300">
            Checkout -&gt; Iniciado:{" "}
            <span className="font-semibold text-sky-200">{funnel.conversion.checkoutToRegisterStart}%</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-charcoal/40 px-3 py-2 text-xs text-slate-300">
            Iniciado -&gt; Concluido:{" "}
            <span className="font-semibold text-sky-200">{funnel.conversion.registerStartToSuccess}%</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-charcoal/40 px-3 py-2 text-xs text-slate-300">
            Concluido -&gt; Pago:{" "}
            <span className="font-semibold text-emerald-300">{funnel.conversion.registerSuccessToPaid}%</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-charcoal/40 px-3 py-2 text-xs text-slate-300">
            Visita -&gt; Pago: <span className="font-semibold text-gold">{funnel.conversion.visitToPaid}%</span>
          </p>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Receita por plano">
          <div className="space-y-2">
            {summary.revenueByPlan.map((item) => (
              <div key={item.planId} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{item.planName ?? "N/A"}</span>
                <span className="font-semibold text-slate-100">{currency.format(item.mrr)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Receita por franquia">
          <div className="space-y-2">
            {summary.revenueByFranchise.map((item) => (
              <div key={`${item.franchiseId ?? "none"}-${item.franchiseName}`} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{item.franchiseName}</span>
                <span className="font-semibold text-slate-100">{currency.format(item.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Projecao de crescimento (6 meses)">
        <p className="mb-2 text-xs text-slate-400">Crescimento medio: {projection.averageGrowthRate}%</p>
        <div className="space-y-2">
          {projection.projection.map((item) => (
            <div key={item.month} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{item.month}</span>
              <span className="font-semibold text-emerald-300">{currency.format(item.projectedMrr)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Alertas globais">
        <div className="space-y-2">
          {summary.alerts.map((alert, index) => (
            <div
              key={`${alert.message}-${index}`}
              className={`rounded-xl px-3 py-2 text-sm ${
                alert.severity === "danger"
                  ? "border border-rose-500/40 bg-rose-500/10 text-rose-200"
                  : alert.severity === "warning"
                    ? "border border-amber-500/40 bg-amber-500/10 text-amber-100"
                    : "border border-sky-500/30 bg-sky-500/10 text-sky-100"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
