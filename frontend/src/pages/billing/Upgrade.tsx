import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getBillingPlans, getBillingStatus } from "../../services/billing.service";

export const Upgrade = () => {
  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: getBillingPlans
  });

  const statusQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus
  });

  const currentPlanId = statusQuery.data?.subscription.planId;
  const recommendedPlan = useMemo(
    () => plansQuery.data?.find((plan) => plan.name === "PRO") ?? plansQuery.data?.[0] ?? null,
    [plansQuery.data]
  );

  if (plansQuery.isLoading || !plansQuery.data || statusQuery.isLoading || !statusQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Upgrade de Plano</h1>
        <p className="text-sm text-slate-400">
          Atualize para liberar recursos premium e remover bloqueios.
        </p>
      </header>

      <Card className="border-amber-400/25 bg-amber-400/10 p-4">
        <p className="text-sm text-amber-100">
          Status atual: <span className="font-semibold">{statusQuery.data.subscription.status}</span>
        </p>
        <p className="mt-1 text-xs text-amber-200">
          Em caso de inadimplencia, o acesso as rotas principais fica bloqueado ate regularizacao.
        </p>
      </Card>

      <section className="grid gap-3 md:grid-cols-3">
        {plansQuery.data.map((plan) => (
          <Card
            key={plan.id}
            className={`p-4 ${
              plan.id === recommendedPlan?.id ? "border-gold/60 bg-gradient-to-b from-gold/10 to-graphite/80" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">{plan.name}</p>
            <p className="mt-1 text-2xl font-bold text-slate-100">R$ {Number(plan.price).toFixed(2)}</p>
            <p className="mt-3 text-xs text-slate-300">Usuarios: {plan.maxUsers}</p>
            <p className="text-xs text-slate-300">Barbeiros: {plan.maxBarbers}</p>
            <p className="text-xs text-slate-300">Agendamentos/mes: {plan.maxAppointmentsMonth}</p>
            {plan.id === currentPlanId ? (
              <p className="mt-3 inline-block rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                Plano Atual
              </p>
            ) : null}
          </Card>
        ))}
      </section>

      <div className="flex gap-2">
        <Link
          to="/billing/plans"
          className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
        >
          Escolher plano
        </Link>
        <Link
          to="/billing/subscription"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
        >
          Ver assinatura
        </Link>
      </div>
    </div>
  );
};
