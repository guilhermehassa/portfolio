import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const modules = new Map();
const adapter = {
  doc: (_db, ...parts) => ({ path: parts.join("/") }),
  runTransaction: (db, action) => db.runTransaction(action),
};
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const loadedModule = { exports: {} };
  modules.set(name, loadedModule);
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = (id) => id === "./motorista-persistence"
    ? adapter
    : load(id.replace(/^\.\//, ""));
  new Function("require", "exports", "module", code)(require, loadedModule.exports, loadedModule);
  return loadedModule.exports;
}
const base = load("motorista");
const { saveJourneyDay, saveEndingDay, syncJourneyState } = load("motorista-journey-persistence");
const uid = "test-owner";
const statePath = `users/${uid}/journeyState/current`;
const dayPath = (date) => `users/${uid}/days/${date}`;
const makeDay = (date, extra = {}) => ({
  ...base.emptyDay(date),
  status: "pending",
  origin: "user",
  filled: {},
  journey: { startedAt: `${date}T08:00:00-03:00`, endedAt: null, pauses: [] },
  ...extra,
});
const closed = (day) => ({
  ...day, status: "closed", minutes: 60,
  filled: { ...day.filled, minutes: true, uberCents: true },
  journey: { ...day.journey, endedAt: `${day.date}T09:00:00-03:00` },
});

// Simula retries por conflito de versão e recusa leituras posteriores a escritas.
function database(initial = {}) {
  const records = new Map(Object.entries(structuredClone(initial)));
  const versions = new Map([...records.keys()].map((key) => [key, 1]));
  return {
    records,
    async runTransaction(action) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const reads = new Map();
        const writes = [];
        const transaction = {
          async get(ref) {
            assert.equal(writes.length, 0, "Firestore exige todas as leituras antes das escritas");
            if (!reads.has(ref.path))
              reads.set(ref.path, {
                version: versions.get(ref.path) ?? 0,
                data: structuredClone(records.get(ref.path)),
              });
            await Promise.resolve();
            const data = reads.get(ref.path).data;
            return { exists: () => data !== undefined, data: () => structuredClone(data) };
          },
          set(ref, data, options) { writes.push({ path: ref.path, data: structuredClone(data), options }); },
          delete(ref) { writes.push({ path: ref.path, remove: true }); },
        };
        const result = await action(transaction);
        if ([...reads].some(([key, read]) => read.version !== (versions.get(key) ?? 0))) continue;
        for (const write of writes) {
          if (write.remove) records.delete(write.path);
          else records.set(write.path, write.options?.merge
            ? { ...records.get(write.path), ...write.data }
            : write.data);
          versions.set(write.path, (versions.get(write.path) ?? 0) + 1);
        }
        return result;
      }
      throw new Error("Retries esgotados no teste.");
    },
  };
}

test("duas sessões em datas distintas não conseguem abrir duas jornadas", async () => {
  const db = database();
  const outcomes = await Promise.allSettled([
    saveJourneyDay({ db, uid, day: makeDay("2026-10-01") }),
    saveJourneyDay({ db, uid, day: makeDay("2026-10-02") }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal([...db.records.values()].filter((item) => item.journey?.endedAt === null).length, 1);
  const active = db.records.get(statePath).date;
  assert.equal(db.records.get(dayPath(active)).journey.endedAt, null);
});

test("encerrar libera marcador e permite abrir outra jornada", async () => {
  const previous = makeDay("2026-10-01");
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date } });
  await saveJourneyDay({ db, uid, day: closed(previous), previous });
  assert.equal(db.records.get(statePath).date, null);
  assert.equal(db.records.get(dayPath(previous.date)).minutes, 60);
  await saveJourneyDay({ db, uid, day: makeDay("2026-10-02") });
  assert.equal(db.records.get(statePath).date, "2026-10-02");
});

test("movimento atômico preserva ganhos, campos desconhecidos e gastos nas datas reais", async () => {
  const previous = makeDay("2026-10-01", { uberCents: 10000, historic: { code: "original" } });
  previous.journey.extra = "preservado";
  const expensePath = `users/${uid}/expenses/example`;
  const expense = { id: "example", date: previous.date, cents: 900 };
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date }, [expensePath]: expense });
  const next = { ...previous, date: "2026-10-02", journey: { startedAt: "2026-10-02T08:00:00-03:00", endedAt: null, pauses: [] } };
  await saveJourneyDay({ db, uid, day: next, previous, knownOpenDates: [previous.date] });
  assert.equal(db.records.has(dayPath(previous.date)), false);
  assert.equal(db.records.get(dayPath(next.date)).uberCents, 10000);
  assert.deepEqual(db.records.get(dayPath(next.date)).historic, previous.historic);
  assert.equal(db.records.get(dayPath(next.date)).journey.extra, "preservado");
  assert.equal(db.records.get(statePath).date, next.date);
  assert.deepEqual(db.records.get(expensePath), expense);
});

test("destino com documento vazio bloqueia transferência sem alterar origem", async () => {
  const previous = makeDay("2026-10-01");
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date }, [dayPath("2026-10-02")]: {} });
  const next = { ...previous, date: "2026-10-02", journey: { ...previous.journey, startedAt: "2026-10-02T08:00:00-03:00" } };
  await assert.rejects(saveJourneyDay({ db, uid, day: next, previous }), /destino/);
  assert.deepEqual(db.records.get(dayPath(previous.date)), previous);
  assert.deepEqual(db.records.get(dayPath(next.date)), {});
});

test("snapshot antigo recusa sobrescrever edição concorrente de ganhos", async () => {
  const previous = makeDay("2026-10-01");
  const changed = { ...previous, uberCents: 2500 };
  const db = database({ [dayPath(previous.date)]: changed, [statePath]: { date: previous.date } });
  await assert.rejects(saveJourneyDay({ db, uid, day: closed(previous), previous }), /outra sessão/);
  assert.deepEqual(db.records.get(dayPath(previous.date)), changed);
});

test("importação pode encerrar ativa e abrir outra no mesmo lote", async () => {
  const previous = makeDay("2026-10-01");
  const ended = closed(previous);
  const next = makeDay("2026-10-02");
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date } });
  await db.runTransaction(async (transaction) => {
    await transaction.get({ path: dayPath(previous.date) });
    await transaction.get({ path: dayPath(next.date) });
    await syncJourneyState({ db, uid, transaction, days: [ended, next], knownOpenDates: [previous.date] });
    transaction.set({ path: dayPath(ended.date) }, ended);
    transaction.set({ path: dayPath(next.date) }, next);
  });
  assert.equal(db.records.get(statePath).date, next.date);
  assert.equal(db.records.get(dayPath(previous.date)).minutes, 60);
});

test("marcador órfão é reconciliado sem fabricar histórico", async () => {
  const db = database({ [statePath]: { date: "2026-09-30" } });
  await saveJourneyDay({ db, uid, day: makeDay("2026-10-01") });
  assert.equal(db.records.get(statePath).date, "2026-10-01");
  assert.equal(db.records.has(dayPath("2026-09-30")), false);
});

test("ganhos existentes sem início impedem abertura e permanecem intactos", async () => {
  const previous = { ...base.emptyDay("2026-10-01"), uberCents: 3000, historic: true };
  const db = database({ [dayPath(previous.date)]: previous });
  await assert.rejects(saveJourneyDay({ db, uid, previous, day: makeDay(previous.date, { uberCents: 3000 }) }), /já tem ganhos/);
  assert.deepEqual(db.records.get(dayPath(previous.date)), previous);
  assert.equal(db.records.has(statePath), false);
});

const category = { id: "combustivel", name: "Combustível", scope: "operational", costKind: "fuel", historic: "category-original" };
const expense = (id, extra = {}) => ({ id, date: "2026-10-02", categoryId: category.id, cents: 1200, note: "", ...extra });
const categoryPath = `users/${uid}/categories/${category.id}`;
const expensePath = (id) => `users/${uid}/expenses/${id}`;
const planPath = `users/${uid}/plannedExpenses/plan`;
const recordsCopy = (db) => structuredClone(Object.fromEntries(db.records));

test("finalizar grava dia, ganhos, marcador e novos gastos/vínculos preservando todos anteriores", async () => {
  const previous = makeDay("2026-10-01", { odometerStart: 1000, historic: { note: "original" } });
  previous.journey.historic = "journey-original";
  previous.journey.pauses = [{ id: "p1", startedAt: "2026-10-01T08:15:00-03:00", endedAt: "2026-10-01T08:30:00-03:00", extra: "pause-original" }];
  const day = { ...closed(previous), minutes: 45, odometerEnd: 1050, km: 50, uberCents: 8000,
    journey: { startedAt: previous.journey.startedAt, endedAt: "2026-10-01T09:00:00-03:00",
      pauses: [{ id: "p1", startedAt: "2026-10-01T08:15:00-03:00", endedAt: "2026-10-01T08:30:00-03:00" }] } };
  const existing = expense("original", { date: "2026-09-02", plannedExpenseId: "plan--2026-09-02", historical: { source: "unchanged" } });
  const plan = { id: "plan", date: "2026-09-02", categoryId: category.id, cents: 1200, note: "original", recurrence: "monthly",
    payments: { "plan--2026-09-02": existing.id }, historical: { unknown: true } };
  const next = expense("new", { plannedExpenseId: "plan--2026-10-02", kind: "fuel",
    fuel: { fuelType: "gasolina", unit: "L", volume: 2.4, odometer: 1040, tank: "partial", incomplete: false } });
  const unrelated = { month: "2026-10", cents: 90000, untouched: true };
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date, unknown: "marker-original" },
    [categoryPath]: category, [expensePath(existing.id)]: existing, [planPath]: plan, [`users/${uid}/goals/2026-10`]: unrelated });
  await saveEndingDay({ db, uid, previous, day, expenses: [next], categories: [category], plannedExpenses: [plan] });
  const saved = db.records.get(dayPath(previous.date));
  assert.equal(saved.uberCents, 8000);
  assert.equal(saved.minutes, 45);
  assert.equal(saved.odometerEnd, 1050);
  assert.deepEqual(saved.historic, previous.historic);
  assert.equal(saved.journey.historic, "journey-original");
  assert.equal(saved.journey.pauses[0].extra, "pause-original");
  assert.deepEqual(db.records.get(statePath), { date: null, unknown: "marker-original" });
  assert.deepEqual(db.records.get(expensePath(next.id)), next);
  assert.deepEqual(db.records.get(expensePath(existing.id)), existing);
  assert.deepEqual(db.records.get(categoryPath), category);
  assert.deepEqual(db.records.get(`users/${uid}/goals/2026-10`), unrelated);
  assert.deepEqual(db.records.get(planPath), { ...plan, payments: { ...plan.payments, "plan--2026-10-02": next.id } });
});

test("encerramento sem gastos e categoria padrão ausente seguem a mesma transação", async () => {
  for (const withCost of [false, true]) {
    const previous = makeDay("2026-10-01");
    const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date } });
    const costs = withCost ? [expense("new")] : [];
    await saveEndingDay({ db, uid, previous, day: closed(previous), expenses: costs, categories: [category] });
    assert.equal(db.records.get(statePath).date, null);
    assert.equal(db.records.get(dayPath(previous.date)).minutes, 60);
    assert.equal(db.records.has(categoryPath), withCost);
    assert.equal(db.records.has(expensePath("new")), withCost);
  }
});

test("ID de gasto já existente bloqueia todos os novos gastos e o encerramento", async () => {
  const previous = makeDay("2026-10-01");
  const existing = expense("taken", { historical: true });
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date }, [expensePath(existing.id)]: existing });
  const before = recordsCopy(db);
  await assert.rejects(saveEndingDay({ db, uid, previous, day: closed(previous), expenses: [expense("free"), expense("taken")], categories: [category] }), /já existe/);
  assert.deepEqual(recordsCopy(db), before);
});

test("categoria/compromisso alterados ou pagamento já usado abortam o grupo inteiro", async () => {
  const previous = makeDay("2026-10-01");
  const plan = { id: "plan", date: "2026-10-02", categoryId: category.id, cents: 1200, note: "", payments: {} };
  const cost = expense("new", { plannedExpenseId: "plan--2026-10-02" });
  for (const scenario of ["category", "plan", "occupied", "missing-plan", "missing-snapshot"]) {
    const currentPlan = scenario === "plan" ? { ...plan, cents: 2400 }
      : scenario === "occupied" ? { ...plan, payments: { "plan--2026-10-02": "other" } } : plan;
    const db = database({
      [dayPath(previous.date)]: previous, [statePath]: { date: previous.date },
      [categoryPath]: scenario === "category" ? { ...category, name: "changed" } : category,
      ...(scenario === "missing-plan" ? {} : { [planPath]: currentPlan }),
    });
    const before = recordsCopy(db);
    await assert.rejects(saveEndingDay({
      db, uid, previous, day: closed(previous), expenses: [cost], categories: [category],
      plannedExpenses: scenario === "missing-snapshot" ? undefined : scenario === "occupied" ? [currentPlan] : [plan],
    }), /Categoria alterada|Previsão alterada|Previsão removida|já tem um pagamento/);
    assert.deepEqual(recordsCopy(db), before, scenario);
  }
});

test("jornada alterada e rascunhos inválidos não salvam custo, categoria ou marcador", async () => {
  const previous = makeDay("2026-10-01");
  const changed = { ...previous, uberCents: 3000 };
  const db = database({ [dayPath(previous.date)]: changed, [statePath]: { date: previous.date } });
  const before = recordsCopy(db);
  await assert.rejects(saveEndingDay({ db, uid, previous, day: closed(previous), expenses: [expense("new")], categories: [category] }), /outra sessão/);
  assert.deepEqual(recordsCopy(db), before);
  const correct = { ...changed };
  for (const invalid of [
    [expense("new"), expense("new")],
    [expense("new", { cents: -1 })],
    [expense("new", { plannedExpenseId: "bad" })],
    [expense("new", { plannedExpenseId: "plan--2026-10-02" }), expense("other", { plannedExpenseId: "plan--2026-10-02" })],
  ]) {
    await assert.rejects(saveEndingDay({ db, uid, previous: correct, day: closed(correct), expenses: invalid, categories: [category] }));
    assert.deepEqual(recordsCopy(db), before);
  }
});

test("dois Finalizar concorrentes confirmam apenas um conjunto de gastos", async () => {
  const previous = makeDay("2026-10-01");
  const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date } });
  const outcomes = await Promise.allSettled(["first", "second"].map((id) =>
    saveEndingDay({ db, uid, previous, day: closed(previous), expenses: [expense(id)], categories: [category] })));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(["first", "second"].filter((id) => db.records.has(expensePath(id))).length, 1);
  assert.equal(db.records.get(statePath).date, null);
});


test("enriquecimento encerrado preserva origem legada e duração fixa", async () => {
  const previous = { ...base.emptyDay("2026-10-01"), minutes: 60, origin: "legacy", historic: { preserved: true } };
  const next = { ...previous, journey: { startedAt: "2026-10-01T00:00:00-03:00", endedAt: "2026-10-01T01:00:00-03:00", pauses: [] } };
  const db = database({ [dayPath(previous.date)]: previous });
  await saveJourneyDay({ db, uid, previous, day: next });
  const saved = db.records.get(dayPath(previous.date));
  assert.equal(saved.minutes, 60);
  assert.equal(saved.origin, "legacy");
  assert.deepEqual(saved.historic, previous.historic);
  assert.equal(saved.status, undefined);
  assert.equal(db.records.has(statePath), false);
});

test("períodos múltiplos e seleção vazia preservam shift e dados no contrato real", async () => {
  for (const shift of ["morning", "mixed"]) {
    const previous = makeDay("2026-10-01", { shift, historical: { note: "original" } });
    const db = database({ [dayPath(previous.date)]: previous, [statePath]: { date: previous.date } });
    assert.equal(Object.hasOwn(db.records.get(dayPath(previous.date)), "periods"), false);
    const day = { ...closed(previous), uberCents: 12000, periods: ["morning", "night"] };
    await saveEndingDay({ db, uid, previous, day, expenses: [], categories: [] });
    const saved = db.records.get(dayPath(previous.date));
    assert.deepEqual(saved.periods, ["morning", "night"]);
    assert.equal(saved.shift, shift);
    assert.equal(saved.minutes, 60);
    assert.equal(saved.uberCents, 12000);
    await saveJourneyDay({ db, uid, previous: saved, day: { ...saved, periods: [] } });
    const cleared = db.records.get(dayPath(previous.date));
    assert.equal(Object.hasOwn(cleared, "periods"), true);
    assert.deepEqual(cleared.periods, []);
    assert.equal(cleared.shift, shift);
    assert.deepEqual(cleared.historical, previous.historical);
    assert.equal(db.records.get(statePath).date, null);
  }
});
