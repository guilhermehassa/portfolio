import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const modules = new Map();
function load(source) {
  const filename = resolve(root, source);
  if (modules.has(filename)) return modules.get(filename).exports;
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const sourceRequire = (specifier) => {
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier);
    const path = specifier.startsWith("@/") ? resolve(root, specifier.slice(2)) : resolve(dirname(filename), specifier);
    return load(`${path}${existsSync(`${path}.ts`) ? ".ts" : ".tsx"}`);
  };
  new Function("require", "module", "exports", code)(sourceRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { emptyDay, money } = load("lib/motorista.ts");
const { maintenanceExpenseFromInput } = load("lib/motorista-maintenance.ts");
const { default: Reports } = load("components/motorista/motorista-reports.tsx");
const render = (props) => renderToStaticMarkup(createElement(Reports, {
  filter: "month", from: "2025-01-01", to: "2025-01-31", reference: "2025-01-15",
  days: [], expenses: [], goals: [], plans: [], categories: [], controls: null, ...props,
}));
const metric = (markup, label, value) => assert.ok(markup.includes(`>${label}</span><strong>${value}</strong>`), `${label}: ${value}`);

test("Relatórios reúne sete grupos, custo registrado e manutenção reconhecida sem incluir futuro", () => {
  const master = maintenanceExpenseFromInput({ categoryId: "manutencao", totalCents: 10500, installments: 2,
    startMonth: "2025-01", note: "Revisão" }, undefined, "m1");
  const goals = [{ month: "2025-01", cents: 50000, variableDailyCents: 0, workDates: ["2025-01-15", "2025-01-16"] }];
  const markup = render({ goals, categories: [{ id: "manutencao", name: "Manutenção" }], expenses: [master,
    { id: "paid", date: "2025-01-15", categoryId: "sem-categoria", cents: 500 },
    { id: "future", date: "2025-01-16", categoryId: "sem-categoria", cents: 99999 },
  ], days: [{ ...emptyDay("2025-01-15"), status: "closed", uberCents: 10000, minutes: 120, km: 30 },
    { ...emptyDay("2025-01-16"), status: "closed", uberCents: 99999 }],
  });
  assert.deepEqual([...markup.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]),
    ["Resumos", "Médias", "Constatações", "Lucratividade", "Plataformas", "Gastos", "Veículo"]);
  metric(markup, "Total Ganhos", money(10000)); metric(markup, "Total Gastos", money(3125));
  metric(markup, "Saldo", money(6875)); metric(markup, "Lucro/dia", money(6875));
  assert.ok(markup.includes("sem-categoria"));
  assert.ok(markup.includes(`Revisão</strong> · ${money(2625)} no período`));
  assert.ok(markup.includes(`${money(10500)} em 2x a partir de 01/2025`));
  assert.ok(!markup.includes(money(99999)));
  for (const old of ["Resultado e meus dias", "Abrir dia", "Por classificação de turno", "Simular dias", "Mês próprio da meta", "Premissas e cobertura"])
    assert.ok(!markup.includes(old));
});

test("linha diária distingue ganho zero de ausência e não estende dados além da referência", () => {
  const markup = render({ days: [
    { ...emptyDay("2025-01-14"), status: "closed", filled: { uberCents: true } },
    { ...emptyDay("2025-01-15"), status: "closed", filled: {} },
    { ...emptyDay("2025-01-16"), status: "closed", uberCents: 25000 },
  ], goals: [{ month: "2025-01", cents: 50000, variableDailyCents: 0, workDates: ["2025-01-14", "2025-01-15", "2025-01-16"] }] });
  assert.ok(markup.includes(`2025-01-14 · Atingido: ${money(0)}`));
  assert.ok(!markup.includes("2025-01-15 · Atingido:"));
  assert.ok(!markup.includes("2025-01-16 · Atingido:"));
  assert.ok(markup.includes("Não informado"));
});

test("Veículo usa só consumo manual, mantém dia sem KM no gráfico e agrupa mestre atravessando meses", () => {
  const master = maintenanceExpenseFromInput({ categoryId: "manutencao", totalCents: 12003, installments: 2,
    startMonth: "2025-01", note: "Serviço único" }, undefined, "m1");
  const markup = render({ filter: "week", from: "2025-01-27", to: "2025-02-02", reference: "2025-02-02",
    days: [
      { ...emptyDay("2025-01-27"), status: "closed", consumption: 10, km: 10 },
      { ...emptyDay("2025-01-28"), status: "closed", consumption: 20, km: 30 },
      { ...emptyDay("2025-01-29"), status: "closed", consumption: 40, km: 0 },
      { ...emptyDay("2025-01-30"), status: "closed", km: 50 },
    ], expenses: [master], goals: [
      { month: "2025-01", cents: 50000, workDates: ["2025-01-27"] },
      { month: "2025-02", cents: 50000, workDates: ["2025-02-01"] },
    ] });
  metric(markup, "Consumo médio geral", "16 km/L");
  assert.ok(markup.includes("2025-01-29 · Consumo manual: 40"));
  assert.ok(!markup.includes("2025-01-30 · Consumo manual:"));
  assert.equal((markup.match(/Serviço único<\/strong>/g) ?? []).length, 1);
  assert.ok(markup.includes(`${money(12003)} no período`));
});

test("período inteiramente futuro é bloqueado sem métricas falsas", () => {
  const markup = render({ from: "2025-02-01", to: "2025-02-28" });
  assert.ok(markup.includes("Selecione a semana ou o mês atual, ou um período passado."));
  assert.ok(!markup.includes("Total Ganhos"));
  assert.ok(!markup.includes("NaN")); assert.ok(!markup.includes("Infinity"));
});

test("horas, KM ou viagens incompletos indisponibilizam os índices afetados preservando totais", () => {
  const markup = render({ days: [
    { ...emptyDay("2025-01-14"), status: "closed", uberCents: 10000, minutes: 120, km: 30, uberRides: 4 },
    { ...emptyDay("2025-01-15"), status: "closed", uberCents: 5000 },
  ] });
  metric(markup, "Total Ganhos", money(15000)); metric(markup, "Dias", "2");
  for (const label of ["Horas trabalhadas", "Ganho/hora", "Lucro/hora", "Ganho/KM", "Lucro/KM", "Ganho/viagem"])
    metric(markup, label, "—");
  metric(markup, "Ganho/dia", money(7500));
});
