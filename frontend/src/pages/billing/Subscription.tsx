import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { cancelSubscription, getBillingStatus, PlanName, subscribePlan } from "../../services/billing.service";
import { useEffect, useState } from "react";
import { trackEvent, trackPageView } from "../../utils/analytics";

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
  const [searchParams] = useSearchParams();
  const notice = searchParams.get("notice");
  const [actionFeedback, setActionFeedback] = useState("");
  const [pixCodeFromRegenerate, setPixCodeFromRegenerate] = useState("");
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus
  });

  useEffect(() => {
    trackPageView("billing_subscription");
  }, []);

  const cancelMutation = useMutation({
    mutationFn: (immediate: boolean) => cancelSubscription(immediate),
    onSuccess: () => {
      trackEvent("subscription_cancel_success");
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      queryClient.invalidateQueries({ queryKey: ["billing-history"] });
    }
  });

  const regeneratePixMutation = useMutation({
    mutationFn: (planName: PlanName) => subscribePlan(planName, true),
    onSuccess: (result) => {
      const pix = (result as { pix?: { copyPasteCode?: string } })?.pix;
      if (pix?.copyPasteCode) {
        trackEvent("subscription_pix_regenerate_success");
        setPixCodeFromRegenerate(pix.copyPasteCode);
        setActionFeedback("Nova cobranca PIX gerada com sucesso.");
      } else {
        trackEvent("subscription_pix_regenerate_empty");
        setActionFeedback("Nao foi possivel gerar uma nova cobranca PIX agora.");
      }
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      queryClient.invalidateQueries({ queryKey: ["billing-history"] });
    },
    onError: () => {
      trackEvent("subscription_pix_regenerate_error");
      setActionFeedback("Falha ao gerar nova cobranca PIX.");
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
  const showContractCTA =
    subscription.status === "TRIALING" ||
    subscription.status === "INCOMPLETE" ||
    subscription.status === "PAST_DUE";
  const visiblePixCode =
    pixCodeFromRegenerate ||
    statusQuery.data.pendingPix?.copyPasteCode ||
    statusQuery.data.pendingPix?.qrCode ||
    "";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Assinatura</h1>
        <p className="text-sm text-slate-400">Status atual, renovacao e cancelamento.</p>
      </header>

      {notice ? (
        <Card className="border-amber-400/30 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-100">{notice}</p>
        </Card>
      ) : null}

      {actionFeedback ? (
        <Card className="border-sky-400/30 bg-sky-400/10 p-4">
          <p className="text-sm text-sky-100">{actionFeedback}</p>
        </Card>
      ) : null}

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

        {showContractCTA ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              to="/billing/plans"
              onClick={() => trackEvent("subscription_contract_cta_click", { target: "plans" })}
              className="rounded-xl bg-gold px-4 py-2 text-center text-sm font-semibold text-charcoal"
            >
              Contratar plano e pagar
            </Link>
            <Link
              to="/billing/upgrade"
              onClick={() => trackEvent("subscription_contract_cta_click", { target: "upgrade" })}
              className="rounded-xl border border-white/20 px-4 py-2 text-center text-sm font-semibold text-slate-100"
            >
              Ver opcoes de upgrade
            </Link>
          </div>
        ) : null}
      </Card>

      {visiblePixCode ? (
        <Card title="Cobranca PIX pendente">
          <div className="flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(visiblePixCode)}`}
              alt="QR Code PIX"
              className="h-48 w-48 rounded-lg border border-white/15 bg-white p-2"
            />
          </div>
          <p className="mt-3 break-all rounded-lg border border-white/15 bg-charcoal p-2 text-xs text-slate-200">
            {visiblePixCode}
          </p>
          {statusQuery.data.pendingPix?.createdAt ? (
            <p className="mt-1 text-[11px] text-slate-400">
              Gerada em {new Date(statusQuery.data.pendingPix.createdAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card title="Acoes de assinatura">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => {
              trackEvent("subscription_cancel_click", { immediate: false });
              cancelMutation.mutate(false);
            }}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
            disabled={cancelMutation.isPending}
          >
            Cancelar ao fim do periodo
          </button>
          <button
            onClick={() => {
              trackEvent("subscription_cancel_click", { immediate: true });
              cancelMutation.mutate(true);
            }}
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200"
            disabled={cancelMutation.isPending}
          >
            Cancelar imediatamente
          </button>
        </div>
        {subscription.gateway === "PIX" && showContractCTA ? (
          <button
            onClick={() => {
              trackEvent("subscription_pix_regenerate_click", { plan: subscription.plan.name });
              regeneratePixMutation.mutate(subscription.plan.name as PlanName);
            }}
            className="mt-3 w-full rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold"
            disabled={regeneratePixMutation.isPending}
          >
            {regeneratePixMutation.isPending ? "Gerando..." : "Gerar nova cobranca PIX"}
          </button>
        ) : null}
      </Card>
    </div>
  );
};
