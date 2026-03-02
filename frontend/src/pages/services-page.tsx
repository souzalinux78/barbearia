import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { createService, getServices } from "../services/services.service";

export const ServicesPage = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: getServices
  });

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: async () => {
      setName("");
      setDescription("");
      setDurationMin("30");
      setPrice("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (mutationError) => {
      if (isAxiosError(mutationError) && typeof mutationError.response?.data?.message === "string") {
        setError(mutationError.response.data.message);
        return;
      }
      setError("Nao foi possivel cadastrar servico.");
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    createMutation.mutate({
      name,
      description: description || undefined,
      durationMin: Number(durationMin),
      price: Number(price)
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Servicos</h1>
        <p className="text-sm text-slate-400">Catalogo e precificacao dos servicos.</p>
      </header>

      <Card title="Novo servico">
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
            Duracao (min)
            <input
              required
              type="number"
              min={5}
              value={durationMin}
              onChange={(event) => setDurationMin(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400">
            Preco (R$)
            <input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
            Descricao (opcional)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 h-20 w-full rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-slate-100"
            />
          </label>

          {error ? <p className="text-xs text-rose-300 sm:col-span-2">{error}</p> : null}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-charcoal disabled:opacity-60 sm:col-span-2"
          >
            {createMutation.isPending ? "Salvando..." : "Cadastrar servico"}
          </button>
        </form>
      </Card>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-3">
          {data?.map((service) => (
            <Card key={service.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{service.name}</p>
                  <p className="text-xs text-slate-500">{service.durationMin} min</p>
                </div>
                <p className="font-semibold text-gold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    Number(service.price)
                  )}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
