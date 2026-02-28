import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getGamificationRanking, QuickRange } from "../../services/gamification.service";
import { PerformanceNav } from "./PerformanceNav";

const quickFilters: Array<{ key: QuickRange; label: string }> = [
  { key: "TODAY", label: "Hoje" },
  { key: "7D", label: "7 dias" },
  { key: "30D", label: "30 dias" },
  { key: "MONTH", label: "Mes" }
];

export const RankingPerformancePage = () => {
  const [quick, setQuick] = useState<QuickRange>("30D");
  const rankingQuery = useQuery({
    queryKey: ["gamification-ranking-page", quick],
    queryFn: () => getGamificationRanking({ quick, limit: 30 })
  });

  if (rankingQuery.isLoading || !rankingQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  const renderRows = (rows: typeof rankingQuery.data.unitRanking) => (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.userId}
          className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm"
        >
          <span
            className={`text-center font-bold ${
              row.medal === "GOLD"
                ? "text-gold"
                : row.medal === "SILVER"
                  ? "text-slate-200"
                  : row.medal === "BRONZE"
                    ? "text-orange-300"
                    : "text-slate-400"
            }`}
          >
            {row.position}
          </span>
          <div>
            <p className="font-semibold text-slate-100">{row.userName}</p>
            <p className="text-xs text-slate-400">
              Receita R$ {row.revenue.toFixed(2)} | Metas {row.goalsHit}
            </p>
          </div>
          <p className="text-right text-xs font-semibold text-emerald-300">{row.points} pts</p>
        </div>
      ))}
      {!rows.length ? <p className="text-xs text-slate-400">Sem participantes no periodo.</p> : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Leaderboard</h1>
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

      <Card title="Ranking da Unidade">{renderRows(rankingQuery.data.unitRanking)}</Card>

      <Card title="Ranking da Franquia">
        {rankingQuery.data.franchiseRanking.length ? (
          renderRows(rankingQuery.data.franchiseRanking)
        ) : (
          <p className="text-xs text-slate-400">Conta sem escopo de franquia para comparativo.</p>
        )}
      </Card>
    </div>
  );
};

