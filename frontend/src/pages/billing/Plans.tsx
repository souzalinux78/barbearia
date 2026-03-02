import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  BillingGateway,
  getBillingPlans,
  PlanName,
  subscribePlan,
  upsertBillingGatewayConfig
} from "../../services/billing.service";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const planLabel: Record<PlanName, string> = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium"
};

const normalizePixKey = (value: string) => {
  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return `+55${digitsOnly}`;
  }
  if ((digitsOnly.length === 12 || digitsOnly.length === 13) && digitsOnly.startsWith("55")) {
    return `+${digitsOnly}`;
  }
  return trimmed;
};

export const Plans = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [selectedGateway, setSelectedGateway] = useState<BillingGateway>("PIX");
  const [pixKey, setPixKey] = useState("");
  const [pixCode, setPixCode] = useState("");
  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: getBillingPlans
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planName: PlanName) => {
      if (planName !== "FREE") {
        await upsertBillingGatewayConfig({
          target: "TENANT",
          stripeActive: selectedGateway === "STRIPE",
          pixActive: selectedGateway === "PIX",
          pixApiKey: selectedGateway === "PIX" ? normalizePixKey(pixKey) : undefined
        });
      }
      return subscribePlan(planName);
    },
    onSuccess: (result) => {
      setPixCode("");
      const maybePix = (result as { gateway?: BillingGateway; pix?: { copyPasteCode?: string } })?.pix;
      if ((result as { gateway?: BillingGateway })?.gateway === "PIX" && maybePix?.copyPasteCode) {
        setPixCode(maybePix.copyPasteCode);
        setFeedback("Plano atualizado. Copie o codigo PIX para concluir o pagamento.");
      } else {
        setFeedback("Plano atualizado com sucesso.");
      }
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      queryClient.invalidateQueries({ queryKey: ["billing-history"] });
    },
    onError: () => setFeedback("Falha ao atualizar plano.")
  });

  const handleChoosePlan = (planName: PlanName) => {
    if (planName !== "FREE" && selectedGateway === "PIX" && normalizePixKey(pixKey).length < 8) {
      setFeedback("Informe sua chave PIX (ex.: +5511974605594) para gerar cobranca.");
      return;
    }
    setFeedback("");
    subscribeMutation.mutate(planName);
  };

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

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Forma de pagamento</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelectedGateway("PIX")}
            className={`rounded-xl border px-4 py-2 text-sm ${
              selectedGateway === "PIX"
                ? "border-gold/70 bg-gold/10 text-slate-100"
                : "border-white/20 text-slate-300"
            }`}
          >
            PIX recorrente
          </button>
          <button
            type="button"
            onClick={() => setSelectedGateway("STRIPE")}
            className={`rounded-xl border px-4 py-2 text-sm ${
              selectedGateway === "STRIPE"
                ? "border-gold/70 bg-gold/10 text-slate-100"
                : "border-white/20 text-slate-300"
            }`}
          >
            Cartao (Stripe)
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          O gateway selecionado sera usado no momento da contratacao.
        </p>
        {selectedGateway === "PIX" ? (
          <label className="mt-3 block text-xs text-slate-400">
            Chave PIX (telefone/email/cpf/cnpj/aleatoria)
            <input
              value={pixKey}
              onChange={(event) => setPixKey(event.target.value)}
              onBlur={(event) => setPixKey(normalizePixKey(event.target.value))}
              placeholder="+5511974605594"
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>
        ) : null}
      </Card>

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
                onClick={() => handleChoosePlan(plan.name)}
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
      {pixCode ? (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">PIX copia e cola</p>
          <div className="mt-3 flex justify-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixCode)}`}
              alt="QR Code PIX"
              className="h-48 w-48 rounded-lg border border-white/15 bg-white p-2"
            />
          </div>
          <p className="mt-2 break-all rounded-lg border border-white/15 bg-charcoal p-2 text-xs text-slate-200">
            {pixCode}
          </p>
        </Card>
      ) : null}
    </div>
  );
};
