import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  verifyLoginCode as apiVerifyLoginCode,
  verifyRegisterCode as apiVerifyRegisterCode,
} from "../api/auth/auth.routes";
import type { LoginInput, VerifyCodeInput } from "../api/auth/auth.types";
import { SESSION_EXPIRED_EVENT } from "../api/http";
import type { User } from "../api/user/user.types";
import { AuthContext } from "../hooks/useAuth";

/**
 * O token JWT vive num cookie httpOnly — o JS não consegue lê-lo.
 * O que persiste aqui é só o "espelho" da sessão (usuário + validade),
 * para a UI sobreviver a reload. A autenticação real é sempre o cookie:
 * se ele expirar/for revogado, a API responde 401 e a sessão local cai.
 */
const STORAGE_KEY = "cidoa.admin.session";

interface StoredSession {
  user: User;
  /** epoch ms — espelho do expiresIn retornado no login */
  expiresAt: number;
}

function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session?.user || Date.now() >= session.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session.user;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveSession(user: User, expiresIn: number) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, expiresAt: Date.now() + expiresIn * 1000 }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadSession);

  // Ponto único que abre a sessão local — usado pelo login por senha e pelos
  // fluxos passwordless (mesma resposta {data, expiresIn} do backend).
  const establishSession = useCallback((loggedUser: User, expiresIn: number) => {
    saveSession(loggedUser, expiresIn);
    setUser(loggedUser);
    return loggedUser;
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const { data, expiresIn } = await apiLogin(input);
      return establishSession(data, expiresIn);
    },
    [establishSession],
  );

  const loginWithCode = useCallback(
    async (input: VerifyCodeInput) => {
      const { data, expiresIn } = await apiVerifyLoginCode(input);
      return establishSession(data, expiresIn);
    },
    [establishSession],
  );

  const registerWithCode = useCallback(
    async (input: VerifyCodeInput) => {
      const { data, expiresIn } = await apiVerifyRegisterCode(input);
      return establishSession(data, expiresIn);
    },
    [establishSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Limpa local mesmo se a request falhar — o cookie expira sozinho.
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    }
  }, []);

  // Interceptor do axios detectou 401 → cookie inválido/expirado.
  useEffect(() => {
    const clearSession = () => {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearSession);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.is_admin ?? false,
      login,
      loginWithCode,
      registerWithCode,
      logout,
    }),
    [user, login, loginWithCode, registerWithCode, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
