import {
  goalForMonth,
  isDate,
  isoWeek,
  weekBounds,
  type Day,
  type Expense,
  type Goal,
} from "./motorista";
import { datesBetween, defaultWorkDates } from "./motorista-evolution";
import { periodTotals } from "./motorista-maintenance";

type WeeklyGoalInput = {
  reference: string;
  goals: Goal[];
  days: Day[];
  expenses: Expense[];
};

// Rateia a meta pelos calendários próprios dos meses e arredonda só a soma final.
// BigInt evita perder centavos quando o produto intermediário excede um inteiro seguro.
function proratedGoal(months: string[], from: string, to: string, goals: Goal[]) {
  let numerator = BigInt(0);
  let denominator = BigInt(1);
  for (const month of months) {
    const goal = goalForMonth(goals, month)?.cents;
    const workDates = goals.find((item) => item.month === month)?.workDates
      ?? defaultWorkDates(month);
    if (goal == null || !Number.isSafeInteger(goal) || !workDates.length) return null;
    const weekDays = workDates.filter((date) => date >= from && date <= to).length;
    const monthDenominator = BigInt(workDates.length);
    numerator = numerator * monthDenominator
      + BigInt(goal) * BigInt(weekDays) * denominator;
    denominator *= monthDenominator;
  }
  const two = BigInt(2);
  const rounded = (numerator * two + denominator) / (denominator * two);
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}

export function weeklyGoalPlanning({ reference, goals, days, expenses }: WeeklyGoalInput) {
  if (!isDate(reference)) throw new Error("Informe uma data de referência válida.");
  const week = isoWeek(reference);
  const { from, to } = weekBounds(week);
  const months = [...new Set(datesBetween(from, to).map((date) => date.slice(0, 7)))];
  const actualTo = reference < to ? reference : to;
  const summary = periodTotals(days, expenses, goals, from, actualTo);
  const goal = proratedGoal(months, from, to, goals);
  return {
    week,
    from,
    to,
    reference,
    actualTo,
    months,
    goal,
    gains: summary.gains,
    costs: summary.costs,
    balance: summary.balance,
    percent: goal ? (summary.balance / goal) * 100 : null,
  };
}

export type WeeklyGoalPlanning = ReturnType<typeof weeklyGoalPlanning>;
