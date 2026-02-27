import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { cancelSubscription, getBillingStatus } from "../../services/billing.service";

const statusLabel: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIALING: "Trial",
  PAST_DUE: "Inadimplente",
  CANCELED: "Cancelado",
  INCOMPLETE: "Pendente"
};

const statusColor: Record<string, string> = {
  ACTIVE: "text-emerald-300",
  TRIALING: "text-amber-300",
  PAST_DUE: "text-rose-300",
  CANCELED: "text-rose-300",
  INCOMPLETE: "text-orange-300"
};

export const Subscription = () => {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus
  });

  const cancelMutation = useMutation({
    mutationFn: (immediate: boolean) => cancelSubscription(immediate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      queryClient.invalidateQueries({ queryKey: ["billing-history"] });
    }
  });

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const { subscription, warning3Days, daysToRenewal } = statusQuery.data;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Assinatura</h1>
        <p className="text-sm text-slate-400">Status atual, renovacao e cancelamento.</p>
      </header>

      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Plano atual</p>
        <p className="mt-2 text-2xl font-bold text-slate-100">{subscription.plan.name}</p>
        <p className={`mt-2 text-sm font-semibold ${statusColor[subscription.status]}`}>
          {statusLabel[subscription.status]}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Renovacao em {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")} (
          {daysToRenewal} dias)
        </p>
        {warning3Days ? (
          <p className="mt-2 rounded-lg bg-amber-400/15 px-3 py-2 text-xs text-amber-200">
            Sua assinatura vence em ate 3 dias.
          </p>
        ) : null}
      </Card>

      <Card title="Acoes de assinatura">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => cancelMutation.mutate(false)}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
            disabled={cancelMutation.isPending}
          >
            Cancelar ao fim do periodo
          </button>
          <button
            onClick={() => cancelMutation.mutate(true)}
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200"
            disabled={cancelMutation.isPending}
          >
            Cancelar imediatamente
          </button>
        </div>
      </Card>
    </div>
  );
};
