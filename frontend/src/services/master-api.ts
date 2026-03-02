import axios from "axios";
import { useMasterAuthStore } from "../store/master-auth.store";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const masterApi = axios.create({
  baseURL,
  timeout: 15000
});

masterApi.interceptors.request.use((config) => {
  const { accessToken } = useMasterAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

masterApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useMasterAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);

