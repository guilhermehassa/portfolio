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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const sourceRequire = (specifier) => {
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier);
    const path = specifier.startsWith("@/")
      ? resolve(root, specifier.slice(2))
      : resolve(dirname(filename), specifier);
    return load(`${path}${existsSync(`${path}.ts`) ? ".ts" : ".tsx"}`);
  };
  new Function("require", "module", "exports", code)(sourceRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { emptyDay, money, isoWeek } = load("lib/motorista.ts");
const { monthlyPlanning } = load("lib/motorista-evolution.ts");
const { weeklyGoalPlanning } = load("lib/motorista-weekly-goal.ts");
const { default: HomeCards, weeklyGains } = load("components/motorista/motorista-home-cards.tsx");
const { PlanningProgress } = load("components/motorista/motorista-planning-progress.tsx");
const render = (component, props) => renderToStaticMarkup(createElement(component,
  component === HomeCards ? {
    week: isoWeek(props.today), onWeekChange: () => {}, expenses: [],
    weeklyPlan: weeklyGoalPlanning({ reference: props.today, goals: [], days: props.days, expenses: props.expenses ?? [] }),
    ...props,
  } : props));
const planning = (overrides = {}) => monthlyPlanning({
  month: "2026-10", reference: "2026-10-07", days: [], expenses: [], categories: [],
  goals: [], plans: [], ...overrides,
});

test("semana reúne as três origens, pendências e datas futuras entre segunda e domingo", () => {
  const days = [
    { ...emptyDay("2026-10-04"), uberCents: 90000 },
    { ...emptyDay("2026-10-05"), uberCents: 100 },
    { ...emptyDay("2026-10-06"), status: "pending", uberCents: 1000, ninetyNineCents: 500, otherCents: 250 },
    { ...emptyDay("2026-10-11"), status: "pending", otherCents: 725 },
    { ...emptyDay("2026-10-12"), uberCents: 80000 },
  ];
  const week = weeklyGains(days, "2026-10-07");
  assert.equal(week.from, "2026-10-05");
  assert.equal(week.to, "2026-10-11");
  assert.equal(week.rows.length, 7);
  assert.equal(week.total, 2575);
  assert.equal(week.rows[1].cents, 1750);
  assert.equal(week.rows[6].cents, 725);
  const markup = render(HomeCards, { plan: planning(), days, today: "2026-10-07" });
  for (const cents of [100, 1750, 725]) {
    assert.ok(markup.includes(`<span class="motorista-weekly-bar-label">${money(cents)}</span>`));
  }
});

test("semana civil atravessa o ano sem trocar as datas dos registros", () => {
  const week = weeklyGains([], "2026-01-01");
  assert.deepEqual(week.rows.map((row) => row.date), [
    "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04",
  ]);
  assert.equal(week.total, 0);
});

test("zero confirmado se distingue de jornada sem ganhos e data sem documento", () => {
  const days = [
    { ...emptyDay("2026-10-06"), filled: { uberCents: true } },
    { ...emptyDay("2026-10-07"), status: "pending" },
  ];
  const week = weeklyGains(days, "2026-10-07");
  assert.equal(week.rows[0].reported, false);
  assert.equal(week.rows[1].reported, true);
  assert.equal(week.rows[1].cents, 0);
  assert.equal(week.rows[2].reported, false);
  assert.equal(week.total, 0);
  const markup = render(HomeCards, { plan: planning(), days, today: "2026-10-07" });
  assert.ok(markup.includes(`<span class="motorista-sr-only">${money(0)}</span>`));
  assert.ok(markup.includes('<span class="motorista-sr-only">Ganhos não informados</span>'));
});

test("Meta pra hoje apresenta requiredDaily existente e percentual usa saldo em vez de ganhos", () => {
  const days = [{ ...emptyDay("2026-10-07"), status: "pending", uberCents: 10000 }];
  const expenses = [{ id: "gasto", date: "2026-10-07", categoryId: "outros", cents: 5000, note: "" }];
  const plan = planning({
    days,
    expenses,
    goals: [{ month: "2026-10", cents: 100000, workDates: ["2026-10-07", "2026-10-08"], variableDailyCents: 0 }],
  });
  const markup = render(HomeCards, { plan, days, expenses, today: "2026-10-07" });
  assert.equal(plan.requiredDaily, 47500);
  assert.equal(plan.percent, 5);
  assert.ok(markup.includes(money(plan.requiredDaily)));
  assert.ok(markup.includes(">5%</strong>"));
  assert.ok(markup.includes(money(10000)));
  assert.ok(markup.includes(`Ganhos: ${money(10000)} | Gastos: ${money(5000)} | Saldo: ${money(5000)}`));
});

test("barra limita o desenho, preservando percentual negativo e acima de cem no texto", () => {
  for (const [percent, bounded] of [[-25, 0], [125, 100]]) {
    const markup = render(PlanningProgress, { percent });
    assert.ok(markup.includes(`aria-valuenow="${bounded}"`));
    assert.ok(markup.includes(`width:${bounded}%`));
    assert.ok(markup.includes(`${percent}% da meta de saldo`));
  }
  const absent = render(PlanningProgress, { percent: null });
  assert.ok(!absent.includes('role="progressbar"'));
  assert.ok(absent.includes("Defina uma meta"));
});

test("cards sem meta ou dias restantes mantêm valores indisponíveis e semana acessível", () => {
  const markup = render(HomeCards, { plan: planning(), days: [], today: "2026-10-07" });
  assert.ok(markup.includes("Meta pra hoje"));
  assert.equal((markup.match(/<time dateTime=/g) ?? []).length, 7);
  assert.ok(markup.includes("ganhos não informados"));
  assert.ok(!markup.includes("NaN"));
  assert.ok(!markup.includes("Infinity"));
  const noRemaining = planning({ goals: [{ month: "2026-10", cents: 10000, workDates: [] }] });
  assert.equal(noRemaining.requiredDaily, null);
  assert.ok(render(HomeCards, { plan: noRemaining, days: [], today: "2026-10-07" }).includes("Sem dias planejados restantes"));
});

test("seletor semanal muda intervalo, sete barras e total sem alterar as metas do Início", () => {
  const days = [
    { ...emptyDay("2026-10-07"), uberCents: 10000 },
    { ...emptyDay("2026-09-28"), ninetyNineCents: 2000, status: "pending" },
    { ...emptyDay("2026-10-04"), otherCents: 3000 },
  ];
  const plan = planning({ days, goals: [{ month: "2026-10", cents: 100000, variableDailyCents: 0 }] });
  const current = render(HomeCards, { plan, days, today: "2026-10-07" });
  const selected = render(HomeCards, { plan, days, today: "2026-10-07", week: "2026-W40" });
  assert.ok(current.includes("05/10/2026 a 11/10/2026"));
  assert.ok(selected.includes("28/09/2026 a 04/10/2026"));
  assert.equal(weeklyGains(days, "2026-10-07", "2026-W40").total, 5000);
  assert.equal((selected.match(/<time dateTime=/g) ?? []).length, 7);
  assert.ok(selected.includes(money(5000)));
  assert.ok(!selected.includes('dateTime="2026-10-07"'));
  for (const markup of [current, selected]) {
    assert.ok(markup.includes(money(plan.requiredDaily)));
    assert.ok(markup.includes(`>${plan.percent}%</strong>`));
    assert.ok(markup.includes('type="week"'));
    assert.ok(!markup.includes("<select"));
  }
});

test("semana inválida fica indisponível sem fabricar total ou datas", () => {
  const markup = render(HomeCards, { plan: planning(), days: [], today: "2026-10-07", week: "" });
  assert.ok(markup.includes("Selecione uma semana válida"));
  assert.ok(!markup.includes("<time dateTime="));
  assert.ok(!markup.includes("NaN"));
  assert.ok(!markup.includes("Infinity"));
});

test("meta semanal combina os meses e mantém realizado até hoje ao trocar só o gráfico", () => {
  const today = "2026-10-01";
  const goals = [
    { month: "2026-09", cents: 100000, workDates: ["2026-09-28", "2026-09-29", "2026-09-30"], variableDailyCents: 0 },
    { month: "2026-10", cents: 100000, workDates: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-10"], variableDailyCents: 0 },
  ];
  const days = [
    { ...emptyDay("2026-09-29"), uberCents: 20000, status: "pending" },
    { ...emptyDay("2026-10-01"), ninetyNineCents: 15000 },
    { ...emptyDay("2026-10-02"), otherCents: 10000 },
  ];
  const expenses = [
    { id: "anterior", date: "2026-09-30", categoryId: "outros", cents: 5000, note: "" },
    { id: "hoje", date: "2026-10-01", categoryId: "outros", cents: 3000, note: "" },
    { id: "futuro", date: "2026-10-02", categoryId: "outros", cents: 7000, note: "" },
  ];
  const plan = planning({ reference: today, goals, days, expenses });
  const weeklyPlan = weeklyGoalPlanning({ reference: today, goals, days, expenses });
  const current = render(HomeCards, { plan, weeklyPlan, days, expenses, today });
  const selected = render(HomeCards, { plan, weeklyPlan, days, expenses, today, week: "2026-W39" });
  for (const markup of [current, selected]) {
    assert.ok(markup.includes("09/2026 · 10/2026"));
    assert.ok(markup.includes(">15%</strong>"));
    assert.ok(markup.includes(`Ganhos: ${money(35000)} | Gastos: ${money(8000)} | Saldo: ${money(27000)}`));
    assert.ok(markup.includes(">12%</strong>"));
    assert.ok(markup.includes(`Ganhos: ${money(15000)} | Gastos: ${money(3000)} | Saldo: ${money(12000)}`));
    assert.ok(markup.indexOf("Meta pra hoje") < markup.indexOf("Meta da semana"));
    assert.ok(markup.indexOf("Meta da semana") < markup.indexOf("Meta do mês"));
    assert.ok(markup.indexOf("Meta do mês") < markup.indexOf("Ganhos da semana"));
  }
  assert.ok(current.includes(money(45000)));
  assert.ok(!selected.includes('dateTime="2026-10-01"'));
});
