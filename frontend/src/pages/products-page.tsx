import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { getProducts } from "../services/products.service";

export const ProductsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Produtos e Estoque</h1>
        <p className="text-sm text-slate-400">Controle de itens e estoque minimo.</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-3">
          {data?.map((product) => (
            <Card key={product.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{product.name}</p>
                  <p className="text-xs text-slate-500">Minimo: {product.minStock}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gold">Estoque: {product.stockQuantity}</p>
                  <p className="text-xs text-slate-400">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      Number(product.price)
                    )}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
