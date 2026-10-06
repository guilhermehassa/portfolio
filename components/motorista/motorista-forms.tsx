"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  dayFromFields,
  dayStatus,
  fuelExpense,
  hasField,
  plannedOccurrences,
  shifts,
} from "@/lib/motorista-evolution";
import {
  emptyDay,
  isDate,
  localDate,
  maskMoney,
  money,
  parseCents,
  parseDecimal,
  type Category,
  type Day,
  type Expense,
  type PlannedExpense,
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

function dayFields(day: Day): Record<string, string> {
  const fields: Record<string, string> = {
    hours: hasField(day, "minutes") ? String(Math.floor(day.minutes / 60)) : "",
    minutes: hasField(day, "minutes") ? String(day.minutes % 60) : "",
    shift: day.shift ?? "",
    note: day.note ?? "",
    odometerStart: day.odometerStart == null ? "" : String(day.odometerStart),
    odometerEnd: day.odometerEnd == null ? "" : String(day.odometerEnd),
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
}: {
  date: string;
  days: Day[];
  expenses: Expense[];
  saving: boolean;
  onSave: (day: Day, previous?: Day) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const liveDay = days.find((d) => d.date === date);
  const [draft, setDraft] = useState<{
    date: string;
    fields: Record<string, string>;
    previous?: Day;
  } | null>(null);
  const previous = draft?.date === date ? draft.previous : liveDay;
  const fields =
    draft?.date === date ? draft.fields : dayFields(previous ?? emptyDay(date));
  const [error, setError] = useState("");
  const set = (key: string, value: string) =>
    setDraft({ date, fields: { ...fields, [key]: value }, previous });
  const paid = expenses
    .filter((e) => e.date === date)
    .reduce((s, e) => s + e.cents, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    try {
      if (!isDate(date)) throw new Error("Selecione uma data válida.");
      const day = dayFromFields(
        date,
        previous,
        fields,
        (button?.value ?? "pending") as NonNullable<Day["status"]>,
      );
      if (date > localDate() && day.status === "closed")
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
        />
      </label>
      <p className="motorista-muted">
        {dayStatus(previous)}. Trabalhou após meia-noite? Use a data em que
        começou. Gastos mantêm a data do pagamento.
      </p>
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
        <label>
          Horas trabalhadas
          <input
            inputMode="numeric"
            placeholder="Ex.: 8"
            value={fields.hours}
            onChange={(e) => set("hours", e.target.value)}
          />
        </label>
        <label>
          Minutos adicionais
          <input
            inputMode="numeric"
            placeholder="0 a 59"
            value={fields.minutes}
            onChange={(e) => set("minutes", e.target.value)}
          />
        </label>
      </div>
      <p className="motorista-muted">
        Informe um único tempo real: inclua espera e deslocamentos de trabalho,
        exclua pausas pessoais. Não some tempos online simultâneos de Uber e 99.
      </p>
      <div className="motorista-field-grid">
        <label>
          KM do trabalho
          <input
            inputMode="decimal"
            value={fields.km}
            onChange={(e) => set("km", e.target.value)}
          />
        </label>
        <label>
          Odômetro inicial (opcional)
          <input
            inputMode="decimal"
            value={fields.odometerStart}
            onChange={(e) => set("odometerStart", e.target.value)}
          />
        </label>
        <label>
          Odômetro final (opcional)
          <input
            inputMode="decimal"
            value={fields.odometerEnd}
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
        <label>
          Classificação do dia
          <select
            value={fields.shift}
            onChange={(e) => set("shift", e.target.value)}
          >
            {Object.entries(shifts).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
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
        Vazio significa não informado; zero é um valor confirmado. Pode fechar
        sem horas ou KM, mas seus índices ficarão indisponíveis.
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
        <button
          type="submit"
          name="status"
          value="off"
          className="motorista-secondary"
          disabled={saving}
        >
          Marcar folga
        </button>
        <button
          type="submit"
          name="status"
          value="pending"
          className="motorista-secondary"
          disabled={saving}
        >
          Salvar pendente
        </button>
        <button
          type="submit"
          name="status"
          value="closed"
          className="motorista-primary"
          disabled={saving}
        >
          {saving ? "Salvando…" : "Fechar dia"}
        </button>
      </div>
    </form>
  );
}

export function ExpenseEditor({
  initial,
  categories,
  plans,
  expenses,
  saving,
  onSave,
  onCancel,
}: {
  initial: Partial<Expense> & { date: string };
  categories: Category[];
  plans: PlannedExpense[];
  expenses: Expense[];
  saving: boolean;
  onSave: (expense: Expense, previous?: Expense) => Promise<boolean>;
  onCancel: () => void;
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
  const [scope, setScope] = useState(initial.scope ?? "unclassified");
  const [fuelType, setFuel] = useState(initial.fuel?.fuelType ?? ""),
    [unit, setUnit] = useState(initial.fuel?.unit ?? "L");
  const [volume, setVolume] = useState(
    initial.fuel?.volume == null ? "" : String(initial.fuel.volume),
  );
  const [odometer, setOdometer] = useState(
    initial.fuel?.odometer == null ? "" : String(initial.fuel.odometer),
  );
  const [tank, setTank] = useState(initial.fuel?.tank ?? "unknown"),
    [missing, setMissing] = useState(initial.fuel?.previousMissing ?? false);
  const [link, setLink] = useState(initial.plannedExpenseId ?? ""),
    [error, setError] = useState("");
  const available = plannedOccurrences(
    plans,
    date.slice(0, 7),
    expenses,
  ).filter((o) => !o.expenseId || o.expenseId === initial.id);
  const nullable = (text: string) => (text.trim() ? parseDecimal(text) : null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const cents = parseCents(value),
        v = nullable(volume),
        km = nullable(odometer);
      if (
        !isDate(date) ||
        !Number.isSafeInteger(cents) ||
        cents <= 0 ||
        !categories.some((c) => c.id === categoryId)
      )
        throw new Error("Informe data, categoria e valor positivo válidos.");
      if (
        kind === "fuel" &&
        ((v !== null && (!Number.isFinite(v) || v <= 0)) ||
          (km !== null && (!Number.isFinite(km) || km < 0)))
      )
        throw new Error(
          "Volume deve ser positivo e odômetro não negativo, ou deixe em branco.",
        );
      const expense: Expense = {
        ...previous,
        id: initial.id ?? crypto.randomUUID(),
        date,
        categoryId,
        cents,
        note,
        kind,
        scope,
        plannedExpenseId: link || null,
      };
      if (kind === "fuel")
        expense.fuel = {
          ...previous?.fuel,
          fuelType,
          unit,
          volume: v,
          odometer: km,
          tank,
          previousMissing: missing,
          incomplete: !fuelType || !v || km === null || tank === "unknown",
        };
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
            onChange={(e) => {
              setDate(e.target.value);
              if (link !== initial.plannedExpenseId) setLink("");
            }}
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
          <legend>Detalhes opcionais do abastecimento</legend>
          <p className="motorista-muted">
            Só o valor pago é necessário. Sem os detalhes, afeta o saldo e
            permanece incompleto para consumo.
          </p>
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
            <label>
              Odômetro no abastecimento (km)
              <input
                inputMode="decimal"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
              />
            </label>
            <label>
              Tanque
              <select
                value={tank}
                onChange={(e) => setTank(e.target.value as typeof tank)}
              >
                <option value="unknown">Não informado</option>
                <option value="full">Completo</option>
                <option value="partial">Parcial</option>
              </select>
            </label>
          </div>
          <label className="motorista-check">
            <input
              type="checkbox"
              checked={missing}
              onChange={(e) => setMissing(e.target.checked)}
            />
            Falta um abastecimento anterior na sequência
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
      <details>
        <summary>Classificação e vínculo com previsão</summary>
        <div className="motorista-form">
          <label>
            Atribuição deste gasto
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="unclassified">
                Usar categoria / não classificado
              </option>
              <option value="operational">Operacional</option>
              <option value="vehicle">Veículo</option>
              <option value="personal">Pessoal</option>
            </select>
          </label>
          <label>
            Despesa prevista correspondente
            <select value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="">Sem vínculo</option>
              {available.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.date} ·{" "}
                  {o.plan.note ||
                    categories.find((c) => c.id === o.plan.categoryId)
                      ?.name}{" "}
                  · {money(o.cents)}
                </option>
              ))}
              {link && !available.some((o) => o.key === link) && (
                <option value={link}>
                  Vínculo existente · {link.slice(-10)}
                </option>
              )}
            </select>
          </label>
          <small>
            Ao pagar, a previsão deixa de estar pendente. Todas as
            classificações continuam no saldo financeiro.
          </small>
        </div>
      </details>
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
          Cancelar
        </button>
        <button className="motorista-primary" disabled={saving}>
          {saving
            ? "Salvando…"
            : initial.id
              ? "Salvar gasto"
              : kind === "fuel"
                ? "Salvar abastecimento"
                : "Salvar gasto"}
        </button>
      </div>
    </form>
  );
}
