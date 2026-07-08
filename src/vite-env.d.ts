/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origem da API (ex.: domínio real/CDN em produção). Ausente = "/api" via proxy dev. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
