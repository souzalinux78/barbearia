import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getCrmChurnRisk, getCrmSegments, getCrmVip } from "../../services/crm.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const CrmSegmentsPage = () => {
  const segmentsQuery = useQuery({
    queryKey: ["crm-segments"],
    queryFn: getCrmSegments
  });

  const churnQuery = useQuery({
    queryKey: ["crm-churn-risk-preview"],
    queryFn: () => getCrmChurnRisk({ pageSize: 8, minDaysWithoutVisit: 30 })
  });

  const vipQuery = useQuery({
    queryKey: ["crm-vip-preview"],
    queryFn: () => getCrmVip({ pageSize: 5 })
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Segmentos Inteligentes</h1>
        <p className="text-sm text-slate-400">Clusters de retencao para campanhas e acao comercial.</p>
      </header>

      {segmentsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {segmentsQuery.data?.segments.map((segment) => (
            <Card key={segment.key} className="space-y-2">
              <p className="text-sm font-semibold text-slate-100">{segment.label}</p>
              <p className="text-2xl font-bold text-gold">{segment.count}</p>
              <Link
                to={`/crm/clients?segment=${segment.key}`}
                className="inline-flex rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-200"
              >
                Ver clientes
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Card title="Risco de Churn">
        {churnQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2">
            {churnQuery.data?.items.map((client) => (
              <div key={client.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs">
                <p className="text-slate-200">{client.name}</p>
                <p className="text-slate-400">{client.daysSinceLastVisit} dias sem voltar</p>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    client.risk === "alto"
                      ? "bg-rose-500/20 text-rose-200"
                      : client.risk === "medio"
                        ? "bg-amber-400/20 text-amber-200"
                        : "bg-emerald-500/20 text-emerald-200"
                  }`}
                >
                  {client.risk}
                </span>
              </div>
            ))}
            {!churnQuery.data?.items.length ? (
              <p className="text-xs text-slate-400">Sem clientes criticos neste momento.</p>
            ) : null}
          </div>
        )}
      </Card>

      <Card title="Clientes VIP">
        {vipQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              Receita VIP:{" "}
              <span className="font-semibold text-gold">
                {formatCurrency(vipQuery.data?.summary.vipRevenue ?? 0)}
              </span>
            </p>
            {vipQuery.data?.items.map((client) => (
              <div key={client.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs">
                <p className="text-slate-200">{client.name}</p>
                <p className="font-semibold text-gold">{formatCurrency(client.totalSpent)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

