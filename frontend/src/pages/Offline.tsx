import { Link } from "react-router-dom";

export const OfflinePage = () => (
  <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center space-y-4 text-center">
    <h1 className="text-3xl font-bold text-slate-100">Voce esta offline</h1>
    <p className="text-sm text-slate-400">
      Alguns dados em cache continuam disponiveis. Conecte-se para criar agendamentos, pagamentos e
      alterar assinatura.
    </p>
    <Link to="/dashboard" className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal">
      Tentar novamente
    </Link>
  </div>
);
