import { api } from "./api";

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export const getClients = async (): Promise<Client[]> => {
  const { data } = await api.get<Client[]>("/clients");
  return data;
};
