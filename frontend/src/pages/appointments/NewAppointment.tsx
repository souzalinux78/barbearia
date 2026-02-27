import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getClients } from "../../services/clients.service";
import { getServices } from "../../services/services.service";
import {
  AppointmentStatus,
  createAppointmentRequest,
  getAppointmentBarbers,
  getAvailableSlots
} from "../../services/appointments.service";
import { useAuthStore } from "../../store/auth.store";

const statusOptions: AppointmentStatus[] = ["AGENDADO", "CONFIRMADO", "BLOQUEADO"];

type NewAppointmentProps = {
  embedded?: boolean;
  defaultDate?: string;
  onDone?: () => void;
};

export const NewAppointment = ({ embedded = false, defaultDate, onDone }: NewAppointmentProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    barberId: "",
    serviceIds: [] as string[],
    date: defaultDate ?? new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "",
    notes: "",
    status: "AGENDADO" as AppointmentStatus
  });

  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const servicesQuery = useQuery({ queryKey: ["services"], queryFn: getServices });
  const barbersQuery = useQuery({
    queryKey: ["barbers"],
    queryFn: getAppointmentBarbers,
    retry: 0
  });

  const barberOptions = useMemo(() => {
    if (barbersQuery.data?.length) {
      return barbersQuery.data;
    }
    if (authUser?.role === "BARBER") {
      return [{ id: authUser.id, name: authUser.name }];
    }
    return [];
  }, [authUser, barbersQuery.data]);

  const availableSlotsQuery = useQuery({
    queryKey: ["available-slots", form.date, form.barberId, form.serviceIds.join(",")],
    queryFn: () => getAvailableSlots(form.date, form.barberId, form.serviceIds),
    enabled: Boolean(form.date && form.barberId && form.serviceIds.length > 0 && form.status !== "BLOQUEADO")
  });

  const createMutation = useMutation({
    mutationFn: createAppointmentRequest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments-day"] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-week"] }),
        queryClient.invalidateQueries({ queryKey: ["day-occupancy"] })
      ]);

      if (embedded && onDone) {
        onDone();
      } else {
        navigate("/appointments");
      }
    },
    onError: () => {
      setError("Nao foi possivel criar o agendamento.");
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    createMutation.mutate({
      clientId: form.status === "BLOQUEADO" ? undefined : form.clientId || undefined,
      barberId: form.barberId,
      serviceIds: form.status === "BLOQUEADO" ? undefined : form.serviceIds,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      notes: form.notes || undefined,
      status: form.status
    });
  };

  return (
    <div className={embedded ? "" : "mx-auto max-w-xl space-y-4"}>
      {!embedded ? (
        <header>
          <h1 className="text-2xl font-bold text-slate-100">Novo Agendamento</h1>
          <p className="text-sm text-slate-400">Crie agendamentos ou bloqueios de horario.</p>
        </header>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-white/10 bg-graphite/90 p-4 shadow-xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
            Data
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as AppointmentStatus }))
              }
              className="w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
          Barbeiro
          <select
            required
            value={form.barberId}
            onChange={(event) => setForm((current) => ({ ...current, barberId: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Selecione</option>
            {barberOptions.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.name}
              </option>
            ))}
          </select>
        </label>

        {form.status !== "BLOQUEADO" ? (
          <>
            <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
              Cliente
              <select
                required
                value={form.clientId}
                onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Selecione</option>
                {clientsQuery.data?.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
              Servicos (multiplos)
              <select
                required
                multiple
                value={form.serviceIds}
                onChange={(event) => {
                  const selected = Array.from(event.target.selectedOptions).map((item) => item.value);
                  setForm((current) => ({ ...current, serviceIds: selected }));
                }}
                className="min-h-28 w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
              >
                {servicesQuery.data?.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
            Inicio
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
            Fim (opcional)
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>

        <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
          Observacoes
          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className="h-20 w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
            placeholder="Preferencias do cliente, observacoes internas..."
          />
        </label>

        {availableSlotsQuery.data?.slots?.length ? (
          <div className="rounded-lg border border-white/10 bg-charcoal/70 p-2">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Sugestao de horarios livres</p>
            <div className="flex flex-wrap gap-2">
              {availableSlotsQuery.data.slots
                .filter((slot) => slot.available)
                .slice(0, 8)
                .map((slot) => (
                  <button
                    key={slot.startTime}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        startTime: slot.startTime,
                        endTime: slot.endTime
                      }))
                    }
                    className="rounded-md border border-gold/40 px-2 py-1 text-xs text-gold"
                  >
                    {slot.startTime}
                  </button>
                ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-charcoal transition hover:brightness-95 disabled:opacity-60"
          >
            {createMutation.isPending ? "Salvando..." : "Salvar agendamento"}
          </button>
          {embedded && onDone ? (
            <button
              type="button"
              onClick={onDone}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-300"
            >
              Fechar
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
};
