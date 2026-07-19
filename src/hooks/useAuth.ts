import { createContext, useContext } from "react";
import type { LoginInput, VerifyCodeInput } from "../api/auth/auth.types";
import type { User } from "../api/user/user.types";

export interface AuthContextValue {
  /** Usuário logado, ou null sem sessão. */
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Login por senha (admin). Seta o cookie httpOnly e persiste a sessão local. */
  login: (input: LoginInput) => Promise<User>;
  /** Passwordless: valida o código de login e abre a sessão. */
  loginWithCode: (input: VerifyCodeInput) => Promise<User>;
  /** Passwordless: valida o código de cadastro, cria a conta e abre a sessão. */
  registerWithCode: (input: VerifyCodeInput) => Promise<User>;
  /** Remove o cookie no backend e limpa a sessão local. */
  logout: () => Promise<void>;
}

// Preenchido pelo <AuthProvider> (src/components/AuthProvider.tsx).
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
