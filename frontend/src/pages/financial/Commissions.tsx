import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getCommissions,
  payCommission,
  QuickFilter
} from "../../services/financial.service";
import { useAuthStore } from "../../store/auth.store";
import { FinancialNav } from "./FinancialNav";
import { QuickFilters } from "./QuickFilters";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Commissions = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [quick, setQuick] = useState<QuickFilter>("30D");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["financial-commissions", quick, page],
    queryFn: () => getCommissions(quick, page, 20)
  });

  const payMutation = useMutation({
    mutationFn: payCommission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    }
  });

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Comissoes</h1>
        <FinancialNav />
        <QuickFilters
          value={quick}
          onChange={(value) => {
            setQuick(value);
            setPage(1);
          }}
        />
      </header>

      {query.isLoading || !query.data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="space-y-2">
            {query.data.items.map((commission) => (
              <Card key={commission.id} className={commission.paid ? "border-emerald-500/30" : "border-gold/40"}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{commission.barber.name}</p>
                    <p className="text-xs text-slate-400">
                      Percentual: {Number(commission.percentage).toFixed(2)}% | Agendamento:{" "}
                      {commission.appointment?.date?.slice(0, 10) ?? "manual"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold">{currency.format(Number(commission.amount))}</p>
                    {!commission.paid && user?.role !== "BARBER" ? (
                      <button
                        onClick={() => payMutation.mutate(commission.id)}
                        className="mt-1 rounded-md bg-forest px-2 py-1 text-[11px] font-semibold text-slate-100"
                      >
                        Marcar paga
                      </button>
                    ) : (
                      <span className={`text-[11px] font-semibold ${commission.paid ? "text-emerald-300" : "text-slate-400"}`}>
                        {commission.paid ? "Paga" : "Pendente"}
                      </span>
                    )}
                  </div>
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
              Pagina {query.data.meta.page} ({query.data.meta.total} comissoes)
            </span>
            <button
              disabled={page * query.data.meta.pageSize >= query.data.meta.total}
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
