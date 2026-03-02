import { api } from "./api";

export type UserRole =
  | "FRANCHISE_OWNER"
  | "UNIT_OWNER"
  | "UNIT_ADMIN"
  | "OWNER"
  | "ADMIN"
  | "BARBER"
  | "RECEPTION";

export type UserItem = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  active: boolean;
  role: {
    name: UserRole;
  };
};

export type CreateUserPayload = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
};

export const getUsers = async (): Promise<UserItem[]> => {
  const { data } = await api.get<UserItem[]>("/users");
  return data;
};

export const createUser = async (payload: CreateUserPayload): Promise<UserItem> => {
  const { data } = await api.post<UserItem>("/users", payload);
  return data;
};
