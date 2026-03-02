import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { registerRequest } from "../services/auth.service";
import {
  BillingGateway,
  getBillingPlans,
  PlanName
} from "../services/billing.service";
import { useAuthStore } from "../store/auth.store";
import { trackEvent, trackPageView } from "../utils/analytics";

const normalizeTenantSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const planLabel: Record<PlanName, string> = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium"
};

const featureLabels: Record<string, string> = {
  dashboard_basic: "Dashboard",
  financial_basic: "Financeiro",
  premium_analytics: "Analytics premium",
  inventory: "Estoque",
  api_access: "API"
};

const resolveRegisterErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    const rawMessage = error.response?.data?.message;
    if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
      if (rawMessage.startsWith("[") && rawMessage.endsWith("]")) {
        try {
          const parsed = JSON.parse(rawMessage) as Array<{ path?: string; message?: string }>;
          const first = parsed.find((item) => item?.message);
          if (first?.path === "tenantSlug") {
            return "Slug invalido. Use apenas letras minusculas, numeros e hifen (-).";
          }
          if (first?.message) {
            return first.message;
          }
        } catch {
          return rawMessage;
        }
      }
      return rawMessage;
    }
  }

  return "Nao foi possivel criar a barbearia. Verifique os dados e tente novamente.";
};

export const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanName>("PRO");
  const [selectedGateway, setSelectedGateway] = useState<BillingGateway>("PIX");
  const [formState, setFormState] = useState({
    tenantName: "",
    tenantSlug: "",
    tenantEmail: "",
    tenantPhone: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: ""
  });

  const plansQuery = useQuery({
    queryKey: ["public-billing-plans"],
    queryFn: getBillingPlans
  });

  useEffect(() => {
    const requestedPlan = searchParams.get("plan");
    if (requestedPlan === "FREE" || requestedPlan === "PRO" || requestedPlan === "PREMIUM") {
      setSelectedPlan(requestedPlan);
    }

    const requestedGateway = searchParams.get("gateway");
    if (requestedGateway === "PIX" || requestedGateway === "STRIPE") {
      setSelectedGateway(requestedGateway);
    }
  }, [searchParams]);

  useEffect(() => {
    const requestedPlan = searchParams.get("plan");
    const requestedGateway = searchParams.get("gateway");
    trackPageView("register", {
      preselectPlan:
        requestedPlan === "FREE" || requestedPlan === "PRO" || requestedPlan === "PREMIUM"
          ? requestedPlan
          : "PRO",
      preselectGateway: requestedGateway === "PIX" || requestedGateway === "STRIPE" ? requestedGateway : "PIX"
    });
  }, [searchParams]);

  const selectedPlanData = useMemo(
    () => plansQuery.data?.find((plan) => plan.name === selectedPlan) ?? null,
    [plansQuery.data, selectedPlan]
  );

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: async (data) => {
      trackEvent("register_success", {
        plan: selectedPlan,
        gateway: selectedPlan === "FREE" ? "NONE" : selectedGateway,
        hasCheckout: Boolean(data.checkout)
      });
      setSession(data);

      if (selectedPlan === "FREE") {
        navigate("/dashboard", { replace: true });
        return;
      }

      const notice = data.checkoutWarning
        ? `Barbearia criada. Nao foi possivel concluir a assinatura automaticamente: ${data.checkoutWarning}`
        : "Barbearia criada e assinatura inicial configurada com sucesso.";
      navigate(`/billing/subscription?notice=${encodeURIComponent(notice)}`, {
        replace: true
      });
    },
    onError: (requestError) => {
      const message = resolveRegisterErrorMessage(requestError);
      trackEvent("register_error", {
        plan: selectedPlan,
        gateway: selectedPlan === "FREE" ? "NONE" : selectedGateway,
        message
      });
      setError(message);
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    trackEvent("register_submit", {
      plan: selectedPlan,
      gateway: selectedPlan === "FREE" ? "NONE" : selectedGateway
    });

    mutation.mutate({
      tenantName: formState.tenantName,
      tenantSlug: normalizeTenantSlug(formState.tenantSlug),
      tenantEmail: formState.tenantEmail || undefined,
      tenantPhone: formState.tenantPhone || undefined,
      ownerName: formState.ownerName,
      ownerEmail: formState.ownerEmail,
      ownerPassword: formState.ownerPassword,
      ownerPhone: formState.ownerPhone || undefined,
      billing: {
        planName: selectedPlan,
        gateway: selectedPlan === "FREE" ? undefined : selectedGateway
      }
    });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-start justify-center px-4 py-6">
      <div className="w-full rounded-2xl border border-white/10 bg-graphite/90 p-6 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-slate-100">Cadastrar Barbearia</h1>
        <p className="mb-6 text-sm text-slate-400">
          Crie sua conta, escolha o plano e defina o pagamento para iniciar operacao.
        </p>

        <section className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">Escolha seu plano</h2>
            <Link to="/" className="text-xs font-semibold text-slate-300 underline">
              Ver planos na landing
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(plansQuery.data ?? []).map((plan) => {
              const active = selectedPlan === plan.name;
              const isPopular = plan.name === "PRO";
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.name)}
                  className={`relative rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-gold/70 bg-gold/10"
                      : "border-white/10 bg-charcoal/60 hover:border-white/30"
                  }`}
                >
                  {isPopular ? (
                    <span className="absolute right-3 top-3 rounded-full bg-gold px-2 py-1 text-[10px] font-bold text-charcoal">
                      Mais Popular
                    </span>
                  ) : null}
                  <p className="text-xs uppercase tracking-wide text-slate-400">{planLabel[plan.name]}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-100">{money.format(Number(plan.price))}</p>
                  <p className="text-[11px] text-slate-400">/mes</p>
                  <div className="mt-3 space-y-1 text-xs text-slate-300">
                    <p>Usuarios: {plan.maxUsers}</p>
                    <p>Barbeiros: {plan.maxBarbers}</p>
                    <p>Agendamentos/mes: {plan.maxAppointmentsMonth}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {Object.entries(plan.features)
                      .filter(([, enabled]) => Boolean(enabled))
                      .slice(0, 4)
                      .map(([key]) => (
                        <span key={key} className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-slate-300">
                          {featureLabels[key] ?? key}
                        </span>
                      ))}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPlanData?.name !== "FREE" ? (
            <div className="rounded-xl border border-white/10 bg-charcoal/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">Modo de pagamento</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedGateway("PIX")}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    selectedGateway === "PIX"
                      ? "border-gold/70 bg-gold/10 text-slate-100"
                      : "border-white/15 bg-charcoal text-slate-300"
                  }`}
                >
                  PIX recorrente
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGateway("STRIPE")}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    selectedGateway === "STRIPE"
                      ? "border-gold/70 bg-gold/10 text-slate-100"
                      : "border-white/15 bg-charcoal text-slate-300"
                  }`}
                >
                  Cartao (Stripe)
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                O gateway selecionado sera aplicado automaticamente na assinatura inicial (gateway global do SaaS).
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              Plano Free selecionado: sem cobranca inicial.
            </div>
          )}
        </section>

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
            Nome da barbearia
            <input
              required
              value={formState.tenantName}
              onChange={(event) =>
                setFormState((current) => ({ ...current, tenantName: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Slug (tenant)
            <input
              required
              value={formState.tenantSlug}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  tenantSlug: normalizeTenantSlug(event.target.value)
                }))
              }
              onBlur={(event) =>
                setFormState((current) => ({
                  ...current,
                  tenantSlug: normalizeTenantSlug(event.target.value)
                }))
              }
              placeholder="minha-barbearia"
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-500">
              Use apenas letras minusculas, numeros e hifen.
            </span>
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            E-mail da barbearia (opcional)
            <input
              type="email"
              value={formState.tenantEmail}
              onChange={(event) =>
                setFormState((current) => ({ ...current, tenantEmail: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
            Telefone da barbearia (opcional)
            <input
              value={formState.tenantPhone}
              onChange={(event) =>
                setFormState((current) => ({ ...current, tenantPhone: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Nome do responsavel
            <input
              required
              value={formState.ownerName}
              onChange={(event) =>
                setFormState((current) => ({ ...current, ownerName: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            E-mail do responsavel
            <input
              required
              type="email"
              value={formState.ownerEmail}
              onChange={(event) =>
                setFormState((current) => ({ ...current, ownerEmail: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Telefone do responsavel (opcional)
            <input
              value={formState.ownerPhone}
              onChange={(event) =>
                setFormState((current) => ({ ...current, ownerPhone: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Senha inicial
            <input
              required
              minLength={8}
              type="password"
              value={formState.ownerPassword}
              onChange={(event) =>
                setFormState((current) => ({ ...current, ownerPassword: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>

          {plansQuery.isLoading ? (
            <p className="text-xs text-slate-400 sm:col-span-2">Carregando planos...</p>
          ) : null}

          {error ? <p className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}

          <button
            type="submit"
            disabled={mutation.isPending || plansQuery.isLoading}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-charcoal transition hover:brightness-95 disabled:opacity-60 sm:col-span-2"
          >
            {mutation.isPending ? "Criando e configurando assinatura..." : "Criar barbearia"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Ja tem conta?{" "}
          <Link to="/login" className="font-semibold text-gold underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};
