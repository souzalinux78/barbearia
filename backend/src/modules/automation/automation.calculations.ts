import { AutomationRuleType } from "@prisma/client";

export const DEFAULT_AUTOMATION_TEMPLATES: Record<AutomationRuleType, string> = {
  CONFIRMATION:
    "Ola {{client_name}}, seu horario esta agendado para {{date}} as {{time}}. Responda 1 para confirmar ou 2 para cancelar.",
  REMINDER: "Seu atendimento comeca em 1 hora. Estamos te esperando!",
  REACTIVATION: "Sentimos sua falta, {{client_name}}! Essa semana voce ganha 10% de desconto.",
  UPSELL: "Na proxima visita recomendamos hidratacao para manter o corte perfeito. Deseja agendar?",
  BIRTHDAY: "Feliz aniversario, {{client_name}}! Ganhe um beneficio especial na sua proxima visita."
};

export const renderAutomationTemplate = (
  template: string,
  variables: Record<string, string | number | null | undefined>
): string =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });

export const detectConfirmationDecision = (message: string): "CONFIRM" | "CANCEL" | null => {
  const normalized = message.trim().toLowerCase();
  if (normalized === "1" || normalized.includes("confirm")) {
    return "CONFIRM";
  }
  if (normalized === "2" || normalized.includes("cancel")) {
    return "CANCEL";
  }
  return null;
};

export const calculateRate = (partial: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return Number(((partial / total) * 100).toFixed(2));
};

export const calculateNoShowReduction = (currentRate: number, previousRate: number): number => {
  if (previousRate <= 0) {
    return 0;
  }
  return Number((((previousRate - currentRate) / previousRate) * 100).toFixed(2));
};

export const isInactiveClient = (lastVisit: Date | null, inactivityDays: number, now = new Date()) => {
  if (!lastVisit) {
    return true;
  }
  const cutoff = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);
  return lastVisit.getTime() <= cutoff.getTime();
};

export const inferAiIntent = (message: string) => {
  const normalized = message.toLowerCase();
  if (/\b(1|2|confirm|cancel)\b/.test(normalized)) {
    return "CONFIRMATION_REPLY";
  }
  if (normalized.includes("horario") || normalized.includes("funciona") || normalized.includes("aberto")) {
    return "HOURS";
  }
  if (normalized.includes("preco") || normalized.includes("valor") || normalized.includes("quanto")) {
    return "PRICING";
  }
  if (normalized.includes("servico") || normalized.includes("servicos")) {
    return "SERVICES";
  }
  if (normalized.includes("agendar") || normalized.includes("marcar") || normalized.includes("agenda")) {
    return "BOOKING";
  }
  return "GENERAL";
};

export const filterByTenant = <T extends { tenantId: string }>(rows: T[], tenantId: string) =>
  rows.filter((row) => row.tenantId === tenantId);
