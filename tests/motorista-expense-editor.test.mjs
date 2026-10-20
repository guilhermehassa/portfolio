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
const paymentMethods = [{ id: "pix", name: "Pix", type: "other", active: true },
  { id: "cartao", name: "Cartão", type: "credit", active: true, closingDay: 20, dueDay: 27 }];

// Exercita a montagem enviada ao callback sem DOM ou acesso à persistência.
function editor(initial, expenses = [], options = {}) {
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
  props = { initial, expenses, categories, paymentMethods, saving: false, onCancel() {},
    onSave: async (expense, previous) => { saved = { expense, previous }; return true; }, ...options };
  const render = () => { cursor = 0; tree = ExpenseEditor(props); };
  const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value)
    ? [value, ...nodes(value.type.name === "PaymentMethodField" ? value.type(value.props) : value.props.children)] : [];
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
    value: (label) => input(label).props.value,
    required: (label) => input(label).props.required,
    options: (label) => nodes(input(label).props.children).filter((node) => node.type === "option").map((node) => ({ value: node.props.value, text: text(node.props.children) })),
    error: () => nodes(tree).find((node) => node.type.name === "FormError").props.children,
    refresh(next) { props = { ...props, ...next }; render(); },
    async submit() { await tree.props.onSubmit({ preventDefault() {} }); render(); return saved; },
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
  app.change("Forma de pagamento", "pix");
  const { expense, previous } = await app.save();
  assert.equal(previous, undefined); assert.equal(expense.fuel.tank, "partial");
  assert.equal(Object.hasOwn(expense.fuel, "previousMissing"), false); assert.equal(expense.fuel.incomplete, true);
  assert.equal(Object.hasOwn(expense.fuel, "odometer"), false);
  assert.equal(Object.hasOwn(expense, "scope"), false);
  assert.equal(Object.hasOwn(expense, "plannedExpenseId"), false);
});

test("novos gastos e abastecimentos exigem forma ativa e guardam condições do cartão", async () => {
  for (const kind of ["expense", "fuel"]) {
    const app = editor({ date: "2025-10-19", categoryId: kind === "fuel" ? "combustivel" : "outros", kind });
    app.change("Valor pago", "R$ 100,00");
    assert.equal(app.required("Forma de pagamento"), true);
    assert.equal(await app.submit(), undefined); assert.match(app.error(), /forma de pagamento/);
    app.change("Forma de pagamento", "cartao");
    const { expense } = await app.save();
    assert.equal(expense.paymentMethodId, "cartao");
    assert.deepEqual(expense.paymentMethodSnapshot, { type: "credit", closingDay: 20, dueDay: 27 });
  }
});

test("histórico vazio continua opcional e sem sinalização ao salvar outros campos", async () => {
  const previous = fuel();
  const app = editor(previous, [previous]);
  assert.equal(app.value("Forma de pagamento"), "");
  assert.equal(app.required("Forma de pagamento"), false);
  assert.equal(app.options("Forma de pagamento")[0].text, "");
  app.change("Observação", "Correção histórica");
  const { expense } = await app.save();
  assert.equal(Object.hasOwn(expense, "paymentMethodId"), false);
  assert.equal(Object.hasOwn(expense, "paymentMethodSnapshot"), false);
});

test("edição conserva forma inativa e termos originais e impede limpar vínculo existente", async () => {
  const previous = fuel({ paymentMethodId: "cartao", paymentMethodSnapshot: { type: "credit", closingDay: 18, dueDay: 25 } });
  const methods = paymentMethods.map((method) => method.id === "cartao" ? { ...method, active: false, closingDay: 10 } : method);
  const app = editor(previous, [previous], { paymentMethods: methods });
  assert.ok(app.options("Forma de pagamento").some((option) => option.value === "cartao"));
  app.change("Observação", "Editada");
  const { expense } = await app.save();
  assert.equal(expense.paymentMethodId, "cartao"); assert.deepEqual(expense.paymentMethodSnapshot, previous.paymentMethodSnapshot);
  app.change("Forma de pagamento", ""); await app.submit(); assert.match(app.error(), /forma de pagamento/);
  const fresh = editor({ date: "2025-10-01", categoryId: "outros" }, [], { paymentMethods: methods });
  assert.ok(!fresh.options("Forma de pagamento").some((option) => option.value === "cartao"));
  fresh.change("Valor pago", "R$ 10,00"); fresh.change("Forma de pagamento", "cartao");
  await fresh.submit(); assert.match(fresh.error(), /ativa/);
});

test("falha na persistência mantém forma e rascunho para tentar de novo", async () => {
  let attempts = 0, canceled = 0;
  const app = editor({ date: "2025-10-19", categoryId: "outros" }, [], {
    onCancel: () => canceled++, onSave: async () => { attempts++; throw new Error("Conflito concorrente"); },
  });
  app.change("Valor pago", "R$ 25,00"); app.change("Forma de pagamento", "pix"); app.change("Observação", "Rascunho");
  await app.submit(); assert.equal(attempts, 1); assert.equal(canceled, 0); assert.match(app.error(), /Conflito/);
  assert.equal(app.value("Forma de pagamento"), "pix"); assert.equal(app.value("Observação"), "Rascunho");
  app.refresh({ saving: true }); await app.submit(); assert.equal(attempts, 1);
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
