import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const loadedModule = { exports: {} };
  modules.set(name, loadedModule);
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = (id) => load(id.replace(/^\.\//, ""));
  new Function("require", "exports", "module", code)(require, loadedModule.exports, loadedModule);
  return loadedModule.exports;
}

const { emptyDay } = load("motorista");
const { weeklyGoalPlanning } = load("motorista-weekly-goal");
const day = (date, fields = {}) => ({ ...emptyDay(date), ...fields });
const expense = (date, cents, fields = {}) => ({
  id: date, date, cents, categoryId: "personal", note: "", ...fields,
});
const planning = (fields = {}) => weeklyGoalPlanning({
  reference: "2026-10-07", goals: [], days: [], expenses: [], ...fields,
});

test("meta semanal usa todos os dias planejados e mantém registros futuros fora do realizado", () => {
  const result = planning({
    goals: [{ month: "2026-10", cents: 100000,
      workDates: ["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14"] }],
    days: [
      day("2026-10-04", { uberCents: 99999 }),
      day("2026-10-05", { status: "closed", uberCents: 0, filled: { uberCents: true } }),
      day("2026-10-07", { status: "pending", uberCents: 1000, ninetyNineCents: 2000, otherCents: 300 }),
      day("2026-10-08", { status: "closed", uberCents: 99999 }),
    ],
    expenses: [expense("2026-10-06", 100, { scope: "personal" }), expense("2026-10-08", 500)],
  });
  assert.deepEqual([result.from, result.to, result.actualTo], ["2026-10-05", "2026-10-11", "2026-10-07"]);
  assert.equal(result.goal, 50000);
  assert.deepEqual([result.gains, result.costs, result.balance], [3300, 100, 3200]);
  assert.equal(result.percent, 6.4);
});

test("semana cruzando meses combina metas e calendários de cada mês", () => {
  const result = planning({ reference: "2026-10-01", goals: [
    { month: "2026-09", cents: 10001, workDates: ["2026-09-01", "2026-09-28", "2026-09-29", "2026-09-30"] },
    { month: "2026-10", cents: 20003, workDates: ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"] },
  ] });
  assert.deepEqual([result.from, result.to], ["2026-09-28", "2026-10-04"]);
  assert.deepEqual(result.months, ["2026-09", "2026-10"]);
  assert.equal(result.goal, 15502);
});

test("herda apenas a meta positiva e usa o calendário padrão próprio do mês", () => {
  const result = planning({ goals: [
    { month: "2026-09", cents: 100000, workDates: ["2026-09-28"] },
    { month: "2026-11", cents: 900000 },
  ] });
  assert.equal(result.goal, 22727);
});

test("calendário explícito vazio mantém a meta semanal indisponível mesmo com meta herdada", () => {
  const result = planning({ goals: [
    { month: "2026-09", cents: 100000 },
    { month: "2026-10", cents: 0, workDates: [] },
  ], days: [day("2026-10-07", { uberCents: 1500 })] });
  assert.equal(result.goal, null);
  assert.equal(result.percent, null);
  assert.equal(result.balance, 1500);
});

test("falta de meta em um dos meses não fabrica uma meta para parte da semana", () => {
  const result = planning({ reference: "2026-10-01", goals: [{ month: "2026-10", cents: 100000 }] });
  assert.equal(result.goal, null);
  assert.equal(result.percent, null);
});

test("sem meta mantém os totais financeiros e o percentual indisponível", () => {
  const result = planning({ days: [day("2026-10-07", { uberCents: 1000 })], expenses: [expense("2026-10-07", 1500)] });
  assert.equal(result.goal, null);
  assert.equal(result.percent, null);
  assert.deepEqual([result.gains, result.costs, result.balance], [1000, 1500, -500]);
});

test("sem dias planejados na semana o alvo é zero sem dividir o percentual", () => {
  const result = planning({ goals: [{ month: "2026-10", cents: 100000, workDates: ["2026-10-12"] }] });
  assert.equal(result.goal, 0);
  assert.equal(result.percent, null);
});

test("arredonda centavos uma única vez após somar as frações dos dois meses", () => {
  const result = planning({ reference: "2026-10-01", goals: [
    { month: "2026-09", cents: 1, workDates: ["2026-09-01", "2026-09-28"] },
    { month: "2026-10", cents: 1, workDates: ["2026-10-01", "2026-10-05"] },
  ] });
  assert.equal(result.goal, 1);
});

test("preserva centavos perto do limite seguro mesmo com produto intermediário maior", () => {
  const result = planning({ goals: [{ month: "2026-10", cents: Number.MAX_SAFE_INTEGER,
    workDates: ["2026-10-05", "2026-10-06", "2026-10-12"] }] });
  assert.equal(result.goal, 6004799503160661);
  assert.equal(Number.isSafeInteger(result.goal), true);
});

test("alvo combinado acima do limite seguro fica indisponível", () => {
  const result = planning({ reference: "2026-10-01", goals: [
    { month: "2026-09", cents: Number.MAX_SAFE_INTEGER, workDates: ["2026-09-28"] },
    { month: "2026-10", cents: Number.MAX_SAFE_INTEGER, workDates: ["2026-10-01"] },
  ] });
  assert.equal(result.goal, null);
  assert.equal(result.percent, null);
});

test("percentual conserva saldos negativos e progresso acima de cem", () => {
  const goals = [{ month: "2026-10", cents: 1000, workDates: ["2026-10-07"] }];
  assert.equal(planning({ goals, expenses: [expense("2026-10-07", 250)] }).percent, -25);
  assert.equal(planning({ goals, days: [day("2026-10-07", { uberCents: 1250 })] }).percent, 125);
});
