import { api } from "./api";

export type CashflowReport = {
  inflow: number;
  outflow: number;
  balance: number;
  byMethod: Record<string, number>;
  period: { from: string; to: string };
};

export const getCashflow = async (): Promise<CashflowReport> => {
  const { data } = await api.get<CashflowReport>("/payments/cashflow");
  return data;
};
