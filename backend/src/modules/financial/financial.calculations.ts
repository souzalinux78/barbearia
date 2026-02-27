export type DreInput = {
  revenue: number;
  expenses: number;
  commissions: number;
};

export const calculateCommissionAmount = (serviceAmount: number, percentage: number): number =>
  Number(((serviceAmount * percentage) / 100).toFixed(2));

export const calculateDre = (input: DreInput) => {
  const operationalProfit = input.revenue - input.expenses - input.commissions;
  const margin = input.revenue > 0 ? Number(((operationalProfit / input.revenue) * 100).toFixed(2)) : 0;

  return {
    receitaBruta: input.revenue,
    totalDespesas: input.expenses,
    totalComissoes: input.commissions,
    lucroOperacional: operationalProfit,
    margemPercentual: margin
  };
};

export const shouldGeneratePaymentOnFinalize = (
  previousStatus: string,
  nextStatus: string
): boolean => previousStatus !== "FINALIZADO" && nextStatus === "FINALIZADO";

export const filterByTenant = <T extends { tenantId: string }>(
  items: T[],
  tenantId: string
): T[] => items.filter((item) => item.tenantId === tenantId);
