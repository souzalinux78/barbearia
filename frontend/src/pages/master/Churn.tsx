import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getMasterChurn } from "../../services/master.service";

const monthChoices = [3, 6, 12, 24];

export const MasterChurnPage = () => {
  const [months, setMonths] = useState(12);

  const churnQuery = useQuery({
    queryKey: ["master-churn", months],
    queryFn: () => getMasterChurn(months)
  });

  if (churnQuery.isLoading || !churnQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const rows = churnQuery.data.months;
  const maxRate = Math.max(...rows.map((row) => row.churnRate), 1);
  const avgRate = rows.length
    ? Number((rows.reduce((sum, row) => sum + row.churnRate, 0) / rows.length).toFixed(2))
    : 0;
  const latestRate = rows[rows.length - 1]?.churnRate ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sky-100">Churn da Plataforma</h1>
          <p className="text-sm text-slate-400">Monitoramento mensal de cancelamentos e base ativa.</p>
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-400">Churn atual</p>
          <p className={`text-2xl font-bold ${latestRate >= 10 ? "text-rose-300" : "text-emerald-300"}`}>{latestRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Churn medio</p>
          <p className={`text-2xl font-bold ${avgRate >= 10 ? "text-rose-300" : "text-amber-300"}`}>{avgRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Meses analisados</p>
          <p className="text-2xl font-bold text-slate-100">{rows.length}</p>
        </Card>
      </section>

      <Card title="Historico de churn">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.month}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-100">{row.month}</span>
                <span className="text-rose-300">Churn: {row.churnRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-charcoal">
                <div
                  className={`h-2 rounded-full ${row.churnRate >= 10 ? "bg-rose-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.max(5, (row.churnRate / maxRate) * 100)}%` }}
                />
              </div>
              <div className="mt-1 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                <p>Canceladas: {row.canceledSubscriptions}</p>
                <p>Base ativa: {row.activeBase}</p>
              </div>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-slate-400">Sem dados de churn no periodo.</p> : null}
        </div>
      </Card>
    </div>
  );
};
