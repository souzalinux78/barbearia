import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getAppointmentsByWeek, getDayOccupancy } from "../../services/appointments.service";

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const addDays = (date: string, offset: number): string => {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

export const WeeklyView = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const weekQuery = useQuery({
    queryKey: ["appointments-week", startDate],
    queryFn: () => getAppointmentsByWeek(startDate, 1, 200)
  });

  const occupancyQueries = useQuery({
    queryKey: ["appointments-week-occupancy", weekQuery.data?.startDate],
    queryFn: async () => {
      const base = weekQuery.data?.startDate ?? startDate;
      const days = Array.from({ length: 7 }).map((_, index) => addDays(base, index));
      const results = await Promise.all(days.map((day) => getDayOccupancy(day)));
      return results;
    },
    enabled: Boolean(weekQuery.data?.startDate || startDate)
  });

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    weekQuery.data?.items.forEach((item) => {
      map.set(item.date, (map.get(item.date) ?? 0) + 1);
    });
    return map;
  }, [weekQuery.data?.items]);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Agenda semanal</h1>
          <p className="text-sm text-slate-400">Visao em 7 dias com indicador de ocupacao.</p>
          <Link to="/appointments" className="text-xs font-semibold text-gold">
            Voltar para visao diaria
          </Link>
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-xl border border-white/10 bg-graphite px-3 py-2 text-sm text-slate-100"
        />
      </header>

      {weekQuery.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index) => {
              const dateValue = addDays(weekQuery.data?.startDate ?? startDate, index);
              const occupancy = occupancyQueries.data?.find((item) => item.date === dateValue);
              const totalAppointments = byDate.get(dateValue) ?? 0;

              return (
                <Card key={dateValue} className="min-h-44">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{dayLabels[index]}</p>
                  <p className="text-sm font-semibold text-slate-200">{dateValue.slice(5)}</p>

                  <p className="mt-3 text-2xl font-bold text-gold">{totalAppointments}</p>
                  <p className="text-xs text-slate-400">agendamentos</p>

                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Ocupacao</span>
                      <span>{occupancy?.occupancyPercent ?? 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-charcoal">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-forest to-gold"
                        style={{ width: `${Math.min(100, occupancy?.occupancyPercent ?? 0)}%` }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
