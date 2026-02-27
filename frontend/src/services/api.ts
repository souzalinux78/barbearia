import axios from "axios";
import { useAuthStore } from "../store/auth.store";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL,
  timeout: 15000
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState();
    if (!refreshToken) {
      clearSession();
      return null;
    }

    try {
      const response = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
      const newAccessToken = response.data.accessToken as string;
      const newRefreshToken = response.data.refreshToken as string;
      setAccessToken(newAccessToken);
      useAuthStore.setState({ refreshToken: newRefreshToken });
      return newAccessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as { _retry?: boolean; headers?: Record<string, string> };
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      const token = await refreshAccessToken();
      if (token && originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
