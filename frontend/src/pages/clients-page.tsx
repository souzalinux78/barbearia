import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getClients } from "../services/clients.service";

export const ClientsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Clientes</h1>
        <p className="text-sm text-slate-400">Cadastro e relacionamento de clientes.</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-3">
          {data?.map((client) => (
            <Card key={client.id}>
              <p className="font-semibold text-slate-100">{client.name}</p>
              <p className="text-sm text-slate-400">{client.email ?? "Sem e-mail"}</p>
              <p className="text-xs text-slate-500">{client.phone ?? "Sem telefone"}</p>
            </Card>
          ))}
          {!data?.length ? <Card>Nenhum cliente encontrado.</Card> : null}
        </div>
      )}
    </div>
  );
};
