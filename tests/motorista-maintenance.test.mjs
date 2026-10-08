import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const loaded = { exports: {} };
  modules.set(name, loaded);
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", "module", code)((id) => load(id.replace(/^\.\//, "")), loaded.exports, loaded);
  return loaded.exports;
}
const base = load("motorista");
const maintenance = load("motorista-maintenance");
const calc = load("motorista-evolution");
const { weeklyGoalPlanning } = load("motorista-weekly-goal");
const category = { id: "manutencao", name: "Manutenção", scope: "vehicle", costKind: "maintenance" };
const make = (overrides = {}, previous) => maintenance.maintenanceExpenseFromInput({
  categoryId: category.id, totalCents: 10001, startMonth: "2026-10", installments: 2, note: "",
  ...overrides,
}, previous, "isolated");
const day = (date, extra = {}) => ({ ...base.emptyDay(date), status: "closed", filled: { uberCents: true }, ...extra });
const ordinary = (date, cents, extra = {}) => ({ id: date, date, categoryId: category.id, cents, note: "", ...extra });
const sum = (items, key = "cents") => items.reduce((s, item) => s + item[key], 0);
const backup = (expenses, extra = {}) => ({ version: 4, exportedAt: "2026-10-08T12:00:00.000Z",
  days: [], expenses, categories: [category], goals: [], plannedExpenses: [], costProfiles: [], ...extra });

test("parcelas conservam centavos e resíduos nas primeiras, atravessando ano", () => {
  assert.deepEqual(maintenance.installmentsPreview({ totalCents: 1001, startMonth: "2026-12", installments: 3 }), [
    { month: "2026-12", cents: 334 }, { month: "2027-01", cents: 334 }, { month: "2027-02", cents: 333 },
  ]);
  assert.deepEqual(maintenance.installmentsPreview({ totalCents: 1, startMonth: "2026-10", installments: 3 }), [
    { month: "2026-10", cents: 1 }, { month: "2026-11", cents: 0 }, { month: "2026-12", cents: 0 },
  ]);
  const maximum = maintenance.installmentsPreview({ totalCents: Number.MAX_SAFE_INTEGER, startMonth: "2026-10", installments: 7 });
  assert.equal(maximum.reduce((s, row) => s + BigInt(row.cents), BigInt(0)), BigInt(Number.MAX_SAFE_INTEGER));
  assert.deepEqual(maintenance.installmentsPreview({ totalCents: 17, startMonth: "2026-10", installments: 1 }), [{ month: "2026-10", cents: 17 }]);
});

test("construção valida total, meses, parcelas, categoria e descrição sem fabricar registro", () => {
  for (const input of [{ totalCents: 0 }, { totalCents: -1 }, { totalCents: 1.1 }, { totalCents: Number.MAX_SAFE_INTEGER + 1 },
    { installments: 0 }, { installments: 1.5 }, { installments: NaN }, { startMonth: "2026-13" },
    { startMonth: "9999-12", installments: 2 }, { categoryId: "" }, { note: "a".repeat(501) }]) {
    assert.throws(() => make(input));
  }
  assert.throws(() => maintenance.maintenanceExpenseFromInput({ categoryId: category.id, totalCents: 1, startMonth: "2026-10", installments: 1, note: "" }));
});

test("editar mestre preserva ID, metadados desconhecidos, fuel e vínculo sem mutar snapshot", () => {
  const previous = { ...make(), foreign: { source: [false, 0, null] }, scope: "personal", plannedExpenseId: null,
    fuel: { odometer: 999, previousMissing: true }, maintenance: { startMonth: "2026-10", installments: 2, foreign: "kept", totalCents: 123 } };
  const snapshot = JSON.stringify(previous);
  const next = make({ totalCents: 20003, startMonth: "2026-11", installments: 3 }, previous);
  assert.equal(next.id, previous.id);
  assert.equal(next.date, "2026-11-01");
  assert.equal(next.scope, "personal");
  assert.deepEqual(next.fuel, previous.fuel);
  assert.equal(next.maintenance.foreign, "kept");
  assert.equal(sum(maintenance.analyticExpenses([next], [], "2026-11-01", "2027-01-31")), 20003);
  assert.equal(JSON.stringify(previous), snapshot);
  assert.deepEqual(base.validateBackup(backup([next])).expenses, [next]);
});

test("cotas próprias ordenadas conservam cada parcela e distribuem resíduo nas primeiras datas", () => {
  const expenses = [make({ totalCents: 1001, installments: 1 })];
  const goals = [{ month: "2026-10", cents: 0, workDates: ["2026-10-09", "2026-10-05", "2026-10-07"] }];
  const entries = maintenance.analyticExpenses(expenses, goals, "2026-10-01", "2026-10-31");
  assert.deepEqual(entries.map(({ date, cents }) => ({ date, cents })), [
    { date: "2026-10-05", cents: 334 }, { date: "2026-10-07", cents: 334 }, { date: "2026-10-09", cents: 333 },
  ]);
  assert.equal(sum(entries), 1001);
  assert.equal(sum(maintenance.analyticExpenses(expenses, goals, "2026-10-01", "2026-10-31", "2026-10-07")), 668);
  assert.equal(base.totals([], expenses).costs, 0);
});

test("calendário padrão é próprio de cada mês, sem herdar calendário junto da meta", () => {
  const expenses = [make({ totalCents: 1000, installments: 1 })];
  const entries = maintenance.analyticExpenses(expenses, [{ month: "2026-09", cents: 1, workDates: ["2026-09-01"] }], "2026-10-01", "2026-10-31");
  assert.deepEqual(entries.map((entry) => entry.date), calc.defaultWorkDates("2026-10"));
  assert.equal(sum(entries), 1000);
});

test("calendário explicitamente vazio rateia nos dias corridos, inclusive bissexto", () => {
  const expenses = [make({ totalCents: 101, installments: 1, startMonth: "2028-02" })];
  const goals = [{ month: "2028-02", cents: 0, workDates: [] }];
  const entries = maintenance.analyticExpenses(expenses, goals, "2028-02-01", "2028-02-29");
  assert.equal(entries.length, 29);
  assert.equal(sum(entries), 101);
  assert.equal(entries[0].cents, 4);
  assert.equal(entries.at(-1).cents, 3);
  assert.equal(entries[0].maintenanceAllocation.allocation, "calendar");
  assert.equal(maintenance.maintenanceRows(expenses, goals, "2028-02-01", "2028-02-29")[0].allocatedCents, 101);
});

test("lista mantém parcelas futuras e separa programado, reconhecido e futuro no filtro", () => {
  const expenses = [make({ totalCents: 101, installments: 2 })];
  const goals = [{ month: "2026-10", cents: 0, workDates: ["2026-10-05", "2026-10-10"] },
    { month: "2026-11", cents: 0, workDates: ["2026-11-01"] }];
  const rows = maintenance.maintenanceRows(expenses, goals, "2026-10-01", "2026-11-30", "2026-10-07");
  assert.deepEqual(rows.map((r) => [r.month, r.monthlyCents, r.scheduledCents, r.allocatedCents, r.futureCents]), [
    ["2026-10", 51, 51, 26, 25], ["2026-11", 50, 50, 0, 50],
  ]);
  assert.equal(rows[0].expense, expenses[0]);
  assert.equal(sum(maintenance.analyticExpenses(expenses, goals, "2026-10-01", "2026-11-30", "2026-10-07")), 26);
});

test("semana cruzando meses combina as cotas desses meses sem duplicar total do mestre", () => {
  const expenses = [make({ totalCents: 1001, startMonth: "2026-09", installments: 2 })];
  const goals = [{ month: "2026-09", cents: 100, workDates: ["2026-09-01", "2026-09-28", "2026-09-30"] },
    { month: "2026-10", cents: 100, workDates: ["2026-10-01", "2026-10-02", "2026-10-12"] }];
  const days = [day("2026-10-01", { uberCents: 1000 })];
  const week = weeklyGoalPlanning({ reference: "2026-10-01", expenses, days, goals });
  assert.equal(week.costs, 167 + 167 + 167);
  assert.equal(week.balance, 1000 - week.costs);
  const complete = maintenance.periodTotals(days, expenses, goals, "2026-09-01", "2026-10-31");
  assert.equal(complete.costs, 1001);
  assert.equal(sum(maintenance.maintenanceRows(expenses, goals, "2026-09-01", "2026-10-31"), "allocatedCents"), 1001);
});

test("meta semanal indisponível com calendário vazio mantém manutenção reconhecida por dias corridos", () => {
  const expenses = [make({ totalCents: 310, installments: 1 })];
  const goals = [{ month: "2026-10", cents: 1000, workDates: [] }];
  const result = weeklyGoalPlanning({ reference: "2026-10-07", goals, days: [], expenses });
  assert.equal(result.goal, null);
  assert.equal(result.costs, 30);
  assert.equal(result.balance, -30);
  assert.equal(result.percent, null);
  const month = calc.monthlyPlanning({ month: "2026-10", reference: "2026-10-07", goals, days: [], expenses, categories: [category], plans: [] });
  assert.equal(month.maintenance, 70);
  assert.equal(month.futureMaintenance, 240);
  assert.equal(month.required, 1310);
  assert.equal(month.requiredDaily, null);
});

test("cenário de calendário altera cotas somente em memória e mantém soma do mês", () => {
  const expense = make({ totalCents: 101, installments: 1 });
  const goals = [{ month: "2026-10", cents: 1000, workDates: ["2026-10-05", "2026-10-09"], variableDailyCents: 0 }];
  const snapshot = JSON.stringify({ expense, goals });
  const args = { month: "2026-10", reference: "2026-10-07", goals, days: [], expenses: [expense], categories: [category], plans: [] };
  const actual = calc.monthlyPlanning(args);
  const scenario = calc.monthlyPlanning({ ...args, workDates: ["2026-10-09"] });
  assert.equal(actual.maintenance, 51);
  assert.equal(actual.futureMaintenance, 50);
  assert.equal(scenario.maintenance, 0);
  assert.equal(scenario.futureMaintenance, 101);
  assert.equal(JSON.stringify({ expense, goals }), snapshot);
});

test("metas mensais reconhecem até referência e somam cotas futuras uma única vez fora da variável", () => {
  const goals = [{ month: "2026-10", cents: 1000, workDates: ["2026-10-05", "2026-10-07", "2026-10-09"], variableDailyCents: 10 }];
  const expenses = [make({ totalCents: 1001, installments: 1 })];
  const days = [day("2026-10-05", { uberCents: 2000 })];
  const args = { month: "2026-10", reference: "2026-10-07", goals, days, expenses, categories: [category], plans: [] };
  const result = calc.monthlyPlanning(args);
  assert.deepEqual([result.gains, result.costs, result.realized, result.maintenance, result.futureMaintenance], [2000, 668, 1332, 668, 333]);
  assert.equal(result.variable, 20);
  assert.equal(result.futureRecorded, 0);
  assert.equal(result.futureCosts, 353);
  assert.equal(result.required, 21);
  assert.equal(result.requiredDaily, 10.5);
  assert.equal(result.base.dailyVariable, 0);
  assert.equal(result.base.separatedCents, 0);
  const ended = calc.monthlyPlanning({ ...args, reference: "2026-11-01" });
  assert.equal(ended.costs, 1001);
  assert.equal(ended.futureCosts, 0);
  const future = calc.monthlyPlanning({ ...args, reference: "2026-09-30" });
  assert.equal(future.costs, 0);
  assert.equal(future.futureMaintenance, 1001);
});

test("100% da manutenção integra saldo, dia e resultado por hora/KM sem aplicar workShare", () => {
  const goals = [{ month: "2026-10", cents: 0, workDates: ["2026-10-05"] }];
  const expenses = [{ ...make({ totalCents: 1000, installments: 1 }), scope: "personal" }, ordinary("2026-10-05", 30, { scope: "personal" })];
  const days = [day("2026-10-05", { uberCents: 2000, km: 10, minutes: 60, filled: { uberCents: true, km: true, minutes: true } })];
  const report = calc.periodAnalysis(days, expenses, "2026-10-01", "2026-10-31", "2026-10-05", goals);
  assert.equal(report.costs, 1030);
  assert.equal(report.balance, 970);
  assert.equal(report.rows[0].costs, 1030);
  assert.equal(report.balancePerHour, 970);
  assert.equal(report.balancePerKm, 97);
  const profile = { id: "p", effectiveFrom: "2026-01-01", vehicle: "owned", fuelType: "Gasolina", unit: "L", consumption: 10,
    priceCentsPerUnit: 100, workShare: 10, fixedMonthlyCents: 0, maintenanceCentsPerKm: 9999, wearCentsPerKm: 2 };
  const snapshot = JSON.stringify(profile);
  const estimate = calc.estimateDay(days[0], expenses, [category], [profile], [], goals);
  assert.deepEqual([estimate.maintenance, estimate.fuel, estimate.wear, estimate.fixed, estimate.operational, estimate.cost], [1000, 100, undefined, undefined, 0, 1100]);
  assert.equal(JSON.stringify(profile), snapshot);
});

test("backup v4 e importações preservam mestre e provisão histórica como JSON inerte", () => {
  const profile = { id: "p", effectiveFrom: "2026-01-01", vehicle: "owned", fuelType: "Gasolina", unit: "L", workShare: 10,
    fixedMonthlyCents: 0, maintenanceCentsPerKm: { legacy: [0, null, true] }, extra: "kept" };
  const expense = make({ totalCents: 1000 });
  const input = backup([expense], { costProfiles: [profile], foreign: "kept" });
  const result = base.validateBackup(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(result, input);
  const entries = [{ name: "categories", id: category.id, data: category }, { name: "expenses", id: expense.id, data: expense }];
  assert.deepEqual(base.importBatches(entries).flat(), entries);
  for (const expense of [{ ...make(), maintenance: undefined }, { ...make(), maintenance: { startMonth: "2026-10", installments: 0 } },
    { ...make(), date: "2026-10-02" }, { ...make(), maintenance: { startMonth: "2026-13", installments: 1 } }]) {
    assert.throws(() => base.validateBackup(backup([expense])));
  }
});

test("despesas antigas não são convertidas por categoria/nome/nota nem fabricam manutenção", () => {
  const expenses = [ordinary("2026-10-01", 1200, { note: "Manutenção em parcelas", kind: "expense" }),
    ordinary("2026-10-02", 33)];
  assert.deepEqual(maintenance.analyticExpenses(expenses, [], "2026-10-01", "2026-10-31"), expenses);
  assert.deepEqual(maintenance.maintenanceRows(expenses, [], "2026-10-01", "2026-10-31"), []);
  assert.equal(maintenance.periodTotals([], expenses, [], "2026-10-01", "2026-10-31").costs, 1233);
  assert.equal(calc.fuelExpense(make({ categoryId: "combustivel" }), [{ id: "combustivel", name: "Combustível", costKind: "fuel" }]), false);
});

test("CSV separa registro total, cotas reconhecidas e previstas sem duplicar coluna financeira", () => {
  const expenses = [make({ totalCents: 101, installments: 1 })];
  const goals = [{ month: "2026-10", cents: 0, workDates: ["2026-10-05", "2026-10-09"] }];
  const csv = base.exportCsv([], expenses, [category], [], goals, "2026-10-07");
  const rows = csv.replace(/^\uFEFF/, "").split("\r\n").map((line) => line.split(";").map((value) => value.slice(1, -1)));
  const header = rows.shift();
  const field = (row, name) => row[header.indexOf(name)];
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => field(row, "tipo")), ["manutencao_registro", "manutencao_custo", "manutencao_prevista"]);
  assert.equal(field(rows[0], "valor_centavos"), "");
  assert.equal(field(rows[0], "manutencao_total_centavos"), "101");
  assert.equal(field(rows[1], "valor_centavos"), "51");
  assert.equal(field(rows[2], "valor_centavos"), "");
  assert.equal(field(rows[2], "manutencao_prevista_centavos"), "50");
  assert.equal(rows.reduce((total, row) => total + Number(field(row, "valor_centavos")), 0), 51);
  assert.equal(rows.reduce((total, row) => total + Number(field(row, "valor_centavos")) + Number(field(row, "manutencao_prevista_centavos")), 0), 101);
});

test("totais combinados falham em vez de perder centavos além do limite seguro", () => {
  const expenses = [make({ totalCents: Number.MAX_SAFE_INTEGER, installments: 1 }), ordinary("2026-10-05", 1)];
  assert.throws(() => maintenance.periodTotals([], expenses, [{ month: "2026-10", cents: 0, workDates: ["2026-10-05"] }], "2026-10-01", "2026-10-31"), /limite de centavos/);
});

// Executa a função real de confirmação do aplicativo com um adaptador só em memória.
// Nenhum SDK, sessão autenticada ou recurso externo é inicializado por estes testes.
function expenseSaver(initial = {}) {
  const text = readFileSync(new URL("../components/motorista/motorista-app.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("app.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const extracted = new Map();
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "saveExpense") extracted.set("saveExpense", node.getText(source));
    if (ts.isVariableDeclaration(node) && ["canonical", "normalize"].includes(node.name.getText(source)))
      extracted.set(node.name.getText(source), `const ${node.getText(source)};`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(extracted.size, 3);
  const records = new Map(Object.entries(structuredClone(initial)));
  let commits = 0;
  const path = (name, id) => `${name}/${id}`;
  const bindings = {
    path, emptyDay: base.emptyDay, categories: [category], getMotoristaDb: () => "isolated-memory",
    plannedOccurrences: calc.plannedOccurrences,
    withSave: async (action) => { await action(); return true; },
    runTransaction: async (_db, action) => {
      const writes = [];
      const transaction = {
        async get(ref) {
          assert.equal(writes.length, 0, "Todas as leituras devem anteceder escritas");
          const value = records.get(ref);
          return { exists: () => value !== undefined, data: () => structuredClone(value) };
        },
        set(ref, value, options) { writes.push([ref, structuredClone(value), options]); },
      };
      await action(transaction);
      for (const [ref, value, options] of writes)
        records.set(ref, options?.merge ? { ...records.get(ref), ...value } : value);
      commits++;
    },
  };
  const code = ts.transpileModule([...extracted.values()].join("\n"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const save = new Function(...Object.keys(bindings), `${code}\nreturn saveExpense;`)(...Object.values(bindings));
  return { save, records, commits: () => commits };
}

test("confirmação transacional salva só mestre/categoria e edição conserva histórico e pagamento vinculado", async () => {
  const fresh = expenseSaver();
  const expense = make({ totalCents: 101, installments: 3 });
  assert.equal(await fresh.save(expense), true);
  assert.equal(fresh.commits(), 1);
  assert.deepEqual([...fresh.records.keys()].sort(), ["categories/manutencao", "expenses/isolated"]);
  assert.deepEqual(fresh.records.get("expenses/isolated"), expense);
  const key = "p--2026-10-05";
  const previous = { ...expense, foreign: { a: [0, true, null] }, plannedExpenseId: key,
    fuel: { odometer: 99, previousMissing: true }, maintenance: { ...expense.maintenance, foreign: "kept" } };
  const plan = { id: "p", date: "2026-10-05", categoryId: category.id, cents: 101, note: "old", payments: { [key]: previous.id }, foreign: "kept" };
  const editing = expenseSaver({ "expenses/isolated": previous, "categories/manutencao": category, "plannedExpenses/p": plan });
  const next = make({ totalCents: 111, startMonth: "2026-11", installments: 2 }, previous);
  await editing.save(next, previous);
  assert.equal(editing.commits(), 1);
  assert.deepEqual(editing.records.get("expenses/isolated"), next);
  assert.deepEqual(editing.records.get("plannedExpenses/p"), plan);
  assert.equal(editing.records.size, 3);
  assert.deepEqual(base.validateBackup(backup([next], { plannedExpenses: [plan] })).expenses, [next]);
});

test("conflito de snapshot, remoção ou vínculo recusa manutenção sem gravar partes", async () => {
  const previous = make();
  const next = make({ totalCents: 123 }, previous);
  for (const initial of [{ "expenses/isolated": { ...previous, note: "outra sessão" } }, {}]) {
    const executor = expenseSaver(initial), before = structuredClone([...executor.records]);
    await assert.rejects(executor.save(next, previous), /outra sessão|removido/);
    assert.equal(executor.commits(), 0);
    assert.deepEqual([...executor.records], before);
  }
  const key = "p--2026-10-05";
  const linked = { ...previous, plannedExpenseId: key };
  const executor = expenseSaver({ "expenses/isolated": linked, "plannedExpenses/p": {
    id: "p", date: "2026-10-05", categoryId: category.id, cents: previous.cents, note: "", payments: { [key]: "other" },
  } });
  const before = structuredClone([...executor.records]);
  await assert.rejects(executor.save(make({ totalCents: 321 }, linked), linked), /vínculo anterior mudou/);
  assert.equal(executor.commits(), 0);
  assert.deepEqual([...executor.records], before);
});
