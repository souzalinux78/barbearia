import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getFranchisePerformance,
  getFranchiseRevenue,
  getFranchiseSummary
} from "../../services/franchise.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const DashboardFranchisePage = () => {
  const summaryQuery = useQuery({
    queryKey: ["franchise-summary"],
    queryFn: () => getFranchiseSummary({ quick: "30D" })
  });

  const revenueQuery = useQuery({
    queryKey: ["franchise-revenue"],
    queryFn: () => getFranchiseRevenue({ quick: "30D" })
  });

  const performanceQuery = useQuery({
    queryKey: ["franchise-performance"],
    queryFn: () => getFranchisePerformance({ quick: "30D", rankingLimit: 8 })
  });

  const isLoading = summaryQuery.isLoading || revenueQuery.isLoading || performanceQuery.isLoading;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Franquia | Dashboard</h1>
        <p className="text-sm text-slate-400">
          Receita consolidada, ranking de unidades e projecao de royalties.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-xs text-slate-400">Receita consolidada</p>
            <p className="text-xl font-bold text-slate-100">
              {formatCurrency(summaryQuery.data?.totals.revenue ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Royalties a receber</p>
            <p className="text-xl font-bold text-gold">
              {formatCurrency(summaryQuery.data?.totals.projectedRoyalties ?? 0)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Taxa media de ocupacao</p>
            <p className="text-xl font-bold text-emerald-300">
              {summaryQuery.data?.totals.averageOccupancy ?? 0}%
            </p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Ticket medio consolidado</p>
            <p className="text-xl font-bold text-slate-100">
              {formatCurrency(summaryQuery.data?.totals.averageTicket ?? 0)}
            </p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Receita por Dia">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueQuery.data?.revenueByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#C6A46A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Ranking de Unidades">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceQuery.data?.ranking ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="unitName" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="revenue" fill="#C6A46A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Insights Inteligentes">
        <div className="space-y-2">
          {performanceQuery.data?.insights.map((insight, index) => (
            <p
              key={`${insight.severity}-${index}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
                insight.severity === "warning"
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                  : insight.severity === "success"
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-slate-200"
              }`}
            >
              {insight.message}
            </p>
          ))}
          {!performanceQuery.data?.insights.length ? (
            <p className="text-sm text-slate-400">Sem insights para o periodo.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
