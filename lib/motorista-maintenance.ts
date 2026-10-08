import {
  civilDate, isDate, isMonth, monthBounds, safeInt, totals,
  type Day, type Expense, type Goal,
} from "./motorista";

export type MaintenanceInput = {
  categoryId: string;
  totalCents: number;
  startMonth: string;
  installments: number;
  note: string;
};
export type InstallmentInput = Pick<MaintenanceInput, "totalCents" | "startMonth" | "installments">;
const idValid = (id: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(id);

function monthIndex(month: string) {
  const [year, number] = month.split("-").map(Number);
  return year * 12 + number - 1;
}
function monthAt(index: number) {
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}
export function validateMaintenanceInput(input: InstallmentInput) {
  if (!safeInt(input.totalCents) || input.totalCents <= 0)
    throw new Error("Informe um custo total positivo em centavos válidos.");
  if (!isMonth(input.startMonth) || !isDate(`${input.startMonth}-01`))
    throw new Error("Selecione um mês inicial válido.");
  if (!safeInt(input.installments) || input.installments < 1 ||
    monthIndex(input.startMonth) + input.installments - 1 > monthIndex("9999-12"))
    throw new Error("Informe um número inteiro de parcelas dentro do calendário permitido.");
}

// O resto fica nas primeiras parcelas/datas. BigInt conserva até o maior centavo seguro.
function share(cents: number, count: number, index: number) {
  const total = BigInt(cents), divisor = BigInt(count);
  return Number(total / divisor + (BigInt(index) < total % divisor ? BigInt(1) : BigInt(0)));
}
export function installmentsPreview(input: InstallmentInput) {
  validateMaintenanceInput(input);
  return Array.from({ length: input.installments }, (_, index) => ({
    month: monthAt(monthIndex(input.startMonth) + index),
    cents: share(input.totalCents, input.installments, index),
  }));
}

export function maintenanceExpenseFromInput(input: MaintenanceInput, previous?: Expense, id?: string): Expense {
  validateMaintenanceInput(input);
  const expenseId = previous?.id ?? id ?? "";
  if (!idValid(expenseId) || !idValid(input.categoryId))
    throw new Error("Revise a identificação e a categoria da manutenção.");
  if (typeof input.note !== "string" || input.note.length > 500)
    throw new Error("A descrição deve ter até 500 caracteres.");
  return {
    ...previous,
    id: expenseId,
    // Âncora técnica do documento; não é vencimento nem pagamento em um dia.
    date: `${input.startMonth}-01`,
    categoryId: input.categoryId,
    kind: "maintenance",
    cents: input.totalCents,
    note: input.note,
    origin: previous?.origin ?? "user",
    maintenance: {
      ...previous?.maintenance,
      startMonth: input.startMonth,
      installments: input.installments,
    },
  };
}

export type MaintenanceRow = {
  expense: Expense;
  month: string;
  installment: number;
  installments: number;
  monthlyCents: number;
  allocatedCents: number;
  scheduledCents: number;
  futureCents: number;
  allocation: "planned" | "calendar";
};
export type AnalyticExpense = Expense & {
  maintenanceAllocation?: { month: string; installment: number; allocation: MaintenanceRow["allocation"] };
};

function allocationDates(month: string, goals: Goal[]) {
  const bounds = monthBounds(month);
  const all = Array.from({ length: Number(bounds.to.slice(-2)) }, (_, index) =>
    `${month}-${String(index + 1).padStart(2, "0")}`);
  const explicit = goals.find((goal) => goal.month === month)?.workDates;
  if (explicit?.some((date) => !isDate(date) || date.slice(0, 7) !== month))
    throw new Error("Há datas planejadas inválidas no mês da manutenção.");
  const planned = explicit === undefined
    ? all.filter((date) => ![0, 6].includes(civilDate(date).getDay()))
    : [...new Set(explicit)].sort();
  return planned.length
    ? { dates: planned, allocation: "planned" as const }
    : { dates: all, allocation: "calendar" as const };
}

function maintenanceSegments(expenses: Expense[], goals: Goal[], from: string, to: string) {
  if (!isDate(from) || !isDate(to) || from > to) return [];
  return expenses.filter((expense) => expense.kind === "maintenance").flatMap((expense) => {
    if (!expense.maintenance) throw new Error("Manutenção sem mês inicial ou parcelas.");
    const input = { ...expense.maintenance, totalCents: expense.cents };
    validateMaintenanceInput(input);
    const first = monthIndex(input.startMonth);
    const start = Math.max(first, monthIndex(from.slice(0, 7)));
    const last = Math.min(first + input.installments - 1, monthIndex(to.slice(0, 7)));
    const result = [];
    for (let index = start; index <= last; index++) {
      const month = monthAt(index);
      const calendar = allocationDates(month, goals);
      result.push({ expense, month, installment: index - first + 1, installments: input.installments,
        monthlyCents: share(input.totalCents, input.installments, index - first), ...calendar });
    }
    return result;
  });
}

export function maintenanceRows(expenses: Expense[], goals: Goal[], from: string, to: string, reference = to): MaintenanceRow[] {
  return maintenanceSegments(expenses, goals, from, to).map(({ dates, ...row }) => {
    const scheduledCents = dates.reduce((sum, date, index) =>
      sum + (date >= from && date <= to ? share(row.monthlyCents, dates.length, index) : 0), 0);
    const allocatedCents = dates.reduce((sum, date, index) =>
      sum + (date >= from && date <= to && date <= reference ? share(row.monthlyCents, dates.length, index) : 0), 0);
    return { ...row, scheduledCents, allocatedCents, futureCents: scheduledCents - allocatedCents };
  });
}

// Lançamentos analíticos somente em memória. Não salvar/importar estes clones como documentos.
export function analyticExpenses(expenses: Expense[], goals: Goal[], from: string, to: string, reference = to): AnalyticExpense[] {
  if (!isDate(from) || !isDate(to) || from > to) return [];
  const ordinary = expenses.filter((expense) => expense.kind !== "maintenance" && expense.date >= from && expense.date <= to);
  const allocated = maintenanceSegments(expenses, goals, from, to).flatMap((row) => row.dates.flatMap((date, index) =>
    date >= from && date <= to && date <= reference ? [{
      ...row.expense, date, kind: "expense" as const,
      cents: share(row.monthlyCents, row.dates.length, index),
      maintenanceAllocation: { month: row.month, installment: row.installment, allocation: row.allocation },
    }] : []));
  return [...ordinary, ...allocated];
}

export function periodTotals(days: Day[], expenses: Expense[], goals: Goal[], from: string, to: string, reference = to) {
  const result = totals(days.filter((day) => day.date >= from && day.date <= to), analyticExpenses(expenses, goals, from, to, reference));
  if (![result.gains, result.costs, result.balance].every(Number.isSafeInteger))
    throw new Error("A soma financeira do período ultrapassa o limite de centavos permitido.");
  return result;
}
