import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getServices } from "../services/services.service";

export const ServicesPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: getServices
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Servicos</h1>
        <p className="text-sm text-slate-400">Catalogo e precificacao dos servicos.</p>
      </header>

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
