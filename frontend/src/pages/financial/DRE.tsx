import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getDre } from "../../services/financial.service";
import { FinancialNav } from "./FinancialNav";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const defaultStart = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return start.toISOString().slice(0, 10);
};

const defaultEnd = () => new Date().toISOString().slice(0, 10);

export const DRE = () => {
  const [start, setStart] = useState(defaultStart());
  const [end, setEnd] = useState(defaultEnd());

  const queryKey = useMemo(() => ["financial-dre", start, end], [start, end]);
  const query = useQuery({
    queryKey,
    queryFn: () => getDre(start, end)
  });

  const data = query.data;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">DRE Simplificado</h1>
        <FinancialNav />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="rounded-xl border border-white/10 bg-graphite px-3 py-2 text-sm text-slate-100"
          />
          <input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="rounded-xl border border-white/10 bg-graphite px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </header>

      {query.isLoading || !data ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <section className="space-y-3">
          <Card className="border-sky-500/30">
            <p className="text-xs uppercase tracking-wide text-slate-400">Receita Bruta</p>
            <p className="mt-1 text-xl font-bold text-sky-300">{currency.format(data.receitaBruta)}</p>
          </Card>

          <Card className="border-orange-500/30">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total de Despesas</p>
            <p className="mt-1 text-xl font-bold text-orange-300">{currency.format(data.totalDespesas)}</p>
          </Card>

          <Card className="border-gold/30">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total de Comissoes</p>
            <p className="mt-1 text-xl font-bold text-gold">{currency.format(data.totalComissoes)}</p>
          </Card>

          <Card className={data.lucroOperacional >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Lucro Operacional</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                data.lucroOperacional >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {currency.format(data.lucroOperacional)}
            </p>
            <p className="text-xs text-slate-400">Margem: {data.margemPercentual}%</p>
          </Card>
        </section>
      )}
    </div>
  );
};
