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

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Aborts (AbortController) passam intactos — quem chamou decide ignorar
    if (axios.isCancel(error)) return Promise.reject(error);
    const status: number = error?.response?.status ?? 0;
    const message: string =
      error?.response?.data?.message ?? error?.message ?? "Erro de rede";
    return Promise.reject(new ApiError(status, message));
  },
);
