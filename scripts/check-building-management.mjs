// node scripts/check-building-management.mjs — administração e foco, sem servidor/navegador.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";
import ts from "typescript";

const dialogSource = await readFile(new URL("../src/components/html/BuildingManageDialog.tsx", import.meta.url), "utf8");
const dialogAst = ts.createSourceFile("BuildingManageDialog.tsx", dialogSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const dialog = dialogAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "BuildingManageDialog");
const tabState = dialog.body.statements.filter(ts.isVariableStatement)
  .flatMap((node) => [...node.declarationList.declarations])
  .find((node) => ts.isArrayBindingPattern(node.name) && node.name.elements[0].name.getText(dialogAst) === "buildingTab");
assert.equal(tabState.initializer.arguments[0].text, "information", "Informações precisa ser a aba inicial");
const leave = dialog.body.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "leaveProfile");
const state = {
  profileEdit: { dirty: false, busy: false }, appearanceBusy: false, confirmExit: false, closed: false,
  get editBusy() { return state.profileEdit.busy || state.appearanceBusy; },
  setConfirmExit(value) { state.confirmExit = value; },
  onClose() { state.closed = true; },
};
vm.runInNewContext(ts.transpileModule(leave.getText(dialogAst), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, state);
state.leaveProfile();
assert.equal(state.closed, true, "Sem alterações pode voltar à cidade");
state.closed = false;
state.appearanceBusy = true;
state.leaveProfile();
assert.equal(state.closed, false, "Ler holograma bloqueia saída");
state.appearanceBusy = false;
state.profileEdit = { dirty: true, busy: true };
state.leaveProfile();
assert.equal(state.closed, false, "Salvar/processar imagem bloqueia saída");
assert.equal(state.confirmExit, false);
state.profileEdit.busy = false;
state.leaveProfile();
assert.equal(state.closed, false, "Edições pendentes exigem confirmação");
assert.equal(state.confirmExit, true);

// Renderiza a seção real do edifício: informações abertas, perfil preservado na outra aba
// e envio pelo rodapé externo. A prévia 3D fica fora deste check, sem GPU/navegador.
let buildingSection;
function findSection(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(dialogAst) === "Tabs.Root") buildingSection = node;
  ts.forEachChild(node, findSection);
}
findSection(dialog);
assert.ok(buildingSection, "Informações e aparência precisam de navegação própria");
const constant = (name) => dialogAst.statements
  .filter(ts.isVariableStatement)
  .flatMap((node) => [...node.declarationList.declarations])
  .find((node) => node.name.getText(dialogAst) === name).initializer.text;
const menuSource = await readFile(new URL("../src/components/GameMenu.tsx", import.meta.url), "utf8");
const menuAst = ts.createSourceFile("GameMenu.tsx", menuSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
let donationSection;
function findDonations(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(menuAst) === "Tabs.Content" && node.openingElement.attributes.properties.some((attribute) => attribute.name?.getText(menuAst) === "value" && attribute.initializer?.text === "donations")) donationSection = node;
  ts.forEachChild(node, findDonations);
}
findDonations(menuAst);
assert.ok(donationSection);
const bundle = await build({
  stdin: { contents: `
    import { createElement, Suspense } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { Tabs } from 'radix-ui';
    import { BuildingProfileForm } from './src/components/html/donate/BuildingProfileForm';
    import { Button } from './src/components/ui/button';
    import { cn } from './src/lib/utils';
    import { formatBRL } from './src/lib/unlock';
    import { Building2, MapPin } from 'lucide-react';
    import { BlockLoader, ErrorMark, PixelBuilding } from './src/components/ui/pixel-icon';
    import { AuthContext } from './src/hooks/useAuth';
    const BuildingCustomizer = () => createElement('div', { 'data-preview': true }, 'Prévia de aparência');
    const Loader2 = () => null;
    const noop = () => {};
    const tabClass = ${JSON.stringify(constant("tabClass"))};
    const scrollClass = ${JSON.stringify(constant("scrollClass"))};
    const footerClass = ${JSON.stringify(constant("footerClass"))};
    function Section({ buildingTab = 'information', ready = true, editBusy = false, error = null }) {
      const profileFormId = 'building-profile';
      const profileEdit = { ready, busy: editBusy, error };
      const appearanceBusy = false;
      const donationId = 42;
      const customization = {}, catalog = null, textureSettings = {};
      const setBuildingTab = noop, leaveProfile = noop, setProfileEdit = noop, onClose = noop, onSaved = noop;
      const onCustomizationChange = noop, setAppearanceBusy = noop;
      return (${buildingSection.getText(dialogAst)});
    }
    export const render = (props) => renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user: { id: 1 } } }, createElement(Section, props)));
    function List({ donations }) {
      const panelClass = '', goldButton = '';
      const totalDonated = donations.reduce((total, donation) => total + donation.value, 0);
      const onOpenChange = noop, onOpenDonation = noop;
      return <Tabs.Root value="donations">${donationSection.getText(menuAst)}</Tabs.Root>;
    }
    export const renderList = (donations) => renderToStaticMarkup(createElement(List, { donations }));
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, format: "cjs", platform: "node", packages: "external", jsx: "automatic", write: false,
  define: { "import.meta.env": "{}" },
});
const renderModule = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), renderModule, renderModule.exports);
const { render, renderList } = renderModule.exports;
const listHtml = renderList([{ id: 42, value: 50 }, { id: 99, value: 25 }]);
assert.equal((listHtml.match(/<button/g) ?? []).length, 2, "Todos os edifícios têm Ver na cidade, sem depender do filtro");
assert.match(listHtml, /Edifício 1/);
assert.match(listHtml, /Edifício 2/);
assert.match(renderList([]), /Nenhum edifício ainda/);
const informationHtml = render({});
assert.match(informationHtml, /aria-selected="true"[^>]*>Informações<\/button>/);
assert.match(informationHtml, /Nome do edifício/);
assert.match(informationHtml, /Descrição/);
assert.doesNotMatch(informationHtml, /<details|data-preview/, "Informações não ficam recolhidas nem depois da prévia");
assert.match(informationHtml, /type="submit" form="building-profile"/);
assert.match(render({ buildingTab: "appearance" }), /<form id="building-profile"/, "Alternar de aba não desmonta o perfil nem perde os campos");
assert.match(render({ buildingTab: "appearance" }), /data-preview="true"/);
for (const props of [{ ready: false }, { editBusy: true }]) {
  assert.match(render(props), /type="submit" form="building-profile"[^>]*disabled=""/, "Rodapé deve respeitar carregamento e salvamento");
}
assert.match(render({ buildingTab: "appearance", error: "Não foi possível salvar." }), /role="alert"[^>]*>[\s\S]*Não foi possível salvar\./, "Falha ao salvar deve aparecer também na aba Aparência");

// Foco real: filtro/teto, chegada atrasada do edifício pago e sessão sem permissão.
const editorSource = await readFile(new URL("../src/components/CitySceneEditor.tsx", import.meta.url), "utf8");
const editorAst = ts.createSourceFile("CitySceneEditor.tsx", editorSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const editor = editorAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "CitySceneEditor");
const openDonation = editor.body.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(editorAst) === "handleOpenDonation"));
const callbacks = editor.body.statements.filter(ts.isVariableStatement).filter((node) => node.declarationList.declarations.some((declaration) => ["handleBuildingClick", "handleCloseInfo", "canEdit"].includes(declaration.name.getText(editorAst))));
const rebuild = editor.body.statements.find((node) => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(editorAst) === "useEffect" && node.getText(editorAst).includes("setDonations(visibleDonations)"));
const frames = [];
const city = {
  visibleDonations: [{ id: 42, value: 25 }], donationsApplied: true,
  loadState: { status: "ready" }, ownedDonationIds: new Set([42]), isAdmin: false,
  pendingFocusRef: { current: null }, customizationsRef: { current: new Map() },
  selectedId: null, infoId: null, focusedId: null, filter: { cityId: 99 }, limit: 1,
  useCallback: (handler) => handler,
  useEffect: (handler) => handler(),
  getBuildingSelection: () => ({ managedId: city.selectedId, infoId: city.infoId }),
  setInfoBuildingId: (id) => { city.infoId = id; },
  setSelectedBuildingId: (id) => { city.selectedId = id; },
  setDonationsApplied: (value) => { city.donationsApplied = value; },
  setFilter: (value) => { city.filter = value; },
  setVisibleLimit: (value) => { city.limit = value; },
  requestAnimationFrame: (handler) => { frames.push(handler); return frames.length; },
  cancelAnimationFrame() {},
};
city.canvasRef = { current: {
  focusOnDonation(id) { city.focusedId = id; },
  clearFocus() { city.focusedId = null; },
  setDonations(entries) { city.renderedIds = entries.map((entry) => entry.id); },
  updateDonationCustomization() {},
} };
const code = `${callbacks.map((node) => node.getText(editorAst)).join("\n")}\n${openDonation.getText(editorAst)}\nObject.assign(globalThis, { handleOpenDonation, handleCloseInfo, canEdit });`;
vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, city);
assert.equal(city.canEdit(42), true);
assert.equal(city.canEdit(99), false, "Conta comum não administra edifício alheio");
city.ownedDonationIds.clear();
assert.equal(city.canEdit(42), false, "Logout remove acesso à administração");
city.isAdmin = true;
assert.equal(city.canEdit(42), true);
city.handleOpenDonation(42);
assert.equal(city.focusedId, 42);
assert.equal(city.infoId, 42);
assert.equal(city.filter.cityId, 99, "Edifício visível preserva filtro");
city.visibleDonations = [];
city.handleOpenDonation(42);
assert.equal(Object.keys(city.filter).length, 0, "Edifício oculto limpa filtro");
assert.equal(city.limit, null, "Edifício oculto remove teto");
const applyCity = () => {
  vm.runInNewContext(ts.transpileModule(rebuild.getText(editorAst), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, city);
  while (frames.length) frames.shift()();
};
applyCity();
assert.equal(city.pendingFocusRef.current, 42, "Rebuild anterior à resposta não perde foco pendente");
city.visibleDonations = [{ id: 42, value: 25 }];
applyCity();
assert.equal(city.pendingFocusRef.current, null);
assert.equal(city.focusedId, 42);
assert.equal(city.infoId, 42);
assert.equal(city.selectedId, null, "Visualizar abre informações, sem forçar edição");
city.visibleDonations = [{ id: 42, value: 50 }];
applyCity();
assert.equal(city.infoId, 42, "Releitura após revelar edifício oculto mantém informações");
assert.equal(city.focusedId, 42);
city.selectedId = 42;
city.infoId = null;
applyCity();
assert.equal(city.selectedId, 42, "Atualização dos edifícios não desmonta administração nem perde campos");
assert.equal(city.focusedId, 42);
city.pendingFocusRef.current = 42;
city.handleCloseInfo();
assert.equal(city.pendingFocusRef.current, null, "Fechar cancela foco pendente");
assert.equal(city.focusedId, null);
city.selectedId = null;
city.infoId = 42;
vm.runInNewContext(ts.transpileModule(rebuild.getText(editorAst), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, city);
city.handleCloseInfo();
while (frames.length) frames.shift()();
assert.equal(city.infoId, null, "Fechar durante rebuild não reabre informações");
assert.equal(city.focusedId, null);

const shortcuts = editor.body.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(editorAst) === "shortcuts"));
const keyboard = {
  isAdmin: false, selectedBuildingId: 42, infoBuildingId: null, showShortcutsHelp: false, closed: false,
  setShowControlPanel() { keyboard.closed = true; },
};
vm.runInNewContext(ts.transpileModule(`${shortcuts.getText(editorAst)}\nshortcuts.find((shortcut) => shortcut.key === "Escape").handler();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, keyboard);
assert.equal(keyboard.closed, false, "Escape na administração deixa descarte/salvamento sob controle do diálogo");

// O acesso próprio sempre abre a lista, mesmo após navegar em outra aba do menu.
const authSource = await readFile(new URL("../src/components/AuthMenu.tsx", import.meta.url), "utf8");
const authAst = ts.createSourceFile("AuthMenu.tsx", authSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
let ownButton;
function findOwnButton(node) {
  if (ts.isJsxElement(node) && ["button", "Button"].includes(node.openingElement.tagName.getText(authAst)) && node.openingElement.attributes.properties.some((attribute) => attribute.name?.getText(authAst) === "aria-label" && attribute.initializer?.text === "Meus edifícios")) ownButton = node;
  ts.forEachChild(node, findOwnButton);
}
findOwnButton(authAst);
assert.ok(ownButton);
const ownHandler = ownButton.openingElement.attributes.properties.find((attribute) => attribute.name?.getText(authAst) === "onClick").initializer.expression;
const auth = { tab: "profile", open: false, setMenuTab(tab) { auth.tab = tab; }, setMenuOpen(open) { auth.open = open; } };
vm.runInNewContext(`(${ownHandler.getText(authAst)})()`, auth);
assert.equal(auth.tab, "donations");
assert.equal(auth.open, true);
console.log("Edifícios: administração independente, abas/perfil, descarte, bloqueio durante upload/save e foco após filtro ou pagamento OK.");
