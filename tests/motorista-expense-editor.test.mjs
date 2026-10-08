import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const React = require("react");
const categories = [{ id: "combustivel", name: "Combustível" }, { id: "outros", name: "Outros" }];

// Exercita a montagem enviada ao callback sem DOM ou acesso à persistência.
function editor(initial, expenses = []) {
  let cursor = 0, tree, saved, props;
  const state = [], modules = new Map();
  const hooks = { ...React, useState(initialState) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initialState === "function" ? initialState() : initialState;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } };
  function load(source) {
    const filename = resolve(root, source);
    if (modules.has(filename)) return modules.get(filename).exports;
    const loadedModule = { exports: {} };
    modules.set(filename, loadedModule);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const sourceRequire = (specifier) => {
      if (specifier === "react") return hooks;
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier);
      const path = specifier.startsWith("@/") ? resolve(root, specifier.slice(2)) : resolve(dirname(filename), specifier);
      return load(`${path}${existsSync(`${path}.ts`) ? ".ts" : ".tsx"}`);
    };
    new Function("require", "module", "exports", code)(sourceRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const { ExpenseEditor } = load("components/motorista/motorista-forms.tsx");
  props = { initial, expenses, categories, saving: false, onCancel() {},
    onSave: async (expense, previous) => { saved = { expense, previous }; return true; } };
  const render = () => { cursor = 0; tree = ExpenseEditor(props); };
  const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value)
    ? [value, ...nodes(value.props.children)] : [];
  const text = (value) => Array.isArray(value) ? value.map(text).join("") : React.isValidElement(value)
    ? text(value.props.children) : value == null ? "" : String(value);
  function input(label) {
    const parent = nodes(tree).find((node) => node.type === "label" && text(node.props.children).startsWith(label));
    assert.ok(parent, "Campo esperado não encontrado: " + label);
    return nodes(parent.props.children).find((node) => ["input", "select", "textarea"].includes(node.type) || node.type.name === "MoneyField");
  }
  render();
  return {
    change(label, value) {
      const control = input(label);
      control.props.onChange(control.type.name === "MoneyField" ? value : { target: { value, checked: value } });
      render();
    },
    checked: (label) => input(label).props.checked,
    refresh(next) { props = { ...props, ...next }; render(); },
    async save() {
      await tree.props.onSubmit({ preventDefault() {} }); render();
      const error = nodes(tree).find((node) => node.type.name === "FormError").props.children;
      assert.equal(error, "");
      return saved;
    },
  };
}

const fuel = (overrides = {}) => ({ id: "f1", date: "2025-01-02", categoryId: "combustivel", cents: 20000,
  kind: "fuel", note: "Anterior", fuel: { fuelType: "Gasolina", unit: "L", volume: 30, odometer: 12345, tank: "unknown" }, ...overrides });

test("editar abastecimento preserva ocultos, desconhecidos e snapshot ao alterar data, valor e observação", async () => {
  const previous = fuel({ scope: "personal", plannedExpenseId: "plan:2025-01-02", origin: "legacy", extra: { keep: true } });
  previous.fuel.extra = "histórico";
  const original = structuredClone(previous);
  const app = editor(previous, [previous]);
  app.change("Data", "2025-01-03"); app.change("Valor pago", "R$ 250,00"); app.change("Observação", "Atualizada");
  app.refresh({ expenses: [{ ...previous, scope: "vehicle", plannedExpenseId: null }] });
  const { expense, previous: snapshot } = await app.save();
  assert.equal(expense.date, "2025-01-03"); assert.equal(expense.cents, 25000); assert.equal(expense.note, "Atualizada");
  assert.equal(expense.scope, "personal"); assert.equal(expense.plannedExpenseId, previous.plannedExpenseId);
  assert.equal(expense.fuel.odometer, 12345); assert.equal(expense.fuel.tank, "unknown");
  assert.equal(Object.hasOwn(expense.fuel, "previousMissing"), false);
  assert.equal(expense.fuel.extra, "histórico"); assert.deepEqual(expense.extra, previous.extra);
  assert.equal(snapshot, previous); assert.deepEqual(previous, original);
});

test("legados mantêm ausência ou null de campos ocultos e checkboxes intocados", async () => {
  for (const details of [
    { fuelType: "Gasolina", unit: "L", volume: 20 },
    { fuelType: "Gasolina", unit: "L", volume: 20, odometer: null, tank: "partial", previousMissing: false },
  ]) {
    const previous = fuel({ fuel: details });
    const app = editor(previous, [previous]);
    const { expense } = await app.save();
    for (const key of ["odometer", "tank", "previousMissing"]) {
      assert.equal(Object.hasOwn(expense.fuel, key), Object.hasOwn(details, key));
      assert.equal(expense.fuel[key], details[key]);
    }
    assert.equal(Object.hasOwn(expense, "scope"), false);
    assert.equal(Object.hasOwn(expense, "plannedExpenseId"), false);
    assert.equal(expense.fuel.incomplete, true);
  }
});

test("escolha explícita de Tanque cheio grava full e desmarcar grava partial preservando campos históricos", async () => {
  const previous = fuel();
  previous.fuel.previousMissing = true;
  const app = editor(previous, [previous]);
  assert.equal(app.checked("Tanque cheio"), false);
  app.change("Tanque cheio", true);
  assert.equal((await app.save()).expense.fuel.tank, "full");
  app.change("Tanque cheio", false);
  const { expense } = await app.save();
  assert.equal(expense.fuel.tank, "partial"); assert.equal(expense.fuel.previousMissing, true);
  assert.equal(expense.fuel.odometer, previous.fuel.odometer);
  assert.equal(previous.fuel.tank, "unknown");
});

test("novo abastecimento usa tanque parcial e não inventa odômetro, atribuição ou vínculo", async () => {
  const app = editor({ date: "2025-01-02", categoryId: "combustivel", kind: "fuel" });
  app.change("Valor pago", "R$ 100,00");
  const { expense, previous } = await app.save();
  assert.equal(previous, undefined); assert.equal(expense.fuel.tank, "partial");
  assert.equal(Object.hasOwn(expense.fuel, "previousMissing"), false); assert.equal(expense.fuel.incomplete, true);
  assert.equal(Object.hasOwn(expense.fuel, "odometer"), false);
  assert.equal(Object.hasOwn(expense, "scope"), false);
  assert.equal(Object.hasOwn(expense, "plannedExpenseId"), false);
});

test("gasto comum preserva classificação/vínculo ocultos e observação continua editável", async () => {
  const previous = { id: "e1", date: "2025-01-02", categoryId: "outros", cents: 5000, note: "Antiga", kind: "expense",
    scope: "vehicle", plannedExpenseId: "plan:2025-01-02", other: "manter" };
  const app = editor(previous, [previous]);
  app.change("Data", "2025-01-04"); app.change("Observação", "Nova");
  const { expense } = await app.save();
  assert.equal(expense.scope, previous.scope); assert.equal(expense.plannedExpenseId, previous.plannedExpenseId);
  assert.equal(expense.note, "Nova"); assert.equal(expense.other, "manter");
  assert.equal(Object.hasOwn(expense, "fuel"), false);
});
