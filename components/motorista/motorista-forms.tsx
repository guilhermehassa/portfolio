"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  instantToLocalInput,
  journeyFromFields,
  journeyInstant,
  journeyMinutes,
  journeyState,
  localDateTime,
  validateJourney,
} from "@/lib/motorista-journey";
import {
  dayFromFields,
  dayStatus,
  fuelExpense,
  hasField,
} from "@/lib/motorista-evolution";
import {
  emptyDay,
  DAY_PERIODS,
  isDate,
  localDate,
  maskMoney,
  money,
  parseCents,
  parseDecimal,
  periodsFromInput,
  type Category,
  type Day,
  type DayPeriod,
  type Expense,
  type JourneyPause,
} from "@/lib/motorista";

export function MoneyField({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <input
      inputMode="numeric"
      placeholder="R$ 0,00"
      value={value}
      onChange={(e) => onChange(maskMoney(e.target.value))}
      required={required}
    />
  );
}
export function FormError({ children }: { children: ReactNode }) {
  return children ? (
    <p className="motorista-alert error" role="alert">
      {children}
    </p>
  ) : null;
}

export function PeriodsEditor({ value, onChange }: {
  value: DayPeriod[];
  onChange: (periods: DayPeriod[]) => void;
}) {
  const options = Object.keys(DAY_PERIODS) as DayPeriod[];
  return <fieldset className="motorista-periods">
    <legend>Período</legend>
    <div className="motorista-periods-options">{options.map((period) => <label className="motorista-check motorista-period-option" key={period}>
      <input type="checkbox" checked={value.includes(period)} onChange={(event) =>
        onChange(options.filter((option) => option === period ? event.target.checked : value.includes(option)))} />
      <span>{DAY_PERIODS[period]}</span>
    </label>)}</div>
  </fieldset>;
}

export type PauseFields = JourneyPause & { startedInput: string; endedInput: string };
export const pauseFields = (pauses: JourneyPause[]): PauseFields[] => pauses.map((pause) => ({
  ...pause,
  startedInput: instantToLocalInput(pause.startedAt),
  endedInput: pause.endedAt ? instantToLocalInput(pause.endedAt) : "",
}));

export function PauseEditor({ pauses, onChange }: { pauses: PauseFields[]; onChange: (pauses: PauseFields[]) => void }) {
  return <div className="motorista-pause-list">
    {pauses.map((pause, index) => <div className="motorista-pause-row" key={pause.id}>
      <strong>Pausa {index + 1}</strong>
      <div className="motorista-field-grid">
        <label>Início da pausa
          <input type="datetime-local" step={60} value={pause.startedInput} required max={localDateTime()}
            onChange={(e) => onChange(pauses.map((p) => p.id === pause.id ? { ...p, startedInput: e.target.value } : p))} />
        </label>
        <label>Fim da pausa
          <input type="datetime-local" step={60} value={pause.endedInput} max={localDateTime()}
            onChange={(e) => onChange(pauses.map((p) => p.id === pause.id ? { ...p, endedInput: e.target.value } : p))} />
        </label>
      </div>
      <button type="button" className="motorista-text-button motorista-danger"
        onClick={() => onChange(pauses.filter((p) => p.id !== pause.id))}>Remover pausa</button>
    </div>)}
    <button type="button" className="motorista-secondary" onClick={() => {
      const current = localDateTime();
      onChange([...pauses, { id: crypto.randomUUID(), startedAt: journeyInstant(current), endedAt: journeyInstant(current), startedInput: current, endedInput: current }]);
    }}>Adicionar pausa</button>
  </div>;
}

export type JourneyAction = "start" | "pause" | "resume";
export const journeyActionTitles: Record<JourneyAction, string> = {
  start: "Iniciar dia",
  pause: "Iniciar pausa",
  resume: "Encerrar pausa",
};

export function JourneyActionEditor({
  action, day: initialDay, days, saving, onSave, onCancel, onCorrect,
}: {
  action: JourneyAction;
  day?: Day;
  days: Day[];
  saving: boolean;
  onSave: (day: Day, previous?: Day) => Promise<boolean>;
  onCancel: () => void;
  onCorrect: (date: string) => void;
}) {
  const [time, setTime] = useState(localDateTime);
  const [odometer, setOdometer] = useState("");
  const [initialDays] = useState(days);
  const [previous] = useState(initialDay);
  const [error, setError] = useState("");
  const date = time.slice(0, 10);
  const existing = initialDays.find((d) => d.date === date);
  const blocked = action === "start" && !!existing && (
    !!existing.journey || existing.uberCents + existing.ninetyNineCents + existing.otherCents > 0 ||
    existing.minutes > 0 || existing.km > 0 || existing.status === "closed" || existing.status === "off"
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const instant = journeyInstant(time);
      if (Date.parse(instant) > Date.now()) throw new Error("A data e hora não podem estar no futuro.");
      let result: Day;
      let expected: Day | undefined;
      if (action === "start") {
        if (blocked) throw new Error("Esta data já possui registros. Corrija o dia existente antes de iniciar.");
        if (initialDays.some((d) => d.journey?.endedAt === null))
          throw new Error("Encerre a jornada aberta antes de iniciar outra.");
        const initialOdometer = parseDecimal(odometer);
        if (!odometer.trim() || !Number.isFinite(initialOdometer) || initialOdometer < 0)
          throw new Error("Informe um odômetro inicial válido.");
        expected = existing;
        result = {
          ...emptyDay(date), ...existing, date, status: "pending", origin: existing?.origin ?? "user",
          odometerStart: initialOdometer,
          journey: { startedAt: instant, endedAt: null, pauses: [] },
        };
      } else {
        if (!previous?.journey || previous.journey.endedAt !== null)
          throw new Error("A jornada não está aberta. Reabra o formulário.");
        const state = journeyState(previous);
        if ((action === "pause" && state !== "running") || (action === "resume" && state !== "paused"))
          throw new Error("A situação da jornada mudou. Reabra o formulário.");
        const pauses = previous.journey.pauses.map((pause) => ({ ...pause }));
        if (action === "pause") pauses.push({ id: crypto.randomUUID(), startedAt: instant, endedAt: null });
        else pauses[pauses.length - 1].endedAt = instant;
        result = { ...previous, journey: { ...previous.journey, pauses } };
        expected = previous;
      }
      validateJourney(result);
      if (await onSave(result, expected)) onCancel();
    } catch (e) { setError(e instanceof Error ? e.message : "Revise os dados da jornada."); }
  }
  return <form className="motorista-form" onSubmit={submit}>
    <FormError>{error}</FormError>
    <label>Data e hora
      <input type="datetime-local" step={60} value={time} max={localDateTime()} required
        onChange={(e) => { setTime(e.target.value); setError(""); }} />
    </label>
    {action === "start" ? <label>Odômetro inicial
      <input inputMode="decimal" value={odometer} required placeholder="Quilometragem do painel"
        onChange={(e) => setOdometer(e.target.value)} />
    </label> : <p className="motorista-muted">Jornada iniciada em {previous ? new Date(previous.journey!.startedAt).toLocaleString("pt-BR") : "—"}. A pausa desconta apenas o tempo trabalhado.</p>}
    {blocked && <p className="motorista-alert">Esta data já possui registros. <button type="button" className="motorista-text-button"
      onClick={() => onCorrect(date)}>Corrigir dia existente</button></p>}
    <div className="motorista-actions motorista-dialog-actions">
      <button type="button" className="motorista-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
      <button type="submit" className="motorista-primary" disabled={saving || blocked}>{saving ? "Salvando…" : journeyActionTitles[action]}</button>
    </div>
  </form>;
}

export function dayFields(day: Day): Record<string, string> {
  const fields: Record<string, string> = {
    hours: hasField(day, "minutes") ? String(Math.floor(day.minutes / 60)) : "",
    minutes: hasField(day, "minutes") ? String(day.minutes % 60) : "",
    shift: day.shift ?? "",
    periods: day.periods === undefined ? "" : JSON.stringify(day.periods),
    note: day.note ?? "",
    odometerStart: day.odometerStart == null ? "" : String(day.odometerStart),
    odometerEnd: day.odometerEnd == null ? "" : String(day.odometerEnd),
    startedAt: day.journey ? instantToLocalInput(day.journey.startedAt) : "",
    endedAt: day.journey?.endedAt ? instantToLocalInput(day.journey.endedAt) : "",
  };
  for (const key of [
    "uberCents",
    "ninetyNineCents",
    "otherCents",
    "uberRides",
    "ninetyNineRides",
    "km",
    "consumption",
  ] as const)
    fields[key] = hasField(day, key) ? String(day[key] ?? 0) : "";
  return fields;
}
export function DayEditor({
  date: initialDate,
  days,
  expenses,
  saving,
  onSave,
  onCancel,
  mode = "edit",
}: {
  date: string;
  days: Day[];
  expenses: Expense[];
  saving: boolean;
  onSave: (day: Day, previous?: Day) => Promise<boolean>;
  onCancel: () => void;
  mode?: "edit" | "end";
}) {
  const [openedAt] = useState(localDateTime);
  const [date, setDate] = useState(initialDate);
  const liveDay = days.find((d) => d.date === date);
  const [draft, setDraft] = useState<{
    date: string;
    fields: Record<string, string>;
    previous?: Day;
    pauses: PauseFields[];
  } | null>(null);
  const previous = draft?.date === date ? draft.previous : liveDay;
  const fields = draft?.date === date ? draft.fields : {
    ...dayFields(previous ?? emptyDay(date)),
    ...(mode === "end" && previous?.journey?.endedAt === null ? { endedAt: openedAt } : {}),
  };
  const pauses = draft?.date === date ? draft.pauses : pauseFields(previous?.journey?.pauses ?? []);
  const [error, setError] = useState("");
  const set = (key: string, value: string) =>
    setDraft({ date, fields: { ...fields, [key]: value }, previous, pauses });
  const setPauses = (next: PauseFields[]) =>
    setDraft({ date, fields, previous, pauses: next });
  const paid = expenses
    .filter((e) => e.kind !== "maintenance" && e.date === date)
    .reduce((s, e) => s + e.cents, 0);
  let calculatedMinutes: number | null = null;
  if (fields.startedAt && fields.endedAt) {
    try {
      calculatedMinutes = journeyMinutes(journeyFromFields(
        previous?.journey ?? { startedAt: "", endedAt: null, pauses: [] },
        fields.startedAt, fields.endedAt, pauses,
      ));
    } catch { /* A validação completa aparece ao salvar. */ }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    try {
      if (!isDate(date)) throw new Error("Selecione uma data válida.");
      const status = (button?.value ?? "pending") as NonNullable<Day["status"]>;
      const withTiming = !!previous?.journey || !!fields.startedAt || !!fields.endedAt || pauses.length > 0;
      const journey = withTiming ? journeyFromFields(
        previous?.journey ?? { startedAt: "", endedAt: null, pauses: [] },
        fields.startedAt,
        fields.endedAt,
        pauses,
      ) : undefined;
      const destinationDate = journey?.startedAt.slice(0, 10) ?? date;
      if (previous && destinationDate !== previous.date && days.some((d) => d.date === destinationDate))
        throw new Error("A nova data já possui um registro. Escolha uma data livre para transferir a jornada.");
      if (journey && status === "closed" && journey.endedAt === null)
        throw new Error("Informe o horário de encerramento para fechar a jornada.");
      if (journey && (Date.parse(journey.startedAt) > Date.now() ||
        (journey.endedAt !== null && Date.parse(journey.endedAt) > Date.now()) ||
        journey.pauses.some((pause) => Date.parse(pause.startedAt) > Date.now() || (pause.endedAt !== null && Date.parse(pause.endedAt) > Date.now()))))
        throw new Error("Os horários da jornada não podem estar no futuro.");
      const duration = journey ? journeyMinutes(journey) : null;
      if (mode === "end" && !fields.odometerEnd.trim())
        throw new Error("Informe o odômetro final para encerrar o dia.");
      const day = dayFromFields(
        destinationDate,
        previous,
        duration === null ? fields : { ...fields, hours: String(Math.floor(duration / 60)), minutes: String(duration % 60) },
        status,
      );
      if (journey) day.journey = journey;
      validateJourney(day);
      if (destinationDate > localDate() && day.status === "closed")
        throw new Error("Um dia futuro deve ser salvo como pendente.");
      if (await onSave(day, previous)) onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise o dia.");
    }
  }
  return (
    <form className="motorista-form" onSubmit={submit}>
      <FormError>{error}</FormError>
      <label>
        Data de início da jornada
        <input
          type="date"
          value={date}
          required
          onChange={(e) => {
            setDate(e.target.value);
            setError("");
          }}
          readOnly={!!previous?.journey}
        />
      </label>
      <p className="motorista-muted">
        {dayStatus(previous)}. Trabalhou após meia-noite? Use a data em que
        começou. Gastos mantêm a data do pagamento.
      </p>
      <fieldset className="motorista-fuel-fields">
        <legend>Horários da jornada</legend>
        <div className="motorista-field-grid">
          <label>
            Início
            <input type="datetime-local" step={60} value={fields.startedAt}
              required={!!previous?.journey || mode === "end"}
              max={localDateTime()} onChange={(e) => set("startedAt", e.target.value)} />
          </label>
          <label>
            Encerramento
            <input type="datetime-local" step={60} value={fields.endedAt}
              required={mode === "end"} max={localDateTime()}
              onChange={(e) => set("endedAt", e.target.value)} />
          </label>
        </div>
        <PauseEditor pauses={pauses} onChange={setPauses} />
        {fields.startedAt && <p className="motorista-muted">
          As horas trabalhadas serão calculadas entre início e encerramento, descontando as pausas.
        </p>}
        {calculatedMinutes !== null && <p>Tempo de trabalho: <strong>{Math.floor(calculatedMinutes / 60)} h {calculatedMinutes % 60} min</strong>.</p>}
        {previous && fields.startedAt && fields.startedAt.slice(0, 10) !== previous.date &&
          <p className="motorista-alert">Ao salvar, a jornada e seus ganhos serão transferidos para {fields.startedAt.slice(0, 10).split("-").reverse().join("/")}. Os gastos continuarão nas datas originais. A nova data precisa estar livre.</p>}
      </fieldset>
      <div className="motorista-field-grid">
        {[
          ["uberCents", "Uber"],
          ["ninetyNineCents", "99"],
          ["otherCents", "Outros"],
        ].map(([key, label]) => (
          <label key={key}>
            {label} (R$)
            <MoneyField
              value={fields[key] === "" ? "" : money(Number(fields[key]))}
              onChange={(v) => set(key, v.trim() ? String(parseCents(v)) : "")}
            />
          </label>
        ))}
        {[
          ["uberRides", "Corridas Uber"],
          ["ninetyNineRides", "Corridas 99"],
        ].map(([key, label]) => (
          <label key={key}>
            {label} (opcional)
            <input
              inputMode="numeric"
              value={fields[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
        {!fields.startedAt && <label>
          Horas trabalhadas
          <input
            inputMode="numeric"
            placeholder="Ex.: 8"
            value={fields.hours}
            onChange={(e) => set("hours", e.target.value)}
          />
        </label>}
        {!fields.startedAt && <label>
          Minutos adicionais
          <input
            inputMode="numeric"
            placeholder="0 a 59"
            value={fields.minutes}
            onChange={(e) => set("minutes", e.target.value)}
          />
        </label>}
      </div>
      <p className="motorista-muted">
        Informe um único tempo real: inclua espera e deslocamentos de trabalho,
        exclua pausas pessoais. Não some tempos online simultâneos de Uber e 99.
      </p>
      <div className="motorista-field-grid">
        {(!previous?.journey || previous.odometerStart == null) && <label>
          KM do trabalho
          <input
            inputMode="decimal"
            value={fields.km}
            onChange={(e) => set("km", e.target.value)}
          />
        </label>}
        <label>
          Odômetro inicial (opcional)
          <input
            inputMode="decimal"
            value={fields.odometerStart}
            onChange={(e) => set("odometerStart", e.target.value)}
          />
        </label>
        <label>
          Odômetro final{mode === "end" ? "" : " (opcional)"}
          <input
            inputMode="decimal"
            value={fields.odometerEnd}
            required={mode === "end"}
            onChange={(e) => set("odometerEnd", e.target.value)}
          />
        </label>
        <label>
          Consumo manual (km/L, opcional)
          <input
            inputMode="decimal"
            value={fields.consumption}
            onChange={(e) => set("consumption", e.target.value)}
          />
        </label>
        <PeriodsEditor value={periodsFromInput(fields.periods, previous)}
          onChange={(periods) => set("periods", JSON.stringify(periods))} />
      </div>
      <p className="motorista-muted">
        Inclua deslocamentos sem passageiro. Com os dois odômetros, a diferença
        substitui os KM diretos; exclua uso pessoal. O consumo manual histórico
        permanece disponível.
      </p>
      <label>
        Observação (opcional)
        <textarea
          rows={2}
          maxLength={500}
          value={fields.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </label>
      <p>
        Gastos já registrados nesta data: <strong>{money(paid)}</strong>. Eles
        serão preservados.
      </p>
      <p className="motorista-muted">
        Vazio significa não informado; zero é um valor confirmado.
        {!fields.startedAt && " Pode fechar sem horários ou KM, mas os índices sem dados ficarão indisponíveis."}
      </p>
      <div className="motorista-actions motorista-dialog-actions">
        <button
          type="button"
          className="motorista-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        {!previous?.journey && mode !== "end" && <button
          type="submit"
          name="status"
          value="off"
          className="motorista-secondary"
          disabled={saving}
        >
          Marcar folga
        </button>}
        {mode !== "end" && <button
          type="submit"
          name="status"
          value="pending"
          className="motorista-secondary"
          disabled={saving}
        >
          Salvar pendente
        </button>}
        <button
          type="submit"
          name="status"
          value="closed"
          className="motorista-primary"
          disabled={saving}
        >
          {saving ? "Salvando…" : mode === "end" ? "Encerrar dia" : "Salvar e fechar dia"}
        </button>
      </div>
    </form>
  );
}

export function ExpenseEditor({
  initial,
  categories,
  expenses,
  saving,
  onSave,
  onCancel,
  submitLabel,
  cancelLabel = "Cancelar",
}: {
  initial: Partial<Expense> & { date: string };
  categories: Category[];
  expenses: Expense[];
  saving: boolean;
  onSave: (expense: Expense, previous?: Expense) => Promise<boolean>;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const [previous] = useState(() =>
    initial.id ? expenses.find((e) => e.id === initial.id) : undefined,
  );
  const [date, setDate] = useState(initial.date),
    [categoryId, setCategory] = useState(initial.categoryId ?? "outros");
  const [value, setValue] = useState(
      initial.cents == null ? "" : money(initial.cents),
    ),
    [note, setNote] = useState(initial.note ?? "");
  const [kind, setKind] = useState(
    initial.kind ?? (initial.categoryId === "combustivel" ? "fuel" : "expense"),
  );
  const [fuelType, setFuel] = useState(initial.fuel?.fuelType ?? ""),
    [unit, setUnit] = useState(initial.fuel?.unit ?? "L");
  const [volume, setVolume] = useState(
    initial.fuel?.volume == null ? "" : String(initial.fuel.volume),
  );
  const [tank, setTank] = useState(initial.fuel?.tank ?? (previous ? "unknown" : "partial"));
  const [tankChanged, setTankChanged] = useState(false);
  const [error, setError] = useState("");
  const nullable = (text: string) => (text.trim() ? parseDecimal(text) : null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const cents = parseCents(value),
        v = nullable(volume);
      if (
        !isDate(date) ||
        !Number.isSafeInteger(cents) ||
        cents <= 0 ||
        !categories.some((c) => c.id === categoryId)
      )
        throw new Error("Informe data, categoria e valor positivo válidos.");
      if (
        kind === "fuel" &&
        v !== null && (!Number.isFinite(v) || v <= 0)
      )
        throw new Error(
          "Volume deve ser positivo ou deixe em branco.",
        );
      const expense: Expense = {
        ...previous,
        id: initial.id ?? crypto.randomUUID(),
        date,
        categoryId,
        cents,
        note,
        kind,
      };
      if (kind === "fuel") {
        const effectiveTank = !previous || tankChanged ? tank : previous.fuel?.tank;
        expense.fuel = {
          ...previous?.fuel,
          fuelType,
          unit,
          volume: v,
          ...(!previous || tankChanged ? { tank } : {}),
          incomplete: !fuelType || !v || previous?.fuel?.odometer == null || !effectiveTank || effectiveTank === "unknown",
        };
      }
      if (await onSave(expense, previous)) onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise o gasto.");
    }
  }
  return (
    <form className="motorista-form" onSubmit={submit}>
      <FormError>{error}</FormError>
      <div className="motorista-field-grid">
        <label>
          Data
          <input
            type="date"
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            value={categoryId}
            onChange={(e) => {
              setCategory(e.target.value);
              setKind(
                fuelExpense(
                  { categoryId: e.target.value } as Expense,
                  categories,
                )
                  ? "fuel"
                  : "expense",
              );
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor pago (R$)
          <MoneyField value={value} onChange={setValue} required />
        </label>
      </div>
      <label>
        Tipo
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="expense">Gasto</option>
          <option value="fuel">Abastecimento</option>
        </select>
      </label>
      {kind === "fuel" && (
        <fieldset className="motorista-fuel-fields">
          <legend>Detalhes do abastecimento</legend>

          <div className="motorista-field-grid">
            <label>
              Combustível
              <select
                value={fuelType}
                onChange={(e) => {
                  setFuel(e.target.value);
                  if (e.target.value === "GNV") setUnit("m3");
                }}
              >
                <option value="">Não informado</option>
                {["Gasolina", "Etanol", "Diesel", "GNV", "Outro"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Unidade
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as typeof unit)}
              >
                <option value="L">Litros (L)</option>
                <option value="m3">Metros cúbicos (m³)</option>
              </select>
            </label>
            <label>
              Volume comprado ({unit === "L" ? "L" : "m³"})
              <input
                inputMode="decimal"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </label>
          </div>
          <label className="motorista-check">
            <input type="checkbox" checked={tank === "full"}
              onChange={(e) => { setTank(e.target.checked ? "full" : "partial"); setTankChanged(true); }} />
            <span>Tanque cheio</span>
          </label>
          {parseDecimal(volume) > 0 && Number.isFinite(parseCents(value)) && (
            <p>
              Preço por {unit === "L" ? "litro" : "m³"}:{" "}
              {money(parseCents(value) / parseDecimal(volume))} (derivado do
              pagamento).
            </p>
          )}
        </fieldset>
      )}
      <label>
        Observação (opcional)
        <textarea
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="motorista-actions motorista-dialog-actions">
        <button
          type="button"
          className="motorista-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          {cancelLabel}
        </button>
        <button className="motorista-primary" disabled={saving}>
          {saving
            ? "Salvando…"
            : submitLabel ?? (initial.id
              ? "Salvar gasto"
              : kind === "fuel"
                ? "Salvar abastecimento"
                : "Salvar gasto")}
        </button>
      </div>
    </form>
  );
}
