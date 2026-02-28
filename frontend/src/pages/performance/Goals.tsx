import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuthStore } from "../../store/auth.store";
import {
  createGamificationGoal,
  getGamificationGoals,
  GoalPeriod,
  GoalType
} from "../../services/gamification.service";
import { PerformanceNav } from "./PerformanceNav";

const goalTypeLabel: Record<GoalType, string> = {
  REVENUE: "Receita",
  APPOINTMENTS: "Atendimentos",
  SERVICES: "Servicos",
  TICKET_AVG: "Ticket medio",
  UPSELL: "Upsell"
};

const periodLabel: Record<GoalPeriod, string> = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal"
};

export const GoalsPerformancePage = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({
    type: "REVENUE" as GoalType,
    period: "MONTHLY" as GoalPeriod,
    targetValue: 10000,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    unitId: "",
    userId: ""
  });

  const goalsQuery = useQuery({
    queryKey: ["gamification-goals", onlyOpen],
    queryFn: () => getGamificationGoals({ pageSize: 100, onlyOpen })
  });

  const createMutation = useMutation({
    mutationFn: createGamificationGoal,
    onSuccess: () => {
      setFeedback("Meta criada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["gamification-goals"] });
      queryClient.invalidateQueries({ queryKey: ["gamification-progress"] });
    }
  });

  const canCreate = useMemo(
    () => ["OWNER", "UNIT_OWNER", "SUPER_ADMIN"].includes(user?.role ?? ""),
    [user?.role]
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Metas</h1>
        <PerformanceNav />
      </header>

      {canCreate ? (
        <Card title="Criar meta">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate({
                ...form,
                unitId: form.unitId || undefined,
                userId: form.userId || undefined
              });
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as GoalType }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              >
                {Object.entries(goalTypeLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={form.period}
                onChange={(event) =>
                  setForm((current) => ({ ...current, period: event.target.value as GoalPeriod }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              >
                {Object.entries(periodLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="number"
              min={1}
              value={form.targetValue}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetValue: Number(event.target.value || 0)
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              placeholder="Valor alvo"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startDate: event.target.value }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endDate: event.target.value }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <input
              type="text"
              value={form.unitId}
              onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}
              placeholder="Unit ID (opcional para meta da unidade)"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />

            <input
              type="text"
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
              placeholder="User ID (opcional para meta individual)"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
            >
              {createMutation.isPending ? "Salvando..." : "Criar meta"}
            </button>
          </form>
        </Card>
      ) : null}

      <Card title="Metas registradas">
        <div className="mb-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} />
            Mostrar apenas metas abertas
          </label>
        </div>

        {goalsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {goalsQuery.data?.items.map((goal) => (
              <div key={goal.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">
                    {goalTypeLabel[goal.type]} | {periodLabel[goal.period]}
                  </p>
                  <p className="text-xs text-slate-400">
                    {goal.startDate} ate {goal.endDate}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {goal.progress.currentValue.toFixed(2)} / {goal.targetValue.toFixed(2)}
                </p>
                <div className="mt-2 h-2 rounded-full bg-charcoal">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-gold transition-all duration-500"
                    style={{ width: `${Math.max(4, Math.min(100, goal.progress.percentage))}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs font-semibold text-emerald-300">
                  {goal.progress.percentage}%
                </p>
              </div>
            ))}
            {!goalsQuery.data?.items.length ? (
              <p className="text-xs text-slate-400">Nenhuma meta encontrada.</p>
            ) : null}
          </div>
        )}
      </Card>

      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
    </div>
  );
};
