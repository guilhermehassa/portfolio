import {
  civilDate,
  emptyDay,
  goalForMonth,
  isDate,
  monthBounds,
  periodsFromInput,
  localDate,
  totals,
  type Category,
  type CostProfile,
  type Day,
  type Expense,
  type Goal,
  type PlannedExpense,
} from "./motorista";
import { journeyLabels, journeyState } from "./motorista-journey";
import { analyticExpenses, maintenanceRows, periodTotals } from "./motorista-maintenance";

export const income = (d: Day) =>
  d.uberCents + d.ninetyNineCents + d.otherCents;
export const dayStatus = (d?: Day) =>
  !d
    ? "Sem jornada"
    : d.journey
      ? journeyLabels[journeyState(d)] + (journeyState(d) === "ended" && d.status === "pending" ? " · ganhos pendentes" : "")
      : d.status === "closed"
      ? "Fechado"
      : d.status === "off"
        ? "Folga"
        : d.status === "pending"
          ? "Pendente"
          : "Legado · conferir";
export const shifts = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
  dawn: "Madrugada",
  mixed: "Misto",
  "": "Não informado",
};
export function eligible(d: Day) {
  return (
    d.status === "closed" ||
    (!d.status && (income(d) > 0 || d.minutes > 0 || d.km > 0))
  );
}
export function hasField(d: Day, key: keyof NonNullable<Day["filled"]>) {
  return d.filled?.[key] ?? (d[key] ?? 0) > 0;
}
export function addDate(date: string, days: number) {
  const d = civilDate(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function datesBetween(from: string, to: string) {
  if (!isDate(from) || !isDate(to) || from > to) return [];
  const result: string[] = [];
  for (let d = from; d <= to; d = addDate(d, 1)) result.push(d);
  return result;
}
export function defaultWorkDates(month: string) {
  const b = monthBounds(month);
  return datesBetween(b.from, b.to).filter(
    (d) => ![0, 6].includes(civilDate(d).getDay()),
  );
}
export function previousPeriod(
  from: string,
  to: string,
  reference: string,
  monthly = false,
) {
  const observedTo =
    monthly && to > reference && from <= reference ? reference : to;
  if (monthly && from.endsWith("-01")) {
    const [y, m] = from.split("-").map(Number);
    const month = localDate(new Date(y, m - 2, 1)).slice(0, 7);
    const previous = monthBounds(month);
    const count = datesBetween(from, observedTo).length;
    const available = Number(previous.to.slice(-2));
    return {
      from: count > available ? addDate(previous.to, 1 - count) : previous.from,
      to:
        count > available
          ? previous.to
          : `${month}-${String(count).padStart(2, "0")}`,
    };
  }
  const n = datesBetween(from, observedTo).length;
  return { from: addDate(from, -n), to: addDate(from, -1) };
}

export function fuelExpense(e: Expense, categories: Category[]) {
  const c = categories.find((c) => c.id === e.categoryId);
  return (
    e.kind === "fuel" ||
    (e.kind !== "expense" && e.kind !== "maintenance" &&
      (c?.costKind === "fuel" || e.categoryId === "combustivel"))
  );
}
export type FuelCycle = {
  from: string;
  to: string;
  fuelType: string;
  unit: "L" | "m3";
  km: number;
  volume: number;
  consumption: number;
  ids: string[];
};
export function fuelCycles(
  expenses: Expense[],
  categories: Category[],
): FuelCycle[] {
  const fills = expenses
    .filter((e) => fuelExpense(e, categories))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const countDates = new Map<string, number>();
  fills.forEach((e) =>
    countDates.set(e.date, (countDates.get(e.date) ?? 0) + 1),
  );
  let start: Expense | null = null,
    volume = 0;
  let ids: string[] = [],
    lastOdometer = 0;
  const cycles: FuelCycle[] = [];
  for (const e of fills) {
    const f = e.fuel;
    if (
      !f?.fuelType ||
      !f.unit ||
      !f.volume ||
      f.odometer == null ||
      !f.tank ||
      f.tank === "unknown" ||
      countDates.get(e.date)! > 1
    ) {
      start = null;
      volume = 0;
      ids = [];
      continue;
    }
    if (start &&
      (f.fuelType !== start.fuel?.fuelType ||
        f.unit !== start.fuel?.unit ||
        f.odometer <= lastOdometer)
    ) {
      start = null;
      volume = 0;
      ids = [];
    }
    if (!start) {
      if (f.tank === "full") {
        start = e;
        ids = [e.id];
        lastOdometer = f.odometer;
      }
      continue;
    }
    volume += f.volume;
    ids.push(e.id);
    lastOdometer = f.odometer;
    if (f.tank === "full") {
      const km = f.odometer - start.fuel!.odometer!;
      if (km > 0 && volume > 0)
        cycles.push({
          from: start.date,
          to: e.date,
          fuelType: f.fuelType,
          unit: f.unit,
          km,
          volume,
          consumption: km / volume,
          ids: [...ids],
        });
      start = e;
      volume = 0;
      ids = [e.id];
    }
  }
  return cycles;
}
export function applicableProfile(profiles: CostProfile[], date: string) {
  return (
    profiles
      .filter((p) => p.effectiveFrom <= date)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null
  );
}
export function estimateDay(
  day: Day,
  expenses: Expense[],
  categories: Category[],
  profiles: CostProfile[],
  cycles = fuelCycles(expenses, categories),
  goals: Goal[] = [],
) {
  const profile = applicableProfile(profiles, day.date);
  if (!eligible(day) || !hasField(day, "km") || day.km <= 0 || !profile)
    return null;
  const lastFuel = expenses
    .filter(
      (e) =>
        e.date <= day.date &&
        fuelExpense(e, categories) &&
        e.fuel?.fuelType === profile.fuelType &&
        e.fuel?.unit === profile.unit &&
        (e.fuel?.volume ?? 0) > 0,
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )[0];
  const cycle = cycles
    .filter(
      (c) =>
        c.to <= day.date &&
        c.fuelType === profile.fuelType &&
        c.unit === profile.unit,
    )
    .at(-1);
  const manualDay = profile.unit === "L" && (day.consumption ?? 0) > 0;
  const consumption = manualDay
    ? day.consumption!
    : profile.consumption || cycle?.consumption;
  const price =
    profile.priceCentsPerUnit ||
    (lastFuel ? lastFuel.cents / lastFuel.fuel!.volume! : 0);
  if (!consumption || !price) return null;
  const fuel = Math.round((day.km / consumption) * price);
  const maintenance = maintenanceRows(expenses, goals, day.date, day.date)
    .reduce((sum, row) => sum + row.allocatedCents, 0);
  let unclassified = 0;
  const operational = expenses
    .filter((e) => e.kind !== "maintenance" && e.date === day.date)
    .reduce((sum, e) => {
      const c = categories.find((c) => c.id === e.categoryId);
      const scope =
        e.scope && e.scope !== "unclassified"
          ? e.scope
          : (c?.scope ?? "unclassified");
      if (fuelExpense(e, categories) || scope === "personal") return sum;
      if (scope === "unclassified") {
        unclassified++;
        return sum;
      }
      return (
        sum +
        Math.round(
          e.cents * (scope === "vehicle" ? profile.workShare / 100 : 1),
        )
      );
    }, 0);
  const cost = fuel + maintenance + operational;
  return {
    date: day.date,
    fuel,
    maintenance,
    operational,
    cost,
    result: income(day) - cost,
    consumption,
    price,
    unit: profile.unit,
    consumptionSource: manualDay
      ? "Manual da jornada (histórico)"
      : profile.consumption
        ? "Manual do perfil"
        : "Ciclo de abastecimentos",
    priceSource: profile.priceCentsPerUnit
      ? "Manual do perfil"
      : "Último abastecimento",
    profile,
    unclassified,
  };
}

export function periodAnalysis(
  days: Day[],
  expenses: Expense[],
  from: string,
  to: string,
  reference: string,
  goals: Goal[] = [],
) {
  const periodDays = days.filter((d) => d.date >= from && d.date <= to);
  const periodExpenses = analyticExpenses(expenses, goals, from, to, reference);
  const work = periodDays.filter(eligible);
  const withHours = work.filter((d) => hasField(d, "minutes") && d.minutes > 0);
  const withKm = work.filter((d) => hasField(d, "km") && d.km > 0);
  const summary = totals(periodDays, periodExpenses);
  const calendarDays = datesBetween(
    from,
    to < reference ? to : reference,
  ).length;
  const hourMinutes = withHours.reduce((s, d) => s + d.minutes, 0);
  const km = withKm.reduce((s, d) => s + d.km, 0);
  const dates = [
    ...new Set([
      ...periodDays.map((d) => d.date),
      ...periodExpenses.map((e) => e.date),
    ]),
  ].sort();
  const rows = dates.map((date) => {
    const day = periodDays.find((d) => d.date === date);
    const cost = periodExpenses
      .filter((e) => e.date === date)
      .reduce((s, e) => s + e.cents, 0);
    const gains = day ? income(day) : 0;
    return { date, day, gains, costs: cost, balance: gains - cost };
  });
  const perApp = (["uber", "ninetyNine", "other"] as const).map((source) => {
    const compatible =
      source === "other"
        ? []
        : work.filter(
            (d) =>
              hasField(d, `${source}Rides`) &&
              hasField(d, `${source}Cents`) &&
              d[`${source}Rides`] > 0,
          );
    const rides = compatible.reduce(
      (s, d) => s + d[`${source === "other" ? "uber" : source}Rides`],
      0,
    );
    const gains = compatible.reduce((s, d) => s + d[`${source}Cents`], 0);
    return {
      source,
      cents: periodDays.reduce((s, d) => s + d[`${source}Cents`], 0),
      rides,
      rideAverage: rides ? gains / rides : null,
      covered: compatible.length,
    };
  });
  const compareGroups = (key: (d: Day) => string) =>
    [...new Set(work.map(key))].map((label) => {
      const subset = work.filter((d) => key(d) === label),
        mins = subset.reduce(
          (s, d) => s + (hasField(d, "minutes") ? d.minutes : 0),
          0,
        );
      return {
        label,
        count: subset.length,
        gains: subset.reduce((s, d) => s + income(d), 0),
        perHour:
          mins > 0
            ? (subset
                .filter((d) => hasField(d, "minutes") && d.minutes > 0)
                .reduce((s, d) => s + income(d), 0) *
                60) /
              mins
            : null,
      };
    });
  return {
    ...summary,
    work,
    rows,
    calendarDays,
    legacy: work.filter((d) => !d.status).length,
    pending: periodDays.filter((d) => d.status === "pending").length,
    gainAverage: work.length
      ? work.reduce((s, d) => s + income(d), 0) / work.length
      : null,
    costCalendarAverage: calendarDays
      ? periodExpenses
          .filter((e) => e.date >= from && e.date <= to && e.date <= reference)
          .reduce((s, e) => s + e.cents, 0) / calendarDays
      : null,
    costWorkAverage: work.length ? summary.costs / work.length : null,
    hours: hourMinutes / 60,
    km,
    hoursCoverage: withHours.length,
    kmCoverage: withKm.length,
    perHour: hourMinutes
      ? (withHours.reduce((s, d) => s + income(d), 0) * 60) / hourMinutes
      : null,
    perKm: km ? withKm.reduce((s, d) => s + income(d), 0) / km : null,
    balancePerHour: hourMinutes
      ? (withHours.reduce((s, d) => s + income(d) - rows.find((row) => row.date === d.date)!.costs, 0) * 60) / hourMinutes
      : null,
    balancePerKm: km
      ? withKm.reduce((s, d) => s + income(d) - rows.find((row) => row.date === d.date)!.costs, 0) / km
      : null,
    perApp,
    weekdays: compareGroups((d) =>
      civilDate(d.date).toLocaleDateString("pt-BR", { weekday: "long" }),
    ),
    shifts: compareGroups((d) => shifts[d.shift ?? ""]),
  };
}

export type PlannedOccurrence = {
  key: string;
  plan: PlannedExpense;
  date: string;
  cents: number;
  expenseId: string | null;
};
export function plannedOccurrences(
  plans: PlannedExpense[],
  month: string,
  expenses: Expense[],
): PlannedOccurrence[] {
  const bounds = monthBounds(month);
  if (!bounds.from) return [];
  return plans.flatMap((plan) => {
    const date =
      plan.recurrence === "monthly" && month >= plan.date.slice(0, 7)
        ? `${month}-${String(Math.min(Number(plan.date.slice(-2)), Number(bounds.to.slice(-2)))).padStart(2, "0")}`
        : plan.date;
    if (
      !date.startsWith(month) ||
      date < plan.date ||
      (plan.endDate && date > plan.endDate)
    )
      return [];
    const key = `${plan.id}--${date}`;
    const expenseId =
      expenses.find((e) => e.plannedExpenseId === key)?.id ??
      plan.payments?.[key] ??
      null;
    return [{ key, plan, date, cents: plan.cents, expenseId }];
  });
}
export function historicalBase(
  days: Day[],
  expenses: Expense[],
  categories: Category[],
  reference: string,
  count = 30,
) {
  const work = days
    .filter(
      (d) =>
        eligible(d) &&
        (d.date < reference || (d.date === reference && d.status === "closed")),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count);
  const from = work.at(-1)?.date;
  const to = work[0]?.date;
  const window =
    from && to ? expenses.filter((e) => e.kind !== "maintenance" && e.date >= from && e.date <= to) : [];
  const separated = window.filter(
    (e) =>
      e.plannedExpenseId ||
      ["fixed", "extraordinary"].includes(
        categories.find((c) => c.id === e.categoryId)?.costKind ?? "",
      ),
  );
  const variable = window.filter((e) => !separated.includes(e));
  return {
    days: work.length,
    from,
    to,
    dailyGains: work.length
      ? Math.round(work.reduce((s, d) => s + income(d), 0) / work.length)
      : null,
    dailyVariable: work.length
      ? Math.round(variable.reduce((s, e) => s + e.cents, 0) / work.length)
      : null,
    separatedCents: separated.reduce((s, e) => s + e.cents, 0),
    unclassified: variable.filter(
      (e) => !categories.find((c) => c.id === e.categoryId)?.costKind,
    ).length,
  };
}
export function monthlyPlanning(args: {
  month: string;
  reference: string;
  goals: Goal[];
  days: Day[];
  expenses: Expense[];
  categories: Category[];
  plans: PlannedExpense[];
  workDates?: string[];
  variableDailyCents?: number | null;
}) {
  const { month, reference, goals, days, expenses, categories, plans } = args;
  const bounds = monthBounds(month),
    ended = reference > bounds.to,
    future = reference < bounds.from;
  const own = goals.find((g) => g.month === month);
  const goal = goalForMonth(goals, month)?.cents ?? null;
  const workDates = args.workDates ?? own?.workDates ?? defaultWorkDates(month);
  const remaining = ended
    ? []
    : workDates.filter(
        (d) =>
          d >= (future ? bounds.from : reference) &&
          d <= bounds.to &&
          !days.some(
            (day) =>
              day.date === d && ["closed", "off"].includes(day.status ?? ""),
          ),
      );
  const actualTo = ended
    ? bounds.to
    : future
      ? addDate(bounds.from, -1)
      : reference;
  const allocationGoals = args.workDates === undefined ? goals : [
    ...goals.filter((g) => g.month !== month),
    { ...own, month, cents: own?.cents ?? 0, workDates: args.workDates },
  ];
  const summary = periodTotals(days, expenses, allocationGoals, bounds.from, actualTo);
  const realized = summary.balance;
  const maintenance = maintenanceRows(expenses, allocationGoals, bounds.from, bounds.to, actualTo)
    .reduce((s, row) => s + row.allocatedCents, 0);
  const futureMaintenance = maintenanceRows(expenses, allocationGoals, bounds.from, bounds.to, actualTo)
    .reduce((s, row) => s + row.futureCents, 0);
  const historyReference = future
    ? reference
    : ended
      ? addDate(bounds.to, 1)
      : reference;
  const base = historicalBase(
    days,
    expenses,
    categories,
    historyReference,
    own?.historyDays ?? 30,
  );
  const dailyVariable =
    args.variableDailyCents ?? own?.variableDailyCents ?? base.dailyVariable;
  const isVariable = (e: Expense) =>
    e.kind !== "maintenance" && !e.plannedExpenseId &&
    !["fixed", "extraordinary"].includes(
      categories.find((c) => c.id === e.categoryId)?.costKind ?? "",
    );
  const variable = ended
    ? 0
    : remaining.reduce(
        (s, date) =>
          s +
          Math.max(
            (dailyVariable ?? 0) -
              expenses
                .filter(
                  (e) => e.date === date && e.date <= actualTo && isVariable(e),
                )
                .reduce((v, e) => v + e.cents, 0),
            0,
          ),
        0,
      );
  const upcoming = ended
    ? []
    : expenses.filter(
        (e) =>
          e.kind !== "maintenance" && e.date > actualTo && e.date >= bounds.from && e.date <= bounds.to,
      );
  // Pagamentos futuros registrados substituem a previsão variável daquela data.
  const futureVariable = upcoming.filter(isVariable);
  const variableAdjusted = Math.max(
    variable -
      remaining.reduce(
        (s, date) =>
          s +
          Math.min(
            dailyVariable ?? 0,
            futureVariable
              .filter((e) => e.date === date)
              .reduce((v, e) => v + e.cents, 0),
          ),
        0,
      ),
    0,
  );
  const occurrences = plannedOccurrences(plans, month, expenses);
  const pending = ended ? [] : occurrences.filter((o) => !o.expenseId);
  const commitments = pending.reduce((s, o) => s + o.cents, 0);
  const futureRecorded = upcoming.reduce((s, e) => s + e.cents, 0);
  const futureCosts = variableAdjusted + commitments + futureRecorded + futureMaintenance;
  const required =
    goal === null ? null : Math.max(goal - realized + futureCosts, 0);
  const partialGains = remaining.reduce(
    (s, date) =>
      s +
      days
        .filter((d) => d.date === date && date <= actualTo)
        .reduce((v, d) => v + income(d), 0),
    0,
  );
  const futureRecordedGains = days
    .filter(
      (d) => d.date > actualTo && d.date >= bounds.from && d.date <= bounds.to,
    )
    .reduce((s, d) => s + income(d), 0);
  const remainingRecordedGains = remaining
    .filter((date) => date > actualTo)
    .reduce(
      (s, date) =>
        s +
        days.filter((d) => d.date === date).reduce((v, d) => v + income(d), 0),
      0,
    );
  const projectedGains =
    base.dailyGains == null
      ? null
      : Math.max(
          base.dailyGains * remaining.length -
            partialGains -
            remainingRecordedGains,
          0,
        ) + futureRecordedGains;
  return {
    month,
    reference,
    ended,
    future,
    goal,
    realized,
    gains: summary.gains,
    costs: summary.costs,
    maintenance,
    futureMaintenance,
    workDates,
    remaining,
    defaultCalendar: !own?.workDates,
    base,
    dailyVariable,
    variable: variableAdjusted,
    commitments,
    futureRecorded,
    futureCosts,
    pending,
    occurrences,
    missing: goal === null ? null : Math.max(goal - realized, 0),
    required,
    requiredDaily:
      required !== null && remaining.length
        ? required / remaining.length
        : null,
    projected: ended
      ? realized
      : projectedGains === null
        ? null
        : realized + projectedGains - futureCosts,
    forecastComplete: dailyVariable !== null,
    percent: goal ? (realized / goal) * 100 : null,
  };
}

export function dayFromFields(
  date: string,
  previous: Day | undefined,
  fields: Record<string, string>,
  status: NonNullable<Day["status"]>,
): Day {
  const parse = (value: string) =>
    value.trim() === "" ? 0 : Number(value.trim().replace(",", "."));
  const result: Day = {
    ...emptyDay(date),
    ...previous,
    date,
    status,
    origin: previous?.origin ?? "user",
    filled: { ...previous?.filled },
    note: fields.note ?? "",
  };
  if (fields.periods !== undefined && fields.periods !== "")
    result.periods = periodsFromInput(fields.periods);
  for (const key of [
    "uberCents",
    "ninetyNineCents",
    "otherCents",
    "uberRides",
    "ninetyNineRides",
    "km",
    "consumption",
  ] as const) {
    const n = parse(fields[key] ?? "");
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      ((key.endsWith("Cents") || key.endsWith("Rides")) &&
        !Number.isSafeInteger(n))
    )
      throw new Error("Revise os ganhos, corridas, quilômetros e consumo.");
    result[key] = n;
    result.filled![key] = (fields[key] ?? "").trim() !== "";
  }
  const h = parse(fields.hours ?? ""),
    m = parse(fields.minutes ?? "");
  if (
    !Number.isSafeInteger(h) ||
    !Number.isSafeInteger(m) ||
    h < 0 ||
    m < 0 ||
    m > 59 ||
    !Number.isSafeInteger(h * 60 + m)
  )
    throw new Error("Informe horas inteiras e minutos entre 0 e 59.");
  result.minutes = h * 60 + m;
  result.filled!.minutes = !!(
    (fields.hours ?? "").trim() || (fields.minutes ?? "").trim()
  );
  const start = fields.odometerStart?.trim()
    ? parse(fields.odometerStart)
    : null;
  const end = fields.odometerEnd?.trim() ? parse(fields.odometerEnd) : null;
  if (
    (start !== null && (!Number.isFinite(start) || start < 0)) ||
    (end !== null && (!Number.isFinite(end) || end < 0)) ||
    (start !== null && end !== null && end < start)
  )
    throw new Error("Revise o odômetro inicial e final.");
  result.odometerStart = start;
  result.odometerEnd = end;
  if (start !== null && end !== null) {
    result.km = Math.round((end - start) * 1000) / 1000;
    result.filled!.km = true;
  }
  if (
    status === "off" &&
    (income(result) > 0 || result.minutes > 0 || result.km > 0)
  )
    throw new Error(
      "Folga não pode conter ganhos ou jornada positiva. Preserve o dia como pendente ou fechado.",
    );
  if (
    status === "closed" &&
    !["uberCents", "ninetyNineCents", "otherCents"].some(
      (k) => result.filled![k as keyof NonNullable<Day["filled"]>],
    )
  )
    throw new Error(
      "Informe ao menos um ganho, inclusive zero, para fechar o dia.",
    );
  return result;
}
