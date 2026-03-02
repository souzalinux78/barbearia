import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getTenantMe, updateTenantSettings } from "../services/tenants.service";
import { useAuthStore } from "../store/auth.store";

export const SettingsPage = () => {
  const user = useAuthStore((state) => state.user);
  const sessionTenant = useAuthStore((state) => state.tenant);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [servicePixKey, setServicePixKey] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [bookingStartTime, setBookingStartTime] = useState("08:00");
  const [bookingEndTime, setBookingEndTime] = useState("20:00");
  const [bookingWorkingDays, setBookingWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const tenantQuery = useQuery({
    queryKey: ["tenant-me"],
    queryFn: getTenantMe
  });

  useEffect(() => {
    if (!tenantQuery.data) {
      return;
    }
    setName(tenantQuery.data.name ?? "");
    setEmail(tenantQuery.data.email ?? "");
    setPhone(tenantQuery.data.phone ?? "");
    setLogoUrl(tenantQuery.data.logoUrl ?? "");
    setServicePixKey(tenantQuery.data.servicePixKey ?? "");
    setBookingEnabled(tenantQuery.data.bookingEnabled);
    setBookingStartTime(tenantQuery.data.bookingStartTime);
    setBookingEndTime(tenantQuery.data.bookingEndTime);
    setBookingWorkingDays(tenantQuery.data.bookingWorkingDays?.length ? tenantQuery.data.bookingWorkingDays : [1, 2, 3, 4, 5, 6]);
  }, [tenantQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      setFormError(null);
      setFormSuccess("Configuracoes salvas com sucesso.");
      tenantQuery.refetch();
    },
    onError: (error) => {
      if (isAxiosError(error) && typeof error.response?.data?.message === "string") {
        setFormError(error.response.data.message);
      } else {
        setFormError("Nao foi possivel salvar as configuracoes.");
      }
      setFormSuccess(null);
    }
  });

  const bookingUrl = useMemo(() => {
    if (!sessionTenant?.slug) {
      return "";
    }
    return `${window.location.origin}/booking/${sessionTenant.slug}`;
  }, [sessionTenant?.slug]);

  const handleCopyBookingUrl = async () => {
    if (!bookingUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  };

  const weekdayOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sab" },
    { value: 0, label: "Dom" }
  ];

  const toggleDay = (day: number) => {
    setBookingWorkingDays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((item) => item !== day);
      }
      return [...current, day].sort((a, b) => a - b);
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    updateMutation.mutate({
      name,
      email,
      phone,
      logoUrl,
      servicePixKey,
      bookingEnabled,
      bookingStartTime,
      bookingEndTime,
      bookingWorkingDays
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Configuracoes</h1>
      </header>

      {tenantQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Card title="Sessao atual">
          <p className="text-sm text-slate-300">Tenant: {tenantQuery.data?.name ?? sessionTenant?.name}</p>
          <p className="text-sm text-slate-300">Slug: {tenantQuery.data?.slug ?? sessionTenant?.slug}</p>
          <p className="text-sm text-slate-300">Usuario: {user?.name}</p>
          <p className="text-sm text-slate-300">Perfil: {user?.role}</p>
        </Card>
      )}

      <Card title="Barbearia e agendamento online">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Nome da barbearia
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              required
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Logo URL
            <input
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Telefone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
            Chave PIX de recebimento (agenda publica)
            <input
              value={servicePixKey}
              onChange={(event) => setServicePixKey(event.target.value)}
              placeholder="CPF, CNPJ, telefone, email ou chave aleatoria"
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-500">
              Esta chave pertence a barbearia e sera usada para gerar o PIX do cliente no agendamento.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={bookingEnabled}
              onChange={(event) => setBookingEnabled(event.target.checked)}
            />
            Agendamento online ativo
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Horario inicial
            <input
              type="time"
              value={bookingStartTime}
              onChange={(event) => setBookingStartTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              required
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Horario final
            <input
              type="time"
              value={bookingEndTime}
              onChange={(event) => setBookingEndTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              required
            />
          </label>

          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Dias de atendimento</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekdayOptions.map((option) => {
                const selected = bookingWorkingDays.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleDay(option.value)}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                      selected
                        ? "border-gold/70 bg-gold/20 text-gold"
                        : "border-white/15 text-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {formError ? <p className="text-xs text-rose-300 sm:col-span-2">{formError}</p> : null}
          {formSuccess ? <p className="text-xs text-emerald-300 sm:col-span-2">{formSuccess}</p> : null}

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-charcoal disabled:opacity-60 sm:col-span-2"
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar configuracoes"}
          </button>
        </form>
      </Card>

      <Card title="Agendar Online">
        <p className="text-sm text-slate-300">
          Compartilhe esse link para o cliente agendar sem login.
        </p>

        <div className="mt-3 rounded-lg border border-white/15 bg-charcoal/70 p-3">
          <p className="break-all text-xs text-slate-200">{bookingUrl || "Tenant sem slug configurado."}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyBookingUrl}
            disabled={!bookingUrl}
            className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-charcoal disabled:opacity-50"
          >
            Copiar link
          </button>

          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200"
            >
              Abrir pagina publica
            </a>
          ) : null}
        </div>

        {copyState === "success" ? (
          <p className="mt-2 text-xs text-emerald-300">Link copiado.</p>
        ) : null}
        {copyState === "error" ? (
          <p className="mt-2 text-xs text-rose-300">Nao foi possivel copiar automaticamente.</p>
        ) : null}
      </Card>
    </div>
  );
};
