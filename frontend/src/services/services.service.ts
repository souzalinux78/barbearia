import { api } from "./api";

export type ServiceItem = {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  active: boolean;
};

export type CreateServicePayload = {
  name: string;
  description?: string;
  durationMin: number;
  price: number;
  active?: boolean;
};

export const getServices = async (): Promise<ServiceItem[]> => {
  const { data } = await api.get<ServiceItem[]>("/services");
  return data;
};

export const createService = async (payload: CreateServicePayload): Promise<ServiceItem> => {
  const { data } = await api.post<ServiceItem>("/services", payload);
  return data;
};
