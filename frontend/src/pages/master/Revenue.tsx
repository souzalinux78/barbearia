import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getMasterRevenue } from "../../services/master.service";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const MasterRevenuePage = () => {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  const revenueQuery = useQuery({
    queryKey: ["master-revenue", period],
    queryFn: () => getMasterRevenue(period)
  });

  if (revenueQuery.isLoading || !revenueQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const revenue = revenueQuery.data;
  const maxAmount = Math.max(...revenue.revenue.map((row) => row.amount), 1);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sky-100">Receita Global</h1>
          <p className="text-sm text-slate-400">Analise de faturamento da plataforma por periodo.</p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-charcoal/50 p-1">
          <button
            onClick={() => setPeriod("monthly")}
            className={`rounded-lg px-3 py-1 text-sm ${
              period === "monthly" ? "bg-sky-500/30 text-sky-100" : "text-slate-300"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setPeriod("yearly")}
            className={`rounded-lg px-3 py-1 text-sm ${
              period === "yearly" ? "bg-sky-500/30 text-sky-100" : "text-slate-300"
            }`}
          >
            Anual
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-slate-400">Receita total ({period === "monthly" ? "12 meses" : "acumulado"})</p>
          <p className="text-2xl font-bold text-emerald-300">{currency.format(revenue.totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Pontos no grafico</p>
          <p className="text-2xl font-bold text-slate-100">{revenue.revenue.length}</p>
        </Card>
      </section>

      <Card title="Evolucao de receita">
        <div className="space-y-2">
          {revenue.revenue.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-300">
                <span>{row.label}</span>
                <span>{currency.format(row.amount)}</span>
              </div>
              <div className="h-2 rounded-full bg-charcoal">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                  style={{ width: `${Math.max(4, (row.amount / maxAmount) * 100)}%` }}
                />
              </div>
              {"cumulative" in row && row.cumulative !== undefined ? (
                <p className="mt-1 text-[11px] text-slate-500">Acumulado: {currency.format(row.cumulative)}</p>
              ) : null}
            </div>
          ))}
          {!revenue.revenue.length ? <p className="text-sm text-slate-400">Sem dados de receita no periodo.</p> : null}
        </div>
      </Card>

      {period === "monthly" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="Receita por plano">
            <div className="space-y-2">
              {(revenue.byPlan ?? []).map((row) => (
                <div key={`${row.planId}-${row.planName ?? "N/A"}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{row.planName ?? "N/A"}</span>
                  <span className="font-semibold text-slate-100">{currency.format(row.mrr)}</span>
                </div>
              ))}
              {!revenue.byPlan?.length ? <p className="text-xs text-slate-500">Sem dados.</p> : null}
            </div>
          </Card>
          <Card title="Receita por franquia">
            <div className="space-y-2">
              {(revenue.byFranchise ?? []).map((row) => (
                <div
                  key={`${row.franchiseId ?? "independente"}-${row.franchiseName}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">{row.franchiseName}</span>
                  <span className="font-semibold text-slate-100">{currency.format(row.revenue)}</span>
                </div>
              ))}
              {!revenue.byFranchise?.length ? <p className="text-xs text-slate-500">Sem dados.</p> : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
