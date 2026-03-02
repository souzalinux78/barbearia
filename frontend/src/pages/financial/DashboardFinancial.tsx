import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getFinancialMetrics,
  getFinancialSummary,
  QuickFilter
} from "../../services/financial.service";
import { FinancialNav } from "./FinancialNav";
import { QuickFilters } from "./QuickFilters";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const DashboardFinancial = () => {
  const [quick, setQuick] = useState<QuickFilter>("30D");
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["financial-summary"],
    queryFn: getFinancialSummary,
    refetchOnMount: "always"
  });

  const metricsQuery = useQuery({
    queryKey: ["financial-metrics", quick],
    queryFn: () => getFinancialMetrics(quick),
    refetchOnMount: "always"
  });

  const isLoading = summaryQuery.isLoading || metricsQuery.isLoading;
  const summary = summaryQuery.data;
  const metrics = metricsQuery.data;

  return (
    <div
      className="space-y-4"
      onTouchStart={(event) => setTouchStartY(event.touches[0].clientY)}
      onTouchEnd={(event) => {
        if (touchStartY === null) {
          return;
        }
        const delta = event.changedTouches[0].clientY - touchStartY;
        if (delta > 90) {
          summaryQuery.refetch();
          metricsQuery.refetch();
        }
        setTouchStartY(null);
      }}
    >
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Financeiro Inteligente</h1>
          <p className="text-sm text-slate-400">Dashboard financeiro com indicadores e crescimento.</p>
        </div>
        <Card>
          <p className="text-xs text-slate-300">
            Recebimento PIX da agenda publica e configurado em <span className="font-semibold text-gold">Perfil</span>.
          </p>
          <Link to="/settings" className="mt-2 inline-block text-xs font-semibold text-gold underline">
            Abrir configuracoes da barbearia
          </Link>
        </Card>
        <FinancialNav />
        <QuickFilters value={quick} onChange={setQuick} />
      </header>

      {isLoading || !summary || !metrics ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <Card className="border-blue-500/30">
              <p className="text-xs uppercase tracking-wide text-slate-400">Faturamento do dia</p>
              <p className="mt-1 text-2xl font-bold text-sky-300">{currency.format(summary.faturamentoDia)}</p>
            </Card>
            <Card className="border-blue-500/30">
              <p className="text-xs uppercase tracking-wide text-slate-400">Faturamento do mes</p>
              <p className="mt-1 text-2xl font-bold text-sky-300">{currency.format(summary.faturamentoMes)}</p>
            </Card>
            <Card className="border-orange-500/30">
              <p className="text-xs uppercase tracking-wide text-slate-400">Despesas do mes</p>
              <p className="mt-1 text-2xl font-bold text-orange-300">{currency.format(summary.despesasMes)}</p>
            </Card>
            <Card className={summary.lucroMes >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}>
              <p className="text-xs uppercase tracking-wide text-slate-400">Lucro do mes</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  summary.lucroMes >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {currency.format(summary.lucroMes)}
              </p>
            </Card>
          </section>

          <Card title="Ticket medio e crescimento">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Ticket medio</p>
                <p className="text-xl font-semibold text-slate-100">{currency.format(summary.ticketMedio)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Crescimento vs mes anterior</p>
                <p
                  className={`text-xl font-semibold ${
                    metrics.crescimentoMesAnterior >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {metrics.crescimentoMesAnterior}%
                </p>
              </div>
            </div>
          </Card>

          <Card title="Receita por metodo">
            <div className="space-y-2">
              {summary.receitaPorMetodo.map((item) => (
                <div key={item.method} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{item.method}</span>
                    <span>{currency.format(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-charcoal">
                    <div
                      className="h-2 rounded-full bg-sky-400 transition-all duration-500"
                      style={{
                        width: `${
                          summary.faturamentoMes > 0 ? Math.max(8, (item.amount / summary.faturamentoMes) * 100) : 8
                        }%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Receita por dia">
            <div className="space-y-2">
              {metrics.receitaPorDia.slice(-7).map((item) => (
                <div key={item.date} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{item.date.slice(5)}</span>
                    <span>{currency.format(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-charcoal">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-gold transition-all duration-500"
                      style={{
                        width: `${
                          Math.max(
                            8,
                            (item.amount /
                              Math.max(...metrics.receitaPorDia.map((value) => value.amount), 1)) *
                              100
                          )
                        }%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Servicos mais faturados">
            <div className="space-y-2">
              {metrics.receitaPorServico.slice(0, 5).map((service) => (
                <div key={service.serviceId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{service.serviceName}</span>
                  <span className="font-semibold text-slate-100">{currency.format(service.amount)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ranking de barbeiros por faturamento">
            <div className="space-y-2">
              {summary.rankingBarbers.map((barber) => (
                <div key={barber.barberId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{barber.barberName}</span>
                  <span className="font-semibold text-gold">{currency.format(barber.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
