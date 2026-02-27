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

const SwipeCard = ({
  appointment,
  onStatusChange
}: {
  appointment: AppointmentItem;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}) => {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

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
      className={`absolute left-14 right-2 rounded-xl border p-2 shadow-md transition-all duration-200 ${statusStyles[appointment.status]}`}
      style={{
        top: `${(toMinutes(appointment.startTime) - dayStartMin) * pixelsPerMinute}px`,
        minHeight: `${Math.max(
          56,
          (toMinutes(appointment.endTime) - toMinutes(appointment.startTime)) * pixelsPerMinute
        )}px`
      }}
    >
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
      </div>
    </article>
  );
};

export const DailyView = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showNewModal, setShowNewModal] = useState(false);

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
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] })
      ]);
    }
  });

  const hours = useMemo(() => {
    const values: number[] = [];
    for (let hour = 8; hour <= 20; hour += 1) {
      values.push(hour);
    }
    return values;
  }, []);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Agenda diaria</h1>
            <p className="text-sm text-slate-400">
              Swipe: direita confirma, esquerda finaliza, esquerda longa cancela.
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

            {dayQuery.data?.items.map((appointment) => (
              <SwipeCard
                key={appointment.id}
                appointment={appointment}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              />
            ))}
          </div>
        </div>
      )}

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
