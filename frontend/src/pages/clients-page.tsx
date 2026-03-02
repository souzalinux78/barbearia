import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { createClient, getClients } from "../services/clients.service";

export const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients
  });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: async () => {
      setName("");
      setEmail("");
      setPhone("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => {
      setError("Nao foi possivel cadastrar cliente.");
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    createMutation.mutate({
      name,
      email: email || undefined,
      phone: phone || undefined
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Clientes</h1>
        <p className="text-sm text-slate-400">Cadastro e relacionamento de clientes.</p>
      </header>

      <Card title="Novo cliente">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
            Nome
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            E-mail (opcional)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Telefone (opcional)
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          {error ? <p className="text-xs text-rose-300 sm:col-span-2">{error}</p> : null}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-charcoal disabled:opacity-60 sm:col-span-2"
          >
            {createMutation.isPending ? "Salvando..." : "Cadastrar cliente"}
          </button>
        </form>
      </Card>

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
