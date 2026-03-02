import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  AppointmentItem,
  AppointmentStatus,
  getAppointmentsByDay,
  getDayOccupancy,
  updateAppointmentStatusRequest
} from "../../services/appointments.service";
import { createManualPayment } from "../../services/financial.service";
import { useAuthStore } from "../../store/auth.store";
import { NewAppointment } from "./NewAppointment";

const statusStyles: Record<AppointmentStatus, string> = {
  AGENDADO: "border-sky-400/60 bg-sky-500/15 text-sky-100",
  CONFIRMADO: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100",
  EM_ATENDIMENTO: "border-amber-400/60 bg-amber-500/15 text-amber-100",
  FINALIZADO: "border-zinc-300/40 bg-zinc-500/15 text-zinc-100",
  CANCELADO: "border-rose-400/60 bg-rose-500/15 text-rose-100",
  NO_SHOW: "border-orange-400/60 bg-orange-500/15 text-orange-100",
  BLOQUEADO: "border-purple-400/60 bg-purple-500/15 text-purple-100"
};

const pixelsPerMinute = 1.2;
const dayStartMin = 8 * 60;
const dayEndMin = 20 * 60;
const timelineHeight = (dayEndMin - dayStartMin) * pixelsPerMinute;

const toMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const formatHourLabel = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

type PositionedAppointment = {
  appointment: AppointmentItem;
  topPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
  zIndex: number;
};

const computePositionedAppointments = (appointments: AppointmentItem[]): PositionedAppointment[] => {
  const normalized = appointments
    .map((appointment) => {
      const startMin = toMinutes(appointment.startTime);
      const endMin = toMinutes(appointment.endTime);
      return {
        appointment,
        startMin,
        endMin: Math.max(endMin, startMin + 15)
      };
    })
    .sort((left, right) => left.startMin - right.startMin || left.endMin - right.endMin);

  const clusters: typeof normalized[] = [];
  let currentCluster: typeof normalized = [];
  let currentClusterEnd = -1;

  normalized.forEach((item) => {
    if (!currentCluster.length) {
      currentCluster = [item];
      currentClusterEnd = item.endMin;
      return;
    }

    if (item.startMin < currentClusterEnd) {
      currentCluster.push(item);
      currentClusterEnd = Math.max(currentClusterEnd, item.endMin);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [item];
    currentClusterEnd = item.endMin;
  });

  if (currentCluster.length) {
    clusters.push(currentCluster);
  }

  const positioned: PositionedAppointment[] = [];

  clusters.forEach((cluster) => {
    const active: Array<{ endMin: number; column: number }> = [];
    const assignments: Array<{ item: (typeof cluster)[number]; column: number }> = [];
    let maxColumns = 1;

    cluster.forEach((item) => {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (active[index].endMin <= item.startMin) {
          active.splice(index, 1);
        }
      }

      const usedColumns = new Set(active.map((entry) => entry.column));
      let column = 0;
      while (usedColumns.has(column)) {
        column += 1;
      }

      active.push({ endMin: item.endMin, column });
      assignments.push({ item, column });
      maxColumns = Math.max(maxColumns, active.length, column + 1);
    });

    assignments.forEach(({ item, column }) => {
      const durationPx = (item.endMin - item.startMin) * pixelsPerMinute;
      positioned.push({
        appointment: item.appointment,
        topPx: (item.startMin - dayStartMin) * pixelsPerMinute,
        heightPx: Math.max(56, durationPx),
        leftPercent: (column / maxColumns) * 100,
        widthPercent: 100 / maxColumns,
        zIndex: 10 + column
      });
    });
  });

  return positioned.sort((left, right) => left.topPx - right.topPx || left.leftPercent - right.leftPercent);
};

const SwipeCard = ({
  appointment,
  onStatusChange,
  onReceivePayment,
  canManagePayments,
  isProcessing,
  layout
}: {
  appointment: AppointmentItem;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onReceivePayment: (appointment: AppointmentItem, method: "PIX" | "CARTAO_CREDITO") => void;
  canManagePayments: boolean;
  isProcessing: boolean;
  layout: Pick<PositionedAppointment, "topPx" | "heightPx" | "leftPercent" | "widthPercent" | "zIndex">;
}) => {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const canMarkAttendance = ["AGENDADO", "CONFIRMADO", "EM_ATENDIMENTO"].includes(appointment.status);
  const hasPaid = appointment.latestPayment?.status === "PAGO";
  const paymentLabel =
    appointment.latestPayment?.status === "PAGO"
      ? `Pago (${appointment.latestPayment.method})`
      : appointment.latestPayment?.status === "PENDENTE"
        ? `Pendente (${appointment.latestPayment.method})`
        : "Sem pagamento";

  return (
    <article
      onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touchStartX === null) {
          return;
        }
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        if (deltaX > 70) {
          onStatusChange(appointment.id, "CONFIRMADO");
        } else if (deltaX < -140) {
          onStatusChange(appointment.id, "CANCELADO");
        } else if (deltaX < -70) {
          onStatusChange(appointment.id, "FINALIZADO");
        }
        setTouchStartX(null);
      }}
      className={`absolute rounded-xl border p-2 shadow-md transition-all duration-200 ${statusStyles[appointment.status]} overflow-hidden`}
      style={{
        top: `${layout.topPx}px`,
        left: `calc(${layout.leftPercent}% + 3px)`,
        width: `calc(${layout.widthPercent}% - 6px)`,
        height: `${layout.heightPx}px`,
        zIndex: layout.zIndex
      }}
    >
      <div className="h-full overflow-y-auto pr-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              {appointment.client?.name ?? "Bloqueio de horario"}
              {appointment.vipBadge ? (
                <span className="ml-2 rounded-full bg-gold/30 px-2 py-0.5 text-[10px] uppercase">VIP</span>
              ) : null}
            </p>
            <p className="text-xs">
              {appointment.startTime} - {appointment.endTime} | {appointment.barber.name}
            </p>
            <p className="text-[11px] uppercase tracking-wide">{appointment.status.replaceAll("_", " ")}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {appointment.appointmentServices.slice(0, 2).map((item) => (
            <span key={item.service.id} className="rounded-md bg-black/30 px-2 py-0.5 text-[10px]">
              {item.service.name}
            </span>
          ))}
          {appointment.recurringClient ? (
            <span className="rounded-md bg-forest/80 px-2 py-0.5 text-[10px]">Recorrente</span>
          ) : null}
          {appointment.noShowAlert ? (
            <span className="rounded-md bg-orange-700/80 px-2 py-0.5 text-[10px]">Alerta no-show</span>
          ) : null}
          <span className="rounded-md bg-black/30 px-2 py-0.5 text-[10px]">{paymentLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {canMarkAttendance ? (
            <button
              type="button"
              onClick={() => onStatusChange(appointment.id, "CONFIRMADO")}
              disabled={isProcessing}
              className="rounded-md border border-emerald-300/40 px-2 py-1 text-[10px] text-emerald-100 disabled:opacity-60"
            >
              Compareceu
            </button>
          ) : null}
          {["AGENDADO", "CONFIRMADO", "EM_ATENDIMENTO"].includes(appointment.status) ? (
            <button
              type="button"
              onClick={() => onStatusChange(appointment.id, "NO_SHOW")}
              disabled={isProcessing}
              className="rounded-md border border-orange-300/40 px-2 py-1 text-[10px] text-orange-100 disabled:opacity-60"
            >
              No-show
            </button>
          ) : null}
          {canManagePayments && appointment.client?.id && !hasPaid ? (
            <>
              <button
                type="button"
                onClick={() => onReceivePayment(appointment, "PIX")}
                disabled={isProcessing}
                className="rounded-md border border-gold/50 px-2 py-1 text-[10px] text-gold disabled:opacity-60"
              >
                Receber PIX
              </button>
              <button
                type="button"
                onClick={() => onReceivePayment(appointment, "CARTAO_CREDITO")}
                disabled={isProcessing}
                className="rounded-md border border-sky-300/40 px-2 py-1 text-[10px] text-sky-100 disabled:opacity-60"
              >
                Receber cartao
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export const DailyView = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showNewModal, setShowNewModal] = useState(false);
  const [processingAppointmentId, setProcessingAppointmentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManagePayments = ["UNIT_OWNER", "UNIT_ADMIN", "OWNER", "ADMIN", "RECEPTION"].includes(
    user?.role ?? ""
  );

  const dayQuery = useQuery({
    queryKey: ["appointments-day", date],
    queryFn: () => getAppointmentsByDay(date, 1, 50)
  });

  const occupancyQuery = useQuery({
    queryKey: ["day-occupancy", date],
    queryFn: () => getDayOccupancy(date)
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      updateAppointmentStatusRequest(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments-day", date] }),
        queryClient.invalidateQueries({ queryKey: ["appointments-week"] }),
        queryClient.invalidateQueries({ queryKey: ["day-occupancy", date] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-executive"] })
      ]);
    }
  });

  const paymentMutation = useMutation({
    mutationFn: createManualPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["financial-cashflow"] }),
        queryClient.invalidateQueries({ queryKey: ["financial-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-executive"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] })
      ]);
    }
  });

  const refreshAgenda = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appointments-day", date] }),
      queryClient.invalidateQueries({ queryKey: ["appointments-week"] }),
      queryClient.invalidateQueries({ queryKey: ["day-occupancy", date] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-executive"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-cashflow"] })
    ]);
  };

  const handleStatusChange = async (appointmentId: string, status: AppointmentStatus) => {
    setActionError(null);
    setProcessingAppointmentId(appointmentId);
    try {
      await statusMutation.mutateAsync({ id: appointmentId, status });
      await refreshAgenda();
    } catch {
      setActionError("Nao foi possivel atualizar o status do agendamento.");
    } finally {
      setProcessingAppointmentId(null);
    }
  };

  const handleReceivePayment = async (
    appointment: AppointmentItem,
    method: "PIX" | "CARTAO_CREDITO"
  ) => {
    if (!appointment.client?.id) {
      setActionError("Agendamento sem cliente, nao e possivel registrar pagamento.");
      return;
    }

    setActionError(null);
    setProcessingAppointmentId(appointment.id);
    try {
      await paymentMutation.mutateAsync({
        appointmentId: appointment.id,
        clientId: appointment.client.id,
        amount: Number(appointment.price ?? 0),
        method,
        status: "PAGO",
        notes:
          method === "PIX"
            ? "Pagamento PIX recebido na agenda."
            : "Pagamento em cartao recebido na agenda."
      });
      await statusMutation.mutateAsync({ id: appointment.id, status: "FINALIZADO" });
      await refreshAgenda();
    } catch {
      setActionError("Nao foi possivel registrar o pagamento.");
    } finally {
      setProcessingAppointmentId(null);
    }
  };

  const hours = useMemo(() => {
    const values: number[] = [];
    for (let hour = 8; hour <= 20; hour += 1) {
      values.push(hour);
    }
    return values;
  }, []);

  const positionedAppointments = useMemo(
    () => computePositionedAppointments(dayQuery.data?.items ?? []),
    [dayQuery.data?.items]
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Agenda diaria</h1>
            <p className="text-sm text-slate-400">
              Swipe: direita confirma, esquerda finaliza, esquerda longa cancela. Use os botoes para pagamento e no-show.
            </p>
            <Link to="/appointments/week" className="text-xs font-semibold text-gold">
              Ver visao semanal
            </Link>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded-xl bg-gold px-3 py-2 text-xs font-bold uppercase text-charcoal"
          >
            Novo
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-xl border border-white/10 bg-graphite px-3 py-2 text-sm text-slate-100"
          />
          <Card className="flex-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ocupacao do dia</p>
            <p className="text-lg font-bold text-gold">
              {occupancyQuery.data ? `${occupancyQuery.data.occupancyPercent}%` : "..."}
            </p>
          </Card>
        </div>
      </header>

      {dayQuery.isLoading ? (
        <Skeleton className="h-[520px] w-full" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-graphite/70 p-2">
          <div className="relative min-w-[320px]" style={{ height: `${timelineHeight}px` }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-white/10"
                style={{ top: `${(hour * 60 - dayStartMin) * pixelsPerMinute}px` }}
              >
                <span className="absolute -top-2 left-1 text-[10px] font-semibold text-slate-500">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}

            {positionedAppointments.map((item) => (
              <SwipeCard
                key={item.appointment.id}
                appointment={item.appointment}
                onStatusChange={handleStatusChange}
                onReceivePayment={handleReceivePayment}
                canManagePayments={canManagePayments}
                isProcessing={processingAppointmentId === item.appointment.id}
                layout={item}
              />
            ))}
          </div>
        </div>
      )}

      {actionError ? <p className="text-xs text-rose-300">{actionError}</p> : null}

      {showNewModal ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-2 md:items-center md:justify-center">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-charcoal p-3">
            <NewAppointment
              embedded
              defaultDate={date}
              onDone={() => {
                setShowNewModal(false);
                queryClient.invalidateQueries({ queryKey: ["appointments-day", date] });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
