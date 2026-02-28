import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getCrmClientDetails } from "../../services/crm.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const CrmClientDetailsPage = () => {
  const params = useParams<{ id: string }>();
  const clientId = String(params.id ?? "");

  const query = useQuery({
    queryKey: ["crm-client-details", clientId],
    queryFn: () => getCrmClientDetails(clientId),
    enabled: Boolean(clientId)
  });

  const initials = useMemo(() => {
    const name = query.data?.client.name ?? "Cliente";
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [query.data?.client.name]);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!query.data) {
    return <Card>Cliente nao encontrado.</Card>;
  }

  const { client } = query.data;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-lg font-bold text-gold">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {client.name}
            {client.vip ? (
              <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                VIP
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-slate-400">
            {client.email ?? "Sem e-mail"} | {client.phone ?? "Sem telefone"}
          </p>
        </div>
      </header>

      <Card className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Total gasto</p>
          <p className="font-semibold text-slate-100">{formatCurrency(client.totalSpent)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Pontos</p>
          <p className="font-semibold text-slate-100">{client.loyaltyPoints.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Cashback</p>
          <p className="font-semibold text-slate-100">{formatCurrency(client.cashbackBalance)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Frequencia media</p>
          <p className="font-semibold text-slate-100">{client.averageReturnDays} dias</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">RFM</p>
          <p className="font-semibold text-slate-100">
            {client.rfm.score} - {client.rfm.segment}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">LTV</p>
          <p className="font-semibold text-slate-100">{client.ltv.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Risco churn</p>
          <p
            className={`font-semibold ${
              client.churnRisk === "alto"
                ? "text-rose-300"
                : client.churnRisk === "medio"
                  ? "text-amber-300"
                  : "text-emerald-300"
            }`}
          >
            {client.churnRisk}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Visitas</p>
          <p className="font-semibold text-slate-100">{client.visitsCount}</p>
        </div>
      </Card>

      <Card title="Historico de Atendimentos">
        <div className="space-y-2">
          {query.data.appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-xl border border-white/10 bg-charcoal/50 p-3 text-xs">
              <p className="font-semibold text-slate-100">
                {appointment.date} {appointment.startTime}-{appointment.endTime}
              </p>
              <p className="text-slate-300">
                {appointment.service?.name ?? "Servico nao informado"} | {appointment.barber.name}
              </p>
              <p className="text-slate-400">
                {appointment.status} | {formatCurrency(appointment.price)}
              </p>
            </div>
          ))}
          {!query.data.appointments.length ? <p className="text-xs text-slate-400">Sem historico.</p> : null}
        </div>
      </Card>

      <Card title="Transacoes de Fidelidade">
        <div className="space-y-2">
          {query.data.loyaltyTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs">
              <p className="text-slate-200">{transaction.type}</p>
              <p className="font-semibold text-slate-100">{transaction.amount.toFixed(2)}</p>
              <p className="text-slate-400">{new Date(transaction.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          ))}
          {!query.data.loyaltyTransactions.length ? (
            <p className="text-xs text-slate-400">Nenhuma transacao de fidelidade registrada.</p>
          ) : null}
        </div>
      </Card>

      <Link to="/crm/clients" className="inline-flex rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200">
        Voltar para clientes
      </Link>
    </div>
  );
};

