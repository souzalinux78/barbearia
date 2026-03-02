import { Component, ErrorInfo, ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Erro inesperado na interface."
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("UI crash captured by AppErrorBoundary", {
      error,
      stack: errorInfo.componentStack
    });
  }

  private reloadPage = () => {
    window.location.reload();
  };

  private goToMasterDashboard = () => {
    window.location.assign("/master");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
        <div className="w-full max-w-lg rounded-2xl border border-rose-400/30 bg-graphite p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">Erro de interface</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">A tela falhou ao carregar</h1>
          <p className="mt-2 text-sm text-slate-300">
            O sistema interceptou o erro para evitar tela branca completa.
          </p>
          <p className="mt-3 rounded-lg border border-white/10 bg-charcoal/70 px-3 py-2 text-xs text-slate-300">
            {this.state.message}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={this.reloadPage}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-charcoal"
            >
              Recarregar
            </button>
            <button
              onClick={this.goToMasterDashboard}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100"
            >
              Ir para /master
            </button>
          </div>
        </div>
      </div>
    );
  }
}

