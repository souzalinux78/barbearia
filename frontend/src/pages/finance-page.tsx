import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getCashflow } from "../services/finance.service";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const FinancePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cashflow"],
    queryFn: getCashflow
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Financeiro</h1>
        <p className="text-sm text-slate-400">Fluxo de caixa e metodos de pagamento.</p>
      </header>

      {isLoading || !data ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Entradas</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">{currency.format(data.inflow)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Saidas</p>
              <p className="mt-1 text-xl font-semibold text-rose-300">{currency.format(data.outflow)}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Saldo</p>
              <p className="mt-1 text-xl font-semibold text-gold">{currency.format(data.balance)}</p>
            </Card>
          </section>

          <Card title="Metodos de pagamento">
            <div className="space-y-2">
              {Object.entries(data.byMethod).map(([method, amount]) => (
                <div key={method} className="flex justify-between text-sm">
                  <span className="text-slate-300">{method}</span>
                  <span className="font-semibold text-slate-100">{currency.format(amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
