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
};
export type Category = { id: string; name: string };
export type Goal = { month: string; cents: number };
export type Backup = {
  version: 3;
  exportedAt: string;
  days: Day[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
};

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
    ![1, 2, 3].includes(input.version as number) ||
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
  if (
    !Array.isArray(gains) ||
    days.length +
      gains.length +
      expenses.length +
      categories.length +
      goals.length >
      10000
  )
    throw new Error("Backup grande demais (limite de 10.000 itens).");
  if (
    !days.every(
      (item) =>
        object(item) &&
        exactKeys(item, [
          "date",
          "uberCents",
          "uberRides",
          "ninetyNineCents",
          "ninetyNineRides",
          "otherCents",
          "minutes",
          "km",
          "consumption",
        ]) &&
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
        exactKeys(item, ["id", "date", "categoryId", "cents", "note"]) &&
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
        exactKeys(item, ["id", "name"]) &&
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
      (item) =>
        object(item) &&
        exactKeys(item, ["month", "cents"]) &&
        isMonth(item.month) &&
        safeInt(item.cents),
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
    !unique(goals, "month")
  )
    throw new Error("O backup contém identificadores duplicados.");
  const categoryIds = new Set(categories.map((item) => (item as Category).id));
  if (!expenses.every((item) => categoryIds.has((item as Expense).categoryId)))
    throw new Error("Há gastos sem categoria correspondente.");
  return {
    version: 3,
    exportedAt: input.exportedAt,
    days: mergeGainsIntoDays(days as Day[], gains as Gain[]),
    expenses: expenses as Expense[],
    categories: categories as Category[],
    goals: goals as Goal[],
  };
}

export function exportCsv(
  days: Day[],
  expenses: Expense[],
  categories: Category[],
) {
  const names = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const rows = [
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
    ],
    ...days.flatMap((day) => [
      ...(day.uberCents > 0
        ? [
            [
              "ganho",
              day.date,
              "Uber",
              "",
              String(day.uberCents),
              String(day.uberRides),
              "",
              "",
              "",
            ],
          ]
        : []),
      ...(day.ninetyNineCents > 0
        ? [
            [
              "ganho",
              day.date,
              "99",
              "",
              String(day.ninetyNineCents),
              String(day.ninetyNineRides),
              "",
              "",
              "",
            ],
          ]
        : []),
      ...(day.otherCents > 0
        ? [
            [
              "ganho",
              day.date,
              "Outro",
              "",
              String(day.otherCents),
              "",
              "",
              "",
              "",
            ],
          ]
        : []),
      [
        "dados_do_dia",
        day.date,
        "",
        "",
        "",
        "",
        String(day.minutes),
        String(day.km),
        day.consumption ? String(day.consumption) : "",
      ],
    ]),
    ...expenses.map((expense) => [
      "gasto",
      expense.date,
      names.get(expense.categoryId) ?? expense.categoryId,
      expense.note,
      String(expense.cents),
      "",
      "",
      "",
      "",
    ]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row.map((value) => `"${value.replace(/"/g, '""')}"`).join(";"),
      )
      .join("\r\n")
  );
}
