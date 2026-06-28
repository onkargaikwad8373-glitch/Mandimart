import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "../types";

import { apiFetch } from "../utils/api";

interface AuthContextType {
  token: string | null;
  user: Omit<User, "password"> | null;
  login: (token: string, user: Omit<User, "password">) => void;
  logout: () => void;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mandimate_token"));
  const [user, setUser] = useState<Omit<User, "password"> | null>(() => {
    try {
      const savedUser = localStorage.getItem("mandimate_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-verify token validity on mount
  useEffect(() => {
    const verifySession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem("mandimate_user", JSON.stringify(data.user));
        } else {
          // Token is invalid/expired
          logout();
        }
      } catch (err) {
        console.error("Session verification failed, operating offline/with cached session", err);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [token]);

  const login = (newToken: string, newUser: Omit<User, "password">) => {
    localStorage.setItem("mandimate_token", newToken);
    localStorage.setItem("mandimate_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setError(null);
  };

  const logout = () => {
    localStorage.removeItem("mandimate_token");
    localStorage.removeItem("mandimate_user");
    setToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
