import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  createMasterTenantBillingCheckout,
  getMasterTenantById,
  getMasterTenants,
  MasterBillingGateway,
  MasterBillingPlanName,
  impersonateMasterTenant,
  updateMasterTenantStatus
} from "../../services/master.service";
import { useAuthStore } from "../../store/auth.store";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const MasterTenantsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setTenantSession = useAuthStore((state) => state.setSession);
  const [filters, setFilters] = useState({
    search: "",
    plan: "" as "" | "FREE" | "PRO" | "PREMIUM",
    status: "" as "" | "ACTIVE" | "SUSPENDED" | "PAST_DUE" | "CANCELED" | "TRIALING"
  });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [billingDraft, setBillingDraft] = useState<{
    planName: MasterBillingPlanName;
    gateway: MasterBillingGateway;
    pixKey: string;
  }>({
    planName: "PRO",
    gateway: "PIX",
    pixKey: ""
  });
  const [billingPixCode, setBillingPixCode] = useState("");

  const tenantsQuery = useQuery({
    queryKey: ["master-tenants", filters],
    queryFn: () =>
      getMasterTenants({
        search: filters.search || undefined,
        plan: filters.plan || undefined,
        status: filters.status || undefined,
        pageSize: 50
      })
  });

  const tenantDetailsQuery = useQuery({
    queryKey: ["master-tenant-details", selectedTenantId],
    queryFn: () => getMasterTenantById(String(selectedTenantId)),
    enabled: Boolean(selectedTenantId)
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      tenantId,
      payload
    }: {
      tenantId: string;
      payload: { status: "ACTIVE" | "SUSPENDED"; reason?: string; planId?: string };
    }) => updateMasterTenantStatus(tenantId, payload),
    onSuccess: () => {
      setFeedback("Tenant atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["master-tenants"] });
      if (selectedTenantId) {
        queryClient.invalidateQueries({ queryKey: ["master-tenant-details", selectedTenantId] });
      }
    }
  });

  const impersonateMutation = useMutation({
    mutationFn: ({ tenantId, targetRoute }: { tenantId: string; targetRoute: string }) =>
      impersonateMasterTenant(tenantId, "suporte").then((data) => ({ ...data, targetRoute })),
    onSuccess: (data) => {
      setTenantSession({
        tenant: data.tenant,
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.accessToken
      });
      navigate(data.targetRoute, { replace: true });
    }
  });

  const quickBillingMutation = useMutation({
    mutationFn: () => {
      if (!selectedTenantId) {
        throw new Error("Selecione um tenant.");
      }
      return createMasterTenantBillingCheckout({
        tenantId: selectedTenantId,
        planName: billingDraft.planName,
        gateway: billingDraft.gateway,
        pixKey: billingDraft.gateway === "PIX" ? billingDraft.pixKey : undefined
      });
    },
    onSuccess: (result) => {
      setBillingPixCode(result.pix?.copyPasteCode ?? "");
      setFeedback("Cobranca configurada com sucesso para o tenant selecionado.");
      queryClient.invalidateQueries({ queryKey: ["master-tenants"] });
      if (selectedTenantId) {
        queryClient.invalidateQueries({ queryKey: ["master-tenant-details", selectedTenantId] });
      }
    },
    onError: () => {
      setFeedback("Falha ao configurar cobranca. Verifique plano, gateway e chave PIX.");
    }
  });

  const planOptions = useMemo(() => tenantsQuery.data?.planOptions ?? [], [tenantsQuery.data]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-sky-100">Gestao Global de Tenants</h1>
        <p className="text-sm text-slate-400">Suspenda, reative, altere plano e acesse via impersonacao.</p>
        <p className="mt-1 text-xs text-slate-500">
          Para configurar PIX/cobranca de uma barbearia, use o botao "Cobranca".
        </p>
      </header>

      <Card title="Filtros">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Buscar por nome, slug ou email"
            className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={filters.plan}
            onChange={(event) =>
              setFilters((current) => ({ ...current, plan: event.target.value as typeof filters.plan }))
            }
            className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Todos os planos</option>
            <option value="FREE">FREE</option>
            <option value="PRO">PRO</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value as typeof filters.status }))
            }
            className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">ATIVO</option>
            <option value="SUSPENDED">SUSPENSO</option>
            <option value="PAST_DUE">INADIMPLENTE</option>
            <option value="CANCELED">CANCELADO</option>
            <option value="TRIALING">TRIAL</option>
          </select>
        </div>
      </Card>

      <Card title="Barbearias cadastradas">
        {tenantsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {tenantsQuery.data?.items.map((tenant) => (
              <div
                key={tenant.id}
                className="rounded-xl border border-white/10 p-3"
                onClick={() => setSelectedTenantId(tenant.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{tenant.name}</p>
                    <p className="text-xs text-slate-400">
                      {tenant.slug} | {tenant.subscription?.planName ?? "Sem plano"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      tenant.status === "ACTIVE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : tenant.status === "SUSPENDED"
                          ? "bg-rose-500/20 text-rose-300"
                          : tenant.status === "PAST_DUE"
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {tenant.status}
                  </span>
                </div>

                <div className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                  <p>Receita mes: {currency.format(tenant.monthlyRevenue)}</p>
                  <p>Usuarios: {tenant.usersCount}</p>
                  <p>Ultimo pagamento: {tenant.lastPaymentAt ? new Date(tenant.lastPaymentAt).toLocaleDateString("pt-BR") : "-"}</p>
                  <p>
                    Regiao: {tenant.unit.city ?? "N/A"} / {tenant.unit.state ?? "N/A"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      updateStatusMutation.mutate({
                        tenantId: tenant.id,
                        payload: {
                          status: tenant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                          reason: "Ajuste manual no painel master"
                        }
                      });
                    }}
                    className="rounded-lg border border-white/20 px-3 py-1 text-xs text-slate-100"
                    disabled={updateStatusMutation.isPending}
                  >
                    {tenant.status === "SUSPENDED" ? "Reativar" : "Suspender"}
                  </button>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      impersonateMutation.mutate({
                        tenantId: tenant.id,
                        targetRoute: "/dashboard"
                      });
                    }}
                    className="rounded-lg bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100"
                    disabled={impersonateMutation.isPending}
                  >
                    Impersonar
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedTenantId(tenant.id);
                      setBillingPixCode("");
                      setBillingDraft((current) => ({
                        ...current,
                        planName:
                          tenant.subscription?.planName === "FREE" ||
                          tenant.subscription?.planName === "PRO" ||
                          tenant.subscription?.planName === "PREMIUM"
                            ? tenant.subscription.planName
                            : "PRO"
                      }));
                    }}
                    className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-semibold text-gold"
                    disabled={quickBillingMutation.isPending}
                  >
                    Cobranca
                  </button>
                </div>
              </div>
            ))}
            {!tenantsQuery.data?.items.length ? (
              <p className="text-xs text-slate-400">Nenhum tenant encontrado com os filtros atuais.</p>
            ) : null}
          </div>
        )}
      </Card>

      {selectedTenantId ? (
        <Card title="Detalhes do tenant selecionado">
          {tenantDetailsQuery.isLoading || !tenantDetailsQuery.data ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-slate-300">
                <p>
                  <span className="font-semibold text-slate-100">{tenantDetailsQuery.data.name}</span> (
                  {tenantDetailsQuery.data.slug})
                </p>
                <p className="text-xs">Status atual: {tenantDetailsQuery.data.status}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {planOptions.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() =>
                      updateStatusMutation.mutate({
                        tenantId: selectedTenantId,
                        payload: {
                          status:
                            tenantDetailsQuery.data?.status === "SUSPENDED" ? "ACTIVE" : "ACTIVE",
                          reason: `Mudanca de plano para ${plan.name}`,
                          planId: plan.id
                        }
                      })
                    }
                    className="rounded-lg border border-sky-500/35 px-3 py-1 text-xs text-sky-100"
                    disabled={updateStatusMutation.isPending}
                  >
                    Mudar para {plan.name}
                  </button>
                ))}
              </div>

              <div id="master-billing-quick" className="rounded-xl border border-gold/20 bg-charcoal/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold">Cobranca rapida</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select
                    value={billingDraft.planName}
                    onChange={(event) =>
                      setBillingDraft((current) => ({
                        ...current,
                        planName: event.target.value as MasterBillingPlanName
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
                  >
                    {planOptions.map((plan) => (
                      <option key={plan.id} value={plan.name}>
                        {plan.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={billingDraft.gateway}
                    onChange={(event) =>
                      setBillingDraft((current) => ({
                        ...current,
                        gateway: event.target.value as MasterBillingGateway
                      }))
                    }
                    className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="PIX">PIX</option>
                    <option value="STRIPE">STRIPE</option>
                  </select>

                  <button
                    onClick={() => {
                      if (billingDraft.gateway === "PIX" && billingDraft.pixKey.trim().length < 8) {
                        setFeedback("Informe uma chave PIX valida para gerar cobranca.");
                        return;
                      }
                      quickBillingMutation.mutate();
                    }}
                    className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-charcoal"
                    disabled={quickBillingMutation.isPending}
                  >
                    {quickBillingMutation.isPending ? "Processando..." : "Gerar cobranca"}
                  </button>
                </div>

                {billingDraft.gateway === "PIX" ? (
                  <label className="mt-2 block text-xs text-slate-400">
                    Chave PIX (telefone/email/cpf/cnpj/aleatoria)
                    <input
                      value={billingDraft.pixKey}
                      onChange={(event) =>
                        setBillingDraft((current) => ({
                          ...current,
                          pixKey: event.target.value
                        }))
                      }
                      placeholder="+5511974605594"
                      className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-gold/50"
                    />
                  </label>
                ) : null}

                {billingPixCode ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-graphite/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">PIX copia e cola</p>
                    <div className="mt-2 flex justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(billingPixCode)}`}
                        alt="QR Code PIX"
                        className="h-44 w-44 rounded-lg border border-white/15 bg-white p-2"
                      />
                    </div>
                    <p className="mt-2 break-all rounded-lg border border-white/15 bg-charcoal p-2 text-xs text-slate-200">
                      {billingPixCode}
                    </p>
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Ultimos logs de status</p>
                <div className="space-y-1">
                  {tenantDetailsQuery.data.statusLogs.slice(0, 5).map((log) => (
                    <p key={log.id} className="text-xs text-slate-300">
                      {new Date(log.createdAt).toLocaleString("pt-BR")} - {log.previousStatus} =&gt; {log.newStatus}
                    </p>
                  ))}
                  {!tenantDetailsQuery.data.statusLogs.length ? (
                    <p className="text-xs text-slate-400">Sem logs de status.</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
    </div>
  );
};
