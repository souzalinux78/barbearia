import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuthStore } from "../../store/auth.store";
import {
  createGamificationChallenge,
  getGamificationChallenges,
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

export const ChallengesPerformancePage = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    targetType: "REVENUE" as GoalType,
    targetValue: 10000,
    rewardPoints: 300,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    active: true
  });

  const challengesQuery = useQuery({
    queryKey: ["gamification-challenges-page"],
    queryFn: () => getGamificationChallenges({ activeOnly: false })
  });

  const createMutation = useMutation({
    mutationFn: createGamificationChallenge,
    onSuccess: () => {
      setFeedback("Desafio criado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["gamification-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["gamification-challenges-page"] });
      setForm((current) => ({ ...current, name: "", description: "" }));
    }
  });

  const canCreate = useMemo(
    () => ["OWNER", "UNIT_OWNER", "SUPER_ADMIN"].includes(user?.role ?? ""),
    [user?.role]
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Desafios Mensais</h1>
        <PerformanceNav />
      </header>

      {canCreate ? (
        <Card title="Criar desafio">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome do desafio"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              placeholder="Descricao"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={form.targetType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetType: event.target.value as GoalType }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              >
                {Object.entries(goalTypeLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
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
                placeholder="Meta"
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="number"
                min={1}
                value={form.rewardPoints}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rewardPoints: Number(event.target.value || 0)
                  }))
                }
                placeholder="Pontos recompensa"
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
            </div>
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
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, active: event.target.checked }))
                }
              />
              Ativo
            </label>
            <button
              type="submit"
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Salvando..." : "Criar desafio"}
            </button>
          </form>
        </Card>
      ) : null}

      <Card title="Lista de desafios">
        {challengesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {challengesQuery.data?.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {item.active ? "ATIVO" : "INATIVO"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {goalTypeLabel[item.targetType]}: {item.targetValue} | Recompensa: {item.rewardPoints} pts
                </p>
                <div className="mt-2 h-2 rounded-full bg-charcoal">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-gold to-emerald-400"
                    style={{ width: `${Math.max(4, item.completionRate)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-slate-400">{item.completionRate}% concluido</p>
              </div>
            ))}
            {!challengesQuery.data?.items.length ? (
              <p className="text-xs text-slate-400">Sem desafios cadastrados.</p>
            ) : null}
          </div>
        )}
      </Card>

      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
    </div>
  );
};
