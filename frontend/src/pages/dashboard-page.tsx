import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getDashboardOverview } from "../services/dashboard.service";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const DashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: getDashboardOverview
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const weeklyMax = Math.max(...data.weeklySeries.map((item) => item.revenue), 1);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400">Visao diaria da sua barbearia.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Faturamento do dia</p>
          <p className="mt-2 text-2xl font-bold text-gold">{money.format(data.revenueToday)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Agendamentos hoje</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{data.appointmentsToday}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Clientes novos</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{data.newClientsToday}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Top servico</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {data.topServices[0]?.serviceName ?? "Sem dados"}
          </p>
        </Card>
      </section>

      <Card title="Receita semanal">
        <div className="space-y-3">
          {data.weeklySeries.map((item) => (
            <div key={item.date} className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{item.date.slice(5)}</span>
                <span>{money.format(item.revenue)}</span>
              </div>
              <div className="h-2 rounded-full bg-charcoal">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-forest to-gold transition-all duration-500"
                  style={{ width: `${Math.max(8, (item.revenue / weeklyMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
