import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getGamificationBadges } from "../../services/gamification.service";
import { PerformanceNav } from "./PerformanceNav";

const iconMap: Record<string, string> = {
  target: "MT",
  crown: "UP",
  scissors: "100",
  ticket: "TK",
  trophy: "CH"
};

export const BadgesPerformancePage = () => {
  const badgesQuery = useQuery({
    queryKey: ["gamification-badges-page"],
    queryFn: () => getGamificationBadges()
  });

  if (badgesQuery.isLoading || !badgesQuery.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  const { catalog, earned } = badgesQuery.data;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Badges e Conquistas</h1>
        <PerformanceNav />
      </header>

      <Card title="Catalogo de badges">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((badge) => (
            <div key={badge.id} className="rounded-xl border border-white/10 bg-charcoal/40 p-3">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                {iconMap[badge.icon] ?? "BG"}
              </div>
              <p className="text-sm font-semibold text-slate-100">{badge.name}</p>
              <p className="mt-1 text-xs text-slate-400">{badge.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Conquistas registradas">
        <div className="space-y-2">
          {earned.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs">
              <p className="text-slate-200">
                <span className="font-semibold text-gold">{item.badgeName}</span> - {item.userName}
              </p>
              <span className="text-slate-400">{new Date(item.achievedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
          {!earned.length ? <p className="text-xs text-slate-400">Nenhuma badge conquistada ainda.</p> : null}
        </div>
      </Card>
    </div>
  );
};

