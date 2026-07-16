import { http } from "../http";
import type { LoginInput, LoginResponse } from "./auth.types";

// Rotas /auth do backend. O token JWT vive em cookie httpOnly
// (`token_access`) — setado no login, removido no logout. O JS nunca o lê.

export async function login(input: LoginInput) {
  const { data } = await http.post<LoginResponse>("/auth/login", input);
  return data;
}

export async function logout() {
  await http.post("/auth/logout");
}
