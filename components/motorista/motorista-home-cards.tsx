import { civilDate, isoWeek, money, decimal, weekBounds, type Day } from "@/lib/motorista";
import { datesBetween, hasField, income, type monthlyPlanning } from "@/lib/motorista-evolution";
import type { WeeklyGoalPlanning } from "@/lib/motorista-weekly-goal";
import { PlanningProgress } from "./motorista-planning-progress";
import { PickerInput } from "./motorista-picker-input";

export function weeklyGains(days: Day[], reference: string, selectedWeek = isoWeek(reference)) {
  const { from, to } = weekBounds(selectedWeek);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const rows = datesBetween(from, to).map((date) => {
    const day = byDate.get(date);
    return {
      date,
      cents: day ? income(day) : 0,
      reported: !!day && (["uberCents", "ninetyNineCents", "otherCents"] as const)
        .some((source) => hasField(day, source)),
    };
  });
  return { from, to, rows, total: rows.reduce((sum, row) => sum + row.cents, 0) };
}

function GoalProgressCard({ title, period, percent, gains, costs, balance, notice }: {
  title: string;
  period: string;
  percent: number | null;
  gains: number;
  costs: number;
  balance: number;
  notice?: string;
}) {
  return (
    <div className="motorista-card motorista-home-summary-card">
      <div className="motorista-home-goal-heading">
        <h2>{title}</h2>
        <p>{period}</p>
      </div>
      <strong className="motorista-home-card-value">
        {percent === null ? "—" : `${decimal(percent)}%`}
      </strong>
      <PlanningProgress percent={percent} showLabel={false} />
      <p className="motorista-home-goal-totals">
        Ganhos: {money(gains)} | Gastos: {money(costs)} | Saldo: {money(balance)}
      </p>
      {notice && <p className="motorista-muted">{notice}</p>}
    </div>
  );
}

export default function MotoristaHomeCards({ plan, weeklyPlan, days, today, week: selectedWeek, onWeekChange }: {
  plan: ReturnType<typeof monthlyPlanning>;
  weeklyPlan: WeeklyGoalPlanning;
  days: Day[];
  today: string;
  week: string;
  onWeekChange: (week: string) => void;
}) {
  const week = weeklyGains(days, today, selectedWeek);
  const validWeek = week.rows.length === 7;
  const weekLabel = validWeek
    ? `${civilDate(week.from).toLocaleDateString("pt-BR")} a ${civilDate(week.to).toLocaleDateString("pt-BR")}`
    : "Selecione uma semana";
  const maximum = Math.max(0, ...week.rows.map((row) => row.cents));
  const monthLabel = civilDate(`${plan.month}-01`).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  const weekMonths = weeklyPlan.months.map((month) => civilDate(`${month}-01`).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })).join(" · ");
  const dateLabel = (date: string) => civilDate(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <div className="motorista-home-cards">
      <div className="motorista-card motorista-home-summary-card">
        <h2>Meta pra hoje</h2>
        <strong className="motorista-home-card-value">
          {plan.requiredDaily === null ? "—" : money(plan.requiredDaily)}
        </strong>
        <p className="motorista-muted">Ganho necessário por dia restante.</p>
        {plan.goal === null ? (
          <p className="motorista-muted">Defina uma meta nas Definições.</p>
        ) : plan.remaining.length === 0 ? (
          <p className="motorista-muted">Sem dias planejados restantes.</p>
        ) : null}
      </div>
      <GoalProgressCard
        title="Meta da semana"
        period={weekMonths}
        percent={weeklyPlan.percent}
        gains={weeklyPlan.gains}
        costs={weeklyPlan.costs}
        balance={weeklyPlan.balance}
        notice={weeklyPlan.goal === null
          ? "Meta semanal indisponível. Confira as metas e os dias planejados nas Definições."
          : weeklyPlan.goal === 0 ? "Sem meta semanal positiva para calcular o progresso." : undefined}
      />
      <GoalProgressCard
        title="Meta do mês"
        period={monthLabel}
        percent={plan.percent}
        gains={plan.gains}
        costs={plan.costs}
        balance={plan.realized}
        notice={plan.percent === null ? "Defina uma meta nas Definições." : undefined}
      />
      <figure className="motorista-card motorista-weekly-gains">
        <figcaption className="motorista-weekly-header">
          <div className="motorista-home-summary-card">
            <h2>Ganhos da semana</h2>
            <strong className="motorista-home-card-value">{validWeek ? money(week.total) : "—"}</strong>
          </div>
          <label>
            Semana
            <PickerInput
              type="week"
              value={selectedWeek}
              displayValue={weekLabel}
              aria-label={`Semana: ${weekLabel}`}
              onChange={(event) => onWeekChange(event.target.value)}
            />
          </label>
        </figcaption>
        {validWeek ? <>
        <p className="motorista-weekly-axis">{money(maximum)}</p>
        <ol className="motorista-weekly-columns" aria-label="Ganhos registrados por dia, de segunda a domingo">
          {week.rows.map((row) => (
            <li key={row.date} title={`${dateLabel(row.date)}: ${row.reported ? money(row.cents) : "ganhos não informados"}`}>
              <div className="motorista-weekly-bar-track" aria-hidden="true">
                <span className="motorista-weekly-bar" style={{ height: `${maximum > 0 ? row.cents / maximum * 100 : 0}%` }}>
                  {row.cents > 0 && <span className="motorista-weekly-bar-label">{money(row.cents)}</span>}
                </span>
              </div>
              <span className="motorista-weekly-day">{civilDate(row.date).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
              <time dateTime={row.date}>{dateLabel(row.date)}</time>
              <span className="motorista-sr-only">{row.reported ? money(row.cents) : "Ganhos não informados"}</span>
            </li>
          ))}
        </ol>
        </> : <p className="motorista-alert">Selecione uma semana válida.</p>}
      </figure>
    </div>
  );
}
