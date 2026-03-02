import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { masterLoginRequest } from "../../services/master-auth.service";
import { useMasterAuthStore } from "../../store/master-auth.store";

export const LoginMasterPage = () => {
  const navigate = useNavigate();
  const setSession = useMasterAuthStore((state) => state.setSession);
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: masterLoginRequest,
    onSuccess: (data) => {
      setSession(data);
      navigate("/master", { replace: true });
    },
    onError: () => {
      setError("Falha no login master. Verifique email e senha.");
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    mutation.mutate(form);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4">
      <div className="w-full max-w-md rounded-2xl border border-sky-500/25 bg-[#0b1a2e]/90 p-6 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold text-sky-100">SaaS Master Admin</h1>
        <p className="mb-6 text-sm text-slate-400">Acesso global da plataforma.</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              E-mail
            </span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none ring-sky-400/50 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Senha
            </span>
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none ring-sky-400/50 focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {mutation.isPending ? "Entrando..." : "Entrar no Master"}
          </button>
        </form>
      </div>
    </div>
  );
};

