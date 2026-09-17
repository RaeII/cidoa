import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  completeRegistration as apiCompleteRegistration,
  verifyLoginCode as apiVerifyLoginCode,
  loginWithGoogle as apiLoginWithGoogle,
} from "../api/auth/auth.routes";
import type {
  CompleteRegistrationInput,
  LoginInput,
  VerifyCodeInput,
} from "../api/auth/auth.types";
import { SESSION_EXPIRED_EVENT } from "../api/http";
import type { User } from "../api/user/user.types";
import type { UpdateOwnProfileInput } from "../api/user/user.types";
import { getOwnSession, updateOwnProfile as apiUpdateOwnProfile } from "../api/user/user.routes";
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

function saveSession(user: User, expiresIn: number) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user, expiresAt: Date.now() + expiresIn * 1000 }),
  );
}

function replaceStoredUser(user: User) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as StoredSession;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, user }));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // localStorage é editável pelo visitante: nunca restaura autorização dele.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const version = ++sessionVersion.current;
      try {
        const { data, expiresIn } = await getOwnSession();
        if (!active || version !== sessionVersion.current) return;
        saveSession(data, expiresIn);
        setUser(data);
      } catch {
        if (!active || version !== sessionVersion.current) return;
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      } finally {
        if (active && version === sessionVersion.current) setIsLoading(false);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Ponto único que abre a sessão local — usado pelo login por senha e pelos
  // fluxos passwordless (mesma resposta {data, expiresIn} do backend).
  const establishSession = useCallback((loggedUser: User, expiresIn: number) => {
    ++sessionVersion.current;
    saveSession(loggedUser, expiresIn);
    setUser(loggedUser);
    setIsLoading(false);
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
      const result = await apiVerifyLoginCode(input);
      if (result.status === "registration_required") return result;

      const user = establishSession(result.data, result.expiresIn);
      return { status: "authenticated" as const, user };
    },
    [establishSession],
  );

  const completeRegistration = useCallback(
    async (input: CompleteRegistrationInput) => {
      const { data, expiresIn } = await apiCompleteRegistration(input);
      return establishSession(data, expiresIn);
    },
    [establishSession],
  );

  const loginWithGoogle = useCallback(
    async (credential: string, referralCode?: string) => {
      const { data, expiresIn } = await apiLoginWithGoogle({ credential, referralCode });
      return establishSession(data, expiresIn);
    },
    [establishSession],
  );

  const updateProfile = useCallback(async (input: UpdateOwnProfileInput) => {
    const version = sessionVersion.current;
    const updated = await apiUpdateOwnProfile(input);
    if (version !== sessionVersion.current) return updated;
    replaceStoredUser(updated);
    setUser(updated);
    return updated;
  }, []);

  const logout = useCallback(async () => {
    ++sessionVersion.current;
    try {
      await apiLogout();
    } finally {
      // Limpa local mesmo se a request falhar — o cookie expira sozinho.
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      ++sessionVersion.current;
      setIsLoading(false);
    }
  }, []);

  // Interceptor do axios detectou 401 → cookie inválido/expirado.
  useEffect(() => {
    const clearSession = () => {
      ++sessionVersion.current;
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearSession);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      isAdmin: user?.is_admin ?? false,
      login,
      loginWithCode,
      loginWithGoogle,
      completeRegistration,
      updateProfile,
      logout,
    }),
    [user, isLoading, login, loginWithCode, loginWithGoogle, completeRegistration, updateProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
