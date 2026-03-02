import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { loginRequest } from "../services/auth.service";
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

export const LoginPage = () => {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [formState, setFormState] = useState({
    tenantSlug: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackPageView("login");
  }, []);

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      trackEvent("login_success", {
        tenantSlug: formState.tenantSlug,
        role: data.user.role
      });
      setSession(data);
      navigate("/dashboard", { replace: true });
    },
    onError: () => {
      trackEvent("login_error", {
        tenantSlug: formState.tenantSlug
      });
      setError("Falha no login. Verifique tenant, email e senha.");
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    trackEvent("login_submit", {
      tenantSlug: formState.tenantSlug
    });
    mutation.mutate(formState);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-graphite/90 p-6 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-slate-100">Barbearia Premium</h1>
        <p className="mb-6 text-sm text-slate-400">Acesse seu painel SaaS multi-tenant.</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tenant
            </span>
            <input
              required
              value={formState.tenantSlug}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  tenantSlug: normalizeTenantSlug(event.target.value)
                }))
              }
              placeholder="nome-da-barbearia"
              className="w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none ring-gold/50 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              E-mail
            </span>
            <input
              required
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              placeholder="owner@barbearia.com"
              className="w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none ring-gold/50 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Senha
            </span>
            <input
              required
              type="password"
              value={formState.password}
              onChange={(event) =>
                setFormState((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="********"
              className="w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none ring-gold/50 focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-charcoal transition hover:brightness-95 disabled:opacity-60"
          >
            {mutation.isPending ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-center text-xs text-slate-400">
            Primeira vez?{" "}
            <Link to="/checkout" className="font-semibold text-gold underline">
              Cadastrar barbearia
            </Link>
          </p>
          <p className="text-center text-xs text-slate-400">
            Dono da plataforma?{" "}
            <Link to="/admin/login" className="font-semibold text-sky-300 underline">
              Acesso Master
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};
