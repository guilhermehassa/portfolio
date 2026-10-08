import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const directory = mkdtempSync(join(tmpdir(), "motorista-calculos-"));
for (const name of ["motorista", "motorista-journey", "motorista-evolution", "motorista-day-ending", "motorista-maintenance"]) {
  const source = readFileSync(
    new URL(`../lib/${name}.ts`, import.meta.url),
    "utf8",
  );
  writeFileSync(
    join(directory, `${name}.js`),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
const require = createRequire(import.meta.url);
const base = require(join(directory, "motorista.js"));
const calc = require(join(directory, "motorista-evolution.js"));
const journey = require(join(directory, "motorista-journey.js"));
const ending = require(join(directory, "motorista-day-ending.js"));
after(() => rmSync(directory, { recursive: true, force: true }));
const categories = [
  {
    id: "combustivel",
    name: "Combustível",
    costKind: "fuel",
    scope: "operational",
  },
  {
    id: "alimentacao",
    name: "Alimentação",
    costKind: "variable",
    scope: "operational",
  },
  { id: "fixo", name: "Aluguel", costKind: "fixed", scope: "vehicle" },
  {
    id: "manutencao",
    name: "Manutenção",
    costKind: "maintenance",
    scope: "vehicle",
  },
  {
    id: "extra",
    name: "Extraordinário",
    costKind: "extraordinary",
    scope: "personal",
  },
];
const day = (date, extra = {}) => ({
  ...base.emptyDay(date),
  status: "closed",
  filled: { uberCents: true },
  ...extra,
});
const expense = (id, date, cents, categoryId = "alimentacao", extra = {}) => ({
  id,
  date,
  cents,
  categoryId,
  note: "",
  ...extra,
});
const profile = (effectiveFrom = "2026-10-01", extra = {}) => ({
  id: effectiveFrom,
  effectiveFrom,
  vehicle: "owned",
  fuelType: "Gasolina",
  unit: "L",
  consumption: 10,
  priceCentsPerUnit: 500,
  workShare: 50,
  fixedMonthlyCents: 31000,
  maintenanceCentsPerKm: 20,
  wearCentsPerKm: 10,
  ...extra,
});
const planning = (overrides) =>
  calc.monthlyPlanning({
    month: "2026-10",
    reference: "2026-10-05",
    goals: [
      {
        month: "2026-10",
        cents: 100000,
        workDates: ["2026-10-05", "2026-10-06"],
        variableDailyCents: 10000,
      },
    ],
    days: [],
    expenses: [],
    categories,
    plans: [],
    ...overrides,
  });

test("fechamento reúne Uber/99 e tempo real único em horas e minutos", () => {
  const d = calc.dayFromFields(
    "2026-10-05",
    undefined,
    {
      uberCents: "30000",
      ninetyNineCents: "15000",
      hours: "8",
      minutes: "30",
      km: "200,5",
    },
    "closed",
  );
  assert.equal(d.minutes, 510);
  assert.equal(calc.income(d), 45000);
  assert.equal(d.km, 200.5);
  assert.equal(d.filled.uberRides, false);
  assert.equal(d.filled.otherCents, false);
  assert.throws(
    () => calc.dayFromFields(d.date, d, { minutes: "60" }, "pending"),
    /minutos/,
  );
});
test("zero informado, vazio, pendência, folga e legado são distintos", () => {
  const zero = calc.dayFromFields(
    "2026-10-05",
    undefined,
    { uberCents: "0" },
    "closed",
  );
  assert.equal(calc.eligible(zero), true);
  assert.equal(zero.filled.uberCents, true);
  assert.equal(zero.filled.minutes, false);
  assert.throws(
    () => calc.dayFromFields(zero.date, undefined, {}, "closed"),
    /ao menos um ganho/,
  );
  assert.equal(
    calc.eligible(day(zero.date, { status: "pending", uberCents: 20000 })),
    false,
  );
  assert.equal(calc.eligible(day(zero.date, { status: "off" })), false);
  assert.equal(
    calc.eligible({ ...base.emptyDay(zero.date), uberCents: 10000 }),
    true,
  );
  assert.equal(calc.eligible(base.emptyDay(zero.date)), false);
  assert.throws(
    () =>
      calc.dayFromFields(zero.date, undefined, { uberCents: "10000" }, "off"),
    /Folga/,
  );
});
test("odômetro calcula só KM de trabalho e rejeita inversão", () => {
  const d = calc.dayFromFields(
    "2026-10-05",
    undefined,
    {
      uberCents: "0",
      km: "900",
      odometerStart: "12345,6",
      odometerEnd: "12500",
    },
    "closed",
  );
  assert.equal(d.km, 154.4);
  assert.equal(d.filled.km, true);
  assert.throws(
    () =>
      calc.dayFromFields(
        d.date,
        undefined,
        { odometerStart: "200", odometerEnd: "100" },
        "pending",
      ),
    /odômetro/,
  );
});
test("gastos sem jornada e na folga entram no saldo e na distribuição, não inventam trabalho", () => {
  const report = calc.periodAnalysis(
    [
      day("2026-10-01", { uberCents: 30000 }),
      day("2026-10-02", { status: "off" }),
      day("2026-10-03", { status: "pending", uberCents: 5000 }),
      day("2026-10-04"),
    ],
    [
      expense("a", "2026-10-02", 10000, "manutencao"),
      expense("b", "2026-10-05", 10000),
    ],
    "2026-10-01",
    "2026-10-31",
    "2026-10-05",
  );
  assert.equal(report.balance, 15000);
  assert.equal(report.work.length, 2);
  assert.equal(report.gainAverage, 15000);
  assert.equal(report.costWorkAverage, 10000);
  assert.equal(report.costCalendarAverage, 4000);
  assert.equal(report.calendarDays, 5);
  assert.equal(report.rows.find((r) => r.date === "2026-10-05").day, undefined);
  assert.equal(
    report.rows.find((r) => r.date === "2026-10-05").balance,
    -10000,
  );
});
test("indicadores por hora/KM usam numeradores compatíveis e não média dos índices", () => {
  const records = [
    day("2026-10-01", { uberCents: 10000, minutes: 60, km: 100 }),
    day("2026-10-02", { uberCents: 30000, minutes: 180 }),
    day("2026-10-03", { uberCents: 90000, km: 300 }),
    day("2026-10-04", {
      uberCents: 50000,
      status: "pending",
      minutes: 60,
      km: 10,
    }),
  ];
  const report = calc.periodAnalysis(
    records,
    [],
    "2026-10-01",
    "2026-10-05",
    "2026-10-05",
  );
  assert.equal(report.perHour, 10000);
  assert.equal(report.perKm, 250);
  assert.equal(report.hoursCoverage, 2);
  assert.equal(report.kmCoverage, 2);
  assert.equal(report.work.length, 3);
});
test("corridas legadas zeradas e Outros não geram médias artificiais", () => {
  const report = calc.periodAnalysis(
    [
      day("2026-10-01", { uberCents: 10000, uberRides: 5 }),
      day("2026-10-02", { uberCents: 80000, uberRides: 0 }),
    ],
    [],
    "2026-10-01",
    "2026-10-02",
    "2026-10-05",
  );
  assert.equal(report.perApp[0].rideAverage, 2000);
  assert.equal(report.perApp[0].covered, 1);
  assert.equal(report.perApp[2].rideAverage, null);
});
const fill = (id, date, odometer, volume, tank = "full", extra = {}) =>
  expense(id, date, volume * 500, "combustivel", {
    kind: "fuel",
    fuel: { fuelType: "Gasolina", unit: "L", odometer, volume, tank, ...extra },
  });
test("consumo observado usa tanque completo, parciais intermediários e volume final", () => {
  const cycles = calc.fuelCycles(
    [
      fill("a", "2026-10-01", 1000, 40),
      fill("b", "2026-10-02", 1100, 10, "partial"),
      fill("c", "2026-10-03", 1300, 20),
    ],
    categories,
  );
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].consumption, 10);
  assert.equal(cycles[0].volume, 30);
});
test("consumo observado ignora previousMissing legado e preserva os documentos originais", () => {
  const fills = [
    fill("a", "2026-10-01", 1000, 40),
    fill("b", "2026-10-02", 1100, 10, "partial"),
    fill("c", "2026-10-03", 1300, 20),
  ];
  const expected = calc.fuelCycles(fills, categories);
  for (const previousMissing of [true, false, null, { historical: true }]) {
    const legacy = fills.map((item) => ({ ...item, fuel: { ...item.fuel, previousMissing } }));
    const snapshot = structuredClone(legacy);
    assert.deepEqual(calc.fuelCycles(legacy, categories), expected);
    assert.deepEqual(legacy, snapshot);
    assert.deepEqual(base.totals([], legacy), base.totals([], fills));
  }
});
test("consumo quebra com dados ausentes, combustível trocado ou ordem diária ambígua", () => {
  assert.equal(
    calc.fuelCycles(
      [
        fill("a", "2026-10-01", 1000, 40),
        expense("incompleto", "2026-10-02", 5000, "combustivel", {
          kind: "fuel",
        }),
        fill("c", "2026-10-03", 1300, 30),
      ],
      categories,
    ).length,
    0,
  );
  assert.equal(
    calc.fuelCycles(
      [
        fill("a", "2026-10-01", 1000, 40),
        fill("c", "2026-10-03", 1300, 30, "full", { fuelType: "Etanol" }),
      ],
      categories,
    ).length,
    0,
  );
  assert.equal(
    calc.fuelCycles(
      [
        fill("a", "2026-10-01", 1000, 40),
        fill("b", "2026-10-01", 1100, 10),
        fill("c", "2026-10-03", 1300, 20),
      ],
      categories,
    ).length,
    0,
  );
});
test("consumo observado mantém requisitos de dados, unidade, odômetro e tanques completos", () => {
  const start = fill("a", "2026-10-01", 1000, 40);
  const end = fill("c", "2026-10-03", 1300, 20);
  for (const changes of [
    { fuelType: "" }, { unit: undefined }, { volume: null }, { volume: 0 },
    { odometer: null }, { tank: "unknown" }, { fuelType: "Etanol" },
    { unit: "m3" }, { odometer: 1000 }, { odometer: 999 },
  ]) {
    assert.equal(calc.fuelCycles([
      start, fill("b", "2026-10-02", 1100, 10, "partial", changes), end,
    ], categories).length, 0);
  }
  assert.equal(calc.fuelCycles([
    fill("a", "2026-10-01", 1000, 40, "partial"), end,
  ], categories).length, 0);
});
test("resultado estimado substitui combustível, mas ignora provisões históricas de fixos, desgaste e manutenção", () => {
  const d = day("2026-10-04", { uberCents: 30000, km: 100 });
  const expenses = [
    fill("pago", d.date, 1200, 40),
    expense("m", d.date, 50000, "manutencao"),
    expense("fixo", d.date, 31000, "fixo"),
    expense("alimentacao", d.date, 1000),
    expense("pessoal", d.date, 9000, "extra"),
  ];
  const result = calc.estimateDay(d, expenses, categories, [profile()]);
  assert.equal(result.fuel, 5000);
  assert.equal(result.fixed, undefined);
  assert.equal(result.maintenance, 0);
  assert.equal(result.wear, undefined);
  assert.equal(result.operational, 41500);
  assert.equal(result.result, -16500);
  assert.notEqual(result.result, base.totals([d], expenses).balance);
});
test("consumo manual histórico e vigências são preservados e preço futuro não retroage", () => {
  const old = profile("2026-10-01"),
    newer = profile("2026-10-10", { priceCentsPerUnit: 1000 });
  const d = day("2026-10-04", { uberCents: 10000, km: 100, consumption: 20 });
  const result = calc.estimateDay(d, [], categories, [newer, old]);
  assert.equal(result.fuel, 2500);
  assert.equal(result.profile.id, old.id);
  assert.equal(calc.estimateDay(d, [], categories, []), null);
  assert.equal(
    calc.estimateDay(d, [fill("future", "2026-10-10", 1000, 20)], categories, [
      profile("2026-10-01", { priceCentsPerUnit: null }),
    ]),
    null,
  );
});
test("ciclo futuro não fornece consumo observado a jornada anterior", () => {
  const fuels = [
    fill("a", "2026-10-01", 1000, 30),
    fill("b", "2026-10-10", 1300, 30),
  ];
  const p = profile("2026-10-01", {
    consumption: null,
    priceCentsPerUnit: 500,
  });
  assert.equal(
    calc.estimateDay(day("2026-10-04", { km: 100 }), fuels, categories, [p]),
    null,
  );
  assert.equal(
    calc.estimateDay(day("2026-10-10", { km: 100 }), fuels, categories, [p])
      .consumption,
    10,
  );
});
test("meta considera saldo negativo e despesas pendentes mesmo depois de atingir meta", () => {
  const a = planning({ expenses: [expense("a", "2026-10-04", 20000)] });
  assert.equal(a.realized, -20000);
  assert.equal(a.required, 140000);
  assert.equal(a.requiredDaily, 70000);
  const b = planning({ days: [day("2026-10-04", { uberCents: 110000 })] });
  assert.equal(b.missing, 0);
  assert.equal(b.required, 10000);
  assert.equal(b.requiredDaily, 5000);
});
test("hoje pendente desconta ganhos e gastos já feitos; fechado remove dia restante", () => {
  const records = [
    day("2026-10-04", { uberCents: 40000 }),
    day("2026-10-05", { status: "pending", uberCents: 15000 }),
  ];
  const a = planning({
    days: records,
    expenses: [expense("a", "2026-10-05", 6000)],
  });
  assert.equal(a.variable, 14000);
  assert.equal(a.remaining.length, 2);
  assert.equal(a.realized, 49000);
  assert.equal(a.projected, 100000);
  records[1].status = "closed";
  const b = planning({
    days: records,
    expenses: [expense("a", "2026-10-05", 6000)],
  });
  assert.equal(b.remaining.length, 1);
  assert.equal(b.variable, 10000);
});
test("sem dias restantes, mês encerrado e mês futuro não dividem por zero", () => {
  assert.equal(
    planning({ goals: [{ month: "2026-10", cents: 100000, workDates: [] }] })
      .requiredDaily,
    null,
  );
  const ended = planning({
    reference: "2026-11-01",
    days: [day("2026-10-04", { uberCents: 5000 })],
  });
  assert.equal(ended.ended, true);
  assert.equal(ended.futureCosts, 0);
  assert.equal(ended.projected, 5000);
  const future = planning({ month: "2026-11" });
  assert.equal(future.future, true);
  assert.equal(future.realized, 0);
  assert.equal(future.remaining.length, 21);
  const last = planning({
    reference: "2026-10-31",
    goals: [
      {
        month: "2026-10",
        cents: 100000,
        workDates: ["2026-10-31"],
        variableDailyCents: 0,
      },
    ],
  });
  assert.equal(last.remaining.length, 1);
  assert.equal(last.requiredDaily, 100000);
});
test("pagamento vinculado substitui previsão pendente sem dupla contagem", () => {
  const plan = {
    id: "aluguel",
    date: "2026-10-06",
    categoryId: "fixo",
    cents: 30000,
    note: "Aluguel",
    payments: {},
  };
  const pending = planning({ plans: [plan] });
  assert.equal(pending.commitments, 30000);
  const payment = expense("pago", "2026-10-05", 30000, "fixo", {
    plannedExpenseId: "aluguel--2026-10-06",
  });
  plan.payments[payment.plannedExpenseId] = payment.id;
  const paid = planning({ plans: [plan], expenses: [payment] });
  assert.equal(paid.commitments, 0);
  assert.equal(paid.realized, -30000);
  assert.equal(paid.required, pending.required);
});
test("recorrência no dia 31 produz ocorrência única em meses curtos", () => {
  const plan = {
    id: "rec",
    date: "2026-01-31",
    categoryId: "fixo",
    cents: 10000,
    note: "",
    recurrence: "monthly",
  };
  const feb = calc.plannedOccurrences([plan], "2026-02", []);
  assert.equal(feb.length, 1);
  assert.equal(feb[0].key, "rec--2026-02-28");
  assert.equal(calc.plannedOccurrences([plan], "2025-12", []).length, 0);
  assert.equal(
    calc.plannedOccurrences([{ ...plan, endDate: "2026-03-31" }], "2026-04", [])
      .length,
    0,
  );
});
test("previsão separa fixos e extraordinários e inclui despesas em folgas na base", () => {
  const records = [
    day("2026-10-01", { uberCents: 30000 }),
    day("2026-10-03", { uberCents: 50000 }),
  ];
  const costs = [
    expense("a", "2026-10-01", 1000),
    expense("folga", "2026-10-02", 3000),
    expense("fixo", "2026-10-02", 90000, "fixo"),
    expense("extra", "2026-10-03", 50000, "extra"),
  ];
  const b = calc.historicalBase(records, costs, categories, "2026-10-05", 30);
  assert.equal(b.dailyVariable, 2000);
  assert.equal(b.separatedCents, 140000);
  assert.equal(b.days, 2);
});
test("lançamentos futuros não viram saldo realizado e substituem previsão daquela data", () => {
  const plan = {
    id: "fixo",
    date: "2026-10-06",
    categoryId: "fixo",
    cents: 30000,
    note: "",
    payments: { "fixo--2026-10-06": "pago" },
  };
  const p = planning({
    plans: [plan],
    expenses: [
      expense("pago", "2026-10-06", 30000, "fixo", {
        plannedExpenseId: "fixo--2026-10-06",
      }),
      expense("var", "2026-10-06", 12000),
    ],
  });
  assert.equal(p.realized, 0);
  assert.equal(p.commitments, 0);
  assert.equal(p.variable, 10000);
  assert.equal(p.futureCosts, 52000);
});
test("comparação semanal cruza meses; mês corrente não inclui dias futuros", () => {
  assert.deepEqual(base.weekBounds("2026-W40"), {
    from: "2026-09-28",
    to: "2026-10-04",
  });
  assert.deepEqual(
    calc.previousPeriod("2026-10-01", "2026-10-31", "2026-10-05", true),
    { from: "2026-09-01", to: "2026-09-05" },
  );
  assert.deepEqual(
    calc.previousPeriod("2026-10-01", "2026-10-07", "2026-10-20"),
    { from: "2026-09-24", to: "2026-09-30" },
  );
});
const backup = (extra) => ({
  version: 4,
  exportedAt: "2026-10-05T21:00:00Z",
  days: [day("2026-10-01", { uberCents: 10000 })],
  expenses: [],
  categories,
  goals: [],
  plannedExpenses: [],
  costProfiles: [],
  ...extra,
});
test("backup conserva previousMissing como metadado legado nas versões aceitas e no round-trip", () => {
  const expenses = [true, false, null, { historical: "preservar" }].map((previousMissing, index) =>
    fill(`legacy-${index}`, "2026-10-01", 1000 + index, 20, "full", { previousMissing }));
  expenses.push(fill("without-flag", "2026-10-02", 1200, 20));
  for (const version of [1, 2, 3, 4]) {
    const restored = base.validateBackup(JSON.parse(JSON.stringify(backup({ version, gains: [], expenses }))));
    assert.equal(restored.version, 4);
    assert.deepEqual(restored.expenses, expenses);
    const roundTrip = base.validateBackup(JSON.parse(JSON.stringify(restored)));
    assert.deepEqual(roundTrip.expenses, expenses);
    assert.equal(Object.hasOwn(roundTrip.expenses.at(-1).fuel, "previousMissing"), false);
  }
});
test("metadado previousMissing continua sujeito à proteção JSON de campos históricos", () => {
  for (const previousMissing of [Infinity, BigInt(1), JSON.parse('{"__proto__":true}')]) {
    assert.throws(() => base.validateBackup(backup({ expenses: [
      fill("legacy", "2026-10-01", 1000, 20, "full", { previousMissing }),
    ] })), /campos históricos/i);
  }
});
const at = (date, time) => `${date}T${time}:00-03:00`;
const timedJourney = (extra = {}) => ({
  startedAt: at("2026-10-01", "20:00"),
  endedAt: at("2026-10-02", "04:00"),
  pauses: [{ id: "p1", startedAt: at("2026-10-01", "23:30"), endedAt: at("2026-10-02", "00:30") }],
  ...extra,
});

test("jornada atravessa meia-noite e desconta pausas dos minutos fixos", () => {
  const timing = timedJourney();
  assert.equal(journey.journeyMinutes(timing), 420);
  const d = day("2026-10-01", { minutes: 420, journey: timing, filled: { uberCents: true, minutes: true } });
  journey.validateJourney(d);
  assert.equal(journey.journeyState(d), "ended");
  assert.equal(journey.journeyMinutes(timing), 420);
  assert.equal(d.date, "2026-10-01");
});

test("corrigir horários e data preserva IDs de pausas, desconhecidos e jornada original", () => {
  const original = { ...timedJourney(), detalheAntigo: "preservar", pauses: [{ ...timedJourney().pauses[0], anotacaoAntiga: "manter" }] };
  const copy = structuredClone(original);
  const corrected = journey.journeyFromFields(original, "2026-10-02T20:00", "2026-10-03T05:00", [
    { ...original.pauses[0], startedInput: "2026-10-02T23:30", endedInput: "2026-10-03T00:30" },
  ]);
  assert.equal(journey.journeyMinutes(corrected), 480);
  assert.equal(corrected.startedAt.slice(0, 10), "2026-10-02");
  assert.equal(corrected.detalheAntigo, "preservar");
  assert.equal(corrected.pauses[0].id, "p1");
  assert.equal(corrected.pauses[0].anotacaoAntiga, "manter");
  assert.deepEqual(original, copy);
});

test("jornada aberta ou pausada não produz duração variável persistida", () => {
  const running = day("2026-10-01", { status: "pending", journey: timedJourney({ endedAt: null, pauses: [] }) });
  assert.equal(journey.journeyState(running), "running");
  assert.equal(journey.journeyMinutes(running.journey), null);
  running.journey.pauses.push({ id: "pausa", startedAt: at("2026-10-01", "22:00"), endedAt: null });
  assert.equal(journey.journeyState(running), "paused");
  assert.equal(journey.journeyMinutes(running.journey), null);
  assert.equal(calc.eligible(running), false);
  running.journey.pauses[0].endedAt = at("2026-10-01", "22:30");
  assert.equal(journey.journeyState(running), "running");
  assert.equal(running.minutes, 0);
});

test("horários recusam inversão, pausas sobrepostas e encerramento durante pausa", () => {
  assert.throws(() => journey.journeyMinutes(timedJourney({ endedAt: at("2026-10-01", "19:00") })), /encerramento/);
  assert.throws(() => journey.journeyMinutes(timedJourney({ pauses: [
    { id: "p1", startedAt: at("2026-10-01", "21:00"), endedAt: at("2026-10-01", "22:00") },
    { id: "p2", startedAt: at("2026-10-01", "21:30"), endedAt: at("2026-10-01", "23:00") },
  ] })), /sobreposição/);
  assert.throws(() => journey.journeyMinutes(timedJourney({ pauses: [
    { id: "p1", startedAt: at("2026-10-01", "22:00"), endedAt: null },
  ] })), /Encerre a pausa/);
  assert.throws(() => journey.journeyMinutes(timedJourney({ startedAt: at("2026-02-30", "20:00") })), /inválida/);
});

test("horário local inclui fuso e rejeita datas inexistentes sem normalização silenciosa", () => {
  const input = "2026-10-01T20:15";
  const instant = journey.journeyInstant(input);
  assert.match(instant, /^2026-10-01T20:15:00[+-]\d{2}:\d{2}$/);
  assert.equal(journey.instantToLocalInput(instant), input);
  assert.throws(() => journey.journeyInstant("2026-02-30T20:00"), /válidas/);
  assert.throws(() => journey.journeyInstant("2026-10-01T25:00"), /válidas/);
});

test("backup conserva horários, pausas e desconhecidos, recusando minutos incompatíveis", () => {
  const d = day("2026-10-01", { minutes: 420, journey: { ...timedJourney(), extraHistorico: "preservar" }, desconhecido: { valor: 3 } });
  assert.deepEqual(base.validateBackup(backup({ days: [d] })).days[0], d);
  assert.throws(() => base.validateBackup(backup({ days: [{ ...d, minutes: 480 }] })), /minutos gravados/i);
  assert.throws(() => base.validateBackup(backup({ days: [{ ...d, date: "2026-10-02" }] })), /data de início/);
});

test("backup não aceita duas jornadas abertas e mantém legado sem fabricar horários", () => {
  const first = day("2026-10-01", { status: "pending", journey: timedJourney({ endedAt: null, pauses: [] }) });
  const second = day("2026-10-02", { status: "pending", journey: { startedAt: at("2026-10-02", "10:00"), endedAt: null, pauses: [] } });
  assert.throws(() => base.validateBackup(backup({ days: [first, second] })), /mais de uma jornada aberta/);
  const legacy = { ...base.emptyDay("2026-10-01"), uberCents: 30000, minutes: 480, origin: "legacy", campoAntigo: "manter" };
  const restored = base.validateBackup(backup({ days: [legacy] })).days[0];
  assert.deepEqual(restored, legacy);
  assert.equal(restored.journey, undefined);
});

test("horários legados compatíveis mantêm minutos, ganhos, ausência de odômetro e origem", () => {
  const legacy = { ...base.emptyDay("2026-10-01"), uberCents: 30000, minutes: 480, origin: "legacy", campoAntigo: "manter", journey: { startedAt: at("2026-10-01", "00:00"), endedAt: at("2026-10-01", "08:00"), pauses: [] } };
  const restored = base.validateBackup(backup({ days: [legacy] })).days[0];
  assert.deepEqual(restored, legacy);
  assert.equal(restored.odometerStart, undefined);
  assert.equal(restored.status, undefined);
  assert.equal(journey.journeyMinutes(restored.journey), 480);
  assert.equal(calc.eligible(restored), true);
});

test("importação mantém fechamento e troca de jornada aberta no mesmo lote", () => {
  const entries = [
    { name: "days", id: "2026-10-01", data: day("2026-10-01", { minutes: 420, journey: timedJourney() }) },
    { name: "goals", id: "2026-10", data: { month: "2026-10", cents: 50000 } },
    { name: "days", id: "2026-10-02", data: day("2026-10-02", { status: "pending", journey: { startedAt: at("2026-10-02", "10:00"), endedAt: null, pauses: [] } }) },
  ];
  const batches = base.importBatches(entries, 2, ["2026-10-01", "2026-10-02"]);
  assert.deepEqual(batches[0].map((entry) => entry.id), ["2026-10-01", "2026-10-02"]);
  assert.equal(batches[1][0].name, "goals");
});

test("CSV exporta horários, pausas e odômetros sem alterar minutos nem pagamentos", () => {
  const d = day("2026-10-01", { minutes: 420, journey: timedJourney(), odometerStart: 10000, odometerEnd: 10200 });
  const csv = base.exportCsv([d], [], categories);
  assert.match(csv, /inicio_jornada/);
  assert.match(csv, /2026-10-01T20:00:00-03:00/);
  assert.match(csv, /2026-10-02T04:00:00-03:00/);
  assert.match(csv, /p1/);
  assert.match(csv, /"10000";"10200"/);
  assert.equal(csv.split("\r\n").filter((row) => row.startsWith('"gasto"')).length, 0);
});
test("backup v4 conserva campos desconhecidos, planejamento e vigências no ciclo JSON", () => {
  const payload = backup({
    days: [
      day("2026-10-01", {
        uberCents: 10000,
        campoHistorico: { original: "Preservar", numero: 2 },
      }),
    ],
    costProfiles: [profile()],
    goals: [
      {
        month: "2026-10",
        cents: 100000,
        workDates: ["2026-10-02"],
        variableDailyCents: 1000,
        historyDays: 30,
      },
    ],
    plannedExpenses: [
      {
        id: "futuro",
        date: "2026-10-02",
        categoryId: "fixo",
        cents: 20000,
        note: "Teste",
      },
    ],
  });
  const restored = base.validateBackup(
    JSON.parse(JSON.stringify(base.validateBackup(payload))),
  );
  assert.deepEqual(restored, payload);
});

test("arquivo antigo marcado como teste nunca pode ser importado nos dados reais", () => {
  const input = JSON.parse(JSON.stringify(backup({ sourceEnvironment: "local-test" })));
  assert.throws(() => base.assertBackupEnvironment(input), /teste local.*dados reais/);
});

test("backups reais atuais e antigos continuam aceitos sem selecionar outro ambiente", () => {
  for (const version of [1, 3, 4]) {
    const real = backup({ version });
    assert.doesNotThrow(() => base.assertBackupEnvironment(real));
    assert.equal(base.validateBackup(real).version, 4);
  }
});
test("versões 1 e 3 continuam legadas; v2 soma gains preservando campos antigos", () => {
  for (const version of [1, 3]) {
    const result = base.validateBackup(
      backup({
        version,
        days: [
          {
            ...base.emptyDay("2026-10-01"),
            uberCents: 10000,
            extraHistorico: "nota",
          },
        ],
      }),
    );
    assert.equal(result.version, 4);
    assert.equal(result.days[0].status, undefined);
    assert.equal(result.days[0].extraHistorico, "nota");
  }
  const v2 = base.validateBackup(
    backup({
      version: 2,
      gains: [{ id: "g", date: "2026-10-01", source: "uber", cents: 5000 }],
    }),
  );
  assert.equal(v2.days[0].uberCents, 15000);
});
test("backup rejeita vínculos inconsistentes, datas erradas, duplicatas e NaN", () => {
  assert.throws(
    () =>
      base.validateBackup(
        backup({
          expenses: [
            expense("p", "2026-10-01", 1000, "fixo", {
              plannedExpenseId: "ausente--2026-10-02",
            }),
          ],
        }),
      ),
    /Vínculo/,
  );
  assert.throws(
    () =>
      base.validateBackup(
        backup({
          goals: [{ month: "2026-10", cents: 1000, workDates: ["2026-11-01"] }],
        }),
      ),
    /Planejamento/,
  );
  assert.throws(
    () => base.validateBackup(backup({ costProfiles: [profile(), profile()] })),
    /duplicados/,
  );
  assert.throws(
    () =>
      base.validateBackup(backup({ days: [day("2026-10-01", { km: NaN })] })),
    /diários/,
  );
});
test("CSV identifica estimativas, unidades e situação sem criar pagamentos", () => {
  const csv = base.exportCsv(
    [day("2026-10-01")],
    [fill("f", "2026-10-01", 1000, 20)],
    categories,
    [{ date: "2026-10-01", result: 20000, fuel: 5000, cost: 10000, unit: "L" }],
  );
  assert.match(csv, /estimativa_trabalho/);
  assert.match(csv, /valor_estimado_centavos/);
  assert.match(csv, /unidade_volume/);
  assert.match(csv, /closed/);
  assert.match(csv, /"20"/);
});

test("CSV preserva zeros confirmados e volumes distintos de gastos com mesmo valor", () => {
  const csv = base.exportCsv(
    [
      day("2026-10-01", {
        filled: { uberCents: true, minutes: true, km: true },
      }),
      { ...base.emptyDay("2026-10-02"), uberCents: 1000 },
    ],
    [fill("a", "2026-10-01", 1000, 2), fill("b", "2026-10-01", 1000, 4)],
    categories,
  );
  const rows = csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .map((line) => line.split(";").map((v) => v.slice(1, -1)));
  assert.deepEqual(
    rows
      .find((r) => r[0] === "dados_do_dia" && r[1] === "2026-10-01")
      .slice(6, 8),
    ["0", "0"],
  );
  assert.equal(
    rows.find((r) => r[0] === "ganho" && r[1] === "2026-10-02")[5],
    "",
  );
  assert.deepEqual(
    rows.filter((r) => r[0] === "gasto").map((r) => r[12]),
    ["2", "4"],
  );
});

test("importação mantém compromisso e pagamentos juntos nas fronteiras dos lotes", () => {
  const entries = Array.from({ length: 149 }, (_, i) => ({
    name: "days",
    id: String(i),
    data: {},
  }));
  const linked = {
    name: "expenses",
    id: "pago",
    data: { plannedExpenseId: "plano--2026-10-01" },
  };
  const plan = {
    name: "plannedExpenses",
    id: "plano",
    data: { payments: { "plano--2026-10-01": "pago" } },
  };
  const batches = base.importBatches([...entries, linked, plan]);
  assert.deepEqual(
    batches.map((b) => b.length),
    [149, 2],
  );
  assert.ok(batches[1].includes(linked) && batches[1].includes(plan));
  assert.throws(
    () => base.importBatches([linked, plan], 1),
    /documentos vinculados/,
  );
});

test("comparação mensal conserva a duração mesmo quando o mês anterior é curto", () => {
  for (const [from, to, expected] of [
    ["2026-03-01", "2026-03-31", { from: "2026-01-29", to: "2026-02-28" }],
    ["2026-04-01", "2026-04-30", { from: "2026-03-01", to: "2026-03-30" }],
    ["2026-10-01", "2026-10-06", { from: "2026-09-01", to: "2026-09-06" }],
  ]) {
    const p = calc.previousPeriod(from, to, "2026-10-06", true);
    assert.deepEqual(p, expected);
    assert.equal(
      calc.datesBetween(from, to).length,
      calc.datesBetween(p.from, p.to).length,
    );
  }
  assert.deepEqual(
    calc.previousPeriod("2026-10-05", "2026-10-11", "2026-10-06"),
    { from: "2026-09-28", to: "2026-10-04" },
  );
});

test("backup rejeita pagamento ligado a vencimento inexistente e aceita IDs com prefixo comum", () => {
  const key = "p--2026-10-09";
  assert.throws(
    () =>
      base.validateBackup(
        backup({
          plannedExpenses: [
            {
              id: "p",
              date: "2026-10-08",
              categoryId: "alimentacao",
              cents: 1000,
              note: "",
              recurrence: "monthly",
              payments: { [key]: "e" },
            },
          ],
          expenses: [
            expense("e", "2026-10-09", 1000, "alimentacao", {
              plannedExpenseId: key,
            }),
          ],
        }),
      ),
    /ocorrência válida/,
  );
  const valid = base.validateBackup(
    backup({
      plannedExpenses: [
        {
          id: "p",
          date: "2026-10-08",
          categoryId: "alimentacao",
          cents: 1000,
          note: "",
        },
        {
          id: "p--outro",
          date: "2026-10-08",
          categoryId: "alimentacao",
          cents: 1000,
          note: "",
          payments: { "p--outro--2026-10-08": "e" },
        },
      ],
      expenses: [
        expense("e", "2026-10-08", 1000, "alimentacao", {
          plannedExpenseId: "p--outro--2026-10-08",
        }),
      ],
    }),
  );
  assert.equal(valid.expenses[0].plannedExpenseId, "p--outro--2026-10-08");
});

test("encerramento por etapas bloqueia horário inválido sem alterar a jornada aberta", () => {
  const previous = day("2026-10-05", {
    status: "pending", minutes: 0,
    journey: { startedAt: journey.journeyInstant("2026-10-05T09:00"), endedAt: null, pauses: [] },
  });
  const original = structuredClone(previous);
  const now = Date.parse(journey.journeyInstant("2026-10-05T18:00"));
  assert.throws(() => ending.validateEndingTime(previous, "2026-10-05T08:59", now), /depois do início/);
  assert.throws(() => ending.validateEndingTime(previous, "2026-10-05T18:01", now), /futuro/);
  assert.throws(() => ending.validateEndingTime({ ...previous, journey: { ...previous.journey, endedAt: journey.journeyInstant("2026-10-05T17:00") } }, "2026-10-05T18:00", now), /não está aberta/);
  assert.deepEqual(previous, original);
});

test("rascunho de encerramento preserva ganhos e desconhecidos ao cruzar meia-noite com pausas", () => {
  const instant = journey.journeyInstant;
  const previous = day("2026-10-05", {
    status: "pending", minutes: 0, odometerStart: 100, uberCents: 3000,
    originalExtra: { source: "preservar" },
    journey: { startedAt: instant("2026-10-05T22:00"), endedAt: null, custom: "horário original", pauses: [] },
  });
  const original = structuredClone(previous);
  const pauses = [{
    id: "pausa-antiga", startedAt: instant("2026-10-05T23:00"), endedAt: instant("2026-10-05T23:30"),
    startedInput: "2026-10-05T23:00", endedInput: "2026-10-05T23:30", custom: "nota original",
  }, {
    id: "pausa-nova", startedAt: instant("2026-10-06T00:30"), endedAt: instant("2026-10-06T00:45"),
    startedInput: "2026-10-06T00:30", endedInput: "2026-10-06T00:45",
  }];
  const result = ending.endingDay(previous, "2026-10-06T02:00", pauses, {
    uberCents: "3000", ninetyNineCents: "0", otherCents: "", uberRides: "", ninetyNineRides: "",
    odometerStart: "100", odometerEnd: "115", km: "", consumption: "", shift: "", note: "Fim do dia",
  }, Date.parse(instant("2026-10-06T03:00")));
  assert.equal(result.date, "2026-10-05");
  assert.equal(result.minutes, 195);
  assert.equal(result.km, 15);
  assert.equal(result.uberCents, 3000);
  assert.equal(result.filled.ninetyNineCents, true);
  assert.equal(result.filled.otherCents, false);
  assert.equal(result.status, "closed");
  assert.equal(result.journey.startedAt, previous.journey.startedAt);
  assert.equal(result.journey.custom, "horário original");
  assert.equal(result.journey.pauses[0].id, "pausa-antiga");
  assert.equal(result.journey.pauses[0].custom, "nota original");
  assert.equal("startedInput" in result.journey.pauses[0], false);
  assert.deepEqual(result.originalExtra, previous.originalExtra);
  assert.deepEqual(previous, original);
});

test("etapas de pausas e ganhos recusam pendências antes de preparar encerramento", () => {
  const instant = journey.journeyInstant;
  const previous = day("2026-10-05", {
    status: "pending", minutes: 0, filled: {}, odometerStart: 100,
    journey: { startedAt: instant("2026-10-05T09:00"), endedAt: null, pauses: [] },
  });
  const now = Date.parse(instant("2026-10-05T18:00"));
  const pause = { id: "p", startedAt: instant("2026-10-05T12:00"), endedAt: null, startedInput: "2026-10-05T12:00", endedInput: "" };
  assert.throws(() => ending.endingJourney(previous, "2026-10-05T17:00", [pause], now), /fim de todas as pausas/);
  assert.throws(() => ending.endingJourney(previous, "2026-10-05T17:00", [{ ...pause, endedInput: "2026-10-05T17:01" }], now), /dentro da jornada/);
  const fields = { uberCents: "", ninetyNineCents: "", otherCents: "", odometerStart: "100", odometerEnd: "110", shift: "", note: "" };
  assert.throws(() => ending.endingDay(previous, "2026-10-05T17:00", [], fields, now), /ao menos um ganho/);
  assert.throws(() => ending.endingDay(previous, "2026-10-05T17:00", [], { ...fields, uberCents: "0", odometerEnd: "" }, now), /odômetro final/);
  const result = ending.endingDay(previous, "2026-10-05T17:00", [], { ...fields, uberCents: "0" }, now);
  assert.equal(result.minutes, 480);
  assert.equal(result.uberCents, 0);
  assert.equal(result.filled.uberCents, true);
});

test("períodos opcionais leem o único turno antigo e Misto sem fabricar seleção", () => {
  const mixed = { shift: "mixed", extra: "original" };
  const original = structuredClone(mixed);
  assert.deepEqual(base.dayPeriods({ shift: "morning" }), ["morning"]);
  assert.deepEqual(base.dayPeriods(mixed), []);
  assert.deepEqual(base.dayPeriods({}), []);
  assert.deepEqual(base.dayPeriods({ shift: "morning", periods: [] }), []);
  assert.deepEqual(base.dayPeriods({ periods: ["night", "morning"] }), ["morning", "night"]);
  assert.deepEqual(mixed, original);
});

test("edição e limpeza de períodos preservam turno cru, valores e ausência do campo histórico", () => {
  const previous = day("2026-10-05", { shift: "mixed", minutes: 120, km: 12, uberCents: 5000, extra: { original: true } });
  const fields = { uberCents: "5000", ninetyNineCents: "", otherCents: "", hours: "2", minutes: "0", km: "12", shift: "morning", note: "", consumption: "" };
  const untouched = calc.dayFromFields(previous.date, previous, { ...fields, periods: "" }, "closed");
  assert.equal(untouched.shift, "mixed");
  assert.equal(Object.hasOwn(untouched, "periods"), false);
  const selected = calc.dayFromFields(previous.date, previous, { ...fields, periods: '["night","morning"]' }, "closed");
  assert.deepEqual(selected.periods, ["morning", "night"]);
  assert.equal(selected.shift, "mixed");
  assert.equal(selected.minutes, 120);
  assert.equal(selected.uberCents, 5000);
  assert.deepEqual(selected.extra, previous.extra);
  assert.equal(Object.hasOwn(previous, "periods"), false);
  const cleared = calc.dayFromFields(previous.date, selected, { ...fields, periods: "[]" }, "closed");
  assert.deepEqual(cleared.periods, []);
  assert.deepEqual(base.dayPeriods(cleared), []);
  assert.equal(cleared.shift, "mixed");
  assert.throws(() => calc.dayFromFields(previous.date, previous, { ...fields, periods: '["mixed"]' }, "closed"), /períodos válidos/);
});

test("backup mantém múltiplos períodos, vazios explícitos e turnos legados sem conversão", () => {
  const payload = { version: 4, exportedAt: new Date().toISOString(),
    days: [day("2026-10-01", { shift: "mixed" }), day("2026-10-02", { shift: "night", periods: ["morning", "night"], custom: "original" }), day("2026-10-03", { shift: "morning", periods: [] })],
    expenses: [], categories: [], goals: [], plannedExpenses: [], costProfiles: [],
  };
  const result = base.validateBackup(JSON.parse(JSON.stringify(payload)));
  assert.equal(Object.hasOwn(result.days[0], "periods"), false);
  assert.equal(result.days[0].shift, "mixed");
  assert.deepEqual(result.days[1].periods, ["morning", "night"]);
  assert.equal(result.days[1].custom, "original");
  assert.deepEqual(result.days[2].periods, []);
  for (const periods of [["mixed"], ["morning", "morning"], ["evening"], "morning", null]) {
    assert.throws(() => base.validateBackup({ ...payload, days: [day("2026-10-01", { periods })] }), /períodos/);
  }
});

test("CSV exporta seleção, vazio explícito e turno histórico sem dividir ganhos ou horas", () => {
  const previous = day("2026-10-05", { shift: "mixed", periods: ["morning", "night"], uberCents: 10000, minutes: 180, filled: { uberCents: true, minutes: true } });
  const csv = base.exportCsv([previous, day("2026-10-06", { shift: "morning", periods: [] })], [], []);
  assert.match(csv.split("\r\n")[0], /"periodos";"periodos_json";"turno_legado";/);
  assert.match(csv, /"Manhã \+ Noite";"\[""morning"",""night""\]";"mixed"/);
  assert.match(csv, /"";"\[\]";"morning"/);
  assert.equal(csv.split("\r\n").filter((row) => row.startsWith('"ganho";"2026-10-05"')).length, 1);
  assert.match(csv, /"dados_do_dia";"2026-10-05";"";"";"";"";"180"/);
});
