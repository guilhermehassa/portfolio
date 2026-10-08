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

// Executa os handlers do componente com hooks controlados, sem DOM ou serviços.
function wizard(name, initialProps) {
  let cursor = 0, props = initialProps;
  const state = [], modules = new Map();
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
    useEffect() {},
    useLayoutEffect() {},
    useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
  };
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
  const { [name]: Component } = load("components/motorista/motorista-day-ending.tsx");
  let tree;
  const render = () => {
    cursor = 0;
    const child = Component(props);
    tree = child.type(child.props);
  };
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap((item) => nodes(item));
    if (!React.isValidElement(value)) return [];
    return [value, ...nodes(value.props.children)];
  }
  function text(value) {
    if (Array.isArray(value)) return value.map(text).join("");
    if (React.isValidElement(value)) return text(value.props.children);
    return value == null || typeof value === "boolean" ? "" : String(value);
  }
  const find = (predicate) => {
    const result = nodes(tree).find(predicate);
    assert.ok(result, "Elemento esperado não encontrado");
    return result;
  };
  const change = (label, value) => {
    const parent = find((node) => node.type === "label" && text(node.props.children).startsWith(label));
    const input = nodes(parent.props.children).find((node) => node.type === "input" || node.type === "textarea");
    input.props.onChange({ target: { value } });
    render();
  };
  render();
  return {
    stage: () => text(find((node) => node.type === "h3").props.children),
    labels: () => nodes(tree).filter((node) => node.type === "li").map((node) => node.props["aria-label"].split(":")[0]),
    value(label) {
      const parent = find((node) => node.type === "label" && text(node.props.children).startsWith(label));
      return nodes(parent.props.children).find((node) => node.type === "input" || node.type === "textarea").props.value;
    },
    change,
    income(source, value) {
      const fieldset = find((node) => node.type === "fieldset" && nodes(node.props.children).some((child) => child.type === "legend" && text(child.props.children) === source));
      nodes(fieldset.props.children).find((node) => node.type.name === "MoneyField").props.onChange(value);
      render();
    },
    pauses(value) { find((node) => node.type.name === "PauseEditor").props.onChange(value); render(); },
    error: () => find((node) => node.type.name === "FormError").props.children,
    click(label) { find((node) => node.type === "button" && text(node.props.children) === label).props.onClick(); render(); },
    async next() { await find((node) => node.type === "form").props.onSubmit({ preventDefault() {} }); render(); },
    refresh(nextProps) { props = { ...props, ...nextProps }; render(); },
    load,
  };
}

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
test.after(() => { globalThis.window = originalWindow; globalThis.document = originalDocument; });
globalThis.window = { matchMedia: () => ({ matches: true }) };
globalThis.document = { activeElement: null };

test("edição mantém rascunho ao voltar e snapshot inicial até uma única confirmação", async () => {
  let saves = 0, cancelled = 0, submission;
  const previous = { date: "2025-01-02", uberCents: 12500, ninetyNineCents: 0, otherCents: 0,
    uberRides: 3, ninetyNineRides: 0, minutes: 420, km: 88, note: "Original", shift: "night", status: "pending",
    origin: "legacy", unknown: { keep: true }, filled: { uberCents: true, minutes: true, km: true } };
  const original = structuredClone(previous);
  const app = wizard("EditingDayWizard", { mode: "edit", date: previous.date, day: previous, days: [previous], saving: false,
    onCancel: () => cancelled++, onSave: async (day, snapshot) => { saves++; submission = { day, snapshot }; return true; } });
  assert.deepEqual(app.labels(), ["Início", "Encerramento", "Pausas", "Dados finais", "Ganhos"]);
  assert.equal(app.value("Data e hora de início"), "");
  await app.next(); await app.next(); await app.next();
  assert.equal(app.value("Horas trabalhadas"), "7");
  assert.equal(app.value("KM do trabalho"), "88");
  app.change("Observação", "Corrigida");
  await app.next(); app.income("Uber", "R$ 200,00");
  app.click("Voltar");
  assert.equal(app.value("Observação"), "Corrigida");
  await app.next();
  app.refresh({ day: { ...previous, uberCents: 99900, note: "Outra sessão" } });
  assert.equal(saves, 0);
  await app.next();
  assert.equal(saves, 1); assert.equal(cancelled, 1);
  assert.equal(submission.day.uberCents, 20000);
  assert.equal(submission.day.status, "closed");
  assert.equal(submission.day.minutes, 420); assert.equal(submission.day.km, 88);
  assert.equal(submission.day.journey, undefined);
  assert.equal(Object.hasOwn(submission.day, "odometerStart"), false);
  assert.equal(submission.day.note, "Corrigida");
  assert.deepEqual(submission.day.unknown, previous.unknown);
  assert.equal(submission.snapshot, previous);
  assert.deepEqual(previous, original);
});

test("cadastro anterior bloqueia data ocupada, aceita ausência histórica e ganho zero confirmado", async () => {
  let saved;
  const existing = { date: "2025-01-02" };
  const app = wizard("EditingDayWizard", { mode: "register", date: existing.date, days: [existing], saving: false,
    onCancel() {}, onSave: async (day, previous) => { saved = { day, previous }; return true; } });
  await app.next();
  assert.equal(app.stage(), "Início"); assert.match(app.error(), /Use Editar/);
  app.change("Data de início do dia", "2025-01-03");
  await app.next(); await app.next(); await app.next(); await app.next();
  app.income("Outros", "R$ 0,00");
  await app.next();
  assert.equal(saved.previous, undefined);
  assert.equal(saved.day.date, "2025-01-03"); assert.equal(saved.day.status, "closed");
  assert.equal(saved.day.journey, undefined);
  assert.equal(saved.day.filled.otherCents, true);
  assert.equal(saved.day.filled.minutes, false); assert.equal(saved.day.filled.km, false);
  assert.equal(Object.hasOwn(saved.day, "odometerStart"), false);
  assert.equal(Object.hasOwn(saved.day, "odometerEnd"), false);
});

test("corrigir início não bloqueia a etapa seguinte e jornada pausada exige fim da pausa antes de salvar", async () => {
  let saved;
  const helper = wizard("EditingDayWizard", { mode: "register", date: "2025-01-02", days: [], saving: false, onCancel() {}, onSave: async () => true });
  const { journeyInstant } = helper.load("lib/motorista-journey.ts");
  const previous = { date: "2025-01-02", uberCents: 1000, ninetyNineCents: 0, otherCents: 0, uberRides: 0,
    ninetyNineRides: 0, minutes: 0, km: 0, status: "pending", odometerStart: 100,
    journey: { startedAt: journeyInstant("2025-01-02T09:00"), endedAt: null,
      pauses: [{ id: "p1", startedAt: journeyInstant("2025-01-02T12:00"), endedAt: null, reason: "Almoço" }], metadata: "keep" } };
  const app = wizard("EditingDayWizard", { mode: "edit", date: previous.date, day: previous, days: [previous], saving: false,
    onCancel() {}, onSave: async (day) => { saved = day; return true; } });
  app.change("Data e hora de início", "2025-01-02T08:00");
  await app.next(); assert.equal(app.stage(), "Encerramento");
  app.change("Data e hora de encerramento", "2025-01-02T18:00");
  await app.next(); await app.next();
  assert.equal(app.stage(), "Pausas"); assert.match(app.error(), /pausa/);
  app.pauses([{ ...previous.journey.pauses[0], startedInput: "2025-01-02T12:00", endedInput: "2025-01-02T13:00" }]);
  await app.next(); app.change("Odômetro final", "180"); await app.next(); await app.next();
  assert.equal(saved.minutes, 540); assert.equal(saved.km, 80);
  assert.equal(saved.journey.metadata, "keep"); assert.equal(saved.journey.pauses[0].reason, "Almoço");
  assert.equal(saved.status, "closed");
  assert.equal(previous.journey.endedAt, null);
});

test("falha na confirmação mantém o rascunho e cancelar não grava", async () => {
  let saves = 0, cancellations = 0;
  const app = wizard("EditingDayWizard", { mode: "register", date: "2025-01-02", days: [], saving: false,
    onCancel: () => cancellations++, onSave: async () => { saves++; return false; } });
  await app.next(); await app.next(); await app.next(); await app.next();
  app.income("Uber", "R$ 15,00"); await app.next();
  assert.equal(app.stage(), "Ganhos"); assert.equal(saves, 1); assert.equal(cancellations, 0);
  app.click("Voltar"); app.click("Cancelar");
  assert.equal(saves, 1); assert.equal(cancellations, 1);
});

test("encerramento do Início continua quatro etapas e usa exclusivamente seu callback transacional", async () => {
  let saved;
  const helper = wizard("EditingDayWizard", { mode: "register", date: "2025-01-02", days: [], saving: false, onCancel() {}, onSave: async () => true });
  const { journeyInstant } = helper.load("lib/motorista-journey.ts");
  const previous = { date: "2025-01-02", uberCents: 3000, ninetyNineCents: 0, otherCents: 0, uberRides: 0,
    ninetyNineRides: 0, minutes: 0, km: 0, status: "pending", odometerStart: 100,
    journey: { startedAt: journeyInstant("2025-01-02T09:00"), endedAt: null, pauses: [] } };
  const app = wizard("EndingDayWizard", { day: previous, categories: [], plans: [], saving: false,
    onCancel() {}, onFinish: async (submission) => { saved = submission; return true; } });
  assert.deepEqual(app.labels(), ["Encerramento", "Pausas", "Dados finais", "Ganhos"]);
  app.change("Data e hora de encerramento", "2025-01-02T18:00");
  await app.next(); await app.next(); app.change("Odômetro final", "200"); await app.next();
  assert.equal(saved, undefined); await app.next();
  assert.equal(saved.previous, previous); assert.equal(saved.day.minutes, 540);
  assert.equal(saved.day.km, 100); assert.deepEqual(saved.expenses, []);
});
