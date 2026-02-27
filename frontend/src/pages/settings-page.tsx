import { Card } from "../components/ui/card";
import { useAuthStore } from "../store/auth.store";

export const SettingsPage = () => {
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Configuracoes</h1>
      </header>

      <Card title="Sessao atual">
        <p className="text-sm text-slate-300">Tenant: {tenant?.name}</p>
        <p className="text-sm text-slate-300">Usuario: {user?.name}</p>
        <p className="text-sm text-slate-300">Perfil: {user?.role}</p>
      </Card>
    </div>
  );
};
