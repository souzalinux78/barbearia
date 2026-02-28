import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getFranchiseUnits } from "../../services/franchise.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const performanceClass = (performance: "GREEN" | "YELLOW" | "RED") => {
  if (performance === "GREEN") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  }
  if (performance === "YELLOW") {
    return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  }
  return "bg-rose-500/15 text-rose-200 border-rose-400/30";
};

export const FranchiseUnitsPage = () => {
  const query = useQuery({
    queryKey: ["franchise-units"],
    queryFn: () => getFranchiseUnits({ quick: "30D" })
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Unidades</h1>
        <p className="text-sm text-slate-400">Comparativo de performance entre unidades.</p>
      </header>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {query.data?.items.map((unit) => (
            <Card key={unit.unitId} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">{unit.name}</p>
                  <p className="text-xs text-slate-400">
                    {unit.city ?? "Cidade"} - {unit.state ?? "UF"}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${performanceClass(unit.performance)}`}>
                  {unit.performance === "GREEN"
                    ? "Acima da media"
                    : unit.performance === "YELLOW"
                      ? "Na media"
                      : "Abaixo da media"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
                <p>Receita: {formatCurrency(unit.revenue)}</p>
                <p>Crescimento: {unit.growthPercent}%</p>
                <p>Retencao: {unit.retentionRate}%</p>
                <p>Churn: {unit.churnRate}%</p>
                <p>No-show: {unit.noShowRate}%</p>
                <p>Ocupacao: {unit.occupancyRate}%</p>
                <p>Ticket: {formatCurrency(unit.averageTicket)}</p>
                <p>Franquia: {unit.franchiseName ?? "Independente"}</p>
              </div>

              <Link
                to={`/franchise/units/${unit.unitId}`}
                className="inline-flex rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-200"
              >
                Ver detalhes da unidade
              </Link>
            </Card>
          ))}
          {!query.data?.items.length ? <Card>Nenhuma unidade encontrada.</Card> : null}
        </div>
      )}
    </div>
  );
};
