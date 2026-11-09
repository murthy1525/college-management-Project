import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../lib/api";

export interface AuthUser {
  userId: number;
  publicId: string;
  email: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.data))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setToken(res.data.data.accessToken);
    setUser({ ...res.data.data.user, userId: res.data.data.user.id });
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  function hasRole(...roles: string[]) {
    return !!user && roles.some((r) => user.roles.includes(r));
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
