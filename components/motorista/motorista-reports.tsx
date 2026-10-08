"use client";
import type { ReactNode } from "react";
import { localDate, type Category, type Day, type Expense, type Goal } from "@/lib/motorista";
import { reportAnalysis, type ReportPeriod } from "@/lib/motorista-reporting";
import { ReportGroups } from "./motorista-report-groups";
export { Metric } from "./motorista-report-groups";

type Props = {
  days: Day[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  from: string;
  to: string;
  filter: ReportPeriod;
  controls: ReactNode;
  reference?: string;
};

export default function MotoristaReports({ days, expenses, categories, goals, from, to, filter, controls,
  reference = localDate() }: Props) {
  if (from > reference) return <section className="motorista-section">
    <p className="motorista-eyebrow">Relatórios</p>
    {controls}
    <p className="motorista-alert">Selecione a semana ou o mês atual, ou um período passado.</p>
  </section>;
  const report = reportAnalysis({ days, expenses, categories, goals, from, to, filter, reference });
  return <section className="motorista-section">
    <p className="motorista-eyebrow">Relatórios</p>
    {controls}
    <ReportGroups report={report} />
  </section>;
}
