/**
 * Termos de Uso + Política de Privacidade: versão única para os dois.
 * Mudou algo relevante no texto → nova data aqui → toda conta aceita de novo
 * (`TermsDialog`). Correção de digitação não precisa de versão nova.
 * O backend guarda a versão aceita em `user.terms_version` (migration 0021).
 */

/**
 * Edição do texto: `prelaunch` (branch beta: tudo simulado, sem pagamento) ou
 * `launch` (branch main: Pix via Woovi direto para a ONG). Única linha que muda
 * entre as branches — merge main → beta mantém a da beta.
 */
export const LEGAL_EDITION = "launch" as "prelaunch" | "launch";
export const IS_PRELAUNCH = LEGAL_EDITION === "prelaunch";

export const LEGAL_DATE = "2026-10-15";
export const LEGAL_UPDATED_AT = "15 de outubro de 2026";
/** Versão aceita (vai ao back). Edição faz parte dela: trocar beta → main pede reaceite. */
export const LEGAL_VERSION = IS_PRELAUNCH ? `${LEGAL_DATE}-beta` : LEGAL_DATE;

/** Controlador dos dados (LGPD art. 5 VI e art. 9 III). Pessoa física: sem documento na página. */
export const LEGAL_CONTROLLER = "Israel Zeferino";
export const LEGAL_EMAIL = "contato@cidoa.com.br";

export const TERMS_PATH = "/termos";
export const PRIVACY_PATH = "/privacidade";
