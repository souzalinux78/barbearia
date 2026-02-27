import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getCashflow, QuickFilter } from "../../services/financial.service";
import { FinancialNav } from "./FinancialNav";
import { QuickFilters } from "./QuickFilters";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const CashFlow = () => {
  const [quick, setQuick] = useState<QuickFilter>("30D");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["financial-cashflow", quick, page],
    queryFn: () => getCashflow(quick, page, 20)
  });

  const data = query.data;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Fluxo de Caixa</h1>
        <FinancialNav />
        <QuickFilters
          value={quick}
          onChange={(value) => {
            setQuick(value);
            setPage(1);
          }}
        />
      </header>

      {query.isLoading || !data ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-slate-400">Entradas</p>
              <p className="text-xl font-bold text-sky-300">{currency.format(data.inflow)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-400">Saidas</p>
              <p className="text-xl font-bold text-orange-300">{currency.format(data.outflow)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-400">Saldo</p>
              <p className={`text-xl font-bold ${data.balance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {currency.format(data.balance)}
              </p>
            </Card>
          </section>

          <div className="space-y-2">
            {data.items.map((entry) => (
              <Card key={entry.id} className={entry.type === "ENTRADA" ? "border-blue-500/30" : "border-orange-500/30"}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{entry.description}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(entry.date).toLocaleString("pt-BR")} {entry.method ? `| ${entry.method}` : ""}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${entry.type === "ENTRADA" ? "text-sky-300" : "text-orange-300"}`}>
                    {entry.type === "ENTRADA" ? "+" : "-"} {currency.format(entry.amount)}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-400">
              Pagina {data.meta.page} ({data.meta.total} registros)
            </span>
            <button
              disabled={page * data.meta.pageSize >= data.meta.total}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </>
      )}
    </div>
  );
};
