import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import {
  getWhatsAppStatus,
  saveWhatsAppConfig,
  sendWhatsAppTest,
  WhatsAppProvider
} from "../../services/automation.service";
import { AutomationNav } from "./AutomationNav";

const resolveWebhookUrl = () => {
  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
  const normalized = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  return `${normalized}/whatsapp/webhook`;
};

const toApiErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  if (axiosError?.response?.data?.message) {
    return axiosError.response.data.message;
  }
  return "Falha ao processar requisicao.";
};

export const WhatsAppConfigPage = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({
    provider: "EVOLUTION" as WhatsAppProvider,
    apiUrl: "",
    apiKey: "",
    phoneNumber: "",
    active: true
  });
  const [testForm, setTestForm] = useState({
    clientId: "",
    phoneNumber: "",
    message: "Teste de conexao WhatsApp - Barbearia Premium"
  });
  const webhookUrl = resolveWebhookUrl();

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: getWhatsAppStatus
  });

  useEffect(() => {
    if (!statusQuery.data?.config) {
      return;
    }
    setForm((current) => ({
      ...current,
      provider: statusQuery.data!.config!.provider,
      apiUrl: statusQuery.data!.config!.apiUrl,
      phoneNumber: statusQuery.data!.config!.phoneNumber,
      active: statusQuery.data!.config!.active
    }));
  }, [statusQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveWhatsAppConfig,
    onSuccess: () => {
      setFeedback("Configuracao WhatsApp salva.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (error) => {
      setFeedback(toApiErrorMessage(error));
    }
  });

  const testMutation = useMutation({
    mutationFn: sendWhatsAppTest,
    onSuccess: () => {
      setFeedback("Mensagem de teste enviada.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (error) => {
      setFeedback(toApiErrorMessage(error));
    }
  });

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setFeedback("URL do webhook copiada.");
    } catch {
      setFeedback("Nao foi possivel copiar automaticamente.");
    }
  };

  if (statusQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">WhatsApp API</h1>
        <p className="text-sm text-slate-400">Conecte provider oficial ou Evolution API por tenant.</p>
      </header>
      <AutomationNav />

      <Card title="Webhook de Entrada">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">URL do webhook</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={webhookUrl}
                className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
              />
              <button
                onClick={copyWebhookUrl}
                type="button"
                className="rounded-xl border border-gold/60 px-3 py-2 text-sm font-semibold text-gold"
              >
                Copiar
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Header obrigatorio: <code>x-whatsapp-signature</code> (HMAC SHA256 do body bruto).
          </p>
          <p className="text-xs text-slate-400">
            Segredo da assinatura: o mesmo valor de <strong>API Key</strong> salvo abaixo.
          </p>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusQuery.data?.connected
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-rose-500/15 text-rose-300"
            }`}
          >
            {statusQuery.data?.connected ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
          </span>
          <p className="text-xs text-slate-400">Fila pendente: {statusQuery.data?.queueSize ?? 0}</p>
        </div>
      </Card>

      <Card title="Configurar Gateway">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate(form);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  provider: event.target.value as WhatsAppProvider
                }))
              }
              className="rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="EVOLUTION">Evolution API</option>
              <option value="OFFICIAL">WhatsApp Official</option>
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked
                  }))
                }
              />
              Gateway ativo
            </label>
          </div>

          <input
            value={form.apiUrl}
            onChange={(event) => setForm((current) => ({ ...current, apiUrl: event.target.value }))}
            placeholder="Ex: https://host/api/message/sendText/souza"
            className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="API Key"
            className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={form.phoneNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                phoneNumber: event.target.value
              }))
            }
            placeholder="Numero WhatsApp da barbearia"
            className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar configuracao"}
          </button>
        </form>
      </Card>

      <Card title="Teste de Envio">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            testMutation.mutate({
              clientId: testForm.clientId || undefined,
              phoneNumber: testForm.phoneNumber || undefined,
              message: testForm.message
            });
          }}
        >
          <input
            value={testForm.clientId}
            onChange={(event) =>
              setTestForm((current) => ({
                ...current,
                clientId: event.target.value
              }))
            }
            placeholder="Client ID (opcional)"
            className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={testForm.phoneNumber}
            onChange={(event) =>
              setTestForm((current) => ({
                ...current,
                phoneNumber: event.target.value
              }))
            }
            placeholder="Telefone (se nao usar Client ID)"
            className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />
          <textarea
            value={testForm.message}
            onChange={(event) =>
              setTestForm((current) => ({
                ...current,
                message: event.target.value
              }))
            }
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-charcoal/70 px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={testMutation.isPending}
            className="rounded-xl border border-gold/60 px-4 py-2 text-sm font-semibold text-gold"
          >
            {testMutation.isPending ? "Enviando..." : "Enviar teste"}
          </button>
        </form>
      </Card>

      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
    </div>
  );
};
