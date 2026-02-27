import { api } from "./api";

export type ServiceItem = {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  active: boolean;
};

export const getServices = async (): Promise<ServiceItem[]> => {
  const { data } = await api.get<ServiceItem[]>("/services");
  return data;
};
