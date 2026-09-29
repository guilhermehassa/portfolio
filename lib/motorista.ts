export type Day = {
  date: string;
  uberCents: number;
  uberRides: number;
  ninetyNineCents: number;
  ninetyNineRides: number;
  otherCents: number;
  minutes: number;
  km: number;
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
  version: 1;
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

export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const decimal = (value: number, digits = 1) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    value,
  );
export const moneyInput = (cents: number) =>
  cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
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
  const gains = value.uber + value.ninetyNine + value.other;
  const costs = expenses.reduce((sum, expense) => sum + expense.cents, 0);
  return {
    ...value,
    gains,
    costs,
    balance: gains - costs,
    rides: value.uberRides + value.ninetyNineRides,
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

const exactKeys = (record: Record<string, unknown>, keys: string[]) =>
  Object.keys(record).every((key) => keys.includes(key));
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function validateBackup(input: unknown): Backup {
  if (
    !object(input) ||
    input.version !== 1 ||
    typeof input.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(input.exportedAt)) ||
    !["days", "expenses", "categories", "goals"].every((key) =>
      Array.isArray(input[key]),
    )
  )
    throw new Error("Formato de backup inválido ou versão não suportada.");
  const days = input.days as unknown[];
  const expenses = input.expenses as unknown[];
  const categories = input.categories as unknown[];
  const goals = input.goals as unknown[];
  if (days.length + expenses.length + categories.length + goals.length > 10000)
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
        nonnegative(item.km),
    )
  )
    throw new Error("Há registros diários inválidos no backup.");
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
    !unique(expenses, "id") ||
    !unique(categories, "id") ||
    !unique(goals, "month")
  )
    throw new Error("O backup contém identificadores duplicados.");
  const categoryIds = new Set(categories.map((item) => (item as Category).id));
  if (!expenses.every((item) => categoryIds.has((item as Expense).categoryId)))
    throw new Error("Há gastos sem categoria correspondente.");
  return input as Backup;
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
    ],
    ...days.flatMap((day) => [
      [
        "ganho",
        day.date,
        "Uber",
        "",
        String(day.uberCents),
        String(day.uberRides),
        String(day.minutes),
        String(day.km),
      ],
      [
        "ganho",
        day.date,
        "99",
        "",
        String(day.ninetyNineCents),
        String(day.ninetyNineRides),
        "",
        "",
      ],
      ["ganho", day.date, "Outros", "", String(day.otherCents), "", "", ""],
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
