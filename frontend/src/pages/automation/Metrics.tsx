import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getAutomationMetrics } from "../../services/automation.service";
import { AutomationNav } from "./AutomationNav";

export const AutomationMetricsPage = () => {
  const [days, setDays] = useState(30);
  const metricsQuery = useQuery({
    queryKey: ["automation-metrics", days],
    queryFn: () => getAutomationMetrics(days)
  });

  if (metricsQuery.isLoading || !metricsQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const metrics = metricsQuery.data;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Metricas de Automacao</h1>
          <p className="text-sm text-slate-400">
            Conversao de confirmacao, reativacao e upsell por periodo.
          </p>
        </div>
        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
        >
          <option value={7}>Ultimos 7 dias</option>
          <option value={30}>Ultimos 30 dias</option>
          <option value={60}>Ultimos 60 dias</option>
          <option value={90}>Ultimos 90 dias</option>
        </select>
      </header>
      <AutomationNav />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-400">Taxa confirmacao</p>
          <p className="text-xl font-bold text-emerald-300">{metrics.confirmationRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Taxa resposta</p>
          <p className="text-xl font-bold text-slate-100">{metrics.responseRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Reducao no-show</p>
          <p className="text-xl font-bold text-gold">{metrics.noShow.reductionPercent}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Upsell conversao</p>
          <p className="text-xl font-bold text-sky-300">{metrics.upsell.rate}%</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Funil de Conversao">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.funnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="stage" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#C6A46A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Conversoes">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-white/10 px-3 py-2">
              <p className="text-slate-400">Reativacao</p>
              <p className="font-semibold text-slate-100">
                {metrics.reactivation.converted} / {metrics.reactivation.sent} ({metrics.reactivation.rate}%)
              </p>
            </div>
            <div className="rounded-xl border border-white/10 px-3 py-2">
              <p className="text-slate-400">Upsell</p>
              <p className="font-semibold text-slate-100">
                {metrics.upsell.converted} / {metrics.upsell.sent} ({metrics.upsell.rate}%)
              </p>
            </div>
            <div className="rounded-xl border border-white/10 px-3 py-2">
              <p className="text-slate-400">No-show atual vs anterior</p>
              <p className="font-semibold text-slate-100">
                {metrics.noShow.currentRate}% vs {metrics.noShow.previousRate}%
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
