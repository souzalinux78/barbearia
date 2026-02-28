export type FranchiseScopeMode = "GLOBAL" | "FRANCHISE" | "UNIT";

export type FranchiseScope = {
  mode: FranchiseScopeMode;
  franchiseId: string | null;
  unitId: string | null;
};

export const calculateRoyaltyAmount = (revenue: number, royaltyPercentage: number): number => {
  if (revenue <= 0 || royaltyPercentage <= 0) {
    return 0;
  }
  return Number(((revenue * royaltyPercentage) / 100).toFixed(2));
};

export const calculateRate = (numerator: number, denominator: number): number => {
  if (denominator <= 0 || numerator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
};

export const calculateGrowth = (current: number, previous: number): number => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

export const getPerformanceSignal = (value: number, average: number): "GREEN" | "YELLOW" | "RED" => {
  if (average <= 0) {
    return value > 0 ? "GREEN" : "YELLOW";
  }
  if (value >= average * 1.1) {
    return "GREEN";
  }
  if (value >= average * 0.85) {
    return "YELLOW";
  }
  return "RED";
};

export const buildScopeFromRole = (input: {
  role:
    | "SUPER_ADMIN"
    | "FRANCHISE_OWNER"
    | "UNIT_OWNER"
    | "UNIT_ADMIN"
    | "OWNER"
    | "ADMIN"
    | "BARBER"
    | "RECEPTION";
  franchiseId: string | null;
  unitId: string;
}): FranchiseScope => {
  if (input.role === "SUPER_ADMIN") {
    return {
      mode: "GLOBAL",
      franchiseId: null,
      unitId: null
    };
  }

  if (input.role === "FRANCHISE_OWNER") {
    return {
      mode: "FRANCHISE",
      franchiseId: input.franchiseId,
      unitId: null
    };
  }

  return {
    mode: "UNIT",
    franchiseId: input.franchiseId,
    unitId: input.unitId
  };
};

export const filterRowsByScope = <T extends { franchiseId: string | null; unitId: string }>(
  rows: T[],
  scope: FranchiseScope
) => {
  if (scope.mode === "GLOBAL") {
    return rows;
  }
  if (scope.mode === "FRANCHISE") {
    return rows.filter((row) => row.franchiseId === scope.franchiseId);
  }
  return rows.filter((row) => row.unitId === scope.unitId);
};

