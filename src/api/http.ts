import axios from "axios";

/** Erro normalizado da API — sempre status numérico (0 = rede) + mensagem legível. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Disparado no `window` quando a API responde 401 fora do login (sessão expirada). */
export const SESSION_EXPIRED_EVENT = "api:session-expired";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  // Envia o cookie httpOnly `token_access` (auth do admin). O JS nunca lê o token.
  withCredentials: true,
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Aborts (AbortController) passam intactos — quem chamou decide ignorar
    if (axios.isCancel(error)) return Promise.reject(error);
    const status: number = error?.response?.status ?? 0;
    const message: string =
      error?.response?.data?.message ?? error?.message ?? "Erro de rede";

    // 401 em qualquer rota exceto o próprio login = sessão inválida/expirada.
    // O AuthProvider escuta este evento e limpa a sessão local.
    if (status === 401 && !error?.config?.url?.includes("/auth/login")) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    return Promise.reject(new ApiError(status, message));
  },
);
