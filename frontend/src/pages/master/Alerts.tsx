import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getMasterSummary } from "../../services/master.service";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const MasterAlertsPage = () => {
  const summaryQuery = useQuery({
    queryKey: ["master-summary"],
    queryFn: getMasterSummary
  });

  if (summaryQuery.isLoading || !summaryQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const summary = summaryQuery.data;
  const pastDueRatio =
    summary.totalActiveSubscriptions > 0
      ? Number(((summary.pastDueSubscriptions / summary.totalActiveSubscriptions) * 100).toFixed(2))
      : 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-sky-100">Alertas Globais</h1>
        <p className="text-sm text-slate-400">Sinais criticos e prioridades operacionais da plataforma.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-400">Churn atual</p>
          <p className={`text-2xl font-bold ${summary.churnRate >= 10 ? "text-rose-300" : "text-emerald-300"}`}>
            {summary.churnRate}%
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Inadimplencia da base</p>
          <p className={`text-2xl font-bold ${pastDueRatio >= 20 ? "text-rose-300" : "text-amber-300"}`}>
            {pastDueRatio}%
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">MRR atual</p>
          <p className="text-2xl font-bold text-sky-200">{currency.format(summary.totalMrr)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Crescimento</p>
          <p className={`text-2xl font-bold ${summary.growthPercent >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {summary.growthPercent}%
          </p>
        </Card>
      </section>

      <Card title="Fila de alertas">
        <div className="space-y-2">
          {summary.alerts.map((alert, index) => (
            <div
              key={`${alert.message}-${index}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
                alert.severity === "danger"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  : alert.severity === "warning"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                    : "border-sky-500/30 bg-sky-500/10 text-sky-100"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Checklist operacional">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>1. Revisar tenants em atraso e disparar cobranca assistida.</li>
          <li>2. Acompanhar churn acima de 10% com plano de retencao.</li>
          <li>3. Validar falhas de webhook e reconciliação de pagamentos.</li>
        </ul>
      </Card>
    </div>
  );
};

