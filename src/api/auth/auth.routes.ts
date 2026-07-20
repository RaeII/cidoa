import { http } from "../http";
import type {
  AuthChallenge,
  CompleteRegistrationInput,
  LoginInput,
  LoginResponse,
  RequestLoginCodeInput,
  VerifyLoginCodeResponse,
  VerifyCodeInput,
} from "./auth.types";

// Rotas /auth do backend. O token JWT vive em cookie httpOnly
// (`token_access`) — setado no login, removido no logout. O JS nunca o lê.

export async function login(input: LoginInput) {
  const { data } = await http.post<LoginResponse>("/auth/login", input);
  return data;
}

export async function logout() {
  await http.post("/auth/logout");
}

// Passwordless (código por e-mail). request-code envia o código; verify-code
// valida e seta o mesmo cookie httpOnly do login por senha.

export async function requestLoginCode(input: RequestLoginCodeInput) {
  const { data } = await http.post<AuthChallenge>("/auth/login/request-code", input);
  return data;
}

export async function verifyLoginCode(input: VerifyCodeInput) {
  const { data } = await http.post<VerifyLoginCodeResponse>("/auth/login/verify-code", input);
  return data;
}

export async function completeRegistration(input: CompleteRegistrationInput) {
  const { data } = await http.post<LoginResponse>("/auth/register/complete", input);
  return data;
}
