import { api } from "./api";

export type QuickFilter = "TODAY" | "7D" | "30D" | "MONTH";

export type FinancialSummary = {
  faturamentoDia: number;
  faturamentoMes: number;
  despesasMes: number;
  lucroMes: number;
  ticketMedio: number;
  receitaPorMetodo: Array<{ method: string; amount: number }>;
  rankingBarbers: Array<{ barberId: string; barberName: string; amount: number }>;
};

export type CashflowResponse = {
  inflow: number;
  outflow: number;
  balance: number;
  byMethod: Record<string, number>;
  items: Array<{
    id: string;
    type: "ENTRADA" | "SAIDA";
    source: "PAYMENT" | "EXPENSE";
    amount: number;
    date: string;
    description: string;
    method: string | null;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type Expense = {
  id: string;
  description: string;
  category: string;
  type: "FIXA" | "VARIAVEL";
  amount: string;
  dueDate: string;
  paid: boolean;
  paidAt: string | null;
};

export type ExpensesResponse = {
  items: Expense[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type Commission = {
  id: string;
  percentage: string;
  amount: string;
  paid: boolean;
  barber: {
    id: string;
    name: string;
  };
  appointment: {
    id: string;
    date: string;
  } | null;
};

export type CommissionsResponse = {
  items: Commission[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type DreResponse = {
  receitaBruta: number;
  totalDespesas: number;
  totalComissoes: number;
  lucroOperacional: number;
  margemPercentual: number;
  period: {
    start: string;
    end: string;
  };
};

export type FinancialMetrics = {
  ticketMedio: number;
  crescimentoMesAnterior: number;
  receitaPorDia: Array<{ date: string; amount: number }>;
  receitaPorBarbeiro: Array<{ barberId: string; barberName: string; amount: number }>;
  receitaPorServico: Array<{ serviceId: string; serviceName: string; amount: number }>;
};

const getQuickParams = (quick: QuickFilter) => ({ quick });

export const getFinancialSummary = async (): Promise<FinancialSummary> => {
  const { data } = await api.get<FinancialSummary>("/financial/summary");
  return data;
};

export const getCashflow = async (
  quick: QuickFilter,
  page = 1,
  pageSize = 20
): Promise<CashflowResponse> => {
  const { data } = await api.get<CashflowResponse>("/financial/cashflow", {
    params: { ...getQuickParams(quick), page, pageSize }
  });
  return data;
};

export const getExpenses = async (
  quick: QuickFilter,
  page = 1,
  pageSize = 20
): Promise<ExpensesResponse> => {
  const { data } = await api.get<ExpensesResponse>("/financial/expenses", {
    params: { ...getQuickParams(quick), page, pageSize }
  });
  return data;
};

export const createExpense = async (payload: {
  description: string;
  category: string;
  amount: number;
  type: "FIXA" | "VARIAVEL";
  dueDate: string;
  paid?: boolean;
}) => {
  const { data } = await api.post("/financial/expense", payload);
  return data;
};

export const payExpense = async (id: string) => {
  const { data } = await api.patch(`/financial/expense/${id}`, { paid: true });
  return data;
};

export const getCommissions = async (
  quick: QuickFilter,
  page = 1,
  pageSize = 20
): Promise<CommissionsResponse> => {
  const { data } = await api.get<CommissionsResponse>("/financial/commissions", {
    params: { ...getQuickParams(quick), page, pageSize }
  });
  return data;
};

export const payCommission = async (id: string) => {
  const { data } = await api.patch(`/financial/commissions/${id}/pay`, { paid: true });
  return data;
};

export const getDre = async (start: string, end: string): Promise<DreResponse> => {
  const { data } = await api.get<DreResponse>("/financial/dre", {
    params: { start, end }
  });
  return data;
};

export const getFinancialMetrics = async (quick: QuickFilter): Promise<FinancialMetrics> => {
  const { data } = await api.get<FinancialMetrics>("/financial/metrics", {
    params: { ...getQuickParams(quick) }
  });
  return data;
};
