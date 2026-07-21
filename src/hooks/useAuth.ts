import { createContext, useContext } from "react";
import type {
  CompleteRegistrationInput,
  LoginInput,
  VerifyCodeInput,
  VerifyCodeResult,
} from "../api/auth/auth.types";
import type { User } from "../api/user/user.types";
import type { UpdateOwnProfileInput } from "../api/user/user.types";

export interface AuthContextValue {
  /** Usuário logado, ou null sem sessão. */
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Login por senha (admin). Seta o cookie httpOnly e persiste a sessão local. */
  login: (input: LoginInput) => Promise<User>;
  /** Valida o e-mail; abre a sessão existente ou libera cadastro em memória. */
  loginWithCode: (input: VerifyCodeInput) => Promise<VerifyCodeResult>;
  /** Login com Google (GIS): entra ou cadastra a partir do ID token e abre a sessão. */
  loginWithGoogle: (credential: string) => Promise<User>;
  /** Cria a conta após a confirmação do e-mail e abre a sessão. */
  completeRegistration: (input: CompleteRegistrationInput) => Promise<User>;
  /** Atualiza nome e nome de usuário do usuário autenticado. */
  updateProfile: (input: UpdateOwnProfileInput) => Promise<User>;
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
