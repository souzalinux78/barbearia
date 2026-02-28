import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getCrmRetention,
  getLoyaltyProgram,
  previewCrmAutomation,
  redeemLoyalty,
  updateLoyaltyProgram
} from "../../services/crm.service";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export const LoyaltyDashboardPage = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [campaignPreviewCount, setCampaignPreviewCount] = useState<number | null>(null);

  const loyaltyQuery = useQuery({
    queryKey: ["crm-loyalty-program"],
    queryFn: getLoyaltyProgram
  });

  const retentionQuery = useQuery({
    queryKey: ["crm-retention-dashboard"],
    queryFn: () => getCrmRetention(60)
  });

  const [programForm, setProgramForm] = useState({
    active: false,
    type: "POINTS" as "POINTS" | "CASHBACK",
    pointsPerReal: 1,
    cashbackPercentage: 5,
    expirationDays: 90
  });

  const [redeemForm, setRedeemForm] = useState({
    clientId: "",
    appointmentId: "",
    mode: "CASHBACK" as "POINTS" | "CASHBACK",
    amount: 10
  });

  useEffect(() => {
    if (!loyaltyQuery.data) {
      return;
    }
    setProgramForm({
      active: loyaltyQuery.data.active,
      type: loyaltyQuery.data.type,
      pointsPerReal: loyaltyQuery.data.pointsPerReal,
      cashbackPercentage: loyaltyQuery.data.cashbackPercentage,
      expirationDays: loyaltyQuery.data.expirationDays
    });
  }, [loyaltyQuery.data]);

  const updateProgramMutation = useMutation({
    mutationFn: updateLoyaltyProgram,
    onSuccess: () => {
      setFeedback("Programa atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["crm-loyalty-program"] });
      queryClient.invalidateQueries({ queryKey: ["crm-retention-dashboard"] });
    }
  });

  const redeemMutation = useMutation({
    mutationFn: redeemLoyalty,
    onSuccess: () => {
      setFeedback("Resgate registrado.");
      setRedeemForm((current) => ({ ...current, clientId: "", appointmentId: "", amount: 10 }));
      queryClient.invalidateQueries({ queryKey: ["crm-clients"] });
    }
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      previewCrmAutomation({
        campaign: "INACTIVE_CLIENTS",
        limit: 100
      }),
    onSuccess: (data: { audienceSize: number }) => {
      setCampaignPreviewCount(data.audienceSize);
    }
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Loyalty + Retencao</h1>
        <p className="text-sm text-slate-400">
          Controle do programa de pontos/cashback, resgate e indicadores de retencao.
        </p>
      </header>

      {retentionQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card>
            <p className="text-xs text-slate-400">Retencao</p>
            <p className="text-xl font-bold text-emerald-300">{retentionQuery.data?.cards.retentionRate}%</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Churn</p>
            <p className="text-xl font-bold text-rose-300">{retentionQuery.data?.cards.churnRate}%</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Clientes ativos</p>
            <p className="text-xl font-bold text-slate-100">{retentionQuery.data?.cards.activeClients}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Clientes inativos</p>
            <p className="text-xl font-bold text-slate-100">{retentionQuery.data?.cards.inactiveClients}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400">Receita VIP</p>
            <p className="text-xl font-bold text-gold">
              {formatCurrency(retentionQuery.data?.cards.vipRevenue ?? 0)}
            </p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Configurar Programa">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              updateProgramMutation.mutate(programForm);
            }}
          >
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={programForm.active}
                onChange={(event) =>
                  setProgramForm((current) => ({ ...current, active: event.target.checked }))
                }
              />
              Programa ativo
            </label>

            <select
              value={programForm.type}
              onChange={(event) =>
                setProgramForm((current) => ({
                  ...current,
                  type: event.target.value as "POINTS" | "CASHBACK"
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="POINTS">Pontos</option>
              <option value="CASHBACK">Cashback</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.1"
                value={programForm.pointsPerReal}
                onChange={(event) =>
                  setProgramForm((current) => ({
                    ...current,
                    pointsPerReal: Number(event.target.value || 0)
                  }))
                }
                placeholder="Pontos por real"
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="number"
                step="0.1"
                value={programForm.cashbackPercentage}
                onChange={(event) =>
                  setProgramForm((current) => ({
                    ...current,
                    cashbackPercentage: Number(event.target.value || 0)
                  }))
                }
                placeholder="% cashback"
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <input
              type="number"
              min={1}
              value={programForm.expirationDays}
              onChange={(event) =>
                setProgramForm((current) => ({
                  ...current,
                  expirationDays: Number(event.target.value || 1)
                }))
              }
              placeholder="Dias para expirar"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />

            <button
              type="submit"
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
              disabled={updateProgramMutation.isPending}
            >
              {updateProgramMutation.isPending ? "Salvando..." : "Salvar programa"}
            </button>
          </form>
        </Card>

        <Card title="Resgatar Pontos / Cashback">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              redeemMutation.mutate({
                clientId: redeemForm.clientId,
                appointmentId: redeemForm.appointmentId || undefined,
                mode: redeemForm.mode,
                amount: redeemForm.amount
              });
            }}
          >
            <input
              value={redeemForm.clientId}
              onChange={(event) =>
                setRedeemForm((current) => ({ ...current, clientId: event.target.value }))
              }
              placeholder="Client ID"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={redeemForm.appointmentId}
              onChange={(event) =>
                setRedeemForm((current) => ({ ...current, appointmentId: event.target.value }))
              }
              placeholder="Appointment ID (opcional)"
              className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={redeemForm.mode}
                onChange={(event) =>
                  setRedeemForm((current) => ({
                    ...current,
                    mode: event.target.value as "POINTS" | "CASHBACK"
                  }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              >
                <option value="CASHBACK">Cashback</option>
                <option value="POINTS">Pontos</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={redeemForm.amount}
                onChange={(event) =>
                  setRedeemForm((current) => ({
                    ...current,
                    amount: Number(event.target.value || 0)
                  }))
                }
                className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl border border-gold/60 px-4 py-2 text-sm font-semibold text-gold"
              disabled={redeemMutation.isPending}
            >
              {redeemMutation.isPending ? "Aplicando..." : "Aplicar resgate"}
            </button>
          </form>
        </Card>
      </div>

      <Card title="Top 10 Clientes">
        <div className="space-y-2">
          {retentionQuery.data?.topClients.map((client, index) => (
            <div key={client.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs">
              <p className="text-slate-200">
                {index + 1}. {client.name}
                {client.vip ? (
                  <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                    VIP
                  </span>
                ) : null}
              </p>
              <p className="font-semibold text-slate-100">{formatCurrency(client.totalSpent)}</p>
            </div>
          ))}
          {!retentionQuery.data?.topClients.length ? (
            <p className="text-xs text-slate-400">Sem clientes com historico suficiente.</p>
          ) : null}
        </div>
      </Card>

      <Card title="Automacao (Preparacao)">
        <p className="text-sm text-slate-300">
          Campanhas automaticas (WhatsApp) estao preparadas para ativacao futura.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => previewMutation.mutate()}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-100"
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? "Gerando..." : "Preview campanha inativos"}
          </button>
          {campaignPreviewCount !== null ? (
            <span className="text-xs text-slate-400">{campaignPreviewCount} clientes no publico</span>
          ) : null}
        </div>
      </Card>

      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
    </div>
  );
};

