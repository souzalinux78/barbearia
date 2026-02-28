import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getGamificationBadges,
  getGamificationChallenges,
  getGamificationProgress,
  getGamificationRanking,
  QuickRange
} from "../../services/gamification.service";
import { PerformanceNav } from "./PerformanceNav";

const quickFilters: Array<{ key: QuickRange; label: string }> = [
  { key: "TODAY", label: "Hoje" },
  { key: "7D", label: "7 dias" },
  { key: "30D", label: "30 dias" },
  { key: "MONTH", label: "Mes" }
];

export const DashboardPerformancePage = () => {
  const [quick, setQuick] = useState<QuickRange>("30D");

  const progressQuery = useQuery({
    queryKey: ["gamification-progress", quick],
    queryFn: () => getGamificationProgress({ quick })
  });
  const rankingQuery = useQuery({
    queryKey: ["gamification-ranking", quick],
    queryFn: () => getGamificationRanking({ quick, limit: 10 })
  });
  const badgesQuery = useQuery({
    queryKey: ["gamification-badges"],
    queryFn: () => getGamificationBadges()
  });
  const challengesQuery = useQuery({
    queryKey: ["gamification-challenges"],
    queryFn: () => getGamificationChallenges({ activeOnly: true })
  });

  const isLoading =
    progressQuery.isLoading ||
    rankingQuery.isLoading ||
    badgesQuery.isLoading ||
    challengesQuery.isLoading;

  const progress = progressQuery.data;
  const ranking = rankingQuery.data;
  const badges = badgesQuery.data;
  const challenges = challengesQuery.data;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Performance e Gamificacao</h1>
          <p className="text-sm text-slate-400">
            Metas dinamicas, pontuacao, leaderboard e desafios mensais.
          </p>
        </div>
        <PerformanceNav />
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((item) => (
            <button
              key={item.key}
              onClick={() => setQuick(item.key)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                quick === item.key ? "bg-gold text-charcoal" : "border border-white/20 text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading || !progress || !ranking || !badges || !challenges ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Progresso medio</p>
              <p className="mt-1 text-2xl font-bold text-sky-300">{progress.summary.averageProgress}%</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Pontuacao total</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{progress.summary.points}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Posicao atual</p>
              <p className="mt-1 text-2xl font-bold text-gold">
                {progress.summary.myPosition ? `#${progress.summary.myPosition}` : "-"}
              </p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate-400">Desafios ativos</p>
              <p className="mt-1 text-2xl font-bold text-violet-300">{challenges.items.length}</p>
            </Card>
          </section>

          <Card title="Metas batidas">
            <p className="text-sm text-slate-300">
              {progress.summary.reachedGoals}/{progress.summary.totalGoals} metas concluidas no periodo.
            </p>
            <div className="mt-2 h-3 rounded-full bg-charcoal">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-gold transition-all duration-700"
                style={{
                  width: `${Math.max(
                    4,
                    progress.summary.totalGoals > 0
                      ? (progress.summary.reachedGoals / progress.summary.totalGoals) * 100
                      : 0
                  )}%`
                }}
              />
            </div>
          </Card>

          <Card title="Top 3 Leaderboard">
            <div className="space-y-2">
              {ranking.unitRanking.slice(0, 3).map((row) => (
                <div
                  key={row.userId}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                    row.position === 1
                      ? "border-gold/50 bg-gold/10"
                      : row.position === 2
                        ? "border-slate-300/40 bg-slate-300/10"
                        : "border-orange-400/40 bg-orange-500/10"
                  }`}
                >
                  <span className="font-semibold text-slate-100">
                    {row.position}. {row.userName}
                  </span>
                  <span className="text-xs text-slate-200">
                    {row.points} pts | R$ {row.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
              {!ranking.unitRanking.length ? (
                <p className="text-xs text-slate-400">Sem dados para ranking no periodo.</p>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Badges conquistadas">
              <p className="mb-2 text-xs text-slate-400">Total: {badges.earned.length}</p>
              <div className="space-y-2">
                {badges.earned.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">{item.badgeName}</span>
                    <span className="text-slate-400">{new Date(item.achievedAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
                {!badges.earned.length ? (
                  <p className="text-xs text-slate-400">Nenhuma badge conquistada ainda.</p>
                ) : null}
              </div>
            </Card>

            <Card title="Desafios em andamento">
              <div className="space-y-3">
                {challenges.items.slice(0, 4).map((item) => (
                  <div key={item.id}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                      <span>{item.name}</span>
                      <span>{item.completionRate}% concluido</span>
                    </div>
                    <div className="h-2 rounded-full bg-charcoal">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                        style={{ width: `${Math.max(4, item.completionRate)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!challenges.items.length ? (
                  <p className="text-xs text-slate-400">Sem desafios ativos.</p>
                ) : null}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

