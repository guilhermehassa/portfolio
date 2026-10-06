"use client";
import { useState, type FormEvent } from "react";
import {
  defaultWorkDates,
  datesBetween,
  historicalBase,
  plannedOccurrences,
} from "@/lib/motorista-evolution";
import {
  isDate,
  isMonth,
  localDate,
  money,
  monthBounds,
  parseCents,
  parseDecimal,
  goalForMonth,
  type Category,
  type CostProfile,
  type Day,
  type Expense,
  type Goal,
  type PlannedExpense,
} from "@/lib/motorista";
import { FormError, MoneyField } from "./motorista-forms";

export type SaveDocument = (
  collection: string,
  id: string,
  data: object,
  previous?: object,
) => Promise<boolean>;
type Props = {
  days: Day[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  profiles: CostProfile[];
  plans: PlannedExpense[];
  saving: boolean;
  save: SaveDocument;
};
export default function MotoristaSettings(props: Props) {
  return (
    <section className="motorista-section">
      <div>
        <p className="motorista-eyebrow">Preferências e planejamento</p>
        <h1>Definições</h1>
      </div>
      <GoalSettings {...props} />
      <div className="motorista-grid motorista-settings-grid">
        <ProfileSettings {...props} />
        <PlanSettings {...props} />
      </div>
      <CategorySettings {...props} />
    </section>
  );
}

function GoalSettings({
  goals,
  days,
  expenses,
  categories,
  saving,
  save,
}: Props) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const own = goals.find((g) => g.month === month),
    inherited = goalForMonth(goals, month);
  const [draft, setDraft] = useState<{
    month: string;
    cents: string;
    workDates: string[];
    historyDays: string;
    variable: string;
    previous?: Goal;
  } | null>(null);
  const fields =
    draft?.month === month
      ? draft
      : {
          month,
          cents: inherited ? money(inherited.cents) : "",
          workDates: own?.workDates ?? defaultWorkDates(month),
          historyDays: String(own?.historyDays ?? 30),
          variable:
            own?.variableDailyCents == null
              ? ""
              : money(own.variableDailyCents),
          previous: own,
        };
  const set = (patch: Partial<typeof fields>) =>
    setDraft({ ...fields, ...patch });
  const [error, setError] = useState("");
  const base = historicalBase(
    days,
    expenses,
    categories,
    localDate(),
    Number(fields.historyDays) || 30,
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const cents = parseCents(fields.cents),
      variableDailyCents = fields.variable.trim()
        ? parseCents(fields.variable)
        : null,
      historyDays = Number(fields.historyDays);
    if (
      !isMonth(month) ||
      !Number.isSafeInteger(cents) ||
      cents <= 0 ||
      !Number.isInteger(historyDays) ||
      historyDays < 1 ||
      historyDays > 365 ||
      (variableDailyCents !== null &&
        (!Number.isSafeInteger(variableDailyCents) || variableDailyCents < 0))
    )
      return setError(
        "Revise a meta, a base de 1 a 365 dias e o gasto previsto.",
      );
    if (
      await save(
        "goals",
        month,
        {
          ...fields.previous,
          month,
          cents,
          workDates: [...fields.workDates].sort(),
          historyDays,
          variableDailyCents,
        },
        fields.previous,
      )
    )
      setDraft(null);
  }
  const bounds = monthBounds(month);
  return (
    <form className="motorista-card motorista-form" onSubmit={submit}>
      <h2>Meta de saldo e calendário</h2>
      <FormError>{error}</FormError>
      <div className="motorista-field-grid">
        <label>
          Mês da meta
          <input
            type="month"
            required
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          Meta mensal de saldo (R$)
          <MoneyField
            value={fields.cents}
            onChange={(v) => set({ cents: v })}
            required
          />
        </label>
        <label>
          Base histórica (dias trabalhados)
          <input
            type="number"
            min={1}
            max={365}
            value={fields.historyDays}
            onChange={(e) => set({ historyDays: e.target.value })}
          />
        </label>
        <label>
          Gasto variável por dia planejado (R$, opcional)
          <MoneyField
            value={fields.variable}
            onChange={(v) => set({ variable: v })}
          />
        </label>
      </div>
      <p className="motorista-muted">
        Só o valor da meta é herdado dos meses anteriores. Calendário e previsão
        são próprios deste mês. Sem ajuste manual, o gasto sugerido é{" "}
        {base.dailyVariable === null
          ? "indisponível"
          : money(base.dailyVariable)}{" "}
        por dia, usando {base.days} dias encerrados/legados{" "}
        {base.from ? `de ${base.from} a ${base.to}` : "disponíveis"}.{" "}
        {base.separatedCents > 0 &&
          `${money(base.separatedCents)} em compromissos, custos fixos ou extraordinários ficaram separados da previsão variável.`}
      </p>
      <div className="motorista-actions">
        <strong>Dias planejados: {fields.workDates.length}</strong>
        <button
          type="button"
          className="motorista-text-button"
          onClick={() => set({ workDates: defaultWorkDates(month) })}
        >
          Preencher segunda a sexta
        </button>
        <button
          type="button"
          className="motorista-text-button"
          onClick={() => set({ workDates: [] })}
        >
          Limpar calendário
        </button>
      </div>
      <div
        className="motorista-calendar"
        role="group"
        aria-label="Datas planejadas de trabalho"
      >
        {datesBetween(bounds.from, bounds.to).map((date) => (
          <button
            type="button"
            key={date}
            aria-pressed={fields.workDates.includes(date)}
            aria-label={`Trabalhar em ${date}`}
            onClick={() =>
              set({
                workDates: fields.workDates.includes(date)
                  ? fields.workDates.filter((d) => d !== date)
                  : [...fields.workDates, date],
              })
            }
          >
            <small>
              {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "short",
              })}
            </small>
            <strong>{Number(date.slice(-2))}</strong>
          </button>
        ))}
      </div>
      <small>
        Começa com segunda a sexta como sugestão ajustável. Fechados e folgas
        não entram nos dias restantes. Hoje entra se planejado e ainda não
        encerrado.
      </small>
      <button className="motorista-primary" disabled={saving}>
        {saving ? "Salvando…" : "Salvar planejamento do mês"}
      </button>
    </form>
  );
}

function ProfileSettings({ profiles, saving, save }: Props) {
  const [selected, setSelected] = useState("new");
  const [revision, setRevision] = useState(0);
  return (
    <div className="motorista-card motorista-form">
      <h2>Veículo e premissas de custo</h2>
      <label>
        Perfil
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setRevision(revision + 1);
          }}
        >
          <option value="new">Nova vigência</option>
          {[...profiles]
            .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
            .map((p) => (
              <option value={p.id} key={p.id}>
                Desde {p.effectiveFrom} · {p.fuelType}
              </option>
            ))}
        </select>
      </label>
      <ProfileEditor
        key={`${selected}-${revision}`}
        initial={profiles.find((p) => p.id === selected)}
        profiles={profiles}
        saving={saving}
        save={save}
        done={() => {
          setSelected("new");
          setRevision(revision + 1);
        }}
      />
    </div>
  );
}
function ProfileEditor({
  initial: incoming,
  profiles,
  saving,
  save,
  done,
}: {
  initial?: CostProfile;
  profiles: CostProfile[];
  saving: boolean;
  save: SaveDocument;
  done: () => void;
}) {
  const [initial] = useState(incoming);
  const [date, setDate] = useState(initial?.effectiveFrom ?? localDate()),
    [vehicle, setVehicle] = useState(initial?.vehicle ?? "owned");
  const [fuel, setFuel] = useState(initial?.fuelType ?? "Gasolina"),
    [unit, setUnit] = useState(initial?.unit ?? "L");
  const [consumption, setConsumption] = useState(
      initial?.consumption == null ? "" : String(initial.consumption),
    ),
    [price, setPrice] = useState(
      initial?.priceCentsPerUnit == null
        ? ""
        : money(initial.priceCentsPerUnit),
    );
  const [share, setShare] = useState(String(initial?.workShare ?? 100)),
    [fixed, setFixed] = useState(
      initial ? money(initial.fixedMonthlyCents) : "",
    );
  const [maintenance, setMaintenance] = useState(
      initial?.maintenanceCentsPerKm == null
        ? ""
        : money(initial.maintenanceCentsPerKm),
    ),
    [wear, setWear] = useState(
      initial?.wearCentsPerKm == null ? "" : money(initial.wearCentsPerKm),
    );
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const consumptionValue = consumption.trim()
      ? parseDecimal(consumption)
      : null;
    const priceValue = price.trim() ? parseCents(price) : null;
    const workShare = parseDecimal(share),
      fixedMonthlyCents = parseCents(fixed),
      maintenanceCentsPerKm = parseCents(maintenance),
      wearCentsPerKm = parseCents(wear);
    if (
      !isDate(date) ||
      (consumptionValue !== null &&
        (!Number.isFinite(consumptionValue) || consumptionValue <= 0)) ||
      (priceValue !== null &&
        (!Number.isSafeInteger(priceValue) || priceValue <= 0)) ||
      !Number.isFinite(workShare) ||
      workShare < 0 ||
      workShare > 100 ||
      ![fixedMonthlyCents, maintenanceCentsPerKm, wearCentsPerKm].every(
        (v) => Number.isSafeInteger(v) && v >= 0,
      )
    )
      return setError(
        "Revise a vigência, consumo, preço, parcela de 0 a 100% e custos.",
      );
    if (profiles.some((p) => p.effectiveFrom === date && p.id !== initial?.id))
      return setError(
        "Já existe um perfil nessa vigência. Selecione-o para revisar.",
      );
    if (
      initial &&
      !window.confirm(
        "Revisar esta vigência recalcula as estimativas históricas a partir dela. Para preservar as premissas antigas, cadastre uma nova vigência. Continuar com a revisão?",
      )
    )
      return;
    const id = initial?.id ?? crypto.randomUUID();
    if (
      await save(
        "costProfiles",
        id,
        {
          ...initial,
          id,
          effectiveFrom: date,
          vehicle,
          fuelType: fuel,
          unit,
          consumption: consumptionValue,
          priceCentsPerUnit: priceValue,
          workShare,
          fixedMonthlyCents,
          maintenanceCentsPerKm,
          wearCentsPerKm,
        },
        initial,
      )
    )
      done();
  }
  return (
    <form className="motorista-form" onSubmit={submit}>
      <FormError>{error}</FormError>
      <div className="motorista-field-grid">
        <label>
          Início da vigência
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          Veículo
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as typeof vehicle)}
          >
            <option value="owned">Próprio</option>
            <option value="financed">Financiado</option>
            <option value="rented">Alugado</option>
          </select>
        </label>
        <label>
          Combustível
          <select
            value={fuel}
            onChange={(e) => {
              setFuel(e.target.value);
              if (e.target.value === "GNV") setUnit("m3");
            }}
          >
            {["Gasolina", "Etanol", "Diesel", "GNV", "Outro"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Unidade de consumo
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as typeof unit)}
          >
            <option value="L">km/L</option>
            <option value="m3">km/m³</option>
          </select>
        </label>
        <label>
          Consumo de referência (opcional)
          <input
            inputMode="decimal"
            value={consumption}
            onChange={(e) => setConsumption(e.target.value)}
          />
        </label>
        <label>
          Preço por unidade (R$, opcional)
          <MoneyField value={price} onChange={setPrice} />
        </label>
        <label>
          Parcela do custo fixo atribuída ao trabalho (%)
          <input
            inputMode="decimal"
            value={share}
            onChange={(e) => setShare(e.target.value)}
          />
        </label>
        <label>
          Custo fixo mensal total (R$)
          <MoneyField value={fixed} onChange={setFixed} />
        </label>
        <label>
          Provisão de manutenção por KM (R$, opcional)
          <MoneyField value={maintenance} onChange={setMaintenance} />
        </label>
        <label>
          Desgaste/depreciação por KM (R$, opcional)
          <MoneyField value={wear} onChange={setWear} />
        </label>
      </div>
      <p className="motorista-muted">
        No custo fixo informe aluguel, parcela ou outros custos conforme seu
        veículo. Atribuição: valor mensal × parcela de trabalho ÷ dias corridos
        do mês. Os KM já são somente de trabalho. Provisões substituem
        pagamentos equivalentes na estimativa e não alteram saldo ou meta. Sem
        preço manual, usa o último abastecimento com volume; sem consumo manual,
        usa ciclos válidos, quando disponíveis.
      </p>
      <button className="motorista-primary" disabled={saving}>
        Salvar premissas com vigência
      </button>
    </form>
  );
}

function PlanSettings({ plans, expenses, categories, saving, save }: Props) {
  const [selected, setSelected] = useState("new"),
    [revision, setRevision] = useState(0);
  const month = localDate().slice(0, 7),
    occurrences = plannedOccurrences(plans, month, expenses);
  return (
    <div className="motorista-card motorista-form">
      <h2>Despesas futuras e compromissos</h2>
      <label>
        Compromisso
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setRevision(revision + 1);
          }}
        >
          <option value="new">Novo compromisso</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.note || categories.find((c) => c.id === p.categoryId)?.name} ·{" "}
              {p.date}
            </option>
          ))}
        </select>
      </label>
      <PlanEditor
        key={`${selected}-${revision}`}
        initial={plans.find((p) => p.id === selected)}
        categories={categories}
        saving={saving}
        save={save}
        done={() => {
          setSelected("new");
          setRevision(revision + 1);
        }}
      />
      <h3>Ocorrências de {month}</h3>
      {occurrences.length ? (
        occurrences.map((o) => (
          <p key={o.key}>
            {o.date} ·{" "}
            {o.plan.note ||
              categories.find((c) => c.id === o.plan.categoryId)?.name}{" "}
            · {money(o.cents)}{" "}
            <strong>
              {o.expenseId ? "Realizado / vinculado" : "Previsto"}
            </strong>
          </p>
        ))
      ) : (
        <p className="motorista-muted">Nenhuma despesa prevista neste mês.</p>
      )}
    </div>
  );
}
function PlanEditor({
  initial: incoming,
  categories,
  saving,
  save,
  done,
}: {
  initial?: PlannedExpense;
  categories: Category[];
  saving: boolean;
  save: SaveDocument;
  done: () => void;
}) {
  const [initial] = useState(incoming);
  const [date, setDate] = useState(initial?.date ?? localDate()),
    [category, setCategory] = useState(initial?.categoryId ?? "outros"),
    [value, setValue] = useState(initial ? money(initial.cents) : ""),
    [note, setNote] = useState(initial?.note ?? "");
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? "none"),
    [end, setEnd] = useState(initial?.endDate ?? ""),
    [error, setError] = useState("");
  const paid = !!Object.keys(initial?.payments ?? {}).length;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseCents(value);
    setError("");
    if (
      !isDate(date) ||
      !Number.isSafeInteger(cents) ||
      cents <= 0 ||
      (end && (!isDate(end) || end < date)) ||
      !categories.some((c) => c.id === category)
    )
      return setError("Revise data, categoria, valor e fim da recorrência.");
    const id = initial?.id ?? crypto.randomUUID();
    if (
      await save(
        "plannedExpenses",
        id,
        {
          ...initial,
          id,
          date,
          categoryId: category,
          cents,
          note,
          recurrence,
          endDate: end || null,
          payments: initial?.payments ?? {},
        },
        initial,
      )
    )
      done();
  }
  return (
    <form className="motorista-form" onSubmit={submit}>
      <FormError>{error}</FormError>
      <div className="motorista-field-grid">
        <label>
          Data prevista
          <input
            type="date"
            value={date}
            disabled={paid}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor previsto (R$)
          <MoneyField value={value} onChange={setValue} required />
        </label>
        <label>
          Recorrência
          <select
            value={recurrence}
            disabled={paid}
            onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
          >
            <option value="none">Uma vez</option>
            <option value="monthly">Todo mês</option>
          </select>
        </label>
        {recurrence === "monthly" && (
          <label>
            Última data prevista (opcional)
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        )}
      </div>
      <label>
        Descrição
        <textarea
          rows={2}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <small>
        O estado realizado é definido pelo vínculo no cadastro do gasto.
        Vencimentos 29–31 usam o último dia dos meses curtos. Um compromisso
        vencido continua pendente até o pagamento.
      </small>
      <button className="motorista-primary" disabled={saving}>
        Salvar despesa prevista
      </button>
    </form>
  );
}

function CategorySettings({ categories, saving, save }: Props) {
  const [selected, setSelected] = useState("new"),
    [revision, setRevision] = useState(0);
  return (
    <div className="motorista-card motorista-form">
      <h2>Categorias e classificação</h2>
      <label>
        Categoria
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setRevision(revision + 1);
          }}
        >
          <option value="new">Nova categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <CategoryEditor
        key={`${selected}-${revision}`}
        initial={categories.find((c) => c.id === selected)}
        categories={categories}
        saving={saving}
        save={save}
        done={() => {
          setSelected("new");
          setRevision(revision + 1);
        }}
      />
    </div>
  );
}
function CategoryEditor({
  initial: incoming,
  categories,
  saving,
  save,
  done,
}: {
  initial?: Category;
  categories: Category[];
  saving: boolean;
  save: SaveDocument;
  done: () => void;
}) {
  const [initial] = useState(incoming);
  const [name, setName] = useState(initial?.name ?? ""),
    [scope, setScope] = useState(initial?.scope ?? "unclassified"),
    [kind, setKind] = useState(initial?.costKind ?? "variable"),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed.length > 80 ||
      categories.some(
        (c) =>
          c.id !== initial?.id &&
          c.name.toLocaleLowerCase("pt-BR") ===
            trimmed.toLocaleLowerCase("pt-BR"),
      )
    )
      return setError("Informe um nome único de até 80 caracteres.");
    const id = initial?.id ?? crypto.randomUUID();
    if (
      await save(
        "categories",
        id,
        { ...initial, id, name: trimmed, scope, costKind: kind },
        initial,
      )
    )
      done();
  }
  return (
    <form className="motorista-form" onSubmit={submit}>
      <FormError>{error}</FormError>
      <div className="motorista-field-grid">
        <label>
          Nome
          <input
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Escopo
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="unclassified">Não classificado</option>
            <option value="operational">Operacional</option>
            <option value="vehicle">Veículo</option>
            <option value="personal">Pessoal</option>
          </select>
        </label>
        <label>
          Tratamento de custo
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="variable">Variável</option>
            <option value="fixed">Fixo (previsão separada)</option>
            <option value="extraordinary">
              Extraordinário (previsão separada)
            </option>
            <option value="fuel">Combustível</option>
            <option value="maintenance">Manutenção</option>
            <option value="wear">Desgaste</option>
          </select>
        </label>
      </div>
      <small>
        Renomear preserva IDs e associações. A classificação é explícita e
        recalcula análises e previsão; todas as despesas, inclusive pessoais,
        continuam no saldo. Cadastre compromissos fixos e extraordinários
        futuros para incluí-los no planejamento.
      </small>
      <button className="motorista-primary" disabled={saving}>
        Salvar categoria
      </button>
    </form>
  );
}
