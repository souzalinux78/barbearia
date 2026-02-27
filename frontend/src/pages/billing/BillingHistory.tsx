import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getBillingHistory } from "../../services/billing.service";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusTag: Record<string, string> = {
  PAID: "bg-emerald-400/15 text-emerald-200",
  PENDING: "bg-amber-400/15 text-amber-200",
  FAILED: "bg-rose-400/15 text-rose-200",
  CANCELED: "bg-rose-400/15 text-rose-200"
};

export const BillingHistory = () => {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const query = useQuery({
    queryKey: ["billing-history", page],
    queryFn: () => getBillingHistory(page, pageSize)
  });

  if (query.isLoading || !query.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const { items, meta } = query.data;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Historico de Cobrancas</h1>
        <p className="text-sm text-slate-400">Acompanhe pagamentos e falhas de billing.</p>
      </header>

      <Card>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-charcoal/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-100">{money.format(Number(item.amount))}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTag[item.status]}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {item.gateway} • {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <button
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>
        <p className="text-xs text-slate-400">
          Pagina {page} de {totalPages}
        </p>
        <button
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => setPage((value) => value + 1)}
        >
          Proxima
        </button>
      </div>
    </div>
  );
};
