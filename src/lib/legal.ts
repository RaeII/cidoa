/**
 * Termos de Uso + Política de Privacidade: versão única para os dois.
 * O aceite acontece somente no cadastro; entrar não exige novo aceite.
 * O backend guarda a versão aceita em `user.terms_version` (migration 0021).
 */

/**
 * Edição do texto: `prelaunch` (branch beta: tudo simulado, sem pagamento) ou
 * `launch` (branch main: Pix via Woovi direto para a ONG). Única linha que muda
 * entre as branches — merge main → beta mantém a da beta.
 */
export const LEGAL_EDITION = "prelaunch" as "prelaunch" | "launch";
export const IS_PRELAUNCH = LEGAL_EDITION === "prelaunch";

export const LEGAL_DATE = "2026-10-16";
export const LEGAL_UPDATED_AT = "16 de outubro de 2026";
/** Versão aceita no cadastro (vai ao back), incluindo a edição mostrada. */
export const LEGAL_VERSION = IS_PRELAUNCH ? `${LEGAL_DATE}-beta` : LEGAL_DATE;

/** Controlador dos dados (LGPD art. 5 VI e art. 9 III). Pessoa física: sem documento na página. */
export const LEGAL_CONTROLLER = "Israel Zeferino";
export const LEGAL_EMAIL = "contato@cidoe.com.br";

export const TERMS_PATH = "/termos";
export const PRIVACY_PATH = "/privacidade";
