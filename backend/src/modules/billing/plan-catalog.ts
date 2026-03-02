import { PlanName } from "@prisma/client";

export type PlanCatalogItem = {
  name: PlanName;
  price: number;
  maxUsers: number;
  maxBarbers: number;
  maxAppointmentsMonth: number;
  features: Record<string, boolean>;
};

export const DEFAULT_PLAN_DEFINITIONS: PlanCatalogItem[] = [
  {
    name: PlanName.FREE,
    price: 0,
    maxUsers: 2,
    maxBarbers: 1,
    maxAppointmentsMonth: 120,
    features: {
      dashboard_basic: true,
      financial_basic: true,
      premium_analytics: false,
      inventory: false,
      crm_advanced: false,
      automation_whatsapp: false
    }
  },
  {
    name: PlanName.PRO,
    price: 149,
    maxUsers: 10,
    maxBarbers: 5,
    maxAppointmentsMonth: 1000,
    features: {
      dashboard_basic: true,
      financial_basic: true,
      premium_analytics: true,
      inventory: true,
      crm_advanced: true,
      automation_whatsapp: true
    }
  },
  {
    name: PlanName.PREMIUM,
    price: 299,
    maxUsers: 999,
    maxBarbers: 999,
    maxAppointmentsMonth: 100000,
    features: {
      dashboard_basic: true,
      financial_basic: true,
      premium_analytics: true,
      inventory: true,
      crm_advanced: true,
      automation_whatsapp: true,
      api_access: true,
      franchise_hub: true
    }
  }
];

