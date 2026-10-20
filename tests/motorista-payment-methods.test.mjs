import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const directory = mkdtempSync(join(tmpdir(), "motorista-pagamentos-"));
for (const name of ["motorista", "motorista-journey", "motorista-maintenance", "motorista-payment-methods", "motorista-invoice-reporting"]) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  writeFileSync(join(directory, `${name}.js`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const require = createRequire(import.meta.url);
const base = require(join(directory, "motorista.js"));
const payment = require(join(directory, "motorista-payment-methods.js"));
const report = require(join(directory, "motorista-invoice-reporting.js"));
const maintenance = require(join(directory, "motorista-maintenance.js"));
after(() => rmSync(directory, { recursive: true, force: true }));

const card = (extra = {}) => ({ id: "cartao", name: "Meu cartão", type: "credit", active: true, closingDay: 20, dueDay: 27, ...extra });
const pix = { id: "pix", name: "Pix", type: "other", active: true };
const methods = [card(), pix];
const expense = (id, date, cents = 100, extra = {}) => ({
  id, date, categoryId: "combustivel", cents, note: "", ...payment.expensePaymentFields("cartao", methods), ...extra,
});
const backup = (extra = {}) => ({
  version: 5, exportedAt: "2026-10-13T15:00:00.000Z", days: [], expenses: [],
  categories: [{ id: "combustivel", name: "Combustível" }], goals: [], plannedExpenses: [], costProfiles: [], paymentMethods: methods, ...extra,
});

test("cadastro valida tipos, nome, estado e dias; Other admite campos nulos", () => {
  payment.validatePaymentMethod(card());
  payment.validatePaymentMethod({ ...pix, closingDay: null, dueDay: null });
  for (const invalid of [card({ closingDay: 0 }), card({ dueDay: 32 }), card({ dueDay: 1.5 }), card({ name: " " }),
    card({ active: null }), card({ type: "outro" }), { ...pix, closingDay: 5 }, card({ id: "../cartao" })])
    assert.throws(() => payment.validatePaymentMethod(invalid));
});

test("novos gastos exigem forma, histórico ausente/null permanece igual e vínculo não pode ser limpo", () => {
  const legacy = { id: "antigo", date: "2026-10-01", categoryId: "combustivel", cents: 100, note: "" };
  assert.throws(() => payment.expensePaymentFields("", methods), /Selecione/);
  assert.deepEqual(payment.expensePaymentFields("", methods, legacy), {});
  assert.deepEqual(payment.expensePaymentFields("", methods, { ...legacy, paymentMethodId: null, paymentMethodSnapshot: null }),
    { paymentMethodId: null, paymentMethodSnapshot: null });
  assert.throws(() => payment.expensePaymentFields("", methods, expense("e1", "2026-10-01")), /Selecione/);
  assert.throws(() => payment.expensePaymentFields("ausente", methods), /não existe/);
});

test("desativação impede nova seleção e permite editar compras vinculadas", () => {
  const inactive = [card({ active: false }), pix];
  assert.throws(() => payment.expensePaymentFields("cartao", inactive), /ativa/);
  const existing = expense("e1", "2026-10-10");
  assert.deepEqual(payment.expensePaymentFields("cartao", inactive, existing).paymentMethodSnapshot, existing.paymentMethodSnapshot);
});

test("datas da fatura usam fechamento estrito e vencimento posterior", () => {
  assert.equal(payment.expensePaymentDueDate(expense("a", "2026-10-19"), methods), "2026-10-27");
  assert.equal(payment.expensePaymentDueDate(expense("b", "2026-10-20"), methods), "2026-11-27");
  assert.equal(payment.expensePaymentDueDate(expense("c", "2026-10-21"), methods), "2026-11-27");
  const configured = [card({ closingDay: 25, dueDay: 5 })];
  assert.equal(payment.expensePaymentDueDate({ ...expense("d", "2026-12-24"), ...payment.expensePaymentFields("cartao", configured) }, configured), "2027-01-05");
  const sameDay = [card({ closingDay: 20, dueDay: 20 })];
  assert.equal(payment.expensePaymentDueDate({ ...expense("e", "2026-10-19"), ...payment.expensePaymentFields("cartao", sameDay) }, sameDay), "2026-11-20");
});

test("dias 29 a 31 são limitados ao mês e ano bissexto sem converter data civil para UTC", () => {
  const configured = [card({ closingDay: 31, dueDay: 5 })];
  const due = (date) => payment.expensePaymentDueDate({ ...expense("d", date), ...payment.expensePaymentFields("cartao", configured) }, configured);
  assert.equal(due("2026-02-27"), "2026-03-05");
  assert.equal(due("2026-02-28"), "2026-04-05");
  assert.equal(due("2028-02-28"), "2028-03-05");
  assert.equal(due("2028-02-29"), "2028-04-05");
  const shortDue = [card({ closingDay: 20, dueDay: 31 })];
  assert.equal(payment.expensePaymentDueDate({ ...expense("e", "2026-02-19"), ...payment.expensePaymentFields("cartao", shortDue) }, shortDue), "2026-02-28");
});

test("edição mantém os termos anteriores; trocar a forma captura a configuração atual", () => {
  const original = expense("e", "2026-10-20");
  const changed = [card({ closingDay: 25, dueDay: 5 }), pix];
  const edited = { ...original, date: "2026-10-19", ...payment.expensePaymentFields("cartao", changed, original) };
  assert.equal(payment.expensePaymentDueDate(edited, changed), "2026-10-27");
  const changedType = [{ ...pix, id: "cartao", name: "Renomeado" }];
  assert.equal(payment.expensePaymentDueDate(original, changedType), "2026-11-27");
  const other = { ...original, ...payment.expensePaymentFields("pix", changed, original) };
  assert.deepEqual(other.paymentMethodSnapshot, { type: "other" });
  assert.equal(payment.expensePaymentDueDate(other, changed), original.date);
});

test("histórico sem forma ou manutenção sem compra não recebe vencimento inferido", () => {
  assert.equal(payment.expensePaymentDueDate({ ...expense("a", "2026-10-01"), paymentMethodId: null, paymentMethodSnapshot: null }, methods), null);
  assert.equal(payment.expensePaymentDueDate(expense("m", "2026-10-01", 100, { kind: "maintenance" }), methods), null);
  assert.throws(() => payment.expensePaymentDueDate(expense("a", "2026-02-30"), methods), /data/);
  assert.throws(() => payment.expensePaymentDueDate(expense("a", "2026-10-01", 100, { paymentMethodId: "ausente" }), methods), /ausente/);
});

test("manutenção separa data de compra editável da âncora do rateio e preserva ausência antiga", () => {
  const input = { categoryId: "combustivel", totalCents: 30000, startMonth: "2026-11", installments: 3, note: "Reparo" };
  const fresh = maintenance.maintenanceExpenseFromInput(input, undefined, "m1");
  assert.equal(fresh.date, "2026-11-01");
  assert.equal(fresh.purchaseDate, base.localDate());
  const legacy = { ...fresh, opaque: { original: true } };
  delete legacy.purchaseDate;
  assert.equal(Object.hasOwn(maintenance.maintenanceExpenseFromInput(input, legacy), "purchaseDate"), false);
  const updated = maintenance.maintenanceExpenseFromInput({ ...input, purchaseDate: "2026-10-19" }, legacy);
  assert.equal(updated.purchaseDate, "2026-10-19");
  assert.equal(updated.date, legacy.date);
  assert.deepEqual(updated.opaque, legacy.opaque);
  assert.throws(() => maintenance.maintenanceExpenseFromInput({ ...input, purchaseDate: "2026-02-30" }, legacy));
});

test("builder de manutenção conserva a forma e os termos recebidos no rascunho ou já salvos", () => {
  const input = { categoryId: "combustivel", totalCents: 30000, startMonth: "2026-11", installments: 3,
    note: "Reparo", purchaseDate: "2026-10-19", ...payment.expensePaymentFields("cartao", methods) };
  const created = maintenance.maintenanceExpenseFromInput(input, undefined, "m1");
  assert.equal(created.paymentMethodId, "cartao");
  assert.deepEqual(created.paymentMethodSnapshot, input.paymentMethodSnapshot);
  const { paymentMethodId: ignoredId, paymentMethodSnapshot: ignoredSnapshot, ...ordinaryEdit } = input;
  void ignoredId; void ignoredSnapshot;
  const edited = maintenance.maintenanceExpenseFromInput({ ...ordinaryEdit, totalCents: 31000 }, created);
  assert.equal(edited.paymentMethodId, created.paymentMethodId);
  assert.deepEqual(edited.paymentMethodSnapshot, created.paymentMethodSnapshot);
  const switched = maintenance.maintenanceExpenseFromInput({ ...ordinaryEdit, ...payment.expensePaymentFields("pix", methods, created) }, created);
  assert.equal(switched.paymentMethodId, "pix");
  assert.deepEqual(switched.paymentMethodSnapshot, { type: "other" });
  assert.throws(() => maintenance.maintenanceExpenseFromInput({ ...ordinaryEdit, paymentMethodId: null, paymentMethodSnapshot: null }, created));
  assert.throws(() => maintenance.maintenanceExpenseFromInput({ ...ordinaryEdit, paymentMethodId: "pix" }, created));
});

test("relatório filtra vencimento futuro, encontra compras anteriores e agrupa por forma", () => {
  const expenses = [expense("b", "2026-10-20", 200), expense("a", "2026-10-19", 100),
    expense("c", "2026-11-02", 300, { ...payment.expensePaymentFields("pix", methods) })];
  const result = report.invoiceExpenseReport({ expenses, methods, from: "2026-11-01", to: "2026-11-30" });
  assert.equal(result.totalCents, 500);
  assert.deepEqual(result.rows.map((row) => row.expense.id), ["c", "b"]);
  assert.equal(result.groups.length, 2);
  const cardOnly = report.invoiceExpenseReport({ expenses, methods, from: "2026-11-27", to: "2026-11-27", paymentMethodId: "cartao" });
  assert.equal(cardOnly.totalCents, 200);
  assert.equal(cardOnly.rows[0].purchaseDate, "2026-10-20");
});

test("categoria filtra gastos; manutenção entra uma vez pelo total, sem cotas analíticas", () => {
  const master = expense("m", "2026-12-01", 90000, { kind: "maintenance", purchaseDate: "2026-10-21", maintenance: { startMonth: "2026-12", installments: 9 } });
  const input = { expenses: [master, expense("a", "2026-10-22", 100, { categoryId: "outra" })], methods, from: "2026-11-01", to: "2026-11-30", categoryId: "combustivel" };
  const result = report.invoiceExpenseReport(input);
  assert.equal(result.totalCents, 90000);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].purchaseDate, "2026-10-21");
});

test("intervalos inválidos ficam vazios e somas financeiras inseguras são recusadas", () => {
  const input = { expenses: [], methods, from: "2026-02-30", to: "2026-11-30" };
  assert.deepEqual(report.invoiceExpenseReport(input), { rows: [], groups: [], totalCents: 0 });
  assert.deepEqual(report.invoiceExpenseReport({ ...input, from: "2026-12-01" }), { rows: [], groups: [], totalCents: 0 });
  const unsafe = [expense("a", "2026-10-01", Number.MAX_SAFE_INTEGER), expense("b", "2026-10-01", 1)];
  assert.throws(() => report.invoiceExpenseReport({ expenses: unsafe, methods, from: "2026-10-01", to: "2026-10-31" }), /limite/);
});

test("backup v5 preserva formas, snapshots, compra e desconhecidos no round-trip", () => {
  const original = backup({ expenses: [expense("a", "2026-10-21", 100, { purchaseDate: "2026-10-21", historical: { nested: [null, 42] } })],
    paymentMethods: [card({ bankMetadata: { code: "123" } }), pix], custom: "preservado" });
  assert.deepEqual(base.validateBackup(JSON.parse(JSON.stringify(original))), original);
  for (const invalid of [backup({ paymentMethods: [card({ dueDay: 0 })] }), backup({ paymentMethods: [card(), card()] }),
    backup({ expenses: [expense("a", "2026-10-01", 100, { paymentMethodId: "ausente" })] }),
    backup({ expenses: [expense("a", "2026-10-01", 100, { paymentMethodSnapshot: null })] }),
    backup({ expenses: [expense("a", "2026-10-01", 100, { paymentMethodId: null })] }),
    backup({ expenses: [expense("a", "2026-10-01", 100, { purchaseDate: "2026-02-30" })] })])
    assert.throws(() => base.validateBackup(invalid));
});

test("backups v1 a v4 normalizam sem fabricar forma ou data de compra no histórico", () => {
  for (const version of [1, 2, 3, 4]) {
    const historic = { id: "old", date: "2026-10-01", categoryId: "combustivel", cents: 100, note: "", legacyField: "mantido" };
    const old = backup({ version, expenses: [historic], gains: [] });
    delete old.paymentMethods;
    const normalized = base.validateBackup(old);
    assert.equal(normalized.version, 5);
    assert.deepEqual(normalized.paymentMethods, []);
    assert.deepEqual(normalized.expenses[0], historic);
  }
});

test("importação cadastra formas antes dos gastos e limita leituras das regras além do teto de 150", () => {
  const entries = Array.from({ length: 45 }, (_, i) => ({ name: "expenses", id: `e${i}`, data: expense(`e${i}`, "2026-10-01") }));
  entries.push({ name: "paymentMethods", id: "cartao", data: card() }, { name: "categories", id: "combustivel", data: { name: "Combustível" } });
  const batches = base.importBatches(entries);
  assert.equal(batches[0][0].name, "categories");
  assert.equal(batches[1][0].name, "paymentMethods");
  assert.deepEqual(batches.slice(2).map((batch) => batch.length), [18, 18, 9]);
  assert.equal(batches.flat().length, entries.length);
  assert.throws(() => base.importBatches(entries, 0));
  const oversizedGroup = entries.slice(0, 19).map((entry) => ({ ...entry, data: { ...entry.data, plannedExpenseId: "p--2026-10-01" } }));
  assert.throws(() => base.importBatches(oversizedGroup), /18 gastos/);
});

test("CSV acrescenta dados da forma sem alterar valores/totais ou multiplicar mestre da manutenção", () => {
  const master = expense("m", "2026-12-01", 300, { kind: "maintenance", purchaseDate: "2026-10-21", maintenance: { startMonth: "2026-12", installments: 2 } });
  const regular = expense("a", "2026-10-20", 200);
  const output = base.exportCsv([], [regular, master], [{ id: "combustivel", name: "Combustível" }], [], [], "2026-12-31", methods);
  const rows = output.replace(/^\uFEFF/, "").split("\r\n").map((line) => line.slice(1, -1).split('";"'));
  const headers = rows[0];
  const col = (name) => headers.indexOf(name);
  const normal = rows.find((row) => row[0] === "gasto");
  assert.equal(normal[col("valor_centavos")], "200");
  assert.equal(normal[col("forma_pagamento_nome")], "Meu cartão");
  assert.equal(normal[col("vencimento_pagamento")], "2026-11-27");
  const total = rows.find((row) => row[0] === "manutencao_registro");
  assert.equal(total[col("valor_centavos")], "");
  assert.equal(total[col("manutencao_total_centavos")], "300");
  assert.equal(total[col("data_compra_manutencao")], "2026-10-21");
  assert.equal(rows.filter((row) => row[col("forma_pagamento_id")] === "cartao").length, 2);
});

test("regras mantêm autorização original e protegem coleção, termos e referência aditivos", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/users\/\{userId\}\/paymentMethods\/\{methodId\}/);
  assert.match(rules, /allow create, update: if owner\(userId\)\s*&& validPaymentMethod/);
  assert.match(rules, /allow delete: if false/);
  assert.match(rules, /validPaymentMethod\(getAfter\(paymentMethodPath/);
  assert.match(rules, /methodId == null && terms == null/);
  assert.match(rules, /journeyReleased\(userId, date\)/);
});
