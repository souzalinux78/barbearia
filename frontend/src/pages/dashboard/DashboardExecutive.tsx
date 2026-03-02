import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  DashboardPeriod,
  DashboardQuickFilter,
  exportDashboard,
  getDashboardSummary
} from "../../services/dashboard.service";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const quickFilters: Array<{ value: DashboardQuickFilter; label: string }> = [
  { value: "TODAY", label: "Hoje" },
  { value: "7D", label: "7 dias" },
  { value: "30D", label: "30 dias" },
  { value: "MONTH", label: "Mes atual" },
  { value: "CUSTOM", label: "Personalizado" }
];

const chartColors = ["#F5D48A", "#10B981", "#38BDF8", "#F97316", "#A78BFA", "#F43F5E"];

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const customTooltip = (value: number | string | undefined) => money.format(Number(value ?? 0));

const StatCard = ({
  title,
  value,
  helper,
  tone
}: {
  title: string;
  value: string;
  helper?: string;
  tone?: "default" | "positive" | "negative";
}) => (
  <Card className="fade-up p-5">
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <p
      className={`mt-2 text-2xl font-bold ${
        tone === "positive"
          ? "text-emerald-300"
          : tone === "negative"
            ? "text-rose-300"
            : "text-slate-100"
      }`}
    >
      {value}
    </p>
    {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
  </Card>
);

export const DashboardExecutive = () => {
  const [quick, setQuick] = useState<DashboardQuickFilter>("30D");
  const [customStart, setCustomStart] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(toDateInput(new Date()));
  const [exportState, setExportState] = useState<string>("");

  const period = useMemo<DashboardPeriod>(() => {
    if (quick === "CUSTOM") {
      return {
        quick,
        start: customStart,
        end: customEnd
      };
    }
    return { quick };
  }, [quick, customStart, customEnd]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dashboard-executive", period],
    queryFn: () => getDashboardSummary(period),
    refetchOnMount: "always"
  });

  const handleExport = async (format: "pdf" | "excel") => {
    try {
      const response = await exportDashboard(format, period);
      setExportState(response.message ?? "Exportacao solicitada.");
    } catch {
      setExportState("Falha ao solicitar exportacao.");
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const revenue = data.revenue;
  const clients = data.clients;
  const services = data.services;
  const barbers = data.barbers;
  const occupancy = data.occupancy;
  const advanced = data.advancedMetrics;

  return (
    <div className="space-y-5">
      <header className="fade-up space-y-3 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-graphite/70 to-forest/30 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Dashboard Executivo Inteligente</h1>
            <p className="text-sm text-slate-400">
              Indicadores estrategicos para crescimento, retencao e performance operacional.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("pdf")}
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              Exportar PDF
            </button>
            <button
              onClick={() => handleExport("excel")}
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickFilters.map((item) => (
            <button
              key={item.value}
              onClick={() => setQuick(item.value)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                quick === item.value
                  ? "bg-gold text-charcoal"
                  : "border border-white/20 text-slate-300 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {quick === "CUSTOM" ? (
          <div className="grid grid-cols-2 gap-2 md:max-w-md">
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        ) : null}

        {exportState ? <p className="text-xs text-slate-400">{exportState}</p> : null}
        {isFetching ? <p className="text-xs text-slate-500">Atualizando dados...</p> : null}
      </header>

      {revenue ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Receita Hoje" value={money.format(revenue.revenueToday)} />
          <StatCard title="Receita Semana" value={money.format(revenue.revenueWeek)} />
          <StatCard title="Receita Mes" value={money.format(revenue.revenueMonth)} />
          <StatCard
            title="Crescimento vs anterior"
            value={percent.format(revenue.growthPercent / 100)}
            tone={revenue.growthPercent >= 0 ? "positive" : "negative"}
            helper={`${money.format(revenue.revenuePeriod)} no periodo selecionado`}
          />
        </section>
      ) : (
        <Card className="p-5 text-sm text-slate-300">
          Perfil com visao limitada: receita e margens disponiveis apenas para papeis de gestao e BARBER.
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Clientes novos (mes)" value={String(clients.newClientsMonth)} />
        <StatCard title="Clientes recorrentes" value={String(clients.recurringClients)} />
        <StatCard title="Retencao" value={percent.format(clients.retentionRate / 100)} />
        <StatCard
          title="No-show"
          value={percent.format(clients.noShowRate / 100)}
          tone={clients.noShowRate > 10 ? "negative" : "default"}
        />
        <StatCard title="Frequencia media" value={`${clients.averageReturnFrequencyDays.toFixed(1)} dias`} />
        <StatCard title="Ticket medio por cliente" value={money.format(clients.averageTicketPerClient)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {revenue ? (
          <Card title="Receita por dia" className="fade-up">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <Tooltip formatter={customTooltip} />
                  <Line type="monotone" dataKey="revenue" stroke="#F5D48A" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : (
          <Card title="Ocupacao semanal" className="fade-up">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancy.weeklySeries} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis type="category" dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} width={70} />
                  <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
                  <Bar dataKey="occupancyPercent" fill="#10B981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card title="Receita por barbeiro" className="fade-up">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue?.byBarber ?? barbers?.rankingByRevenue ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey={"barberName"} tick={{ fill: "#94A3B8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <Tooltip formatter={customTooltip} />
                <Bar dataKey={"revenue"} fill="#38BDF8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Receita por servico" className="fade-up">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenue?.byService ?? services.revenueByService}
                  dataKey="revenue"
                  nameKey="serviceName"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label
                >
                  {(revenue?.byService ?? services.revenueByService).map((entry, index) => (
                    <Cell key={entry.serviceName} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={customTooltip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Ocupacao semanal (%)" className="fade-up">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancy.weeklySeries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                <YAxis type="category" dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} width={70} />
                <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
                <Bar dataKey="occupancyPercent" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Crescimento mensal (%)" className="fade-up">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue?.monthlyGrowth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} />
                <Tooltip formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}%`} />
                <Line type="monotone" dataKey="growthPercent" stroke="#F97316" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card title="Servicos e agenda" className="fade-up">
          <div className="space-y-2 text-sm">
            <p className="text-slate-300">
              Mais vendido: <span className="font-semibold text-slate-100">{services.mostSoldService?.serviceName ?? "N/A"}</span>
            </p>
            <p className="text-slate-300">
              Mais lucrativo: <span className="font-semibold text-slate-100">{services.mostProfitableService?.serviceName ?? "N/A"}</span>
            </p>
            <p className="text-slate-300">
              Duracao media: <span className="font-semibold text-slate-100">{services.averageServiceDurationMin.toFixed(1)} min</span>
            </p>
            <p className="text-slate-300">
              Ocupacao do dia: <span className="font-semibold text-slate-100">{occupancy.occupancyDayPercent.toFixed(2)}%</span>
            </p>
            <p className="text-slate-300">
              Ocupacao da semana: <span className="font-semibold text-slate-100">{occupancy.occupancyWeekPercent.toFixed(2)}%</span>
            </p>
            <p className="text-slate-300">
              Horario mais lucrativo: <span className="font-semibold text-slate-100">{occupancy.mostProfitableHour?.hour ?? "--"}h</span>
            </p>
            <p className="text-slate-300">
              Dia mais lucrativo: <span className="font-semibold text-slate-100">{occupancy.mostProfitableWeekday?.weekdayName ?? "N/A"}</span>
            </p>
          </div>
        </Card>

        <Card title="Ranking de barbeiros" className="fade-up">
          <div className="space-y-2">
            {(barbers?.rankingByRevenue ?? []).slice(0, 5).map((barber, index) => (
              <div key={barber.barberId} className="flex items-center justify-between rounded-lg bg-charcoal/60 px-3 py-2">
                <p className="text-sm text-slate-200">
                  {index + 1}. {barber.barberName}
                </p>
                <div className="text-right text-xs text-slate-400">
                  <p>{money.format(barber.revenue)}</p>
                  <p>Ticket {money.format(barber.averageTicket)}</p>
                </div>
              </div>
            ))}
            {!barbers ? <p className="text-sm text-slate-400">Visao limitada para este perfil.</p> : null}
          </div>
        </Card>
      </section>

      {advanced ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="LTV" value={money.format(advanced.ltv.value)} />
          <StatCard title="Churn Rate" value={percent.format(advanced.churn.ratePercent / 100)} />
          <StatCard
            title="Margem operacional"
            value={percent.format(advanced.operationalMargin.marginPercent / 100)}
            tone={advanced.operationalMargin.marginPercent >= 0 ? "positive" : "negative"}
          />
          <StatCard title="CAC" value={advanced.cac.value ? money.format(advanced.cac.value) : "Em preparacao"} />
        </section>
      ) : null}

      <Card title="Insights Inteligentes" className="fade-up">
        <div className="space-y-2">
          {data.insights.map((insight, index) => (
            <div
              key={`${insight.message}-${index}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
                insight.severity === "warning"
                  ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
                  : insight.severity === "success"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-sky-400/30 bg-sky-400/10 text-sky-200"
              }`}
            >
              {insight.message}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
