import { goalForMonth, isDate, type Category, type Day, type Expense, type Goal } from "./motorista";
import { analyticExpenses, maintenanceRows, periodTotals } from "./motorista-maintenance";
import { addDate, datesBetween, defaultWorkDates, eligible, hasField } from "./motorista-evolution";
import { weeklyGoalPlanning } from "./motorista-weekly-goal";

export type ReportPeriod = "week" | "month";

export function reportGoal(filter: ReportPeriod, from: string, to: string, goals: Goal[]) {
  if (!isDate(from) || !isDate(to) || from > to) return null;
  return filter === "week"
    ? weeklyGoalPlanning({ reference: from, goals, days: [], expenses: [] }).goal
    : goalForMonth(goals, from.slice(0, 7))?.cents ?? null;
}

export function reportCategoryCosts(expenses: Expense[], goals: Goal[], categories: Category[], from: string, to: string, reference: string) {
  const amounts = new Map<string, number>();
  for (const expense of analyticExpenses(expenses, goals, from, to, reference)) {
    const cents = (amounts.get(expense.categoryId) ?? 0) + expense.cents;
    if (!Number.isSafeInteger(cents)) throw new Error("O custo da categoria ultrapassa o limite de centavos permitido.");
    amounts.set(expense.categoryId, cents);
  }
  return [...amounts].filter(([, cents]) => cents > 0).map(([id, cents]) => ({
    id, label: categories.find((category) => category.id === id)?.name ?? id, cents,
  })).sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));
}

export function reportMaintenanceRows(expenses: Expense[], goals: Goal[], from: string, to: string, reference: string) {
  const byId = new Map<string, {
    expense: Expense; name: string; totalCents: number; installments: number; startMonth: string;
    months: string[]; allocatedCents: number; scheduledCents: number; futureCents: number;
  }>();
  for (const row of maintenanceRows(expenses, goals, from, to, reference)) {
    const item = byId.get(row.expense.id) ?? {
      expense: row.expense, name: row.expense.note || "Manutenção", totalCents: row.expense.cents,
      installments: row.installments, startMonth: row.expense.maintenance!.startMonth,
      months: [], allocatedCents: 0, scheduledCents: 0, futureCents: 0,
    };
    item.months.push(row.month);
    item.allocatedCents += row.allocatedCents;
    item.scheduledCents += row.scheduledCents;
    item.futureCents += row.futureCents;
    byId.set(row.expense.id, item);
  }
  return [...byId.values()];
}

type ReportInput = {
  filter: ReportPeriod; from: string; to: string; reference: string;
  days: Day[]; expenses: Expense[]; categories: Category[]; goals: Goal[];
};

function plannedDates(from: string, to: string, goals: Goal[]) {
  const months = [...new Set(datesBetween(from, to).map((date) => date.slice(0, 7)))];
  return months.flatMap((month) => goals.find((goal) => goal.month === month)?.workDates ?? defaultWorkDates(month))
    .filter((date) => date >= from && date <= to).sort();
}
const ratio = (value: number, divisor: number, complete = true) => complete && divisor > 0 ? value / divisor : null;

export function reportAnalysis({ filter, from, to, reference, days, expenses, categories, goals }: ReportInput) {
  if (!["week", "month"].includes(filter) || !isDate(from) || !isDate(to) || !isDate(reference) || from > to)
    throw new Error("Selecione uma semana ou mês válidos para o relatório.");
  if (from > reference) throw new Error("Relatórios estão disponíveis somente para períodos atuais ou passados.");
  const effectiveTo = to < reference ? to : reference;
  const periodDays = days.filter((day) => day.date >= from && day.date <= effectiveTo);
  const work = periodDays.filter(eligible);
  const hoursDays = work.filter((day) => hasField(day, "minutes"));
  const kmDays = work.filter((day) => hasField(day, "km"));
  const hoursComplete = work.length > 0 && hoursDays.length === work.length;
  const kmComplete = work.length > 0 && kmDays.length === work.length;
  const hours = hoursDays.reduce((sum, day) => sum + day.minutes, 0) / 60;
  const km = kmDays.reduce((sum, day) => sum + day.km, 0);
  const totals = periodTotals(periodDays, expenses, goals, from, effectiveTo);
  const platforms = (["uber", "ninetyNine"] as const).map((source) => {
    const gainField = `${source}Cents` as const, tripsField = `${source}Rides` as const;
    const recorded = periodDays.filter((day) => hasField(day, gainField) || hasField(day, tripsField));
    const covered = recorded.filter((day) => hasField(day, tripsField));
    const tripsComplete = recorded.length > 0 && covered.length === recorded.length;
    const gainsComplete = recorded.length > 0 && recorded.every((day) => hasField(day, gainField));
    const gains = periodDays.reduce((sum, day) => sum + day[gainField], 0);
    const trips = covered.reduce((sum, day) => sum + day[tripsField], 0);
    return { id: source, name: source === "uber" ? "Uber" : "99", gains, trips,
      averagePerTrip: ratio(gains, trips, tripsComplete && gainsComplete), share: ratio(gains * 100, totals.gains),
      coveredDays: covered.length, recordedDays: recorded.length, tripsComplete, gainsComplete };
  });
  const activePlatforms = platforms.filter((platform) => platform.recordedDays > 0);
  const tripsComplete = activePlatforms.length > 0 && activePlatforms.every((platform) => platform.tripsComplete);
  const trips = platforms.reduce((sum, platform) => sum + platform.trips, 0);
  const gainPerDay = ratio(totals.gains, work.length);
  const profitPerDay = ratio(totals.balance, work.length);
  const goal = reportGoal(filter, from, to, goals);
  const calendar = plannedDates(from, to, goals);
  const remainingDates = calendar.filter((date) => date >= reference &&
    !periodDays.some((day) => day.date === date && ["closed", "off"].includes(day.status ?? "")));
  const missing = goal === null ? null : Math.max(goal - totals.balance, 0);
  const dates = datesBetween(from, effectiveTo);
  const attained = dates.map((date) => {
    const day = periodDays.find((item) => item.date === date);
    return day && (["uberCents", "ninetyNineCents", "otherCents"] as const).some((key) => hasField(day, key))
      ? day.uberCents + day.ninetyNineCents + day.otherCents : null;
  });
  const meta = dates.map((date) => {
    if (goal === null) return null;
    const cutoff = addDate(date, -1);
    const before = periodTotals(days, expenses, goals, from, cutoff).balance;
    // O estado final de datas seguintes não era conhecido no início dessa data.
    return ratio(Math.max(goal - before, 0), calendar.filter((planned) => planned >= date).length);
  });
  const consumptionValues = dates.map((date) => {
    const day = periodDays.find((item) => item.date === date);
    return day && hasField(day, "consumption") && day.consumption !== undefined && Number.isFinite(day.consumption)
      ? day.consumption : null;
  });
  const weighted = periodDays.filter((day) => hasField(day, "consumption") && (day.consumption ?? 0) > 0 &&
    hasField(day, "km") && day.km > 0);
  const measuredKm = weighted.reduce((sum, day) => sum + day.km, 0);
  const measuredVolume = weighted.reduce((sum, day) => sum + day.km / day.consumption!, 0);
  return {
    from, to, reference, effectiveTo, ended: reference > to,
    summary: { gains: totals.gains, costs: totals.costs, balance: totals.balance, workedDays: work.length, hours, km, trips },
    averages: { hoursPerDay: ratio(hours, work.length, hoursComplete), gainsPerDay: gainPerDay,
      profitPerDay, costsPerDay: ratio(totals.costs, work.length) },
    findings: { gainsPerHour: ratio(totals.gains, hours, hoursComplete), gainsPerDay: gainPerDay,
      gainsPerKm: ratio(totals.gains, km, kmComplete), profitPerHour: ratio(totals.balance, hours, hoursComplete),
      profitPerDay, profitPerKm: ratio(totals.balance, km, kmComplete),
      gainsPerTrip: ratio(platforms.reduce((sum, platform) => sum + platform.gains, 0), trips,
        tripsComplete && activePlatforms.every((platform) => platform.gainsComplete)) },
    profitability: { gains: totals.gains, costs: totals.costs, balance: totals.balance, goal, missing, required: missing,
      requiredDaily: missing === null ? null : ratio(missing, remainingDates.length), futureCosts: 0, remainingDays: remainingDates.length },
    chart: { dates, meta, attained }, platforms,
    categories: reportCategoryCosts(expenses, goals, categories, from, effectiveTo, reference),
    vehicle: { km, consumption: ratio(measuredKm, measuredVolume), consumptionUnit: "L" as const,
      consumptionCoveredDays: weighted.length, consumptionRecordedDays: consumptionValues.filter((value) => value !== null).length,
      consumptionValues, maintenance: reportMaintenanceRows(expenses, goals, from, effectiveTo, reference) },
    coverage: { hoursDays: hoursDays.length, kmDays: kmDays.length, workedDays: work.length,
      pendingDays: periodDays.filter((day) => day.status === "pending").length,
      legacyDays: work.filter((day) => !day.status).length, hoursComplete, kmComplete, tripsComplete },
  };
}
