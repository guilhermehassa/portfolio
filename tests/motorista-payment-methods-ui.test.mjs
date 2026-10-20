import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = fileURLToPath(new URL("../", import.meta.url));

// Hooks controlados para exercitar handlers e callbacks reais, sem navegador ou Firestore.
function component(path, name, initialProps) {
  let cursor = 0, tree, props = initialProps;
  const state = [], modules = new Map();
  const hooks = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } };
  function load(source) {
    const filename = resolve(root, source);
    if (modules.has(filename)) return modules.get(filename).exports;
    const loaded = { exports: {} };
    modules.set(filename, loaded);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const sourceRequire = (specifier) => {
      if (specifier === "react") return hooks;
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier);
      const filenameBase = specifier.startsWith("@/") ? resolve(root, specifier.slice(2)) : resolve(dirname(filename), specifier);
      return load(`${filenameBase}${existsSync(`${filenameBase}.ts`) ? ".ts" : ".tsx"}`);
    };
    new Function("require", "module", "exports", code)(sourceRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  const Component = load(path)[name];
  const render = () => { cursor = 0; tree = Component(props); };
  const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value)
    ? [value, ...nodes(value.props.children)] : [];
  const text = (value) => Array.isArray(value) ? value.map(text).join("") : React.isValidElement(value)
    ? text(value.props.children) : value == null ? "" : String(value);
  function input(label) {
    const parent = nodes(tree).find((node) => node.type === "label" && text(node.props.children).startsWith(label));
    assert.ok(parent, "Campo esperado não encontrado: " + label);
    return nodes(parent.props.children).find((node) => ["input", "textarea", "select"].includes(node.type));
  }
  render();
  return {
    change(label, value) { input(label).props.onChange({ target: { value, checked: value } }); render(); },
    value: (label) => input(label).props.value,
    checked: (label) => input(label).props.checked,
    error: () => nodes(tree).find((node) => node.type.name === "FormError").props.children,
    options: (label) => nodes(input(label).props.children).filter((node) => node.type === "option").map((node) => ({ value: node.props.value, text: text(node.props.children) })),
    refresh(next) { props = { ...props, ...next }; render(); },
    async save() { await tree.props.onSubmit({ preventDefault() {} }); render(); },
    markup: () => renderToStaticMarkup(tree),
  };
}

const path = "components/motorista/motorista-payment-methods.tsx";
const methods = [
  { id: "nubank", name: "Nubank", type: "credit", active: true, closingDay: 20, dueDay: 27 },
  { id: "antigo", name: "Cartão antigo", type: "credit", active: false, closingDay: 25, dueDay: 5 },
  { id: "pix", name: "Pix", type: "other", active: true },
];

test("cadastro de cartão exige nome e dias inteiros de 1 a 31, aceitando vencimento no mês seguinte", async () => {
  let saved, calls = 0, done = 0;
  const app = component(path, "PaymentMethodEditor", { paymentMethods: methods, saving: false,
    done: () => done++, save: async (collection, id, data, previous) => { calls++; saved = { collection, id, data, previous }; return true; } });
  assert.equal(app.value("Nome"), ""); assert.equal(app.value("Tipo"), "other");
  assert.deepEqual(app.options("Tipo").map((option) => option.text), ["Outro", "Cartão de Crédito"]);
  app.change("Tipo", "credit"); await app.save(); assert.equal(calls, 0); assert.match(app.error(), /nome/);
  app.change("Nome", "  Banco   Azul  "); await app.save(); assert.equal(calls, 0);
  app.change("Dia de fechamento", "32"); app.change("Dia de vencimento", "5"); await app.save(); assert.equal(calls, 0);
  app.change("Dia de fechamento", "25.5"); await app.save(); assert.equal(calls, 0);
  app.change("Dia de fechamento", "25"); await app.save();
  assert.equal(calls, 1); assert.equal(done, 1); assert.equal(saved.collection, "paymentMethods");
  assert.equal(saved.data.name, "Banco Azul"); assert.equal(saved.data.closingDay, 25); assert.equal(saved.data.dueDay, 5);
  assert.equal(saved.data.active, true); assert.equal(saved.previous, undefined); assert.equal(saved.id, saved.data.id);
});

test("nome duplicado é recusado inclusive inativo, sem cadastrar exemplos automáticos", async () => {
  let calls = 0;
  const app = component(path, "PaymentMethodEditor", { paymentMethods: methods, saving: false, done() {},
    save: async () => { calls++; return true; } });
  assert.equal(calls, 0); app.change("Nome", "  CARTÃO   antigo "); await app.save();
  assert.equal(calls, 0); assert.match(app.error(), /Já existe/); assert.equal(app.value("Nome"), "  CARTÃO   antigo ");
  app.change("Nome", "Dinheiro"); await app.save(); assert.equal(calls, 1);
});

test("edição conserva snapshot inicial, desconhecidos e permite desativar preservando cadastro", async () => {
  const initial = { ...methods[0], custom: { preserved: true } };
  const original = structuredClone(initial);
  let saved, previous;
  const app = component(path, "PaymentMethodEditor", { initial, paymentMethods: methods, saving: false, done() {},
    save: async (_collection, _id, data, snapshot) => { saved = data; previous = snapshot; return true; } });
  app.change("Nome", "Cartão principal"); app.change("Ativa para novos gastos", false);
  app.refresh({ initial: { ...initial, closingDay: 10 } }); await app.save();
  assert.equal(previous, initial); assert.equal(saved.id, initial.id); assert.equal(saved.active, false);
  assert.equal(saved.closingDay, 20); assert.equal(saved.name, "Cartão principal");
  assert.deepEqual(saved.custom, initial.custom); assert.deepEqual(initial, original);
});

test("mudar cartão para Outro limpa os dias e mantém rascunho após falha de persistência", async () => {
  let saved, done = 0;
  const app = component(path, "PaymentMethodEditor", { initial: methods[0], paymentMethods: methods, saving: false,
    done: () => done++, save: async (_collection, _id, data) => { saved = data; throw new Error("Conflito concorrente"); } });
  app.change("Tipo", "other"); app.change("Nome", "Débito Nubank"); await app.save();
  assert.equal(saved.closingDay, null); assert.equal(saved.dueDay, null); assert.equal(saved.type, "other");
  assert.equal(done, 0); assert.match(app.error(), /Conflito/); assert.equal(app.value("Nome"), "Débito Nubank");
});

const categories = [{ id: "combustivel", name: "Combustível" }, { id: "manutencao", name: "Manutenção" }, { id: "outros", name: "Outros" }];
const expenses = [
  { id: "anterior", date: "2025-10-20", categoryId: "combustivel", kind: "fuel", cents: 20000, note: "Compra outubro", paymentMethodId: "nubank",
    paymentMethodSnapshot: { type: "credit", closingDay: 20, dueDay: 27 } },
  { id: "novembro", date: "2025-11-19", categoryId: "outros", cents: 3000, note: "Compra novembro", paymentMethodId: "nubank",
    paymentMethodSnapshot: { type: "credit", closingDay: 20, dueDay: 27 } },
  { id: "cartao-inativo", date: "2025-10-24", categoryId: "outros", cents: 1500, note: "Compra cartão antigo", paymentMethodId: "antigo",
    paymentMethodSnapshot: { type: "credit", closingDay: 25, dueDay: 5 } },
  { id: "pix", date: "2025-11-27", categoryId: "outros", cents: 1000, note: "Pagamento Pix", paymentMethodId: "pix", paymentMethodSnapshot: { type: "other" } },
  { id: "proxima", date: "2025-11-20", categoryId: "outros", cents: 90000, note: "Próxima fatura", paymentMethodId: "nubank",
    paymentMethodSnapshot: { type: "credit", closingDay: 20, dueDay: 27 } },
  { id: "legado", date: "2025-11-01", categoryId: "outros", cents: 88888, note: "Histórico sem forma" },
  { id: "manutencao", date: "2025-12-01", purchaseDate: "2025-10-22", categoryId: "manutencao", kind: "maintenance", cents: 12000,
    note: "Serviço total", maintenance: { startMonth: "2025-12", installments: 3 }, paymentMethodId: "nubank",
    paymentMethodSnapshot: { type: "credit", closingDay: 20, dueDay: 27 } },
];
const report = (extra = {}) => component("components/motorista/motorista-expense-reports.tsx", "MotoristaExpenseReports", {
  expenses, paymentMethods: methods, categories, from: "2025-11-01", to: "2025-11-30", controls: React.createElement("p", {}, "Filtro de período"), ...extra,
});
const metric = (markup, label, cents) => assert.ok(markup.includes(`<span>${label}</span><strong>${(cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>`), label);

test("consulta mostra fatura de novembro com compras anteriores, formas inativas e manutenção inteira uma vez", () => {
  const app = report(); const markup = app.markup();
  metric(markup, "Total filtrado", 37500); metric(markup, "Nubank", 35000); metric(markup, "Cartão antigo", 1500); metric(markup, "Pix", 1000);
  for (const note of ["Compra outubro", "Compra novembro", "Compra cartão antigo", "Pagamento Pix", "Serviço total"])
    assert.ok(markup.includes(note));
  assert.ok(markup.includes("20/10/2025")); assert.ok(markup.includes("27/11/2025"));
  assert.equal((markup.match(/Serviço total/g) ?? []).length, 1);
  assert.ok(!markup.includes("Próxima fatura")); assert.ok(!markup.includes("Histórico sem forma"));
  assert.ok(!markup.includes("pendente")); assert.ok(markup.includes("Filtro de período"));
  assert.ok(app.options("Forma de pagamento").some((option) => option.value === "antigo"));
});

test("filtros de cartão e categoria aplicam-se aos itens e aos totais da consulta", () => {
  const app = report(); app.change("Forma de pagamento", "nubank");
  metric(app.markup(), "Total filtrado", 35000); assert.ok(!app.markup().includes("Pagamento Pix</td>"));
  app.change("Categoria", "combustivel"); const filtered = app.markup();
  metric(filtered, "Total filtrado", 20000); metric(filtered, "Nubank", 20000);
  assert.ok(filtered.includes("Compra outubro")); assert.ok(!filtered.includes("Serviço total"));
  app.change("Forma de pagamento", "antigo"); const empty = app.markup();
  metric(empty, "Total filtrado", 0); assert.ok(empty.includes("Nenhum gasto com vencimento nos filtros selecionados."));
});

test("consulta futura e por dia mantém o período completo sem limitar à data atual", () => {
  const app = report({ from: "2025-12-27", to: "2025-12-27" });
  metric(app.markup(), "Total filtrado", 90000); assert.ok(app.markup().includes("Próxima fatura"));
  const day = report({ from: "2025-11-05", to: "2025-11-05" });
  metric(day.markup(), "Total filtrado", 1500); assert.ok(day.markup().includes("Compra cartão antigo"));
});

test("consulta inválida informa erro sem totals falsos e dados inválidos não derrubam filtros", () => {
  const invalid = report({ from: "2025-11-30", to: "2025-11-01" }).markup();
  assert.ok(invalid.includes("Selecione um período válido")); assert.ok(!invalid.includes("Total filtrado"));
  const missing = report({ expenses: [{ ...expenses[0], paymentMethodId: "ausente" }] }).markup();
  assert.ok(missing.includes('role="alert"')); assert.ok(missing.includes("forma de pagamento ausente"));
});
