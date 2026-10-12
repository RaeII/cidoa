// node scripts/check-donation-info.mjs — dados e acessos da seção, sem servidor/navegador.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const bundle = await build({
  entryPoints: ["src/components/html/DonationInfoSection.tsx"],
  bundle: true, format: "cjs", platform: "node", packages: "external", jsx: "automatic", write: false,
});
let pagination;
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  (name) => name === "react" ? {
    ...React,
    useMemo: (calculate) => calculate(),
    useState: (initial) => [pagination ?? initial, (next) => { pagination = next; }],
  } : require(name), module, module.exports,
);
const { DonationInfoSection } = module.exports;
function find(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node.props, node.type) ? [node.props] : []), ...find(node.props.children, predicate)];
}
let opened, filter, retried = false;
const donations = [
  { id: 1, value: 0.1, cityId: 10, ongId: 20, ongIds: [20] },
  { id: 2, value: 0.2, cityId: 10, ongId: 20, ongIds: [20, 30] },
];
const props = {
  donations,
  cities: [{ id: 10, name: "São Paulo", uf: "SP" }],
  ongs: [{ id: 20, name: "Patas" }, { id: 30, name: "Abrigo" }],
  filter: {}, loadState: { status: "ready", count: 2 },
  onFilterChange: (next) => { filter = next; },
  onOpenDonation: (id) => { opened = id; },
  onRetry: () => { retried = true; },
};
const tree = DonationInfoSection(props);
const html = renderToStaticMarkup(tree);
assert.match(html, /R\$.*0,30/, "Soma em centavos, sem arredondar valores ilustrativos");
assert.match(html, /São Paulo · SP/);
assert.match(html, /Patas, Abrigo/, "Exibe todas as ONGs do edifício");
assert.match(html, /ONGs apoiadas<\/dt><dd[^>]*>2<\/dd>/);
assert.match(html, />2<\/span> edifícios apoiando/, "Não conta contribuição multiongs como dois edifícios");
assert.deepEqual(donations.map((donation) => donation.id), [1, 2], "Ordenar não altera dados da cena");
const access = find(tree, (item) => item["aria-label"]?.startsWith("Ver informações do edifício"));
assert.equal(access.length, 2);
access[0].onClick();
assert.equal(opened, 2, "Maior valor primeiro; acesso repassa id real ao editor");
find(tree, (item) => item["aria-label"] === "Ver contribuições para Abrigo")[0].onClick();
assert.equal(filter.ongId, 30);
const filtered = DonationInfoSection({ ...props, filter: { cityId: 10, ongId: 30 } });
find(filtered, (item) => item["aria-label"] === "Ver contribuições para Abrigo")[0].onClick();
assert.equal(filter.cityId, 10, "Alternar ONG preserva filtros geográficos");
assert.equal(filter.ongId, undefined);
assert.match(renderToStaticMarkup(filtered), /Total neste recorte/);

const many = Array.from({ length: 11 }, (_, id) => ({ ...donations[0], id: id + 1, value: id + 1 }));
const pagedProps = { ...props, donations: many };
let paged = DonationInfoSection(pagedProps);
assert.equal(find(paged, (item) => item["aria-label"]?.startsWith("Ver informações do edifício")).length, 10);
find(paged, (_, type) => type.name === "PaginationNext")[0].onClick();
paged = DonationInfoSection(pagedProps);
assert.equal(find(paged, (item) => item["aria-label"]?.startsWith("Ver informações do edifício")).length, 1);
assert.equal(find(paged, (_, type) => type.name === "PaginationNext")[0].disabled, true);
assert.equal(find(DonationInfoSection(props), (item) => item["aria-label"]?.startsWith("Ver informações do edifício")).length, 2, "Novo recorte volta à primeira página");
assert.equal(find(DonationInfoSection(pagedProps), (item) => item["aria-label"]?.startsWith("Ver informações do edifício")).length, 10, "Limpar filtro também volta à primeira página");
assert.match(renderToStaticMarkup(DonationInfoSection({ ...props, donations: [] })), /Nenhuma contribuição ainda/);
assert.match(renderToStaticMarkup(DonationInfoSection({ ...props, donations: [], filter: { ongId: 30 } })), /Nenhum edifício encontrado/);
assert.match(renderToStaticMarkup(DonationInfoSection({ ...props, loadState: { status: "loading" } })), /role="status"/);
const failed = DonationInfoSection({ ...props, loadState: { status: "error", message: "Falha" } });
assert.match(renderToStaticMarkup(failed), /role="alert"/);
find(failed, (item) => item.onClick === props.onRetry)[0].onClick();
assert.equal(retried, true);

// Mesmo acesso da cena, inclusive quando o teto esconde o edifício da lista.
const source = await readFile(new URL("../src/components/CitySceneEditor.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("CitySceneEditor.tsx", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const editor = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "CitySceneEditor");
const accessDeclaration = editor.body.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => item.name.getText(ast) === "handleOpenDonation"));
const city = {
  visibleDonations: donations, donationsApplied: true, pendingFocusRef: { current: null },
  opened: null, filter: { cityId: 10 }, limit: 1,
  handleBuildingClick(id) { city.opened = id; },
  setFilter(next) { city.filter = next; },
  setVisibleLimit(next) { city.limit = next; },
};
const accessCode = ts.transpileModule(`${accessDeclaration.getText(ast)}\nglobalThis.openDonation = handleOpenDonation;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(accessCode, city);
city.openDonation(2);
assert.equal(city.opened, 2);
assert.equal(city.filter.cityId, 10, "Edifício visível mantém filtro da cena");
city.visibleDonations = [];
city.openDonation(1);
assert.equal(Object.keys(city.filter).length, 0);
assert.equal(city.limit, null, "Lista pode revelar edifício fora do teto");
assert.equal(city.pendingFocusRef.current, 1, "Rebuild conserva o foco pedido");
let section;
function findSection(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "DonationInfoSection") section = node;
  ts.forEachChild(node, findSection);
}
findSection(editor);
const attributes = section.attributes.properties;
assert.equal(attributes.find((item) => item.name?.getText(ast) === "onFilterChange").initializer.expression.getText(ast), "setFilter");
const openSection = attributes.find((item) => item.name?.getText(ast) === "onOpenDonation").initializer.expression;
let scrollTop;
vm.runInNewContext(`(${openSection.getText(ast)})(2)`, {
  scrollRef: { current: { scrollTo: ({ top }) => { scrollTop = top; } } },
  handleOpenDonation: (id) => { opened = id; },
});
assert.equal(scrollTop, 0, "Ver na cidade retorna ao canvas");
assert.equal(opened, 2);
console.log("Seção de ONGs: totais, beneficiárias, filtros, paginação, estados e acesso ao edifício OK.");
