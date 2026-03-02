import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { getMasterPlans, MasterPlan, updateMasterPlan } from "../../services/master.service";

type PlanName = "FREE" | "PRO" | "PREMIUM";

type PlanDraft = {
  name: PlanName;
  price: number;
  maxUsers: number;
  maxBarbers: number;
  maxAppointmentsMonth: number;
  features: Record<string, boolean>;
  newFeatureKey: string;
};

const planOrder: PlanName[] = ["FREE", "PRO", "PREMIUM"];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const normalizeFeatureKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

export const MasterPlansPage = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [drafts, setDrafts] = useState<Record<PlanName, PlanDraft> | null>(null);

  const plansQuery = useQuery({
    queryKey: ["master-plans"],
    queryFn: getMasterPlans
  });

  useEffect(() => {
    if (!plansQuery.data?.length) {
      return;
    }

    const next = plansQuery.data.reduce<Record<PlanName, PlanDraft>>((acc, plan) => {
      const name = plan.name as PlanName;
      acc[name] = {
        name,
        price: plan.price,
        maxUsers: plan.maxUsers,
        maxBarbers: plan.maxBarbers,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        features: { ...plan.features },
        newFeatureKey: ""
      };
      return acc;
    }, {} as Record<PlanName, PlanDraft>);

    setDrafts(next);
  }, [plansQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: {
      name: PlanName;
      payload: {
        price: number;
        maxUsers: number;
        maxBarbers: number;
        maxAppointmentsMonth: number;
        features: Record<string, boolean>;
      };
    }) => updateMasterPlan(input.name, input.payload),
    onSuccess: (_result, variables) => {
      setFeedback(`Plano ${variables.name} atualizado com sucesso.`);
      queryClient.invalidateQueries({ queryKey: ["master-plans"] });
      queryClient.invalidateQueries({ queryKey: ["master-summary"] });
      queryClient.invalidateQueries({ queryKey: ["master-tenants"] });
    },
    onError: () => {
      setFeedback("Falha ao salvar plano. Revise os campos e tente novamente.");
    }
  });

  const sortedPlans = useMemo(() => {
    if (!drafts) {
      return [];
    }
    return planOrder
      .map((name) => drafts[name])
      .filter((plan): plan is PlanDraft => Boolean(plan));
  }, [drafts]);

  if (plansQuery.isLoading || !drafts) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const setDraftValue = <K extends keyof PlanDraft>(name: PlanName, key: K, value: PlanDraft[K]) => {
    setDrafts((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [name]: {
          ...current[name],
          [key]: value
        }
      };
    });
  };

  const setFeatureValue = (name: PlanName, featureKey: string, value: boolean) => {
    setDrafts((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [name]: {
          ...current[name],
          features: {
            ...current[name].features,
            [featureKey]: value
          }
        }
      };
    });
  };

  const addFeature = (name: PlanName) => {
    const draft = drafts[name];
    const nextKey = normalizeFeatureKey(draft.newFeatureKey);
    if (!nextKey || !/^[a-z0-9_]{2,40}$/.test(nextKey)) {
      setFeedback("Feature invalida. Use apenas letras minusculas, numeros e underscore.");
      return;
    }
    if (draft.features[nextKey] !== undefined) {
      setFeedback("Esta feature ja existe neste plano.");
      return;
    }
    setFeatureValue(name, nextKey, false);
    setDraftValue(name, "newFeatureKey", "");
  };

  const removeFeature = (name: PlanName, featureKey: string) => {
    setDrafts((current) => {
      if (!current) {
        return current;
      }
      const { [featureKey]: _removed, ...rest } = current[name].features;
      return {
        ...current,
        [name]: {
          ...current[name],
          features: rest
        }
      };
    });
  };

  const savePlan = (name: PlanName) => {
    const draft = drafts[name];
    mutation.mutate({
      name,
      payload: {
        price: Number(draft.price),
        maxUsers: Number(draft.maxUsers),
        maxBarbers: Number(draft.maxBarbers),
        maxAppointmentsMonth: Number(draft.maxAppointmentsMonth),
        features: draft.features
      }
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-sky-100">Planos Comerciais</h1>
        <p className="text-sm text-slate-400">
          Configure preco, limites e recursos de cada plano diretamente pelo Master.
        </p>
      </header>

      {feedback ? (
        <Card className="border-sky-400/30 bg-sky-400/10 p-3">
          <p className="text-sm text-sky-100">{feedback}</p>
        </Card>
      ) : null}

      {sortedPlans.map((plan) => (
        <Card key={plan.name} title={`Plano ${plan.name}`}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-400">
              Preco mensal (R$)
              <input
                type="number"
                step="0.01"
                min={0}
                value={plan.price}
                onChange={(event) => setDraftValue(plan.name, "price", Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Atual: {currency.format(plan.price)}
              </span>
            </label>

            <label className="text-xs text-slate-400">
              Limite de usuarios
              <input
                type="number"
                min={1}
                value={plan.maxUsers}
                onChange={(event) => setDraftValue(plan.name, "maxUsers", Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-xs text-slate-400">
              Limite de barbeiros
              <input
                type="number"
                min={1}
                value={plan.maxBarbers}
                onChange={(event) => setDraftValue(plan.name, "maxBarbers", Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <label className="text-xs text-slate-400">
              Agendamentos por mes
              <input
                type="number"
                min={1}
                value={plan.maxAppointmentsMonth}
                onChange={(event) =>
                  setDraftValue(plan.name, "maxAppointmentsMonth", Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-charcoal/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">Features do plano</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {Object.keys(plan.features)
                .sort()
                .map((featureKey) => (
                  <div
                    key={`${plan.name}-${featureKey}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
                  >
                    <label className="flex items-center gap-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(plan.features[featureKey])}
                        onChange={(event) => setFeatureValue(plan.name, featureKey, event.target.checked)}
                      />
                      <span>{featureKey}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFeature(plan.name, featureKey)}
                      className="text-[11px] font-semibold text-rose-300"
                    >
                      remover
                    </button>
                  </div>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={plan.newFeatureKey}
                onChange={(event) =>
                  setDraftValue(plan.name, "newFeatureKey", normalizeFeatureKey(event.target.value))
                }
                placeholder="nova_feature"
                className="min-w-[220px] flex-1 rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => addFeature(plan.name)}
                className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-100"
              >
                Adicionar feature
              </button>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => savePlan(plan.name)}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Salvando..." : `Salvar ${plan.name}`}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};

