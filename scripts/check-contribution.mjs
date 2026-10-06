// node scripts/check-contribution.mjs — campo monetário, sem servidor ou navegador.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
console.log("Contribuição: máscara fixa de 2 casas, digitação, exclusão, colagem em reais e valores preservados OK.");
