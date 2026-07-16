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
