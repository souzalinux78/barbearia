import { api } from "./api";

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export type CreateClientPayload = {
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  notes?: string;
};

export const getClients = async (): Promise<Client[]> => {
  const { data } = await api.get<Client[]>("/clients");
  return data;
};

export const createClient = async (payload: CreateClientPayload): Promise<Client> => {
  const { data } = await api.post<Client>("/clients", payload);
  return data;
};
