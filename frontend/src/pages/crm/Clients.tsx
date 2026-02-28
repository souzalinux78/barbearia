import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { CrmClientSegmentKey, getCrmClients, getCrmSegments } from "../../services/crm.service";

const segmentOptions: Array<{ label: string; value?: CrmClientSegmentKey }> = [
  { label: "Todos" },
  { label: "VIP", value: "VIP" },
  { label: "Em risco", value: "NO_RETURN_30" },
  { label: "Inativos", value: "INACTIVE" },
  { label: "No-show", value: "NO_SHOW" }
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const CrmClientsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [segment, setSegment] = useState<CrmClientSegmentKey | undefined>(() => {
    const value = searchParams.get("segment");
    if (!value) {
      return undefined;
    }
    return value as CrmClientSegmentKey;
  });

  const clientsQuery = useQuery({
    queryKey: ["crm-clients", search, segment],
    queryFn: () => getCrmClients({ search: search || undefined, segment, pageSize: 30 })
  });

  const segmentsQuery = useQuery({
    queryKey: ["crm-segments-overview"],
    queryFn: getCrmSegments
  });

  const quickSegmentMap = useMemo(() => {
    const map = new Map<string, number>();
    segmentsQuery.data?.segments.forEach((item) => {
      map.set(item.key, item.count);
    });
    return map;
  }, [segmentsQuery.data]);

  const handleSegmentChange = (value: CrmClientSegmentKey | undefined) => {
    setSegment(value);
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set("segment", value);
    } else {
      next.delete("segment");
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-100">CRM Clientes</h1>
        <p className="text-sm text-slate-400">
          Segmentacao inteligente, fidelidade e risco de churn por cliente.
        </p>
      </header>

      <Card className="space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone"
          className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100 outline-none ring-gold/40 placeholder:text-slate-500 focus:ring-2"
        />
        <div className="flex flex-wrap gap-2">
          {segmentOptions.map((option) => {
            const count = option.value ? quickSegmentMap.get(option.value) : undefined;
            const active = segment === option.value || (!segment && !option.value);
            return (
              <button
                key={option.label}
                onClick={() => handleSegmentChange(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  active
                    ? "border-gold bg-gold text-charcoal"
                    : "border-white/15 bg-white/5 text-slate-300"
                }`}
              >
                {option.label}
                {typeof count === "number" ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </Card>

      {clientsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {clientsQuery.data?.items.map((client) => (
            <Card key={client.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">
                    {client.name}
                    {client.vip ? (
                      <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                        VIP
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-400">{client.email ?? "Sem e-mail"}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                    client.churnRisk === "alto"
                      ? "bg-rose-500/20 text-rose-200"
                      : client.churnRisk === "medio"
                        ? "bg-amber-400/20 text-amber-200"
                        : "bg-emerald-500/20 text-emerald-200"
                  }`}
                >
                  risco {client.churnRisk}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <p>Total gasto: {formatCurrency(client.totalSpent)}</p>
                <p>Visitas: {client.visitsCount}</p>
                <p>Pontos: {client.loyaltyPoints.toFixed(2)}</p>
                <p>Cashback: {formatCurrency(client.cashbackBalance)}</p>
              </div>

              <Link
                to={`/crm/client/${client.id}`}
                className="inline-flex rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/5"
              >
                Ver detalhes
              </Link>
            </Card>
          ))}
          {!clientsQuery.data?.items.length ? <Card>Nenhum cliente encontrado neste filtro.</Card> : null}
        </div>
      )}
    </div>
  );
};
