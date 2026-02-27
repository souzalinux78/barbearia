import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getAppointmentsByDay } from "../services/appointments.service";

const statusColor: Record<string, string> = {
  AGENDADO: "text-sky-300",
  CONFIRMADO: "text-emerald-300",
  EM_ATENDIMENTO: "text-amber-300",
  FINALIZADO: "text-green-400",
  CANCELADO: "text-rose-300",
  NO_SHOW: "text-zinc-400"
};

export const AppointmentsPage = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useQuery({
    queryKey: ["appointments-by-day", date],
    queryFn: () => getAppointmentsByDay(date)
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Agendamentos</h1>
          <p className="text-sm text-slate-400">Agenda por dia com status operacional.</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-xl border border-white/10 bg-graphite px-3 py-2 text-sm text-slate-100"
        />
      </header>

      {isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="space-y-3">
          {data?.map((appointment) => (
            <Card key={appointment.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-100">{appointment.client.name}</p>
                  <p className="text-sm text-slate-300">{appointment.service.name}</p>
                  <p className="text-xs text-slate-500">{new Date(appointment.startAt).toLocaleString("pt-BR")}</p>
                </div>
                <span className={`text-xs font-semibold uppercase ${statusColor[appointment.status] ?? "text-slate-300"}`}>
                  {appointment.status.replaceAll("_", " ")}
                </span>
              </div>
            </Card>
          ))}

          {!data?.length ? <Card>Nenhum agendamento para este dia.</Card> : null}
        </div>
      )}
    </div>
  );
};
