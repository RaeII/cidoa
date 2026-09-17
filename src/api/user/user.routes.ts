import { http } from "../http";
import type { UpdateOwnProfileInput, User, UserPage } from "./user.types";

export async function getOwnSession() {
  const { data } = await http.get<{ data: User; expiresIn: number }>("/user/me");
  return data;
}

export async function updateOwnProfile(input: UpdateOwnProfileInput) {
  const { data } = await http.put<{ data: User }>("/user/me", input);
  return data.data;
}

/**
 * Lista usuários ativos (JWT + admin). `search` casa username, nome ou e-mail —
 * é assim que se acha uma conta sem paginar a base toda.
 */
export async function listUsers(
  params: { search?: string; page?: number; limit?: number } = {},
) {
  const { data } = await http.get<UserPage>("/user", {
    // axios omite chave undefined — `search` vazio não vira `?search=`.
    params: { search: params.search || undefined, page: params.page, limit: params.limit },
  });
  return data;
}

/**
 * Liga/desliga o acesso de administrador de um usuário (JWT + admin).
 *
 * O backend consulta a permissão atual no banco em cada requisição.
 */
export async function setUserAdmin(id: number, isAdmin: boolean) {
  const { data } = await http.put<{ data: User }>(`/user/${id}`, { is_admin: isAdmin });
  return data.data;
}
