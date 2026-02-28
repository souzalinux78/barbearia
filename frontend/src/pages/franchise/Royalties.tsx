import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getFranchiseRoyalties } from "../../services/franchise.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const FranchiseRoyaltiesPage = () => {
  const query = useQuery({
    queryKey: ["franchise-royalties"],
    queryFn: () => getFranchiseRoyalties({ quick: "MONTH" })
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Royalties</h1>
        <p className="text-sm text-slate-400">Repasse automatico mensal por unidade/franquia.</p>
      </header>

      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <p className="text-xs text-slate-400">Projetado</p>
            <p className="text-xl font-bold text-gold">{formatCurrency(query.data?.projectedTotal ?? 0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Pendente</p>
            <p className="text-xl font-bold text-amber-300">{formatCurrency(query.data?.pendingTotal ?? 0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Pago</p>
            <p className="text-xl font-bold text-emerald-300">{formatCurrency(query.data?.paidTotal ?? 0)}</p>
          </Card>
        </div>
      )}

      <Card title="Lancamentos">
        <div className="space-y-2">
          {query.data?.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-charcoal/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-100">
                  {item.unitName} | {item.franchiseName}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    item.paid ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
                  }`}
                >
                  {item.paid ? "Pago" : "Pendente"}
                </span>
              </div>
              <p className="mt-1 text-slate-300">
                Periodo: {item.periodStart} ate {item.periodEnd}
              </p>
              <p className="text-slate-300">Receita: {formatCurrency(item.revenue)}</p>
              <p className="font-semibold text-gold">Royalty: {formatCurrency(item.royaltyAmount)}</p>
            </div>
          ))}
          {!query.data?.items.length ? (
            <p className="text-sm text-slate-400">Sem lancamentos de royalties para este periodo.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
