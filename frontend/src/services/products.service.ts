import { api } from "./api";

export type Product = {
  id: string;
  name: string;
  stockQuantity: number;
  minStock: number;
  price: string;
};

export const getProducts = async (): Promise<Product[]> => {
  const { data } = await api.get<Product[]>("/products");
  return data;
};
