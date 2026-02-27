import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  createExpense,
  getExpenses,
  payExpense,
  QuickFilter
} from "../../services/financial.service";
import { FinancialNav } from "./FinancialNav";
import { QuickFilters } from "./QuickFilters";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const Expenses = () => {
  const queryClient = useQueryClient();
  const [quick, setQuick] = useState<QuickFilter>("30D");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    description: "",
    category: "",
    amount: "",
    type: "VARIAVEL" as "FIXA" | "VARIAVEL",
    dueDate: new Date().toISOString().slice(0, 10)
  });

  const query = useQuery({
    queryKey: ["financial-expenses", quick, page],
    queryFn: () => getExpenses(quick, page, 20)
  });

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      setForm({
        description: "",
        category: "",
        amount: "",
        type: "VARIAVEL",
        dueDate: new Date().toISOString().slice(0, 10)
      });
      queryClient.invalidateQueries({ queryKey: ["financial-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["financial-cashflow"] });
    }
  });

  const payMutation = useMutation({
    mutationFn: payExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-cashflow"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    }
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      description: form.description,
      category: form.category,
      amount: Number(form.amount),
      type: form.type,
      dueDate: form.dueDate
    });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">Despesas</h1>
        <FinancialNav />
        <QuickFilters
          value={quick}
          onChange={(value) => {
            setQuick(value);
            setPage(1);
          }}
        />
      </header>

      <Card title="Nova despesa">
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
          <input
            required
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Descricao"
            className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
          <input
            required
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="Categoria"
            className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Valor"
            className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({ ...current, type: event.target.value as "FIXA" | "VARIAVEL" }))
            }
            className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
          >
            <option value="VARIAVEL">Variavel</option>
            <option value="FIXA">Fixa</option>
          </select>
          <input
            required
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            className="rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-charcoal disabled:opacity-60"
          >
            {createMutation.isPending ? "Salvando..." : "Adicionar"}
          </button>
        </form>
      </Card>

      {query.isLoading || !query.data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="space-y-2">
            {query.data.items.map((expense) => (
              <Card key={expense.id} className={expense.paid ? "border-emerald-500/30" : "border-orange-500/30"}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{expense.description}</p>
                    <p className="text-xs text-slate-400">
                      {expense.category} | {expense.type} | Venc: {expense.dueDate.slice(0, 10)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-300">{currency.format(Number(expense.amount))}</p>
                    {!expense.paid ? (
                      <button
                        onClick={() => payMutation.mutate(expense.id)}
                        className="mt-1 rounded-md bg-forest px-2 py-1 text-[11px] font-semibold text-slate-100"
                      >
                        Marcar paga
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-300">Paga</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-400">
              Pagina {query.data.meta.page} ({query.data.meta.total} despesas)
            </span>
            <button
              disabled={page * query.data.meta.pageSize >= query.data.meta.total}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </>
      )}
    </div>
  );
};
