// node scripts/check-pass.mjs — sem servidor, navegador ou dependências novas.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/pass.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { sortPassRewards } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const reward = (key, donationMin, referralMin) => ({
  key, label: key, categoryKey: "shape", categoryLabel: "Formato",
  unlock: donationMin === null && referralMin === null ? null : { donationMin, referralMin },
});
const input = [
  reward("maior-doacao", 100, null), reward("com-indicacao", 10, 3),
  reward("so-indicacoes", null, 2), reward("gratis", null, null),
  reward("menos-indicacoes", 10, 1), reward("menor-doacao", 10, null),
  reward("empate", 10, null), reward("centavos", 10.5, null),
];
const original = structuredClone(input);
assert.deepEqual(sortPassRewards(input).map((item) => item.key), [
  "gratis", "so-indicacoes", "menor-doacao", "empate", "menos-indicacoes",
  "com-indicacao", "centavos", "maior-doacao",
]);
assert.deepEqual(input, original, "Ordenação não pode alterar dados recebidos por props");
assert.equal(sortPassRewards(input).length, input.length, "Requisitos iguais mantêm cartões individuais");
assert.deepEqual(sortPassRewards([]), []);
console.log("Passe: grátis, doações, indicações, centavos, empates e dados imutáveis OK.");
