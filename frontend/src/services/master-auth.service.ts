import { masterApi } from "./master-api";

export type MasterLoginResponse = {
  admin: {
    id: string;
    email: string;
    role: "SUPER_ADMIN";
  };
  accessToken: string;
};

export const masterLoginRequest = async (payload: { email: string; password: string }) => {
  const { data } = await masterApi.post<MasterLoginResponse>("/admin/login", payload);
  return data;
};

