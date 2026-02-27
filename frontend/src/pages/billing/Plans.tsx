import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getBillingPlans, PlanName, subscribePlan } from "../../services/billing.service";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const planLabel: Record<PlanName, string> = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium"
};

export const Plans = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: getBillingPlans
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribePlan,
    onSuccess: () => {
      setFeedback("Plano atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
    },
    onError: () => setFeedback("Falha ao atualizar plano.")
  });

  if (plansQuery.isLoading || !plansQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const plans = plansQuery.data;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Planos SaaS</h1>
        <p className="text-sm text-slate-400">Escolha o plano ideal para o momento da barbearia.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        {plans.map((plan) => {
          const isPopular = plan.name === "PRO";
          return (
            <Card
              key={plan.id}
              className={`relative p-5 ${isPopular ? "border-gold/60 bg-gradient-to-b from-gold/10 to-graphite/80" : ""}`}
            >
              {isPopular ? (
                <span className="absolute right-3 top-3 rounded-full bg-gold px-2 py-1 text-[10px] font-bold text-charcoal">
                  Mais Popular
                </span>
              ) : null}
              <p className="text-xs uppercase tracking-wide text-slate-400">{planLabel[plan.name]}</p>
              <p className="mt-2 text-3xl font-bold text-slate-100">{money.format(Number(plan.price))}</p>
              <p className="text-xs text-slate-400">/mes</p>

              <ul className="mt-4 space-y-1 text-sm text-slate-300">
                <li>Usuarios: {plan.maxUsers}</li>
                <li>Barbeiros: {plan.maxBarbers}</li>
                <li>Agendamentos/mes: {plan.maxAppointmentsMonth}</li>
                <li>Analytics premium: {plan.features.premium_analytics ? "Sim" : "Nao"}</li>
                <li>Estoque: {plan.features.inventory ? "Sim" : "Nao"}</li>
              </ul>

              <button
                onClick={() => subscribeMutation.mutate(plan.name)}
                className="mt-5 w-full rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? "Atualizando..." : `Escolher ${planLabel[plan.name]}`}
              </button>
            </Card>
          );
        })}
      </section>

      {feedback ? <p className="text-sm text-slate-300">{feedback}</p> : null}
    </div>
  );
};
