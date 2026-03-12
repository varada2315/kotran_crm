import React, { createContext, useState, useEffect } from "react";
import { User } from "@workspace/api-client-react";
import { getMe } from "@workspace/api-client-react";

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("kotran_token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (error) {
          console.error("Auth verification failed", error);
          logout();
        }
      }
      setIsLoading(false);
    }
    verifyAuth();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("kotran_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("kotran_token");
    localStorage.removeItem("kotran_workspace_id");
    setToken(null);
    setUser(null);
    window.location.href = import.meta.env.BASE_URL + "login";
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
