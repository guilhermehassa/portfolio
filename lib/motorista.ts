export type Day = {
  date: string;
  uberCents: number;
  uberRides: number;
  ninetyNineCents: number;
  ninetyNineRides: number;
  otherCents: number;
  minutes: number;
  km: number;
  consumption?: number;
  status?: "pending" | "closed" | "off";
  origin?: "legacy" | "user";
  filled?: Partial<
    Record<
      | "uberCents"
      | "ninetyNineCents"
      | "otherCents"
      | "uberRides"
      | "ninetyNineRides"
      | "minutes"
      | "km"
      | "consumption",
      boolean
    >
  >;
  shift?: "morning" | "afternoon" | "night" | "dawn" | "mixed" | "";
  note?: string;
  odometerStart?: number | null;
  odometerEnd?: number | null;
};

export type Gain = {
  id: string;
  date: string;
  source: "uber" | "ninetyNine" | "other";
  cents: number;
};

export type Expense = {
  id: string;
  date: string;
  categoryId: string;
  cents: number;
  note: string;
  kind?: "expense" | "fuel";
  origin?: "legacy" | "user";
  scope?: ExpenseScope;
  fuel?: FuelDetails;
  plannedExpenseId?: string | null;
};
export type ExpenseScope =
  "operational" | "vehicle" | "personal" | "unclassified";
export type FuelDetails = {
  fuelType?: string;
  unit?: "L" | "m3";
  volume?: number | null;
  odometer?: number | null;
  tank?: "full" | "partial" | "unknown";
  previousMissing?: boolean;
  incomplete?: boolean;
};
export type Category = {
  id: string;
  name: string;
  scope?: ExpenseScope;
  costKind?:
    "variable" | "fixed" | "extraordinary" | "fuel" | "maintenance" | "wear";
};
export type Goal = {
  month: string;
  cents: number;
  workDates?: string[];
  historyDays?: number;
  variableDailyCents?: number | null;
};
export type PlannedExpense = {
  id: string;
  date: string;
  categoryId: string;
  cents: number;
  note: string;
  recurrence?: "none" | "monthly";
  endDate?: string | null;
  payments?: Record<string, string>;
};
export type CostProfile = {
  id: string;
  effectiveFrom: string;
  vehicle: "owned" | "financed" | "rented";
  fuelType: string;
  unit: "L" | "m3";
  consumption?: number | null;
  priceCentsPerUnit?: number | null;
  workShare: number;
  fixedMonthlyCents: number;
  maintenanceCentsPerKm?: number;
  wearCentsPerKm?: number;
};
export type Backup = {
  version: 4;
  exportedAt: string;
  days: Day[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  plannedExpenses: PlannedExpense[];
  costProfiles: CostProfile[];
};

export type ImportEntry = { name: string; id: string; data: object };
// Categorias entram primeiro. Cada compromisso e seus pagamentos importados
// permanecem na mesma transação, mesmo se o arquivo ultrapassar um lote.
export function importBatches(
  entries: ImportEntry[],
  limit = 150,
): ImportEntry[][] {
  const batches: ImportEntry[][] = [];
  const categories = entries.filter((e) => e.name === "categories");
  for (let i = 0; i < categories.length; i += limit)
    batches.push(categories.slice(i, i + limit));
  const remaining = entries.filter((e) => e.name !== "categories");
  const groups = new Map<string, ImportEntry[]>();
  for (const e of remaining) {
    const link =
      e.name === "expenses" ? (e.data as Expense).plannedExpenseId : null;
    const key =
      e.name === "plannedExpenses"
        ? `plan:${e.id}`
        : link
          ? `plan:${link.slice(0, -12)}`
          : `${e.name}:${e.id}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  let batch: ImportEntry[] = [];
  for (const group of groups.values()) {
    if (group.length > limit)
      throw new Error(
        `Um compromisso reúne ${group.length} documentos vinculados; divida o histórico em backups consistentes de até ${limit} itens por compromisso antes de importar.`,
      );
    if (batch.length + group.length > limit) {
      batches.push(batch);
      batch = [];
    }
    batch.push(...group);
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "combustivel", name: "Combustível" },
  { id: "manutencao", name: "Manutenção" },
  { id: "alimentacao", name: "Alimentação" },
  { id: "pedagio", name: "Pedágio" },
  { id: "estacionamento", name: "Estacionamento" },
  { id: "lavagem", name: "Lavagem" },
  { id: "outros", name: "Outros" },
];

export const emptyDay = (date: string): Day => ({
  date,
  uberCents: 0,
  uberRides: 0,
  ninetyNineCents: 0,
  ninetyNineRides: 0,
  otherCents: 0,
  minutes: 0,
  km: 0,
  consumption: 0,
});

export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const decimal = (value: number, digits = 1) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    value,
  );
export const moneyInput = (cents: number) => (cents ? money(cents) : "");
export const maskMoney = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  return digits ? money(Number(digits)) : "";
};
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const civilDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
export const isDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  localDate(civilDate(value)) === value;
export const isMonth = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const utcDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const utcDateLabel = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
export function isoWeek(value: string) {
  if (!isDate(value)) return "";
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    (date.getTime() - yearStart.getTime() + 86400000) / (7 * 86400000),
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}
export function weekBounds(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return { from: "", to: "" };
  const year = Number(match[1]);
  const week = Number(match[2]);
  const monday = new Date(Date.UTC(year, 0, 4));
  monday.setUTCDate(
    monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + (week - 1) * 7,
  );
  const from = utcDateLabel(monday);
  if (isoWeek(from) !== value) return { from: "", to: "" };
  monday.setUTCDate(monday.getUTCDate() + 6);
  return { from, to: utcDateLabel(monday) };
}
export function monthBounds(value: string) {
  if (!isMonth(value)) return { from: "", to: "" };
  const [year, month] = value.split("-").map(Number);
  return {
    from: `${value}-01`,
    to: `${value}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`,
  };
}
export const parseDecimal = (value: string) => {
  const input = value.trim();
  const normalized = input.includes(",")
    ? input.replace(/\./g, "").replace(",", ".")
    : input;
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized))
    return normalized ? NaN : 0;
  return Number(normalized);
};
export const parseCents = (value: string) => {
  const input = value.trim();
  if (input.startsWith("R$")) {
    const normalized = input
      .slice(2)
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    if (!/^\d+(\.\d{2})?$/.test(normalized)) return NaN;
    return Math.round(Number(normalized) * 100);
  }
  const normalized = input.includes(",")
    ? input.replace(/\./g, "").replace(",", ".")
    : input;
  if (normalized && !/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const number = parseDecimal(value);
  if (!Number.isFinite(number) || number < 0) return NaN;
  return Math.round(number * 100);
};
export const nonnegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
export const safeInt = (value: unknown) =>
  nonnegative(value) && Number.isSafeInteger(value);

export function periodBounds(
  kind: "day" | "week" | "month" | "custom",
  anchor: string,
  from: string,
  to: string,
) {
  if (kind === "custom") return { from, to };
  if (kind === "day") return { from: anchor, to: anchor };
  const date = civilDate(anchor);
  if (kind === "week") {
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const start = localDate(date);
    date.setDate(date.getDate() + 6);
    return { from: start, to: localDate(date) };
  }
  return {
    from: `${anchor.slice(0, 7)}-01`,
    to: localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export function legacyGains(days: Day[]): Gain[] {
  return days.flatMap((day) =>
    (["uber", "ninetyNine", "other"] as const).flatMap((source) => {
      const cents = day[`${source}Cents`];
      return cents > 0
        ? [
            {
              id: `legacy:${day.date}:${source}`,
              date: day.date,
              source,
              cents,
            },
          ]
        : [];
    }),
  );
}

export function totals(days: Day[], expenses: Expense[]) {
  const value = days.reduce(
    (sum, day) => ({
      uber: sum.uber + day.uberCents,
      ninetyNine: sum.ninetyNine + day.ninetyNineCents,
      other: sum.other + day.otherCents,
      uberRides: sum.uberRides + day.uberRides,
      ninetyNineRides: sum.ninetyNineRides + day.ninetyNineRides,
      minutes: sum.minutes + day.minutes,
      km: sum.km + day.km,
    }),
    {
      uber: 0,
      ninetyNine: 0,
      other: 0,
      uberRides: 0,
      ninetyNineRides: 0,
      minutes: 0,
      km: 0,
    },
  );
  const uber = value.uber;
  const ninetyNine = value.ninetyNine;
  const other = value.other;
  const totalGains = uber + ninetyNine + other;
  const costs = expenses.reduce((sum, expense) => sum + expense.cents, 0);
  return {
    ...value,
    uber,
    ninetyNine,
    other,
    gains: totalGains,
    costs,
    balance: totalGains - costs,
    rides: value.uberRides + value.ninetyNineRides,
    consumption: (() => {
      const records = days.filter(
        (day) => day.consumption && day.consumption > 0,
      );
      return records.length > 0
        ? records.reduce((sum, day) => sum + day.consumption!, 0) /
            records.length
        : null;
    })(),
  };
}

export function goalPlan(
  month: string,
  goalCents: number,
  balanceCents: number,
  today = localDate(),
) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const estimatedDays = Math.round((daysInMonth * 5) / 7);
  const start = `${month}-01`;
  const end = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const remainingCalendarDays =
    today > end
      ? 0
      : today < start
        ? daysInMonth
        : daysInMonth - Number(today.slice(-2)) + 1;
  const remainingWorkDays = Math.round((remainingCalendarDays * 5) / 7);
  const missing = Math.max(goalCents - balanceCents, 0);
  return {
    estimatedDays,
    daily: estimatedDays > 0 ? goalCents / estimatedDays : null,
    weekly: estimatedDays > 0 ? (goalCents / estimatedDays) * 5 : null,
    remainingWorkDays,
    requiredDaily: remainingWorkDays > 0 ? missing / remainingWorkDays : null,
    missing,
    percent: goalCents > 0 ? (balanceCents / goalCents) * 100 : 0,
  };
}

export function expectedGoal(
  from: string,
  to: string,
  goals: Goal[],
): number | null {
  if (!isDate(from) || !isDate(to) || from > to) return null;

  let expected = 0;
  let cursor = from.slice(0, 7);
  const lastMonth = to.slice(0, 7);

  while (cursor <= lastMonth) {
    const goal = goalForMonth(goals, cursor)?.cents;
    if (!goal) return null;

    const [year, month] = cursor.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const segmentFrom = cursor === from.slice(0, 7) ? Number(from.slice(8)) : 1;
    const segmentTo = cursor === lastMonth ? Number(to.slice(8)) : daysInMonth;
    const estimatedMonthDays = Math.round((daysInMonth * 5) / 7);
    const estimatedSegmentDays = Math.round(
      ((segmentTo - segmentFrom + 1) * 5) / 7,
    );
    expected += (goal * estimatedSegmentDays) / estimatedMonthDays;
    cursor = localDate(new Date(year, month, 1)).slice(0, 7);
  }

  return Math.round(expected);
}

export function goalForMonth(goals: Goal[], month: string): Goal | null {
  if (!isMonth(month)) return null;
  return goals.reduce<Goal | null>(
    (latest, goal) =>
      goal.cents > 0 &&
      goal.month <= month &&
      (!latest || goal.month > latest.month)
        ? goal
        : latest,
    null,
  );
}

const exactKeys = (record: Record<string, unknown>, keys: string[]) =>
  Object.keys(record).every((key) => keys.includes(key));
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function mergeGainsIntoDays(days: Day[], gains: Gain[]): Day[] {
  const byDate = new Map(days.map((day) => [day.date, { ...day }]));
  for (const gain of gains) {
    const day = byDate.get(gain.date) ?? emptyDay(gain.date);
    const key = `${gain.source}Cents` as const;
    const next = day[key] + gain.cents;
    if (!Number.isSafeInteger(next))
      throw new Error("A soma dos ganhos ultrapassa o limite permitido.");
    day[key] = next;
    byDate.set(gain.date, day);
  }
  return [...byDate.values()];
}
export function validateBackup(input: unknown): Backup {
  if (
    !object(input) ||
    ![1, 2, 3, 4].includes(input.version as number) ||
    typeof input.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(input.exportedAt)) ||
    !["days", "expenses", "categories", "goals"].every((key) =>
      Array.isArray(input[key]),
    )
  )
    throw new Error("Formato de backup inválido ou versão não suportada.");
  const days = input.days as unknown[];
  const gains = input.version === 2 ? (input.gains as unknown[]) : [];
  const expenses = input.expenses as unknown[];
  const categories = input.categories as unknown[];
  const goals = input.goals as unknown[];
  const plannedExpenses =
    input.version === 4 ? (input.plannedExpenses as unknown[]) : [];
  const costProfiles =
    input.version === 4 ? (input.costProfiles as unknown[]) : [];
  if (
    !Array.isArray(gains) ||
    !Array.isArray(plannedExpenses) ||
    !Array.isArray(costProfiles) ||
    days.length +
      gains.length +
      expenses.length +
      categories.length +
      goals.length +
      plannedExpenses.length +
      costProfiles.length >
      10000
  )
    throw new Error("Backup grande demais (limite de 10.000 itens).");
  if (
    !days.every(
      (item) =>
        object(item) &&
        isDate(item.date) &&
        [
          "uberCents",
          "uberRides",
          "ninetyNineCents",
          "ninetyNineRides",
          "otherCents",
          "minutes",
        ].every((key) => safeInt(item[key])) &&
        nonnegative(item.km) &&
        (item.consumption === undefined || nonnegative(item.consumption)),
    )
  )
    throw new Error("Há registros diários inválidos no backup.");
  if (
    !gains.every(
      (item) =>
        object(item) &&
        exactKeys(item, ["id", "date", "source", "cents"]) &&
        typeof item.id === "string" &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(item.id) &&
        isDate(item.date) &&
        ["uber", "ninetyNine", "other"].includes(String(item.source)) &&
        typeof item.cents === "number" &&
        safeInt(item.cents) &&
        item.cents > 0,
    )
  )
    throw new Error("Há ganhos inválidos no backup.");
  if (
    !expenses.every(
      (item) =>
        object(item) &&
        typeof item.id === "string" &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(item.id) &&
        isDate(item.date) &&
        typeof item.categoryId === "string" &&
        safeInt(item.cents) &&
        typeof item.note === "string" &&
        item.note.length <= 500,
    )
  )
    throw new Error("Há gastos inválidos no backup.");
  if (
    !categories.every(
      (item) =>
        object(item) &&
        typeof item.id === "string" &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(item.id) &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        item.name.length <= 80,
    )
  )
    throw new Error("Há categorias inválidas no backup.");
  if (
    !goals.every(
      (item) => object(item) && isMonth(item.month) && safeInt(item.cents),
    )
  )
    throw new Error("Há metas inválidas no backup.");
  const unique = (items: unknown[], key: string) =>
    new Set(items.map((item) => (item as Record<string, unknown>)[key]))
      .size === items.length;
  if (
    !unique(days, "date") ||
    !unique(gains, "id") ||
    !unique(expenses, "id") ||
    !unique(categories, "id") ||
    !unique(goals, "month") ||
    !unique(plannedExpenses, "id") ||
    !unique(costProfiles, "id")
  )
    throw new Error("O backup contém identificadores duplicados.");
  const categoryIds = new Set(categories.map((item) => (item as Category).id));
  if (!expenses.every((item) => categoryIds.has((item as Expense).categoryId)))
    throw new Error("Há gastos sem categoria correspondente.");
  validateExtensions(
    days,
    expenses,
    categories,
    goals,
    plannedExpenses,
    costProfiles,
  );
  return {
    ...input,
    version: 4,
    exportedAt: input.exportedAt,
    days: mergeGainsIntoDays(days as Day[], gains as Gain[]),
    expenses: expenses as Expense[],
    categories: categories as Category[],
    goals: goals as Goal[],
    plannedExpenses: plannedExpenses as PlannedExpense[],
    costProfiles: costProfiles as CostProfile[],
  };
}

function validateExtensions(
  days: unknown[],
  expenses: unknown[],
  categories: unknown[],
  goals: unknown[],
  plans: unknown[],
  profiles: unknown[],
) {
  const id = (v: unknown) =>
    typeof v === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
  const optionalNumber = (v: unknown) => v == null || nonnegative(v);
  const optionalText = (v: unknown, max = 500) =>
    v === undefined || (typeof v === "string" && v.length <= max);
  const scope = (v: unknown) =>
    v === undefined ||
    ["operational", "vehicle", "personal", "unclassified"].includes(String(v));
  const json = (v: unknown, depth = 0): boolean =>
    depth < 30 &&
    (v === null ||
      typeof v === "string" ||
      typeof v === "boolean" ||
      (typeof v === "number" && Number.isFinite(v)) ||
      (Array.isArray(v)
        ? v.every((x) => json(x, depth + 1))
        : object(v) &&
          Object.entries(v).every(
            ([k, x]) =>
              !["__proto__", "constructor", "prototype"].includes(k) &&
              json(x, depth + 1),
          )));
  if (
    ![
      ...days,
      ...expenses,
      ...categories,
      ...goals,
      ...plans,
      ...profiles,
    ].every((x) => json(x))
  )
    throw new Error("Campos históricos não são valores JSON válidos.");
  if (
    !days.every((x) => {
      const d = x as Day;
      return (
        (d.status === undefined ||
          ["pending", "closed", "off"].includes(d.status)) &&
        (d.origin === undefined || ["legacy", "user"].includes(d.origin)) &&
        optionalText(d.note) &&
        (d.shift === undefined ||
          ["", "morning", "afternoon", "night", "dawn", "mixed"].includes(
            d.shift,
          )) &&
        optionalNumber(d.odometerStart) &&
        optionalNumber(d.odometerEnd) &&
        (d.odometerStart == null ||
          d.odometerEnd == null ||
          d.odometerEnd >= d.odometerStart) &&
        (d.filled === undefined ||
          (object(d.filled) &&
            Object.values(d.filled).every((v) => typeof v === "boolean"))) &&
        (d.status !== "off" ||
          (d.uberCents + d.ninetyNineCents + d.otherCents === 0 &&
            d.minutes === 0 &&
            d.km === 0))
      );
    })
  )
    throw new Error(
      "Há situações, odômetros ou preenchimentos diários inválidos.",
    );
  if (
    !categories.every((x) => {
      const c = x as Category;
      return (
        scope(c.scope) &&
        (c.costKind === undefined ||
          [
            "variable",
            "fixed",
            "extraordinary",
            "fuel",
            "maintenance",
            "wear",
          ].includes(c.costKind))
      );
    })
  )
    throw new Error("Classificação de categoria inválida.");
  if (
    !goals.every((x) => {
      const g = x as Goal;
      return (
        (g.workDates === undefined ||
          (Array.isArray(g.workDates) &&
            new Set(g.workDates).size === g.workDates.length &&
            g.workDates.every((d) => isDate(d) && d.startsWith(g.month)))) &&
        (g.historyDays === undefined ||
          (safeInt(g.historyDays) &&
            g.historyDays >= 1 &&
            g.historyDays <= 365)) &&
        (g.variableDailyCents == null || safeInt(g.variableDailyCents))
      );
    })
  )
    throw new Error("Planejamento mensal inválido.");
  if (
    !expenses.every((x) => {
      const e = x as Expense,
        f = e.fuel;
      return (
        scope(e.scope) &&
        (e.kind === undefined || ["expense", "fuel"].includes(e.kind)) &&
        (e.plannedExpenseId == null || id(e.plannedExpenseId)) &&
        (f === undefined ||
          (object(f) &&
            optionalText(f.fuelType, 80) &&
            (f.unit === undefined || ["L", "m3"].includes(f.unit)) &&
            optionalNumber(f.volume) &&
            optionalNumber(f.odometer) &&
            (f.tank === undefined ||
              ["full", "partial", "unknown"].includes(f.tank)) &&
            (f.previousMissing === undefined ||
              typeof f.previousMissing === "boolean") &&
            (f.incomplete === undefined || typeof f.incomplete === "boolean")))
      );
    })
  )
    throw new Error("Detalhes de gasto ou abastecimento inválidos.");
  const categoryIds = new Set((categories as Category[]).map((c) => c.id));
  if (
    !plans.every((x) => {
      if (!object(x)) return false;
      return (
        id(x.id) &&
        isDate(x.date) &&
        categoryIds.has(x.categoryId as string) &&
        safeInt(x.cents) &&
        typeof x.note === "string" &&
        x.note.length <= 500 &&
        (x.recurrence === undefined ||
          ["none", "monthly"].includes(String(x.recurrence))) &&
        (x.endDate == null || (isDate(x.endDate) && x.endDate >= x.date)) &&
        (x.payments === undefined ||
          (object(x.payments) &&
            Object.entries(x.payments).every(([k, v]) => id(k) && id(v))))
      );
    })
  )
    throw new Error("Há despesas previstas inválidas.");
  if (
    !profiles.every((x) => {
      if (!object(x)) return false;
      return (
        id(x.id) &&
        isDate(x.effectiveFrom) &&
        ["owned", "financed", "rented"].includes(String(x.vehicle)) &&
        typeof x.fuelType === "string" &&
        x.fuelType.length > 0 &&
        x.fuelType.length <= 80 &&
        ["L", "m3"].includes(String(x.unit)) &&
        optionalNumber(x.consumption) &&
        optionalNumber(x.priceCentsPerUnit) &&
        nonnegative(x.workShare) &&
        Number(x.workShare) <= 100 &&
        safeInt(x.fixedMonthlyCents) &&
        optionalNumber(x.maintenanceCentsPerKm) &&
        optionalNumber(x.wearCentsPerKm)
      );
    }) ||
    new Set((profiles as CostProfile[]).map((p) => p.effectiveFrom)).size !==
      profiles.length
  )
    throw new Error("Perfis de custo ou vigências inválidos.");
  const linked = (expenses as Expense[]).filter((e) => e.plannedExpenseId);
  if (new Set(linked.map((e) => e.plannedExpenseId)).size !== linked.length)
    throw new Error("Uma previsão está vinculada a mais de um pagamento.");
  for (const e of linked) {
    const plan = (plans as PlannedExpense[]).find(
      (p) => p.id === e.plannedExpenseId!.slice(0, -12),
    );
    const date = e.plannedExpenseId!.slice((plan?.id.length ?? 0) + 2);
    if (!plan || !isDate(date) || plan.payments?.[e.plannedExpenseId!] !== e.id)
      throw new Error("Vínculo entre previsão e pagamento inconsistente.");
    const occurrenceDate =
      plan.recurrence === "monthly"
        ? `${date.slice(0, 7)}-${String(Math.min(Number(plan.date.slice(-2)), Number(monthBounds(date.slice(0, 7)).to.slice(-2)))).padStart(2, "0")}`
        : plan.date;
    if (
      date !== occurrenceDate ||
      date < plan.date ||
      (plan.endDate && date > plan.endDate)
    )
      throw new Error(
        "Vínculo não corresponde a uma ocorrência válida da previsão.",
      );
  }
  for (const p of plans as PlannedExpense[])
    for (const [key, expenseId] of Object.entries(p.payments ?? {})) {
      if (
        !(expenses as Expense[]).some(
          (e) => e.id === expenseId && e.plannedExpenseId === key,
        )
      )
        throw new Error("Previsão referencia pagamento ausente.");
    }
}

export function exportCsv(
  days: Day[],
  expenses: Expense[],
  categories: Category[],
  estimates: Array<{
    date: string;
    result: number;
    fuel: number;
    cost: number;
    unit: string;
  }> = [],
) {
  const names = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const rows: string[][] = [
    [
      "tipo",
      "data",
      "categoria",
      "descricao",
      "valor_centavos",
      "corridas",
      "minutos",
      "km",
      "consumo_km_l",
      "situacao",
      "combustivel",
      "unidade_volume",
      "volume",
      "odometro_km",
      "valor_estimado_centavos",
      "custo_estimado_centavos",
      "combustivel_estimado_centavos",
    ],
  ];
  const known = (
    day: Day,
    field: keyof NonNullable<Day["filled"]>,
    value: number,
  ) => day.filled?.[field] ?? value > 0;
  for (const day of days) {
    const status = day.status ?? "legado_nao_confirmado";
    const sources = [
      ["Uber", day.uberCents, day.uberRides, "uberCents", "uberRides"],
      [
        "99",
        day.ninetyNineCents,
        day.ninetyNineRides,
        "ninetyNineCents",
        "ninetyNineRides",
      ],
      ["Outro", day.otherCents, 0, "otherCents", null],
    ] as const;
    for (const [name, cents, rides, valueField, ridesField] of sources) {
      if (!known(day, valueField, cents)) continue;
      rows.push([
        "ganho",
        day.date,
        name,
        "",
        String(cents),
        ridesField && known(day, ridesField, rides) ? String(rides) : "",
        "",
        "",
        "",
        status,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    }
    rows.push([
      "dados_do_dia",
      day.date,
      "",
      day.note ?? "",
      "",
      "",
      known(day, "minutes", day.minutes) ? String(day.minutes) : "",
      known(day, "km", day.km) ? String(day.km) : "",
      known(day, "consumption", day.consumption ?? 0)
        ? String(day.consumption)
        : "",
      status,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }
  for (const expense of expenses) {
    rows.push([
      "gasto",
      expense.date,
      names.get(expense.categoryId) ?? expense.categoryId,
      expense.note,
      String(expense.cents),
      "",
      "",
      "",
      "",
      "registrado",
      expense.fuel?.fuelType ?? "",
      expense.fuel?.unit ?? "",
      expense.fuel?.volume == null ? "" : String(expense.fuel.volume),
      expense.fuel?.odometer == null ? "" : String(expense.fuel.odometer),
      "",
      "",
      "",
    ]);
  }
  for (const e of estimates)
    rows.push([
      "estimativa_trabalho",
      e.date,
      "",
      "Estimativa; não é lançamento financeiro",
      "",
      "",
      "",
      "",
      "",
      "estimado",
      "",
      e.unit,
      "",
      "",
      String(e.result),
      String(e.cost),
      String(e.fuel),
    ]);
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row.map((value) => `"${value.replace(/"/g, '""')}"`).join(";"),
      )
      .join("\r\n")
  );
}
