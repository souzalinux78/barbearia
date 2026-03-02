import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getMasterPlatformMetrics, getMasterSummary } from "../../services/master.service";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const monthChoices = [3, 6, 12, 24];

export const MasterMetricsPage = () => {
  const [months, setMonths] = useState(12);

  const summaryQuery = useQuery({
    queryKey: ["master-summary"],
    queryFn: getMasterSummary
  });
  const metricsQuery = useQuery({
    queryKey: ["master-platform-metrics", months],
    queryFn: () => getMasterPlatformMetrics(months)
  });

  if (summaryQuery.isLoading || metricsQuery.isLoading || !summaryQuery.data || !metricsQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const summary = summaryQuery.data;
  const rows = metricsQuery.data.items;
  const avgChurn =
    rows.length > 0
      ? Number((rows.reduce((sum, row) => sum + row.totalChurn, 0) / rows.length).toFixed(2))
      : 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sky-100">Metricas da Plataforma</h1>
          <p className="text-sm text-slate-400">Visao de crescimento, base ativa e retencao.</p>
        </div>
        <select
          value={months}
          onChange={(event) => setMonths(Number(event.target.value))}
          className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
        >
          {monthChoices.map((option) => (
            <option key={option} value={option}>
              Ultimos {option} meses
            </option>
          ))}
        </select>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-400">Assinaturas ativas</p>
          <p className="text-2xl font-bold text-slate-100">{summary.totalActiveSubscriptions}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Usuarios ativos</p>
          <p className="text-2xl font-bold text-slate-100">{summary.totalUsers}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Retencao media</p>
          <p className="text-2xl font-bold text-emerald-300">{summary.avgRetentionDays} dias</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Churn medio ({months}m)</p>
          <p className="text-2xl font-bold text-rose-300">{avgChurn}%</p>
        </Card>
      </section>

      <Card title="Historico de plataforma">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.month} className="rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-100">{row.month}</span>
                <span className="text-sky-200">{currency.format(row.totalMrr)}</span>
              </div>
              <div className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                <p>Assinaturas ativas: {row.totalActiveSubscriptions}</p>
                <p>Novas assinaturas: {row.totalNewSubscriptions}</p>
                <p>Churn: {row.totalChurn}%</p>
              </div>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-slate-400">Sem dados no periodo.</p> : null}
        </div>
      </Card>
    </div>
  );
};

