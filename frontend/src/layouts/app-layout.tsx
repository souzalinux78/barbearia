import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/navigation/sidebar";
import { BottomNav } from "../components/navigation/bottom-nav";
import { getBillingStatus } from "../services/billing.service";
import { useAuthStore } from "../store/auth.store";
import {
  requestPushPermissionAndSubscribe,
  syncPushSubscription
} from "../services/push.service";

export const AppLayout = () => {
  const location = useLocation();
  const tenant = useAuthStore((state) => state.tenant);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pushBannerVisible, setPushBannerVisible] = useState(false);
  const [pushFeedback, setPushFeedback] = useState("");
  const [bookingLinkFeedback, setBookingLinkFeedback] = useState("");

  const billingQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus
  });

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem("push-banner-dismissed") === "1";
    const shouldShow = "Notification" in window && Notification.permission === "default" && !dismissed;
    setPushBannerVisible(shouldShow);

    if ("Notification" in window && Notification.permission === "granted") {
      syncPushSubscription().catch(() => null);
    }
  }, []);

  const enablePush = async () => {
    const result = await requestPushPermissionAndSubscribe();
    if (!result.supported) {
      setPushFeedback("Push notification nao suportado neste navegador.");
      return;
    }
    if (!result.granted) {
      setPushFeedback("Permissao de notificacao negada.");
      return;
    }
    setPushFeedback("Notificacoes ativadas com sucesso.");
    setPushBannerVisible(false);
    localStorage.setItem("push-banner-dismissed", "1");
  };

  const billing = billingQuery.data;
  const showPastDueBanner =
    billing?.subscription.status === "PAST_DUE" || billing?.subscription.status === "INCOMPLETE";
  const billingBannerText =
    billing?.subscription.status === "INCOMPLETE"
      ? "Cobranca pendente. Conclua o pagamento para liberar o acesso completo."
      : "Assinatura em atraso. Regularize para evitar bloqueio completo.";
  const showRenewalWarning = billing?.warning3Days;
  const isBillingRoute = location.pathname.startsWith("/billing");
  const showBlockingModal = Boolean(billing?.blocked && !isBillingRoute);
  const showOfflineBanner = isOffline;
  const showPushBanner = pushBannerVisible && !showBlockingModal;
  const bookingUrl =
    tenant?.slug && typeof window !== "undefined"
      ? `${window.location.origin}/booking/${tenant.slug}`
      : "";

  const copyBookingLink = async () => {
    if (!bookingUrl) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookingUrl);
      } else {
        const input = document.createElement("textarea");
        input.value = bookingUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setBookingLinkFeedback("Link copiado para area de transferencia.");
      window.setTimeout(() => setBookingLinkFeedback(""), 2200);
    } catch {
      setBookingLinkFeedback("Nao foi possivel copiar automaticamente.");
      window.setTimeout(() => setBookingLinkFeedback(""), 2200);
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />
      <div className="flex w-full flex-col">
        {showPastDueBanner ? (
          <div className="sticky top-0 z-40 border-b border-rose-400/25 bg-rose-500/10 px-4 py-2 text-xs text-rose-200 md:px-8">
            {billingBannerText}
            <Link to="/billing/upgrade" className="ml-2 font-semibold underline">
              Resolver agora
            </Link>
          </div>
        ) : null}

        {showRenewalWarning && !showPastDueBanner ? (
          <div className="sticky top-0 z-40 border-b border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs text-amber-100 md:px-8">
            Sua assinatura vence em ate 3 dias. Atualize sua forma de pagamento.
          </div>
        ) : null}

        {showOfflineBanner ? (
          <div className="sticky top-0 z-40 border-b border-sky-300/25 bg-sky-400/10 px-4 py-2 text-xs text-sky-100 md:px-8">
            Voce esta offline. Apenas dados em cache estao disponiveis.
          </div>
        ) : null}

        {showPushBanner ? (
          <div className="sticky top-0 z-40 border-b border-gold/30 bg-gold/10 px-4 py-2 text-xs text-slate-100 md:px-8">
            Ative push notifications para receber lembretes e eventos da barbearia.
            <button onClick={enablePush} className="ml-2 rounded bg-gold px-2 py-1 font-semibold text-charcoal">
              Ativar
            </button>
            <button
              onClick={() => {
                setPushBannerVisible(false);
                localStorage.setItem("push-banner-dismissed", "1");
              }}
              className="ml-2 underline"
            >
              Agora nao
            </button>
          </div>
        ) : null}

        <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8 md:pt-8">
          {tenant?.slug ? (
            <div className="mb-4 rounded-2xl border border-gold/25 bg-gold/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">Link publico de agendamento</p>
              <p className="mt-1 break-all text-xs text-slate-200">{bookingUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyBookingLink}
                  className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-charcoal"
                >
                  Copiar link
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-100"
                >
                  Abrir pagina publica
                </a>
                <Link
                  to="/settings"
                  className="rounded-lg border border-gold/40 px-3 py-2 text-xs font-semibold text-gold"
                >
                  Configurar PIX e horarios
                </Link>
              </div>
              {bookingLinkFeedback ? <p className="mt-2 text-xs text-slate-200">{bookingLinkFeedback}</p> : null}
            </div>
          ) : null}

          <div key={location.pathname} className="route-fade">
            <Outlet />
          </div>
          {pushFeedback ? <p className="mt-4 text-xs text-slate-400">{pushFeedback}</p> : null}
        </main>
      </div>

      {showBlockingModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-charcoal/90 px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-graphite p-5">
            <h2 className="text-lg font-bold text-slate-100">Acesso bloqueado por assinatura</h2>
            <p className="mt-2 text-sm text-slate-300">
              Regularize o billing para voltar a usar agenda, financeiro e operacoes principais.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                to="/billing/upgrade"
                className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
              >
                Fazer upgrade
              </Link>
              <Link
                to="/billing/subscription"
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
              >
                Ver assinatura
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
};
