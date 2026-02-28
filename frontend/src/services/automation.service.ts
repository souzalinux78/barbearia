import { api } from "./api";

export type AutomationRuleType =
  | "CONFIRMATION"
  | "REMINDER"
  | "REACTIVATION"
  | "UPSELL"
  | "BIRTHDAY";

export type WhatsAppProvider = "OFFICIAL" | "EVOLUTION";
export type WhatsAppDirection = "OUTBOUND" | "INBOUND";

export type AutomationRule = {
  id: string;
  tenantId: string;
  type: AutomationRuleType;
  active: boolean;
  delayMinutes: number;
  templateMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type AutomationMessagesResponse = {
  items: Array<{
    id: string;
    clientId: string;
    appointmentId: string | null;
    direction: WhatsAppDirection;
    message: string;
    status: string;
    automationType: AutomationRuleType | null;
    createdAt: string;
    client: {
      id: string;
      name: string;
      phone: string | null;
    };
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type AutomationMetricsResponse = {
  confirmationRate: number;
  responseRate: number;
  noShow: {
    currentRate: number;
    previousRate: number;
    reductionPercent: number;
  };
  reactivation: {
    sent: number;
    converted: number;
    rate: number;
  };
  upsell: {
    sent: number;
    converted: number;
    rate: number;
  };
  totals: {
    outboundAutomation: number;
    inboundAutomation: number;
  };
  funnel: Array<{
    stage: string;
    value: number;
  }>;
};

export type WhatsAppStatusResponse = {
  connected: boolean;
  config: {
    provider: WhatsAppProvider;
    apiUrl: string;
    phoneNumber: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  queueSize: number;
  messagesLast24h: Record<string, number>;
};

export const getAutomationRules = async (): Promise<AutomationRule[]> => {
  const { data } = await api.get<AutomationRule[]>("/automation/rules");
  return data;
};

export const updateAutomationRule = async (
  type: AutomationRuleType,
  payload: Partial<Pick<AutomationRule, "active" | "delayMinutes" | "templateMessage">>
) => {
  const { data } = await api.patch<AutomationRule>(`/automation/rules/${type}`, payload);
  return data;
};

export const getAutomationMessages = async (params?: {
  page?: number;
  pageSize?: number;
  type?: AutomationRuleType;
  direction?: WhatsAppDirection;
}) => {
  const { data } = await api.get<AutomationMessagesResponse>("/automation/messages", { params });
  return data;
};

export const getAutomationMetrics = async (days = 30) => {
  const { data } = await api.get<AutomationMetricsResponse>("/automation/metrics", {
    params: { days }
  });
  return data;
};

export const runAutomationSweep = async () => {
  const { data } = await api.post("/automation/run-sweep");
  return data;
};

export const getWhatsAppStatus = async () => {
  const { data } = await api.get<WhatsAppStatusResponse>("/whatsapp/status");
  return data;
};

export const saveWhatsAppConfig = async (payload: {
  provider: WhatsAppProvider;
  apiUrl: string;
  apiKey: string;
  phoneNumber: string;
  active: boolean;
}) => {
  const { data } = await api.put("/whatsapp/config", payload);
  return data;
};

export const sendWhatsAppTest = async (payload: {
  clientId?: string;
  phoneNumber?: string;
  message: string;
}) => {
  const { data } = await api.post("/whatsapp/test", payload);
  return data;
};
