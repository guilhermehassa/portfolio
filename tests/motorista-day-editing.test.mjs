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
    ? adapter : load(id.replace(/^\.\//, ""));
  new Function("require", "exports", "module", code)(require, loadedModule.exports, loadedModule);
  return loadedModule.exports;
}

const { emptyDay } = load("motorista");
const { hasField } = load("motorista-evolution");
const { instantToLocalInput } = load("motorista-journey");
const { editingDay } = load("motorista-day-editing");
const { saveJourneyDay } = load("motorista-journey-persistence");
const now = Date.parse("2026-10-08T20:00:00-03:00");
const iso = (date, time) => `${date}T${time}:00-03:00`;
const day = (date, fields = {}) => ({ ...emptyDay(date), ...fields });
const closed = (fields = {}) => day("2026-10-07", {
  status: "closed", origin: "user", uberCents: 10000, minutes: 480, km: 80,
  filled: { uberCents: true, minutes: true, km: true }, odometerStart: 1000, odometerEnd: 1080,
  journey: { startedAt: iso("2026-10-07", "08:00"), endedAt: iso("2026-10-07", "16:00"), pauses: [] },
  ...fields,
});
function fields(previous, extra = {}) {
  const result = {
    startedAt: previous?.journey ? instantToLocalInput(previous.journey.startedAt) : "",
    endedAt: previous?.journey?.endedAt ? instantToLocalInput(previous.journey.endedAt) : "",
    odometerStart: previous?.odometerStart == null ? "" : String(previous.odometerStart),
    odometerEnd: previous?.odometerEnd == null ? "" : String(previous.odometerEnd),
    hours: previous && hasField(previous, "minutes") ? String(Math.floor(previous.minutes / 60)) : "",
    minutes: previous && hasField(previous, "minutes") ? String(previous.minutes % 60) : "",
    periods: previous?.periods === undefined ? "" : JSON.stringify(previous.periods), note: previous?.note ?? "",
  };
  for (const key of ["uberCents", "ninetyNineCents", "otherCents", "uberRides", "ninetyNineRides", "km", "consumption"])
    result[key] = previous && hasField(previous, key) ? String(previous[key] ?? 0) : "";
  return { ...result, ...extra };
}
const pauses = (previous) => (previous?.journey?.pauses ?? []).map((pause) => ({
  ...pause, startedInput: instantToLocalInput(pause.startedAt),
  endedInput: pause.endedAt ? instantToLocalInput(pause.endedAt) : "",
}));
const edit = (previous, extra = {}) => editingDay({
  mode: "edit", date: previous.date, previous, fields: fields(previous),
  pauses: pauses(previous), days: [previous], now, ...extra,
});

test("editar dia fechado substitui ganhos e recalcula tempo/KM preservando histórico desconhecido", () => {
  const previous = closed({ shift: "night", periods: ["night"], extra: { historical: true },
    filled: { uberCents: true, minutes: true, km: true, unknown: "preservar" },
    journey: { startedAt: iso("2026-10-07", "08:00"), endedAt: iso("2026-10-07", "16:00"), extra: "cronologia",
      pauses: [{ id: "pause-1", startedAt: iso("2026-10-07", "12:00"), endedAt: iso("2026-10-07", "13:00"), extra: "pausa" }] }, minutes: 420 });
  const snapshot = structuredClone(previous);
  const result = edit(previous, { fields: fields(previous, { startedAt: "2026-10-07T07:00", endedAt: "2026-10-07T17:00",
    odometerStart: "1005", odometerEnd: "1090", uberCents: "5000", periods: "[]" }) });
  assert.equal(result.status, "closed");
  assert.equal(result.uberCents, 5000);
  assert.equal(result.minutes, 540);
  assert.equal(result.km, 85);
  assert.equal(result.origin, "user");
  assert.equal(result.shift, "night");
  assert.deepEqual(result.periods, []);
  assert.deepEqual(result.extra, { historical: true });
  assert.equal(result.filled.unknown, "preservar");
  assert.equal(result.journey.extra, "cronologia");
  assert.equal(result.journey.pauses[0].extra, "pausa");
  assert.deepEqual(previous, snapshot);
});

test("legado sem horários/odômetros mantém ausências, minutos/KM e origem", () => {
  const previous = day("2026-10-06", { origin: "legacy", uberCents: 1500, minutes: 123, km: 42.5,
    consumption: 12.3, shift: "morning", note: "registro histórico", extra: 10 });
  const result = edit(previous);
  assert.equal(result.status, "closed");
  assert.equal(result.minutes, 123);
  assert.equal(result.km, 42.5);
  assert.equal(result.consumption, 12.3);
  assert.equal(result.origin, "legacy");
  assert.equal(result.shift, "morning");
  assert.equal(result.note, "registro histórico");
  assert.equal(result.extra, 10);
  for (const key of ["journey", "odometerStart", "odometerEnd", "periods"])
    assert.equal(Object.hasOwn(result, key), false);
});

test("jornada encerrada sem odômetro inicial conserva KM manuais e aceita odômetro final ausente", () => {
  const previous = closed({ odometerStart: null, odometerEnd: null });
  const result = edit(previous, { fields: fields(previous, { km: "75,5" }) });
  assert.equal(result.km, 75.5);
  assert.equal(result.odometerStart, null);
  assert.equal(result.odometerEnd, null);
  assert.equal(result.minutes, 480);
});

test("jornada aberta só é confirmada com encerramento e duração fixa", () => {
  const previous = closed({ status: "pending", minutes: 0,
    journey: { startedAt: iso("2026-10-07", "08:00"), endedAt: null, pauses: [] } });
  assert.throws(() => edit(previous), /encerramento/);
  const result = edit(previous, { fields: fields(previous, { endedAt: "2026-10-07T16:00" }) });
  assert.equal(result.status, "closed");
  assert.equal(result.minutes, 480);
  assert.equal(result.journey.endedAt, iso("2026-10-07", "16:00"));
});

test("jornada pausada exige resolver a pausa para confirmação integral", () => {
  const previous = closed({ status: "pending", minutes: 0,
    journey: { startedAt: iso("2026-10-07", "08:00"), endedAt: null,
      pauses: [{ id: "pause-open", startedAt: iso("2026-10-07", "12:00"), endedAt: null }] } });
  const finalFields = fields(previous, { endedAt: "2026-10-07T16:00" });
  assert.throws(() => edit(previous, { fields: finalFields }), /Encerre a pausa/);
  const result = edit(previous, { fields: finalFields,
    pauses: pauses(previous).map((pause) => ({ ...pause, endedInput: "2026-10-07T13:00" })) });
  assert.equal(result.status, "closed");
  assert.equal(result.minutes, 420);
  assert.equal(result.journey.pauses[0].id, "pause-open");
});

test("data derivada do início pode mudar e destino ocupado é bloqueado", () => {
  const previous = closed();
  const changes = fields(previous, { startedAt: "2026-10-06T08:00", endedAt: "2026-10-06T16:00" });
  assert.equal(edit(previous, { fields: changes }).date, "2026-10-06");
  assert.throws(() => edit(previous, { fields: changes, days: [previous, day("2026-10-06")] }), /nova data já possui/);
});

test("cadastro anterior bloqueia data ocupada e não abre o registro para sobrescrever", () => {
  const options = { mode: "register", date: "2026-10-07", fields: fields(undefined, { uberCents: "0" }), pauses: [], now };
  assert.throws(() => editingDay({ ...options, days: [closed()] }), /Use Editar/);
  assert.throws(() => editingDay({ ...options, days: [], previous: closed() }), /Use Editar/);
});

test("cadastro anterior aceita apenas data passada e confirma ganho zero sem criar horários", () => {
  const options = { mode: "register", date: "2026-10-07", fields: fields(undefined, { uberCents: "0" }), pauses: [], days: [], now };
  const result = editingDay(options);
  assert.equal(result.status, "closed");
  assert.equal(result.uberCents, 0);
  assert.equal(result.filled.uberCents, true);
  assert.equal(Object.hasOwn(result, "journey"), false);
  assert.equal(Object.hasOwn(result, "odometerStart"), false);
  for (const date of ["2026-10-08", "2026-10-09"])
    assert.throws(() => editingDay({ ...options, date }), /anterior a hoje/);
});

test("confirmação exige ganho informado e não converte vazio em zero confirmado", () => {
  const previous = day("2026-10-07", { status: "pending" });
  assert.throws(() => edit(previous), /ao menos um ganho/);
  const result = edit(previous, { fields: fields(previous, { ninetyNineCents: "0" }) });
  assert.equal(result.filled.ninetyNineCents, true);
  assert.equal(result.filled.uberCents, false);
});

test("edição recusa horários futuros, pausas sobrepostas e odômetro final menor", () => {
  const previous = closed();
  assert.throws(() => edit(previous, { fields: fields(previous, { endedAt: "2026-10-09T09:00" }) }), /futuro/);
  assert.throws(() => edit(previous, { fields: fields(previous, { odometerEnd: "999" }) }), /odômetro/);
  assert.throws(() => edit(previous, { pauses: [
    { id: "pause-1", startedAt: iso("2026-10-07", "10:00"), endedAt: iso("2026-10-07", "12:00") },
    { id: "pause-2", startedAt: iso("2026-10-07", "11:00"), endedAt: iso("2026-10-07", "13:00") },
  ] }), /sem sobreposição/);
});

function database(initial) {
  const records = new Map(Object.entries(structuredClone(initial)));
  return { records, async runTransaction(action) {
    const writes = [];
    await action({
      get: async (ref) => {
        assert.equal(writes.length, 0);
        const data = records.get(ref.path);
        return { exists: () => data !== undefined, data: () => structuredClone(data) };
      },
      set: (ref, data, options) => writes.push({ ref, data: structuredClone(data), options }),
      delete: (ref) => writes.push({ ref, remove: true }),
    });
    for (const { ref, data, options, remove } of writes) {
      if (remove) records.delete(ref.path);
      else records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...data } : data);
    }
  } };
}
const uid = "test-owner";
const path = (collection, id) => `users/${uid}/${collection}/${id}`;

test("rascunho editado transfere o dia inteiro sem duplicar e preserva gastos/vínculos", async () => {
  const previous = closed({ extra: { historical: true } });
  const expensePath = path("expenses", "expense-original");
  const expense = { id: "expense-original", date: previous.date, cents: 1000, plannedExpenseId: "plan--2026-10-07" };
  const db = database({ [path("days", previous.date)]: previous, [expensePath]: expense });
  const result = edit(previous, { fields: fields(previous, { startedAt: "2026-10-06T08:00", endedAt: "2026-10-06T16:00", uberCents: "5000" }) });
  await saveJourneyDay({ db, uid, day: result, previous });
  assert.equal(db.records.has(path("days", "2026-10-07")), false);
  assert.equal(db.records.get(path("days", "2026-10-06")).uberCents, 5000);
  assert.deepEqual(db.records.get(path("days", "2026-10-06")).extra, previous.extra);
  assert.deepEqual(db.records.get(expensePath), expense);
});

test("conflito concorrente e destino ocupado rejeitam sem gravação parcial", async () => {
  const previous = closed();
  const sourcePath = path("days", previous.date);
  const result = edit(previous, { fields: fields(previous, { startedAt: "2026-10-06T08:00", endedAt: "2026-10-06T16:00" }) });
  for (const initial of [
    { [sourcePath]: { ...previous, uberCents: 12345 } },
    { [sourcePath]: previous, [path("days", "2026-10-06")]: day("2026-10-06") },
  ]) {
    const db = database(initial);
    const snapshot = structuredClone([...db.records]);
    await assert.rejects(saveJourneyDay({ db, uid, day: result, previous }), /outra sessão|destino/);
    assert.deepEqual([...db.records], snapshot);
  }
});

test("edição de pausa aberta fecha dia e libera o marcador na mesma confirmação", async () => {
  const previous = closed({ status: "pending", minutes: 0,
    journey: { startedAt: iso("2026-10-07", "08:00"), endedAt: null,
      pauses: [{ id: "pause-open", startedAt: iso("2026-10-07", "12:00"), endedAt: null }] } });
  const db = database({ [path("days", previous.date)]: previous, [path("journeyState", "current")]: { date: previous.date } });
  const result = edit(previous, { fields: fields(previous, { endedAt: "2026-10-07T16:00" }),
    pauses: pauses(previous).map((pause) => ({ ...pause, endedInput: "2026-10-07T13:00" })) });
  await saveJourneyDay({ db, uid, day: result, previous, knownOpenDates: [previous.date] });
  assert.equal(db.records.get(path("days", previous.date)).status, "closed");
  assert.equal(db.records.get(path("days", previous.date)).minutes, 420);
  assert.deepEqual(db.records.get(path("journeyState", "current")), { date: null });
});
