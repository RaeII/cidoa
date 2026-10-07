// node scripts/check-contribution.mjs — campo monetário, sem servidor ou navegador.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { formatMoneyInput, normalizeMoneyInput } = await load("../src/lib/moneyInput.ts");
const { parseMoney } = await load("../src/lib/unlock.ts");
for (const [input, expected] of [
  ["", "0,00"], ["25", "25,00"], ["25,", "25,00"], ["25.", "25,00"],
  ["25,90", "25,90"], ["25.90", "25,90"], [",50", "0,50"],
  ["1.000", "1.000,00"], ["1.234,56", "1.234,56"],
  [" R$\u00a01.234,56 ", "1.234,56"], ["1.234.567,89", "1.234.567,89"],
]) assert.equal(normalizeMoneyInput(input), expected, input);

// Cada tecla mantém a vírgula e exatamente duas casas, sem esperar pelo blur.
let amount = "0,00";
for (const [digit, expected] of [["1", "0,01"], ["2", "0,12"], ["3", "1,23"], ["4", "12,34"], ["5", "123,45"], ["6", "1.234,56"]]) {
  amount = formatMoneyInput(amount + digit);
  assert.equal(amount, expected);
  assert.match(amount, /^\d{1,3}(?:\.\d{3})*,\d{2}$/);
}
for (const expected of ["123,45", "12,34", "1,23", "0,12", "0,01", "0,00", "0,00"]) {
  amount = formatMoneyInput(amount.slice(0, -1));
  assert.equal(amount, expected, "Backspace deve preservar a máscara");
}
assert.equal(formatMoneyInput(""), "0,00", "Apagar tudo mantém a vírgula");
assert.equal(formatMoneyInput("12,34"), "12,34", "Reformatar preserva valor");
for (const input of ["abc", "-25", "+25", "1e3", "0x10", "Infinity", "9007199254740992"]) {
  assert.equal(formatMoneyInput(input), null, `Máscara: entrada inválida ${input}`);
}

for (const input of ["abc", "-25", "+25", "1e3", "0x10", "Infinity", "25,999", "25.9999", "1,2,3", "12.34,56", "12 34", "9007199254740992"]) {
  assert.equal(normalizeMoneyInput(input), null, `Entrada inválida: ${input}`);
}

// O valor enviado ao pagamento deve preservar os centavos, inclusive após o blur.
for (const [input, expected] of [["25", 25], ["R$ 1.234,56", 1234.56], ["25.90", 25.9], [",50", 0.5], ["1000000,01", 1000000.01]]) {
  const normalized = normalizeMoneyInput(input);
  assert.equal(parseMoney(normalized), expected);
  const formatted = expected.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.equal(parseMoney(normalizeMoneyInput(formatted)), expected, `Formatação alterou ${input}`);
}
assert.equal(parseMoney(normalizeMoneyInput("0,00")), null);
assert.equal(parseMoney(normalizeMoneyInput("")), null);

// Executa os handlers reais do modal sem montar a cena nem abrir um navegador.
const dialogSource = await readFile(new URL("../src/components/html/donate/ContributeDialog.tsx", import.meta.url), "utf8");
const dialogAst = ts.createSourceFile("ContributeDialog.tsx", dialogSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const dialog = dialogAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ContributeDialog");
const handlers = ["finish", "leaveProfile", "handleOpenChange"];
const declarations = dialog.body.statements.filter((node) => ts.isFunctionDeclaration(node) && handlers.includes(node.name?.text));
assert.equal(declarations.length, handlers.length);
const { outputText: handlerCode } = ts.transpileModule(declarations.map((node) => node.getText(dialogAst)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
});
const paidFlow = { step: "done", userId: 1, contribution: { donationId: null, ongId: 2, cityId: 3, value: 25 }, donationId: 42 };
let views = 0;
const state = {
  active: paidFlow,
  flow: paidFlow,
  profileEdit: { dirty: false, busy: false },
  confirmExit: false,
  open: true,
  focusedId: null,
  onOpenChange: (open) => { state.open = open; },
  onFinish: (id) => { state.focusedId = id; views += 1; },
};
for (const field of ["flow", "profileEdit", "confirmExit"]) {
  state[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => { state[field] = value; };
}
vm.runInNewContext(handlerCode, state);
state.finish(paidFlow.donationId);
assert.equal(state.open, false);
assert.equal(state.focusedId, 42);
assert.equal(state.flow, paidFlow, "Ver meu edifício deve preservar o pagamento e a etapa de edição");
state.handleOpenChange(true);
assert.equal(state.open, true);
assert.equal(state.flow, paidFlow, "Voltar deve reabrir Seu edifício, sem iniciar outro pagamento");
assert.equal(views, 1);
state.profileEdit = { dirty: true, busy: true };
state.handleOpenChange(false);
assert.equal(state.open, true, "Salvar/processar imagem bloqueia saída");
assert.equal(state.confirmExit, false);
state.profileEdit.busy = false;
state.handleOpenChange(false);
assert.equal(state.open, true, "Edições pendentes exigem confirmação");
assert.equal(state.confirmExit, true);
assert.equal(state.flow, paidFlow);
state.finish(paidFlow.donationId);
assert.equal(state.confirmExit, false);
assert.equal(state.flow, paidFlow, "Confirmar descarte não apaga o pagamento");
console.log("Contribuição: máscara fixa de 2 casas, digitação, exclusão, colagem em reais e valores preservados OK.");
console.log("Seu edifício: visualizar, retornar à edição, bloqueio durante salvamento e confirmação de descarte OK.");
