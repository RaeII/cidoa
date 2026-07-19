import type { User } from "../user/user.types";

/**
 * Credenciais de login. `login` aceita username OU email —
 * o backend resolve o identificador.
 */
export interface LoginInput {
  login: string;
  password: string;
}

export interface LoginResponse {
  data: User;
  /** TTL da sessão em segundos (o token em si fica no cookie httpOnly). */
  expiresIn: number;
}

// ─── Passwordless (código por e-mail) ───────────────────────────

/** Body de request-code (login e cadastro): só o e-mail. */
export interface RequestCodeInput {
  email: string;
}

/** Desafio criado pelo request-code — código de 6 dígitos enviado por e-mail. */
export interface AuthChallenge {
  challengeId: string;
  /** ISO — quando o desafio expira. */
  expiresAt: string;
  /** ISO — quando um novo código pode ser reenviado (cooldown). */
  resendAvailableAt: string;
  /** Só em dev (AUTH_DEBUG_CODE): código em texto p/ preencher no front. NUNCA em produção. */
  debugCode?: string;
}

/** Body de verify-code: id do desafio + código de 6 dígitos. */
export interface VerifyCodeInput {
  challengeId: string;
  code: string;
}
