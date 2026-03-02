import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useParams } from "react-router-dom";
import { Card } from "../../components/ui/card";
import {
  createPublicBookingAppointment,
  getPublicBookingContext,
  getPublicBookingSlots
} from "../../services/public-booking.service";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const getLocalIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = getLocalIsoDate();
const weekdayShortMap: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sab"
};
const weekdayLongMap: Record<number, string> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado"
};

const resolvePublicBookingErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }

    if (status === 403) {
      return "Agendamento temporariamente indisponivel para este estabelecimento.";
    }
    if (status === 404) {
      return "Estabelecimento nao encontrado. Verifique o link informado.";
    }
  }

  return "Nao foi possivel carregar os dados deste estabelecimento.";
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const addUtcDays = (baseIsoDate: string, days: number) => {
  const base = new Date(`${baseIsoDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return toIsoDate(base);
};

const getUtcWeekdayFromIsoDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();

export const PublicBookingPage = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [date, setDate] = useState(today);
  const [selectedSlotStart, setSelectedSlotStart] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CARD">("CARD");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [copyPixFeedback, setCopyPixFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contextErrorMessage, setContextErrorMessage] = useState<string | null>(null);

  const contextQuery = useQuery({
    queryKey: ["public-booking-context", tenantSlug],
    queryFn: () => getPublicBookingContext(String(tenantSlug)),
    enabled: Boolean(tenantSlug),
    retry: false
  });

  useEffect(() => {
    if (!contextQuery.error) {
      return;
    }
    setContextErrorMessage(resolvePublicBookingErrorMessage(contextQuery.error));
  }, [contextQuery.error]);

  useEffect(() => {
    if (!contextQuery.data) {
      return;
    }

    if (!selectedBarberId && contextQuery.data.barbers.length > 0) {
      setSelectedBarberId(contextQuery.data.barbers[0].id);
    }

    if (selectedServiceIds.length === 0 && contextQuery.data.services.length > 0) {
      setSelectedServiceIds([contextQuery.data.services[0].id]);
    }

    setPaymentMethod(contextQuery.data.tenant.paymentSettings?.pixEnabled ? "PIX" : "CARD");
  }, [contextQuery.data, selectedBarberId, selectedServiceIds.length]);

  const slotsQuery = useQuery({
    queryKey: ["public-booking-slots", tenantSlug, date, selectedBarberId, selectedServiceIds.join(",")],
    queryFn: () =>
      getPublicBookingSlots(String(tenantSlug), {
        date,
        barberId: selectedBarberId,
        serviceIds: selectedServiceIds
      }),
    enabled: Boolean(tenantSlug && date && selectedBarberId && selectedServiceIds.length > 0)
  });

  const availableSlots = useMemo(
    () => slotsQuery.data?.slots.filter((slot) => slot.available) ?? [],
    [slotsQuery.data]
  );
  const maxAdvanceDays = contextQuery.data?.tenant.bookingSettings?.maxAdvanceDays ?? 7;
  const maxBookingDate = useMemo(() => addUtcDays(today, maxAdvanceDays), [maxAdvanceDays]);
  const workingDays = contextQuery.data?.tenant.bookingSettings?.workingDays ?? [1, 2, 3, 4, 5, 6];
  const selectableDates = useMemo(() => {
    const normalizedWorkingDays = workingDays.length ? workingDays : [1, 2, 3, 4, 5, 6];
    const values: Array<{ value: string; label: string; weekday: number }> = [];
    let cursor = today;
    while (cursor <= maxBookingDate) {
      const weekday = getUtcWeekdayFromIsoDate(cursor);
      if (normalizedWorkingDays.includes(weekday)) {
        const [year, month, day] = cursor.split("-");
        values.push({
          value: cursor,
          weekday,
          label: `${weekdayLongMap[weekday] ?? "dia"} ${day}/${month}/${year}`
        });
      }
      cursor = addUtcDays(cursor, 1);
    }
    return values;
  }, [workingDays, maxBookingDate]);
  const selectedWeekday = useMemo(
    () => new Date(`${date}T00:00:00.000Z`).getUTCDay(),
    [date]
  );
  const isWorkingDay = workingDays.includes(selectedWeekday);
  const selectedDateBr = useMemo(() => {
    const [year, month, day] = date.split("-");
    if (!year || !month || !day) {
      return date;
    }
    const weekday = weekdayLongMap[selectedWeekday] ?? "";
    return `${weekday} ${day}/${month}/${year}`;
  }, [date, selectedWeekday]);

  useEffect(() => {
    if (!selectableDates.length) {
      return;
    }
    const stillValid = selectableDates.some((item) => item.value === date);
    if (!stillValid) {
      setDate(selectableDates[0].value);
      setSelectedSlotStart("");
    }
  }, [date, selectableDates]);

  useEffect(() => {
    if (!selectedSlotStart) {
      return;
    }

    const exists = availableSlots.some((slot) => slot.startTime === selectedSlotStart);
    if (!exists) {
      setSelectedSlotStart("");
    }
  }, [availableSlots, selectedSlotStart]);

  const selectedServices = useMemo(
    () => contextQuery.data?.services.filter((service) => selectedServiceIds.includes(service.id)) ?? [],
    [contextQuery.data?.services, selectedServiceIds]
  );

  const totalValue = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMin, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      createPublicBookingAppointment(String(tenantSlug), {
        clientName,
        clientPhone,
        clientEmail: clientEmail || undefined,
        paymentMethod,
        barberId: selectedBarberId,
        serviceIds: selectedServiceIds,
        date,
        startTime: selectedSlotStart,
        notes: notes || undefined
      }),
    onError: (mutationError) => {
      if (isAxiosError(mutationError) && typeof mutationError.response?.data?.message === "string") {
        setError(mutationError.response.data.message);
        return;
      }
      setError("Nao foi possivel concluir o agendamento. Verifique os campos e tente novamente.");
    }
  });

  const toggleService = (serviceId: string) => {
    setSelectedSlotStart("");
    setSelectedServiceIds((current) => {
      if (current.includes(serviceId)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((id) => id !== serviceId);
      }
      return [...current, serviceId];
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!contextQuery.data) {
      setError("Nao foi possivel validar os dados do estabelecimento.");
      return;
    }

    if (!selectedSlotStart) {
      setError("Selecione um horario disponivel.");
      return;
    }
    if (paymentMethod === "PIX" && !contextQuery.data.tenant.paymentSettings?.pixEnabled) {
      setError("Este estabelecimento ainda nao configurou recebimento PIX.");
      return;
    }

    createMutation.mutate();
  };

  if (contextQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4">
        <Card className="min-h-40 animate-pulse" />
      </main>
    );
  }

  if (contextQuery.isError || !contextQuery.data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-4">
        <Card className="w-full">
          <h1 className="text-xl font-bold text-slate-100">Agendamento indisponivel</h1>
          <p className="mt-2 text-sm text-slate-300">
            {contextErrorMessage ?? "Nao foi possivel carregar os dados deste estabelecimento."}
          </p>
        </Card>
      </main>
    );
  }

  if (createMutation.isSuccess) {
    const result = createMutation.data;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-4">
        <Card className="w-full">
          <h1 className="text-2xl font-bold text-emerald-200">Agendamento confirmado</h1>
          <p className="mt-2 text-sm text-slate-300">
            {result.client.name}, seu horario na {result.tenant.name} foi registrado.
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Data: <span className="font-semibold text-slate-100">{result.appointment.date}</span> | Horario:{" "}
            <span className="font-semibold text-slate-100">{result.appointment.startTime}</span>
          </p>
          {result.payment?.method === "PIX" ? (
            <div className="mt-4 rounded-xl border border-white/15 bg-charcoal/60 p-3">
              <p className="text-sm font-semibold text-slate-100">Pagamento via PIX</p>
              <p className="mt-1 text-xs text-slate-300">
                Beneficiario: {result.payment.beneficiary} | Valor: {money.format(result.payment.amount)}
              </p>
              <div className="mt-3 flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    result.payment.copyPasteCode ?? ""
                  )}`}
                  alt="QR Code PIX"
                  className="h-44 w-44 rounded-lg border border-white/15 bg-white p-2"
                />
              </div>
              <p className="mt-2 break-all rounded-lg border border-white/15 bg-charcoal p-2 text-xs text-slate-200">
                {result.payment.copyPasteCode ?? "-"}
              </p>
              <button
                type="button"
                onClick={async () => {
                  const pixCode = result.payment?.copyPasteCode;
                  if (!pixCode) {
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(pixCode);
                    setCopyPixFeedback("Codigo PIX copiado.");
                  } catch {
                    setCopyPixFeedback("Nao foi possivel copiar automaticamente.");
                  }
                }}
                className="mt-2 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-charcoal"
              >
                Copiar codigo PIX
              </button>
              {copyPixFeedback ? <p className="mt-2 text-xs text-slate-300">{copyPixFeedback}</p> : null}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/15 bg-charcoal/60 p-3">
              <p className="text-sm font-semibold text-slate-100">Pagamento presencial no local</p>
              <p className="mt-1 text-xs text-slate-300">
                Metodo: cartao. Valor previsto: {money.format(result.payment?.amount ?? 0)}.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                O estabelecimento fara a cobranca no horario do atendimento.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedSlotStart("");
              setNotes("");
              setClientName("");
              setClientPhone("");
              setClientEmail("");
              setCopyPixFeedback("");
              createMutation.reset();
            }}
            className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
          >
            Fazer novo agendamento
          </button>
        </Card>
      </main>
    );
  }

  const noBarbersAvailable = contextQuery.data.barbers.length === 0;
  const noServicesAvailable = contextQuery.data.services.length === 0;
  if (noBarbersAvailable || noServicesAvailable) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-4">
        <Card className="w-full">
          <h1 className="text-xl font-bold text-slate-100">Agenda temporariamente indisponivel</h1>
          <p className="mt-2 text-sm text-slate-300">
            Este estabelecimento ainda nao configurou todos os dados de agendamento.
          </p>
          {noBarbersAvailable ? (
            <p className="mt-1 text-xs text-slate-400">Barbeiros disponiveis: 0</p>
          ) : null}
          {noServicesAvailable ? (
            <p className="mt-1 text-xs text-slate-400">Servicos disponiveis: 0</p>
          ) : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/85 via-graphite/80 to-forest/30 p-5">
        {contextQuery.data.tenant.logoUrl ? (
          <img
            src={contextQuery.data.tenant.logoUrl}
            alt={`Logo ${contextQuery.data.tenant.name}`}
            className="mb-3 h-14 w-14 rounded-xl border border-white/15 object-cover"
          />
        ) : null}
        <h1 className="text-2xl font-bold text-slate-100">Agendar horario</h1>
        <p className="mt-1 text-sm text-slate-300">{contextQuery.data.tenant.name}</p>
        {contextQuery.data.tenant.bookingSettings ? (
          <p className="mt-2 text-xs text-slate-400">
            Atendimento: {contextQuery.data.tenant.bookingSettings.workingDays
              .map((day) => weekdayShortMap[day] ?? String(day))
              .join(", ")}{" "}
            | {contextQuery.data.tenant.bookingSettings.startTime} -{" "}
            {contextQuery.data.tenant.bookingSettings.endTime} | ate{" "}
            {contextQuery.data.tenant.bookingSettings.maxAdvanceDays ?? 7} dias de antecedencia
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-400">Data selecionada: {selectedDateBr}</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card title="1. Escolha os servicos">
          <div className="grid gap-2 sm:grid-cols-2">
            {contextQuery.data.services.map((service) => {
              const selected = selectedServiceIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-gold/70 bg-gold/15"
                      : "border-white/15 bg-charcoal/60 hover:border-white/30"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-100">{service.name}</p>
                  <p className="text-xs text-slate-400">
                    {service.durationMin} min | {money.format(service.price)}
                  </p>
                  {service.description ? (
                    <p className="mt-1 text-xs text-slate-500">{service.description}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="2. Barbeiro e data">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Barbeiro
              <select
                value={selectedBarberId}
                onChange={(event) => {
                  setSelectedSlotStart("");
                  setSelectedBarberId(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              >
                {contextQuery.data.barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs uppercase tracking-wide text-slate-400">
              Data
              <select
                value={date}
                onChange={(event) => {
                  setSelectedSlotStart("");
                  setDate(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              >
                {selectableDates.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <Card title="3. Horarios disponiveis">
          {slotsQuery.isFetching ? <p className="text-sm text-slate-400">Carregando horarios...</p> : null}
          {!slotsQuery.isFetching && availableSlots.length === 0 ? (
            <p className="text-sm text-slate-400">
              {isWorkingDay
                ? "Nenhum horario livre para os filtros selecionados."
                : "A data escolhida esta fora dos dias de atendimento deste estabelecimento."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {availableSlots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => setSelectedSlotStart(slot.startTime)}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                    selectedSlotStart === slot.startTime
                      ? "border-emerald-300 bg-emerald-300/20 text-emerald-100"
                      : "border-white/20 bg-charcoal/60 text-slate-200 hover:border-white/35"
                  }`}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="4. Seus dados">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Nome
              <input
                required
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-xs uppercase tracking-wide text-slate-400">
              Telefone
              <input
                required
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
              E-mail (opcional)
              <input
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
              Observacoes (opcional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 h-20 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>
          </div>
        </Card>

        <Card title="5. Pagamento">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("PIX")}
              disabled={!contextQuery.data.tenant.paymentSettings?.pixEnabled}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                paymentMethod === "PIX"
                  ? "border-gold/70 bg-gold/15 text-slate-100"
                  : "border-white/15 bg-charcoal/60 text-slate-300"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <p className="text-sm font-semibold">PIX</p>
              <p className="text-xs">
                {contextQuery.data.tenant.paymentSettings?.pixEnabled
                  ? "Pague agora e receba QR Code."
                  : "Indisponivel: barbearia sem chave PIX cadastrada."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("CARD")}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                paymentMethod === "CARD"
                  ? "border-gold/70 bg-gold/15 text-slate-100"
                  : "border-white/15 bg-charcoal/60 text-slate-300"
              }`}
            >
              <p className="text-sm font-semibold">Cartao no local</p>
              <p className="text-xs">Pagamento presencial no horario do atendimento.</p>
            </button>
          </div>
        </Card>

        <Card title="Resumo">
          <div className="space-y-1 text-sm text-slate-300">
            <p>
              Servicos:{" "}
              <span className="font-semibold text-slate-100">
                {selectedServices.map((service) => service.name).join(", ") || "Nenhum"}
              </span>
            </p>
            <p>
              Duracao estimada: <span className="font-semibold text-slate-100">{totalDuration} min</span>
            </p>
            <p>
              Valor estimado: <span className="font-semibold text-slate-100">{money.format(totalValue)}</span>
            </p>
            <p>
              Horario selecionado:{" "}
              <span className="font-semibold text-slate-100">{selectedSlotStart || "Nao selecionado"}</span>
            </p>
          </div>
        </Card>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-charcoal transition hover:brightness-95 disabled:opacity-60"
        >
          {createMutation.isPending ? "Confirmando..." : "Confirmar agendamento"}
        </button>
      </form>
    </main>
  );
};
