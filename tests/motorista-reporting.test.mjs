import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const loaded = { exports: {} };
  modules.set(name, loaded);
  const code = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", "module", code)((id) => load(id.replace(/^\.\//, "")), loaded.exports, loaded);
  return loaded.exports;
}
const reporting = load("motorista-reporting");
const base = load("motorista");
const calc = load("motorista-evolution");
const { maintenanceExpenseFromInput } = load("motorista-maintenance");
const master = (input = {}, id = "isolated") => maintenanceExpenseFromInput({
  categoryId: "manutencao", totalCents: 1001, startMonth: "2026-09", installments: 2, note: "Troca de peças", ...input,
}, undefined, id);
const goals = [
  { month: "2026-09", cents: 1000, workDates: ["2026-09-01", "2026-09-28", "2026-09-30"] },
  { month: "2026-10", cents: 2000, workDates: ["2026-10-01", "2026-10-02", "2026-10-12"] },
];

test("meta do relatório acompanha semana selecionada cruzando meses e herança mensal existente", () => {
  assert.equal(reporting.reportGoal("week", "2026-09-28", "2026-10-04", goals), 2000);
  assert.equal(reporting.reportGoal("month", "2026-11-01", "2026-11-30", goals), 2000);
  assert.equal(reporting.reportGoal("month", "2026-08-01", "2026-08-31", goals), null);
  assert.equal(reporting.reportGoal("week", "", "2026-10-04", goals), null);
});

test("barras incluem combustível, cotas de manutenção e categoria ausente sem contar mestre", () => {
  const expenses = [master(), { id: "fuel", date: "2026-10-01", categoryId: "combustivel", kind: "fuel", cents: 100, note: "" },
    { id: "unknown", date: "2026-10-01", categoryId: "removed-category", cents: 25, note: "" }];
  const rows = reporting.reportCategoryCosts(expenses, goals,
    [{ id: "manutencao", name: "Manutenção" }, { id: "combustivel", name: "Combustível" }],
    "2026-09-28", "2026-10-04", "2026-10-01");
  assert.deepEqual(rows, [{ id: "manutencao", label: "Manutenção", cents: 501 },
    { id: "combustivel", label: "Combustível", cents: 100 }, { id: "removed-category", label: "removed-category", cents: 25 }]);
});

test("listagem de veículo agrupa cotas por mestre ao cruzar meses e conserva total/snapshot", () => {
  const expense = master();
  const before = JSON.stringify(expense);
  const rows = reporting.reportMaintenanceRows([expense], goals, "2026-09-28", "2026-10-04", "2026-10-01");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].expense, expense);
  assert.deepEqual(rows[0].months, ["2026-09", "2026-10"]);
  assert.equal(rows[0].allocatedCents, 501);
  assert.equal(rows[0].scheduledCents, 668);
  assert.equal(rows[0].futureCents, 167);
  assert.equal(rows[0].totalCents, 1001);
  assert.equal(rows[0].installments, 2);
  assert.equal(rows[0].startMonth, "2026-09");
  assert.equal(rows[0].name, "Troca de peças");
  assert.equal(JSON.stringify(expense), before);
});

const day = (date, extra = {}) => ({ ...base.emptyDay(date), status: "closed", filled: { uberCents: true }, ...extra });
const expense = (date, cents, extra = {}) => ({ id: date, date, cents, note: "", categoryId: "combustivel", ...extra });
const analysis = (extra = {}) => reporting.reportAnalysis({ filter: "month", from: "2026-10-01", to: "2026-10-31",
  reference: "2026-10-07", days: [], expenses: [], categories: [], goals: [], ...extra });

test("resumos e todos lucros incorporam gastos sem jornada e manutenção proporcional", () => {
  const days = [day("2026-10-05", { uberCents: 1000, minutes: 60, km: 10, uberRides: 2,
    filled: { uberCents: true, minutes: true, km: true, uberRides: true } })];
  const expenses = [master({ startMonth: "2026-10", totalCents: 101, installments: 1 }), expense("2026-10-06", 50)];
  const goals = [{ month: "2026-10", cents: 2000, workDates: ["2026-10-05", "2026-10-07"] }];
  const result = analysis({ days, expenses, goals });
  assert.deepEqual(result.summary, { gains: 1000, costs: 151, balance: 849, workedDays: 1, hours: 1, km: 10, trips: 2 });
  assert.deepEqual(result.averages, { hoursPerDay: 1, gainsPerDay: 1000, profitPerDay: 849, costsPerDay: 151 });
  assert.deepEqual(result.findings, { gainsPerHour: 1000, gainsPerDay: 1000, gainsPerKm: 100,
    profitPerHour: 849, profitPerDay: 849, profitPerKm: 84.9, gainsPerTrip: 500 });
  assert.equal(result.profitability.balance, 849);
  assert.equal(result.profitability.missing, 1151);
  assert.equal(result.profitability.required, 1151 * (1000 / 849));
});

test("relatórios cortam ganhos e gastos realizados hoje em mês e semana, mantêm datas futuras da meta no gráfico e bloqueiam período totalmente futuro", () => {
  const result = analysis({ filter: "week", from: "2026-10-05", to: "2026-10-11", days: [day("2026-10-07", { uberCents: 10 }),
    day("2026-10-08", { uberCents: 999 })], expenses: [expense("2026-10-08", 999)] });
  assert.equal(result.effectiveTo, "2026-10-07");
  assert.equal(result.summary.gains, 10);
  assert.equal(result.summary.costs, 0);
  assert.deepEqual(result.chart.dates, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.equal(result.chart.attained[2], 10);
  assert.equal(result.chart.attained[3], null);
  assert.throws(() => analysis({ from: "2026-11-01", to: "2026-11-30" }), /atuais ou passados/);
  assert.throws(() => analysis({ filter: "day" }), /semana ou mês/);
});

test("horas e KM incompletos anulam indicadores afetados preservando totais disponíveis e médias diárias", () => {
  const days = [day("2026-10-05", { uberCents: 1000, minutes: 60, km: 10,
    filled: { uberCents: true, minutes: true, km: true } }), day("2026-10-06", { uberCents: 1000 })];
  const result = analysis({ days });
  assert.equal(result.summary.hours, 1);
  assert.equal(result.summary.km, 10);
  assert.equal(result.summary.workedDays, 2);
  assert.equal(result.averages.gainsPerDay, 1000);
  assert.equal(result.averages.profitPerDay, 1000);
  for (const key of ["gainsPerHour", "gainsPerKm", "profitPerHour", "profitPerKm"]) assert.equal(result.findings[key], null);
  assert.equal(result.averages.hoursPerDay, null);
  assert.equal(result.coverage.hoursComplete, false);
  assert.equal(result.coverage.kmComplete, false);
});

test("zero confirmado completa campos sem fabricar divisão quando divisor é zero", () => {
  const result = analysis({ days: [day("2026-10-05", { filled: { uberCents: true, minutes: true, km: true, uberRides: true, consumption: true }, consumption: 0 })] });
  assert.equal(result.coverage.hoursComplete, true);
  assert.equal(result.coverage.kmComplete, true);
  assert.equal(result.averages.hoursPerDay, 0);
  assert.equal(result.averages.gainsPerDay, 0);
  assert.equal(result.findings.gainsPerHour, null);
  assert.equal(result.findings.gainsPerKm, null);
  assert.equal(result.findings.gainsPerTrip, null);
  assert.equal(result.chart.attained[4], 0);
  assert.equal(result.chart.attained[0], null);
  assert.equal(result.vehicle.consumptionValues[4], 0);
  assert.equal(result.vehicle.consumption, null);
});

test("dias trabalhados mantém fechados e legado positivo sem criar jornada por despesa", () => {
  const result = analysis({ days: [day("2026-10-01"), day("2026-10-02", { status: undefined, uberCents: 50 }),
    day("2026-10-03", { status: "pending", uberCents: 20 }), day("2026-10-04", { status: "off" })],
    expenses: [expense("2026-10-06", 5)] });
  assert.equal(result.summary.workedDays, 2);
  assert.equal(result.summary.gains, 70);
  assert.equal(result.averages.gainsPerDay, 35);
  assert.equal(result.coverage.pendingDays, 1);
  assert.equal(result.coverage.legacyDays, 1);
});

test("plataformas usam próprios totais e completude independente, participação considera Outros", () => {
  const result = analysis({ days: [day("2026-10-05", { uberCents: 1000, ninetyNineCents: 500, otherCents: 500, uberRides: 2,
    filled: { uberCents: true, ninetyNineCents: true, otherCents: true, uberRides: true } })] });
  assert.equal(result.platforms[0].gains, 1000);
  assert.equal(result.platforms[0].averagePerTrip, 500);
  assert.equal(result.platforms[0].share, 50);
  assert.equal(result.platforms[1].gains, 500);
  assert.equal(result.platforms[1].averagePerTrip, null);
  assert.equal(result.platforms[1].share, 25);
  assert.equal(result.findings.gainsPerTrip, null);
  const full = analysis({ days: [day("2026-10-05", { uberCents: 1000, ninetyNineCents: 500, otherCents: 500, uberRides: 2, ninetyNineRides: 1,
    filled: { uberCents: true, ninetyNineCents: true, otherCents: true, uberRides: true, ninetyNineRides: true } })] });
  assert.equal(full.findings.gainsPerTrip, 500);
  assert.equal(full.platforms[1].averagePerTrip, 500);
  const missingGain = analysis({ days: [day("2026-10-05", { filled: { otherCents: true, uberRides: true }, uberRides: 2 })] });
  assert.equal(missingGain.platforms[0].averagePerTrip, null);
});

test("Meta diária aplica quociente dos últimos 30 dias, sobe após resultado abaixo da meta, cai após superar a meta e projeta dias previstos futuros", () => {
  const goals = [{ month: "2026-10", cents: 4000, workDates: ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-09", "2026-10-10"] }];
  // Dia 05: ganho 300, gasto 100 -> saldo 200 (abaixo da meta diária inicial de 800)
  // Dia 06: ganho 2700, gasto 700 -> saldo 2000 (acima da meta diária de 950)
  // Dia 07 (hoje, encerrado): ganho 1500, gasto 300 -> saldo 1200
  // Saldo acumulado até hoje (07/10): 3400. Falta 600 para os 2 dias futuros previstos (09/10 e 10/10) -> 300/dia * multiplier
  const days = [
    day("2026-10-05", { uberCents: 300 }),
    day("2026-10-06", { uberCents: 2700 }),
    day("2026-10-07", { uberCents: 1500 }),
  ];
  const expenses = [expense("2026-10-05", 100), expense("2026-10-06", 700), expense("2026-10-07", 300)];
  const result = analysis({ days, goals, expenses, reference: "2026-10-07" });
  const multiplier = 4500 / 3400;
  // Dias 01 a 04 não estavam previstos no calendário -> null na linha da meta
  assert.deepEqual(result.chart.meta.slice(0, 4), [null, null, null, null]);
  // Dia 05 (início): falta 4000 / 5 dias = 800 * multiplier
  assert.equal(result.chart.meta[4], 800 * multiplier);
  // Dia 06 (após fazer só 200 de saldo no dia 05): falta (4000 - 200) / 4 dias = 950 * multiplier (AUMENTOU)
  assert.equal(result.chart.meta[5], 950 * multiplier);
  assert.ok(result.chart.meta[5] > result.chart.meta[4]);
  // Dia 07 (após fazer 2000 de saldo no dia 06): falta (4000 - 2200) / 3 dias = 600 * multiplier (DIMINUIU)
  assert.equal(result.chart.meta[6], 600 * multiplier);
  assert.ok(result.chart.meta[6] < result.chart.meta[5]);
  // Dia 08 não previsto -> null; Dias 09 e 10 previstos no futuro -> requiredDaily = (600 / 2) * multiplier = 300 * multiplier
  assert.equal(result.chart.meta[7], null);
  assert.equal(result.chart.meta[8], 300 * multiplier);
  assert.equal(result.chart.meta[9], 300 * multiplier);
  assert.equal(result.chart.attained[4], 300);
  assert.equal(result.chart.attained[5], 2700);
  assert.equal(result.chart.attained[6], 1500);
  assert.equal(result.chart.attained[8], null);
  assert.equal(result.profitability.balance, 3400);
  assert.equal(result.profitability.missing, 600);
  assert.equal(result.profitability.required, 600 * multiplier);
  assert.equal(result.profitability.requiredDaily, 300 * multiplier);
});

test("ganho necessário aplica quociente dos últimos 30 dias sobre o déficit atual, sem gastos futuros", () => {
  const result = analysis({ goals: [{ month: "2026-10", cents: 1000, variableDailyCents: 99999, workDates: ["2026-10-05", "2026-10-09"] }],
    days: [day("2026-10-05", { uberCents: 500 })], expenses: [master({ totalCents: 100, startMonth: "2026-10", installments: 1 }),
      expense("2026-10-09", 999999)], plans: [{ id: "p", date: "2026-10-09", cents: 99999, categoryId: "x", note: "" }] });
  assert.equal(result.summary.costs, 50);
  assert.equal(result.profitability.balance, 450);
  assert.equal(result.profitability.missing, 550);
  assert.equal(result.profitability.required, 550 * (500 / 450));
  assert.equal(result.profitability.futureCosts, 0);
});

test("período passado mantém déficit histórico e Meta reconstruída sem inventar dias restantes", () => {
  const result = analysis({ reference: "2026-11-05", goals: [{ month: "2026-10", cents: 1000, workDates: ["2026-10-05"] }],
    days: [day("2026-10-05", { uberCents: 200 })] });
  assert.equal(result.ended, true);
  assert.equal(result.profitability.required, 800);
  assert.equal(result.profitability.remainingDays, 0);
  assert.equal(result.profitability.requiredDaily, null);
  assert.equal(result.chart.meta[4], 1000);
});

test("consumo manual é razão física ponderada pela distância, ausência lacuna e dia sem KM só linha", () => {
  const days = [day("2026-10-01", { km: 10, consumption: 10, filled: { km: true, consumption: true } }),
    day("2026-10-02", { km: 30, consumption: 20, filled: { km: true, consumption: true } }),
    day("2026-10-03", { consumption: 40, filled: { consumption: true } })];
  const result = analysis({ days });
  assert.equal(result.vehicle.consumption, 16);
  assert.equal(result.vehicle.consumptionCoveredDays, 2);
  assert.equal(result.vehicle.consumptionRecordedDays, 3);
  assert.deepEqual(result.vehicle.consumptionValues.slice(0, 7), [10, 20, 40, null, null, null, null]);
  assert.equal(result.vehicle.consumptionValues.length, 31);
  assert.equal(result.vehicle.consumptionUnit, "L");
});

test("sem meta/calendário mantém valores reais sem fabricar Meta, consumo ou divisores", () => {
  const result = analysis({ expenses: [master({ startMonth: "2026-10", totalCents: 310, installments: 1 })],
    goals: [{ month: "2026-10", cents: 0, workDates: [] }] });
  assert.equal(result.summary.costs, 70);
  assert.equal(result.summary.workedDays, 0);
  assert.equal(result.profitability.goal, null);
  assert.equal(result.averages.gainsPerDay, null);
  assert.deepEqual(result.chart.meta, Array(31).fill(null));
  assert.equal(result.vehicle.consumption, null);
});

test("provisões retiradas aceitam round-trip como JSON desconhecido e não têm efeito funcional", () => {
  const profile = { id: "legacy", effectiveFrom: "2026-01-01", vehicle: "owned", fuelType: "Gasolina", unit: "L",
    workShare: 100, consumption: 10, priceCentsPerUnit: 100,
    fixedMonthlyCents: { foreign: [0, null] }, wearCentsPerKm: "old", maintenanceCentsPerKm: false };
  const backup = { version: 4, exportedAt: "2026-10-08T12:00:00.000Z", days: [], expenses: [], categories: [],
    goals: [], plannedExpenses: [], costProfiles: [profile] };
  assert.deepEqual(base.validateBackup(JSON.parse(JSON.stringify(backup))), { ...backup, version: 5, paymentMethods: [] });
  const snapshot = JSON.stringify(profile);
  const result = calc.estimateDay(day("2026-10-05", { uberCents: 1000, km: 10 }), [], [], [profile]);
  assert.equal(result.cost, 100);
  assert.equal(Object.hasOwn(result, "fixed"), false);
  assert.equal(Object.hasOwn(result, "wear"), false);
  assert.equal(JSON.stringify(profile), snapshot);
  assert.throws(() => base.validateBackup({ ...backup, costProfiles: [{ ...profile, wearCentsPerKm: { constructor: "bad" } }] }), /JSON/);
});
