import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const root = fileURLToPath(new URL("../", import.meta.url));
function moduleLoader(react = React) {
  const modules = new Map();
  function load(source) {
    const filename = resolve(root, source);
    if (modules.has(filename)) return modules.get(filename).exports;
    const loadedModule = { exports: {} };
    modules.set(filename, loadedModule);
    const privateExport = filename.endsWith("motorista-settings.tsx") ? "\nexport { ProfileEditor };" : "";
    const code = ts.transpileModule(readFileSync(filename, "utf8") + privateExport, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const sourceRequire = (specifier) => {
      if (specifier === "react") return react;
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier);
      const path = specifier.startsWith("@/") ? resolve(root, specifier.slice(2)) : resolve(dirname(filename), specifier);
      return load(`${path}${existsSync(`${path}.ts`) ? ".ts" : ".tsx"}`);
    };
    new Function("require", "module", "exports", code)(sourceRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

// Controla campos e callbacks reais do formulário, sem DOM nem armazenamento.
function form(path, name, initialProps) {
  let cursor = 0, tree, props = initialProps;
  const state = [];
  const hooks = { ...React, useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } };
  const Component = moduleLoader(hooks)(path)[name];
  const render = () => { cursor = 0; tree = Component(props); };
  const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value)
    ? [value, ...nodes(value.type.name === "MaintenanceFields" ? value.type(value.props) : value.props.children)] : [];
  const text = (value) => Array.isArray(value) ? value.map(text).join("") : React.isValidElement(value)
    ? text(value.props.children) : value == null ? "" : String(value);
  function input(label) {
    const parent = nodes(tree).find((node) => node.type === "label" && text(node.props.children).startsWith(label));
    assert.ok(parent, "Campo esperado não encontrado: " + label);
    return nodes(parent.props.children).find((node) => ["input", "textarea", "select"].includes(node.type) || node.type.name === "MoneyField");
  }
  render();
  return {
    change(label, value) {
      const control = input(label);
      control.props.onChange(control.type.name === "MoneyField" ? value : { target: { value } }); render();
    },
    value: (label) => input(label).props.value,
    error: () => nodes(tree).find((node) => node.type.name === "FormError").props.children,
    refresh(next) { props = { ...props, ...next }; render(); },
    async save() { await tree.props.onSubmit({ preventDefault() {} }); render(); },
    cancel() { nodes(tree).find((node) => node.type === "button" && text(node.props.children) === "Cancelar").props.onClick(); },
  };
}
const load = moduleLoader();
const { maintenanceExpenseFromInput, installmentsPreview } = load("lib/motorista-maintenance.ts");

test("editar manutenção envia somente o mestre com ID e metadados intactos e substitui distribuição", async () => {
  const previous = { id: "m1", date: "2025-01-01", categoryId: "manutencao", kind: "maintenance", cents: 11515,
    note: "Revisão", origin: "legacy", extra: { preserved: true },
    maintenance: { startMonth: "2025-01", installments: 3, historic: true } };
  const original = structuredClone(previous);
  let saved, calls = 0, done = 0;
  const app = form("components/motorista/motorista-maintenance.tsx", "MaintenanceEditor", {
    initial: previous, saving: false, installmentsPreview, onCancel: () => done++,
    onSave: async (draft, snapshot) => { calls++; saved = { expense: maintenanceExpenseFromInput(draft, snapshot), snapshot }; return true; },
  });
  assert.equal(app.value("Custo total"), load("lib/motorista.ts").money(previous.cents));
  app.change("Descrição", "Revisão corrigida"); app.change("Custo total", "R$ 117,19");
  app.change("Mês inicial", "2025-02"); app.change("Número de parcelas", "2");
  app.refresh({ initial: { ...previous, cents: 99999 } });
  assert.equal(calls, 0); await app.save();
  assert.equal(calls, 1); assert.equal(done, 1); assert.equal(saved.snapshot, previous);
  assert.equal(saved.expense.id, previous.id); assert.equal(saved.expense.cents, 11719);
  assert.equal(saved.expense.date, "2025-02-01"); assert.equal(saved.expense.note, "Revisão corrigida");
  assert.deepEqual(saved.expense.maintenance, { startMonth: "2025-02", installments: 2, historic: true });
  assert.deepEqual(saved.expense.extra, previous.extra); assert.deepEqual(previous, original);
});

test("novo cadastro começa sem valor, aceita descrição vazia e mantém rascunho se confirmação falhar", async () => {
  let calls = 0, done = 0, saved;
  const app = form("components/motorista/motorista-maintenance.tsx", "MaintenanceEditor", {
    saving: false, installmentsPreview, onCancel: () => done++,
    onSave: async (draft, previous) => { calls++; assert.equal(previous, undefined); saved = maintenanceExpenseFromInput(draft, previous, "novo"); return false; },
  });
  assert.equal(app.value("Custo total"), ""); assert.equal(app.value("Número de parcelas"), "1");
  await app.save(); assert.match(app.error(), /custo total/); assert.equal(calls, 0);
  app.change("Custo total", "R$ 17,05");
  app.change("Número de parcelas", "0"); await app.save(); assert.equal(calls, 0);
  app.change("Número de parcelas", "1"); app.change("Mês inicial", "2025-01"); await app.save();
  assert.equal(calls, 1); assert.equal(done, 0); assert.equal(saved.cents, 1705);
  assert.equal(saved.note, ""); assert.equal(app.value("Descrição"), ""); assert.equal(app.value("Custo total"), "R$ 17,05");
  app.cancel(); assert.equal(calls, 1); assert.equal(done, 1);
});

test("perfil editado preserva estimativas antigas invisíveis e novo perfil não as cria", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { confirm: () => true };
  try {
    const previous = { id: "p1", effectiveFrom: "2025-01-01", vehicle: "owned", fuelType: "Gasolina", unit: "L",
      consumption: 10, priceCentsPerUnit: 700, workShare: 80, fixedMonthlyCents: 20000,
      maintenanceCentsPerKm: 42, wearCentsPerKm: 3, custom: "preservar" };
    const original = structuredClone(previous);
    let saved, snapshot;
    const app = form("components/motorista/motorista-settings.tsx", "ProfileEditor", {
      initial: previous, profiles: [previous], saving: false, done() {},
      save: async (_name, _id, data, previous) => { saved = data; snapshot = previous; return true; },
    });
    app.change("Preço por unidade", "R$ 7,50"); await app.save();
    assert.equal(saved.maintenanceCentsPerKm, 42); assert.equal(saved.wearCentsPerKm, 3);
    assert.equal(saved.fixedMonthlyCents, 20000); assert.equal(saved.priceCentsPerUnit, 750); assert.equal(saved.custom, "preservar");
    assert.equal(snapshot, previous); assert.deepEqual(previous, original);
    const fresh = form("components/motorista/motorista-settings.tsx", "ProfileEditor", {
      profiles: [], saving: false, done() {}, save: async (_name, _id, data) => { saved = data; return true; },
    });
    await fresh.save(); assert.equal(Object.hasOwn(saved, "maintenanceCentsPerKm"), false);
    assert.equal(Object.hasOwn(saved, "wearCentsPerKm"), false);
    assert.equal(Object.hasOwn(saved, "fixedMonthlyCents"), false);
  } finally { globalThis.window = originalWindow; }
});

test("metas e Relatórios apresentam cotas reconhecidas sem somar custo total do mestre", () => {
  const { emptyDay, money, isoWeek } = load("lib/motorista.ts");
  const { monthlyPlanning } = load("lib/motorista-evolution.ts");
  const { weeklyGoalPlanning } = load("lib/motorista-weekly-goal.ts");
  const days = [{ ...emptyDay("2025-01-15"), uberCents: 10000, status: "closed" }];
  const goals = [{ month: "2025-01", cents: 50000, variableDailyCents: 0, workDates: ["2025-01-15", "2025-01-16"] }];
  const expenses = [maintenanceExpenseFromInput({ categoryId: "manutencao", totalCents: 10500, installments: 2,
    startMonth: "2025-01", note: "Serviço" }, undefined, "m1")];
  const categories = [{ id: "manutencao", name: "Manutenção" }];
  const plan = monthlyPlanning({ month: "2025-01", reference: "2025-01-15", days, goals, expenses, categories, plans: [] });
  const weeklyPlan = weeklyGoalPlanning({ reference: "2025-01-15", days, goals, expenses });
  const { renderToStaticMarkup } = require("react-dom/server");
  const { default: HomeCards } = load("components/motorista/motorista-home-cards.tsx");
  const { default: Reports } = load("components/motorista/motorista-reports.tsx");
  const home = renderToStaticMarkup(React.createElement(HomeCards, { plan, weeklyPlan, days,
    today: "2025-01-15", week: isoWeek("2025-01-15"), onWeekChange() {} }));
  assert.equal(plan.costs, 2625); assert.equal(weeklyPlan.costs, 2625);
  assert.ok(home.includes(`Ganhos: ${money(10000)} | Gastos: ${money(2625)} | Saldo: ${money(7375)}`));
  const report = renderToStaticMarkup(React.createElement(Reports, { days, expenses, categories, goals,
    plans: [], from: "2025-01-01", to: "2025-01-31", reference: "2025-01-15", filter: "month", controls: null }));
  assert.ok(report.includes(`Total Gastos</span><strong>${money(2625)}`));
  assert.ok(report.includes(`${money(10500)} em 2x`));
  assert.ok(!report.includes(money(13125)));
});
