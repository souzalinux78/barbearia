import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth.store";
import { getBillingPlans } from "../services/billing.service";
import { trackEvent, trackPageView } from "../utils/analytics";

const features = [
  {
    title: "Agenda Inteligente",
    description: "Controle horarios, evite conflitos e reduza no-show com confirmacao automatica."
  },
  {
    title: "Financeiro Completo",
    description: "Fluxo de caixa, comissoes, DRE e indicadores para acompanhar lucro real."
  },
  {
    title: "CRM e Retencao",
    description: "Fidelidade, cashback, segmentacao de clientes e campanhas de reativacao."
  },
  {
    title: "Gestao de Equipe",
    description: "Cadastre barbeiros, acompanhe performance e metas por profissional."
  }
];

const planSubtitle: Record<string, string> = {
  FREE: "Para comecar",
  PRO: "Crescimento acelerado",
  PREMIUM: "Escala e franquias"
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const LandingPage = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const plansQuery = useQuery({
    queryKey: ["landing-plans"],
    queryFn: getBillingPlans
  });

  useEffect(() => {
    trackPageView("landing");
  }, []);

  const salesNumber =
    (import.meta.env.VITE_SALES_WHATSAPP as string | undefined)?.replace(/\D/g, "") ||
    "5511999999999";
  const whatsAppHref = `https://wa.me/${salesNumber}?text=${encodeURIComponent(
    "Ola! Quero conhecer e assinar o sistema Barbearia Premium SaaS."
  )}`;

  const trackLandingCta = (location: string, action: string, plan?: string) => () => {
    trackEvent("landing_cta_click", {
      location,
      action,
      plan: plan ?? null
    });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-charcoal/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-wide text-gold">BARBEARIA PREMIUM SaaS</p>
            <p className="text-xs text-slate-400">Gestao inteligente para barbearias de alta performance</p>
          </div>

          <div className="flex items-center gap-2">
            {accessToken ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-charcoal"
              >
                Ir para painel
              </Link>
            ) : (
              <>
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={trackLandingCta("header", "whatsapp_sales")}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200"
                >
                  WhatsApp vendas
                </a>
                <Link
                  to="/login"
                  onClick={trackLandingCta("header", "login")}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  Entrar
                </Link>
                <Link
                  to="/checkout?plan=PRO&gateway=PIX"
                  onClick={trackLandingCta("header", "checkout", "PRO")}
                  className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-charcoal"
                >
                  Assinar agora
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:grid-cols-2 md:py-16">
          <div className="space-y-4">
            <p className="inline-flex rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
              SaaS para barbearias
            </p>
            <h1 className="text-3xl font-bold leading-tight text-slate-100 md:text-5xl">
              Aumente lucro e controle sua barbearia em um unico sistema.
            </h1>
            <p className="max-w-xl text-sm text-slate-300 md:text-base">
              Tenha agenda, financeiro, CRM, assinatura recorrente e dashboards executivos para tomar
              decisoes com dados reais.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/checkout?plan=PRO&gateway=PIX"
                onClick={trackLandingCta("hero", "checkout", "PRO")}
                className="rounded-xl bg-gold px-5 py-3 text-sm font-bold text-charcoal"
              >
                Quero assinar
              </Link>
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noreferrer"
                onClick={trackLandingCta("hero", "whatsapp_sales")}
                className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100"
              >
                Falar com vendas
              </a>
              <Link
                to="/login"
                onClick={trackLandingCta("hero", "login")}
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-100"
              >
                Ja sou cliente
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-graphite/80 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold">Resultados esperados</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-charcoal/70 p-4">
                <p className="text-xs text-slate-400">Reducao de no-show</p>
                <p className="text-2xl font-bold text-emerald-300">-35%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-charcoal/70 p-4">
                <p className="text-xs text-slate-400">Aumento de ticket medio</p>
                <p className="text-2xl font-bold text-sky-300">+22%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-charcoal/70 p-4">
                <p className="text-xs text-slate-400">Retencao de clientes</p>
                <p className="text-2xl font-bold text-gold">+28%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-charcoal/70 p-4">
                <p className="text-xs text-slate-400">Tempo operacional</p>
                <p className="text-2xl font-bold text-sky-200">-40%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
          <h2 className="text-2xl font-bold text-slate-100">Tudo que sua operacao precisa</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-white/10 bg-graphite/70 p-5">
                <h3 className="text-lg font-semibold text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
          <h2 className="text-2xl font-bold text-slate-100">Planos para cada fase</h2>
          {plansQuery.isLoading ? (
            <p className="mt-4 text-sm text-slate-400">Carregando planos...</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(plansQuery.data ?? []).map((plan) => {
                const highlight = plan.name === "PRO";
                const signupLink =
                  plan.name === "FREE"
                    ? `/checkout?plan=${plan.name}`
                    : `/checkout?plan=${plan.name}&gateway=PIX`;
                return (
                  <article
                    key={plan.id}
                    className={`rounded-2xl border p-5 ${
                      highlight ? "border-gold/60 bg-gold/10" : "border-white/10 bg-graphite/70"
                    }`}
                  >
                    {highlight ? (
                      <p className="inline-flex rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-charcoal">
                        Mais Popular
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-300">{plan.name}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-100">{money.format(Number(plan.price))}</p>
                    <p className="mt-1 text-xs text-slate-400">/mes</p>
                    <p className="mt-2 text-sm text-slate-300">{planSubtitle[plan.name] ?? "Plano"}</p>
                    <div className="mt-3 space-y-1 text-xs text-slate-300">
                      <p>Usuarios: {plan.maxUsers}</p>
                      <p>Barbeiros: {plan.maxBarbers}</p>
                      <p>Agendamentos/mes: {plan.maxAppointmentsMonth}</p>
                    </div>
                    <Link
                      to={signupLink}
                      onClick={trackLandingCta("plans", "checkout", plan.name)}
                      className="mt-4 inline-flex rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-gold/50"
                    >
                      Escolher {plan.name}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/20 via-graphite/80 to-forest/20 p-6 text-center">
            <h2 className="text-2xl font-bold text-slate-100">Pronto para profissionalizar sua barbearia?</h2>
            <p className="mt-2 text-sm text-slate-300">
              Crie sua conta e comece agora com onboarding rapido.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                to="/checkout?plan=PRO&gateway=PIX"
                onClick={trackLandingCta("final_cta", "checkout", "PRO")}
                className="rounded-xl bg-gold px-5 py-3 text-sm font-bold text-charcoal"
              >
                Cadastrar barbearia
              </Link>
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noreferrer"
                onClick={trackLandingCta("final_cta", "whatsapp_sales")}
                className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100"
              >
                WhatsApp comercial
              </a>
              <Link
                to="/login"
                onClick={trackLandingCta("final_cta", "login")}
                className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-slate-100"
              >
                Entrar no sistema
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
