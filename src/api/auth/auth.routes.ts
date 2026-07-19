import { http } from "../http";
import type {
  AuthChallenge,
  LoginInput,
  LoginResponse,
  RequestCodeInput,
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

export async function requestLoginCode(input: RequestCodeInput) {
  const { data } = await http.post<AuthChallenge>("/auth/login/request-code", input);
  return data;
}

export async function verifyLoginCode(input: VerifyCodeInput) {
  const { data } = await http.post<LoginResponse>("/auth/login/verify-code", input);
  return data;
}

export async function requestRegisterCode(input: RequestCodeInput) {
  const { data } = await http.post<AuthChallenge>("/auth/register/request-code", input);
  return data;
}

export async function verifyRegisterCode(input: VerifyCodeInput) {
  const { data } = await http.post<LoginResponse>("/auth/register/verify-code", input);
  return data;
}
