import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getMasterBillingConfig, updateMasterBillingConfig } from "../../services/master.service";

type BillingDraft = {
  stripeActive: boolean;
  pixActive: boolean;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  pixApiKey: string;
  pixWebhookSecret: string;
};

export const MasterBillingConfigPage = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const configQuery = useQuery({
    queryKey: ["master-billing-config"],
    queryFn: getMasterBillingConfig
  });
  const [draft, setDraft] = useState<BillingDraft>({
    stripeActive: false,
    pixActive: false,
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    pixApiKey: "",
    pixWebhookSecret: ""
  });

  useEffect(() => {
    if (!configQuery.data) {
      return;
    }
    setDraft({
      stripeActive: configQuery.data.stripeActive,
      pixActive: configQuery.data.pixActive,
      stripeSecretKey: configQuery.data.stripeSecretKey,
      stripeWebhookSecret: configQuery.data.stripeWebhookSecret,
      pixApiKey: configQuery.data.pixApiKey,
      pixWebhookSecret: configQuery.data.pixWebhookSecret
    });
  }, [configQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateMasterBillingConfig({
        stripeActive: draft.stripeActive,
        pixActive: draft.pixActive,
        stripeSecretKey: draft.stripeSecretKey || undefined,
        stripeWebhookSecret: draft.stripeWebhookSecret || undefined,
        pixApiKey: draft.pixApiKey || undefined,
        pixWebhookSecret: draft.pixWebhookSecret || undefined
      }),
    onSuccess: () => {
      setFeedback("Configuracao global de cobranca atualizada.");
      queryClient.invalidateQueries({ queryKey: ["master-billing-config"] });
    },
    onError: () => {
      setFeedback("Falha ao salvar configuracao global.");
    }
  });

  if (configQuery.isLoading || !configQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-sky-100">Cobranca Global</h1>
        <p className="text-sm text-slate-400">Define o gateway padrao da plataforma (fallback para novos tenants).</p>
      </header>

      <Card title="Gateway ativo">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => setDraft((current) => ({ ...current, stripeActive: true, pixActive: false }))}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              draft.stripeActive
                ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                : "border-white/15 text-slate-300"
            }`}
          >
            Stripe ativo
          </button>
          <button
            onClick={() => setDraft((current) => ({ ...current, stripeActive: false, pixActive: true }))}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              draft.pixActive
                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                : "border-white/15 text-slate-300"
            }`}
          >
            PIX ativo
          </button>
        </div>
      </Card>

      <Card title="Credenciais Stripe">
        <div className="grid gap-2">
          <input
            value={draft.stripeSecretKey}
            onChange={(event) =>
              setDraft((current) => ({ ...current, stripeSecretKey: event.target.value }))
            }
            placeholder="sk_live_..."
            className="rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={draft.stripeWebhookSecret}
            onChange={(event) =>
              setDraft((current) => ({ ...current, stripeWebhookSecret: event.target.value }))
            }
            placeholder="whsec_..."
            className="rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </Card>

      <Card title="Credenciais PIX">
        <div className="grid gap-2">
          <input
            value={draft.pixApiKey}
            onChange={(event) => setDraft((current) => ({ ...current, pixApiKey: event.target.value }))}
            placeholder="api-key-pix"
            className="rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={draft.pixWebhookSecret}
            onChange={(event) =>
              setDraft((current) => ({ ...current, pixWebhookSecret: event.target.value }))
            }
            placeholder="segredo-webhook-pix"
            className="rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
        </div>
      </Card>

      <Card>
        <button
          onClick={() => mutation.mutate()}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Salvando..." : "Salvar configuracao global"}
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Ultima atualizacao:{" "}
          {configQuery.data.updatedAt
            ? new Date(configQuery.data.updatedAt).toLocaleString("pt-BR")
            : "nunca"}
        </p>
        {feedback ? <p className="mt-2 text-sm text-emerald-300">{feedback}</p> : null}
      </Card>
    </div>
  );
};

