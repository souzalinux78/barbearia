import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  AutomationRule,
  AutomationRuleType,
  getAutomationRules,
  updateAutomationRule
} from "../../services/automation.service";
import { AutomationNav } from "./AutomationNav";

const typeLabel: Record<AutomationRuleType, string> = {
  CONFIRMATION: "Confirmacao",
  REMINDER: "Lembrete",
  REACTIVATION: "Reativacao",
  UPSELL: "Upsell",
  BIRTHDAY: "Aniversario"
};

export const AutomationRulesPage = () => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, AutomationRule>>({});
  const [feedback, setFeedback] = useState("");

  const rulesQuery = useQuery({
    queryKey: ["automation-rules"],
    queryFn: getAutomationRules
  });

  useEffect(() => {
    if (!rulesQuery.data) {
      return;
    }
    const map: Record<string, AutomationRule> = {};
    rulesQuery.data.forEach((rule) => {
      map[rule.type] = rule;
    });
    setDrafts(map);
  }, [rulesQuery.data]);

  const updateRuleMutation = useMutation({
    mutationFn: ({ type, payload }: { type: AutomationRuleType; payload: Partial<AutomationRule> }) =>
      updateAutomationRule(type, payload),
    onSuccess: () => {
      setFeedback("Regra atualizada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    }
  });

  const orderedTypes = useMemo<AutomationRuleType[]>(
    () => ["CONFIRMATION", "REMINDER", "REACTIVATION", "UPSELL", "BIRTHDAY"],
    []
  );

  if (rulesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Regras de Automacao</h1>
        <p className="text-sm text-slate-400">
          Configure ativacao, delay e template. Variaveis: {"{{client_name}}"}, {"{{date}}"}, {"{{time}}"}, {"{{barber_name}}"}.
        </p>
      </header>
      <AutomationNav />

      <div className="space-y-3">
        {orderedTypes.map((type) => {
          const rule = drafts[type];
          if (!rule) {
            return null;
          }

          return (
            <Card key={type} title={typeLabel[type]}>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                  <p className="text-sm text-slate-200">Ativar regra</p>
                  <input
                    type="checkbox"
                    checked={rule.active}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [type]: {
                          ...rule,
                          active: event.target.checked
                        }
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">Delay (minutos)</label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={rule.delayMinutes}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [type]: {
                          ...rule,
                          delayMinutes: Number(event.target.value || 0)
                        }
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">Template</label>
                  <textarea
                    value={rule.templateMessage}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [type]: {
                          ...rule,
                          templateMessage: event.target.value
                        }
                      }))
                    }
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
                  />
                </div>

                <button
                  onClick={() =>
                    updateRuleMutation.mutate({
                      type,
                      payload: {
                        active: rule.active,
                        delayMinutes: rule.delayMinutes,
                        templateMessage: rule.templateMessage
                      }
                    })
                  }
                  disabled={updateRuleMutation.isPending}
                  className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
                >
                  {updateRuleMutation.isPending ? "Salvando..." : "Salvar regra"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
    </div>
  );
};
