// node scripts/check-consent.mjs — sem servidor ou navegador.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
async function loadComponent(path, storage) {
  const bundle = await build({
    entryPoints: [path], bundle: true, format: "cjs", platform: "node",
    packages: "external", jsx: "automatic", write: false,
  });
  const module = { exports: {} };
  let state;
  new Function("require", "module", "exports", "localStorage", bundle.outputFiles[0].text)(
    (name) => name === "react" ? {
      ...React,
      useState(initial) {
        if (state === undefined) state = typeof initial === "function" ? initial() : initial;
        return [state, (next) => { state = next; }];
      },
    } : require(name),
    module, module.exports, storage,
  );
  return module.exports;
}

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
const { CookieNotice } = await loadComponent("src/components/CookieNotice.tsx", storage);
const notice = CookieNotice();
const html = renderToStaticMarkup(notice);
assert.match(html, /aria-label="Cookies"/);
assert.match(html, /href="\/privacidade#cookies" target="_blank"/);
assert.doesNotMatch(html, /role="dialog"|aria-modal/, "Aviso não bloqueia a navegação");
const dismiss = (tree) => React.Children.toArray(tree.props.children).find((child) => child.props.onClick).props.onClick();
dismiss(notice);
assert.equal(CookieNotice(), null, "Fecha na visita atual");
const returning = await loadComponent("src/components/CookieNotice.tsx", storage);
assert.equal(returning.CookieNotice(), null, "Não repete após recarregar");
values.set("cidoa:cookie-notice", "invalid");
const invalid = await loadComponent("src/components/CookieNotice.tsx", storage);
assert.notEqual(invalid.CookieNotice(), null, "Valor desconhecido não conta como confirmação");

const blockedStorage = {
  getItem() { throw new Error("Storage bloqueado"); },
  setItem() { throw new Error("Storage bloqueado"); },
};
const blocked = await loadComponent("src/components/CookieNotice.tsx", blockedStorage);
dismiss(blocked.CookieNotice());
assert.equal(blocked.CookieNotice(), null, "Storage bloqueado não impede fechar");

const { TermsConsent } = await loadComponent("src/components/TermsConsent.tsx");
let accepted = false;
const consent = TermsConsent({ id: "terms", checked: false, onChange: (value) => { accepted = value; } });
const consentHtml = renderToStaticMarkup(consent);
assert.match(consentHtml, /type="checkbox" required=""/);
assert.doesNotMatch(consentHtml, /checked=""|18 anos/);
assert.match(consentHtml, /href="\/termos" target="_blank"/);
assert.match(consentHtml, /href="\/privacidade" target="_blank"/);
consent.props.children[0].props.onChange({ target: { checked: true } });
assert.equal(accepted, true, "Aceite exige ação explícita");

console.log("Consentimentos: caixa do cadastro, links, aviso não bloqueante, persistência e storage bloqueado OK.");
