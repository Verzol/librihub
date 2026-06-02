"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "./api";
import type { LoginInput, RegisterInput, User } from "./api/types";

const TOKEN_KEY = "librihub.access_token";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveToken = useCallback((value: string | null) => {
    setToken(value);
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = token ?? localStorage.getItem(TOKEN_KEY);
    if (!activeToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const current = await authApi.me(activeToken);
      setToken(activeToken);
      setUser(current);
    } catch {
      saveToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [saveToken, token]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      refreshUser,
      login: async (input) => {
        const response = await authApi.login(input);
        saveToken(response.access_token);
        const current = await authApi.me(response.access_token);
        setUser(current);
      },
      register: async (input) => {
        const response = await authApi.register(input);
        saveToken(response.access_token);
        setUser(response.user);
      },
      logout: () => {
        saveToken(null);
        setUser(null);
      }
    }),
    [isLoading, refreshUser, saveToken, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
