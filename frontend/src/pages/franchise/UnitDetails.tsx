import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getFranchiseRevenue, getFranchiseUnits } from "../../services/franchise.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const FranchiseUnitDetailsPage = () => {
  const params = useParams<{ id: string }>();
  const unitId = String(params.id ?? "");

  const unitQuery = useQuery({
    queryKey: ["franchise-unit-details", unitId],
    queryFn: () => getFranchiseUnits({ quick: "30D", unitId }),
    enabled: Boolean(unitId)
  });

  const revenueQuery = useQuery({
    queryKey: ["franchise-unit-revenue", unitId],
    queryFn: () => getFranchiseRevenue({ quick: "30D", unitId }),
    enabled: Boolean(unitId)
  });

  const unit = useMemo(() => unitQuery.data?.items[0], [unitQuery.data]);

  if (unitQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!unit) {
    return <Card>Unidade nao encontrada.</Card>;
  }

  const revenueSeries = revenueQuery.data?.revenueByDay ?? [];
  const startRevenue = revenueSeries[0]?.revenue ?? 0;
  const endRevenue = revenueSeries[revenueSeries.length - 1]?.revenue ?? 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">{unit.name}</h1>
        <p className="text-sm text-slate-400">
          {unit.city ?? "Cidade"} - {unit.state ?? "UF"} | {unit.franchiseName ?? "Unidade independente"}
        </p>
      </header>

      <Card className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <p className="text-slate-200">Receita: {formatCurrency(unit.revenue)}</p>
        <p className="text-slate-200">Ticket: {formatCurrency(unit.averageTicket)}</p>
        <p className="text-slate-200">Retencao: {unit.retentionRate}%</p>
        <p className="text-slate-200">Churn: {unit.churnRate}%</p>
        <p className="text-slate-200">No-show: {unit.noShowRate}%</p>
        <p className="text-slate-200">Ocupacao: {unit.occupancyRate}%</p>
        <p className="text-slate-200">Crescimento: {unit.growthPercent}%</p>
        <p className="text-slate-200">Performance: {unit.performance}</p>
      </Card>

      <Card title="Evolucao Simples de Receita (30 dias)">
        <p className="text-sm text-slate-300">
          Inicio do periodo: <span className="font-semibold">{formatCurrency(startRevenue)}</span>
        </p>
        <p className="text-sm text-slate-300">
          Final do periodo: <span className="font-semibold">{formatCurrency(endRevenue)}</span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Estrutura pronta para comparacao visual regional e mapa por cidade/estado.
        </p>
      </Card>

      <Link to="/franchise/units" className="inline-flex rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200">
        Voltar para unidades
      </Link>
    </div>
  );
};
