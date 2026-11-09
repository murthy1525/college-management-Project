import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

const TOKEN_KEY = "cms_access_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (err.response?.status === 401) return "Your session has expired. Please log in again.";
  }
  return "Something went wrong. Please try again.";
}
