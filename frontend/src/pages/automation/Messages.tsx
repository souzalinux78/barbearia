import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getAutomationMessages } from "../../services/automation.service";

export const AutomationMessagesPage = () => {
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<"OUTBOUND" | "INBOUND" | "ALL">("ALL");

  const messagesQuery = useQuery({
    queryKey: ["automation-messages", page, direction],
    queryFn: () =>
      getAutomationMessages({
        page,
        pageSize: 20,
        direction: direction === "ALL" ? undefined : direction
      })
  });

  if (messagesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const totalPages = Math.max(
    1,
    Math.ceil((messagesQuery.data?.meta.total ?? 0) / (messagesQuery.data?.meta.pageSize ?? 20))
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Mensagens WhatsApp</h1>
        <p className="text-sm text-slate-400">Historico de conversas, automacoes e respostas recebidas.</p>
      </header>

      <Card>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDirection("ALL")}
            className={`rounded-lg px-3 py-1 text-xs ${direction === "ALL" ? "bg-gold text-charcoal" : "bg-white/10 text-slate-200"}`}
          >
            Todas
          </button>
          <button
            onClick={() => setDirection("OUTBOUND")}
            className={`rounded-lg px-3 py-1 text-xs ${direction === "OUTBOUND" ? "bg-gold text-charcoal" : "bg-white/10 text-slate-200"}`}
          >
            Saida
          </button>
          <button
            onClick={() => setDirection("INBOUND")}
            className={`rounded-lg px-3 py-1 text-xs ${direction === "INBOUND" ? "bg-gold text-charcoal" : "bg-white/10 text-slate-200"}`}
          >
            Entrada
          </button>
        </div>
      </Card>

      <div className="space-y-2">
        {messagesQuery.data?.items.map((item) => (
          <Card key={item.id}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    item.direction === "OUTBOUND"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {item.direction}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
                  {item.automationType ?? "MANUAL"}
                </span>
                <span className="text-slate-400">
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-slate-100">{item.message}</p>
              <p className="text-xs text-slate-400">
                Cliente: {item.client.name} | Status: {item.status}
              </p>
            </div>
          </Card>
        ))}
        {!messagesQuery.data?.items.length ? (
          <Card>
            <p className="text-sm text-slate-400">Nenhuma mensagem para os filtros selecionados.</p>
          </Card>
        ) : null}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 disabled:opacity-50"
          >
            Anterior
          </button>
          <p className="text-xs text-slate-300">
            Pagina {page} de {totalPages}
          </p>
          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-white/20 px-3 py-1 text-xs text-slate-100 disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      </Card>
    </div>
  );
};
