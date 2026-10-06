"use client";
import { useState, type ReactNode } from "react";
import {
  applicableProfile,
  dayStatus,
  datesBetween,
  estimateDay,
  fuelCycles,
  fuelExpense,
  monthlyPlanning,
  periodAnalysis,
  previousPeriod,
} from "@/lib/motorista-evolution";
import {
  decimal,
  localDate,
  money,
  monthBounds,
  type Category,
  type CostProfile,
  type Day,
  type Expense,
  type Goal,
  type PlannedExpense,
} from "@/lib/motorista";
import { MoneyField } from "./motorista-forms";

const currency = (v: number | null | undefined) => (v == null ? "—" : money(v));
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="motorista-card motorista-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function PlanningCard({
  plan,
  onSettings,
  onReports,
}: {
  plan: ReturnType<typeof monthlyPlanning>;
  onSettings?: () => void;
  onReports?: () => void;
}) {
  return (
    <div className="motorista-card motorista-form">
      <h2>Planejamento de {plan.month}</h2>
      <p className="motorista-muted">
        Referência: {plan.reference}.{" "}
        {plan.ended
          ? "Mês encerrado · resultado histórico."
          : plan.future
            ? "Mês futuro · planejamento."
            : "Saldo realizado até esta data."}
      </p>
      <div className="motorista-stats">
        <Metric label="Meta de saldo" value={currency(plan.goal)} />
        <Metric label="Saldo realizado" value={money(plan.realized)} />
        <Metric label="Falta de saldo" value={currency(plan.missing)} />
        {!plan.ended && (
          <>
            <Metric
              label="Despesas futuras previstas"
              value={money(plan.futureCosts)}
            />
            <Metric
              label="Dias planejados restantes"
              value={String(plan.remaining.length)}
            />
            <Metric
              label="Ganho necessário por dia restante"
              value={currency(plan.requiredDaily)}
            />
          </>
        )}
      </div>
      {plan.percent !== null && (
        <div
          className="motorista-progress"
          role="progressbar"
          aria-label="Progresso da meta de saldo"
          aria-valuenow={Math.max(0, Math.min(100, Math.round(plan.percent)))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            style={{ width: `${Math.max(0, Math.min(100, plan.percent))}%` }}
          />
        </div>
      )}
      <p className="motorista-muted">
        {plan.percent == null
          ? "Defina uma meta para calcular a necessidade."
          : `${decimal(plan.percent)}% da meta de saldo.`}{" "}
        {!plan.ended &&
          plan.remaining.length === 0 &&
          `Sem dias restantes: ${plan.required === null ? "meta não definida" : `${money(plan.required)} de ganhos ainda necessários, considerando despesas previstas`}.`}
      </p>
      {!plan.ended && (
        <>
          <p>
            Previsão: variáveis {money(plan.variable)} + compromissos pendentes{" "}
            {money(plan.commitments)} + pagamentos com data futura já
            registrados {money(plan.futureRecorded)}.
          </p>
          <p className="motorista-muted">
            Base: {plan.base.days} dias encerrados/legados
            {plan.base.from
              ? `, de ${plan.base.from} a ${plan.base.to}`
              : " disponíveis"}
            . Gasto variável: {currency(plan.dailyVariable)} por dia planejado.
            Pagamentos variáveis já lançados em dias restantes são descontados
            da previsão.{" "}
            {plan.defaultCalendar &&
              "Calendário inicial: segunda a sexta; ajuste nas Definições."}{" "}
            {!plan.forecastComplete &&
              "Sem base de gastos: previsão variável incompleta. Informe uma estimativa nas Definições."}{" "}
            {plan.base.unclassified > 0 &&
              `${plan.base.unclassified} gastos sem classificação de custo permanecem na base variável.`}{" "}
            {plan.base.separatedCents > 0 &&
              `${money(plan.base.separatedCents)} em fixos, extraordinários ou vinculados foram tratados separadamente da base variável.`}
          </p>
        </>
      )}
      <div className="motorista-actions">
        {onSettings && (
          <button className="motorista-secondary" onClick={onSettings}>
            Editar planejamento
          </button>
        )}
        {onReports && (
          <button className="motorista-text-button" onClick={onReports}>
            Ver relatório da meta
          </button>
        )}
      </div>
    </div>
  );
}

type Props = {
  days: Day[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  plans: PlannedExpense[];
  profiles: CostProfile[];
  from: string;
  to: string;
  filter: string;
  controls: ReactNode;
  onDay: (date: string) => void;
  onSettings: () => void;
};
export default function MotoristaReports({
  days,
  expenses,
  categories,
  goals,
  plans,
  profiles,
  from,
  to,
  filter,
  controls,
  onDay,
  onSettings,
}: Props) {
  const today = localDate();
  const effectiveTo =
    filter === "month" && from <= today && to >= today ? today : to;
  const report = periodAnalysis(days, expenses, from, effectiveTo, today);
  const previous = previousPeriod(from, effectiveTo, today, filter === "month");
  const prior = periodAnalysis(
    days,
    expenses,
    previous.from,
    previous.to,
    today,
  );
  const cycles = fuelCycles(expenses, categories);
  const estimates = report.work
    .map((d) => estimateDay(d, expenses, categories, profiles, cycles))
    .filter((e) => e !== null);
  const estimatedHours = estimates.filter(
    (e) => days.find((d) => d.date === e.date)!.minutes > 0,
  );
  const estimatedHoursTotal =
    estimatedHours.reduce(
      (s, e) => s + days.find((d) => d.date === e.date)!.minutes,
      0,
    ) / 60;
  const estimatedKm = estimates.reduce(
    (s, e) => s + days.find((d) => d.date === e.date)!.km,
    0,
  );
  const paidFuel = expenses.filter(
    (e) =>
      e.date >= from && e.date <= effectiveTo && fuelExpense(e, categories),
  );
  const categoryRows = categories
    .map((c) => ({
      ...c,
      cents: expenses
        .filter(
          (e) =>
            e.date >= from && e.date <= effectiveTo && e.categoryId === c.id,
        )
        .reduce((s, e) => s + e.cents, 0),
    }))
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const ranking = [...report.rows].sort((a, b) => b.balance - a.balance);
  const estimateRanking = [...estimates].sort((a, b) => b.result - a.result);
  const [metaMonth, setMetaMonth] = useState(
    from.slice(0, 7) || today.slice(0, 7),
  );
  const plan = monthlyPlanning({
    month: metaMonth,
    reference: today,
    goals,
    days,
    expenses,
    categories,
    plans,
  });
  const profile = applicableProfile(profiles, effectiveTo);
  return (
    <section className="motorista-section">
      <div>
        <p className="motorista-eyebrow">Análise</p>
        <h1>Relatórios</h1>
        <p className="motorista-muted">
          Período: {from} a {effectiveTo}. Saldo inclui todos os gastos,
          inclusive pessoais. Mês em andamento considera somente até hoje.
        </p>
      </div>
      {controls}
      <div className="motorista-card motorista-report-group">
        <h2>Resultado e meus dias</h2>
        <div className="motorista-stats">
          <Metric label="Ganhos registrados" value={money(report.gains)} />
          <Metric label="Gastos registrados" value={money(report.costs)} />
          <Metric label="Saldo dos lançamentos" value={money(report.balance)} />
          <Metric
            label="Dias trabalhados elegíveis"
            value={String(report.work.length)}
          />
          <Metric
            label="Ganho médio por dia trabalhado"
            value={currency(report.gainAverage)}
          />
          <Metric
            label="Gasto por dia corrido observado"
            value={currency(report.costCalendarAverage)}
          />
          <Metric
            label="Gasto distribuído por dia trabalhado"
            value={currency(report.costWorkAverage)}
          />
        </div>
        <p className="motorista-muted">
          Base das jornadas: {report.work.length} dias fechados ou legados com
          evidência de trabalho; {report.pending} pendentes fora das médias.{" "}
          {report.legacy} legados precisam de conferência. Gasto por dia
          corrido: {report.calendarDays} dias até a referência. Gasto por dia
          trabalhado distribui todos os gastos, inclusive em folgas, e não mede
          o gasto efetivo de cada jornada.
        </p>
        <p>
          Comparação: {previous.from} a {previous.to} · saldo{" "}
          {money(prior.balance)} · diferença{" "}
          {money(report.balance - prior.balance)}.{" "}
          {filter === "month"
            ? "Janela anterior com a mesma quantidade de dias, ajustada para meses curtos."
            : "Período anterior de mesma duração."}
        </p>
        <DailyChart rows={report.rows} />
        <div className="motorista-table-scroll">
          <table className="motorista-table">
            <caption>
              Todos os dias com registros, inclusive gastos sem jornada
            </caption>
            <thead>
              <tr>
                <th>Data / situação</th>
                <th>Ganhos</th>
                <th>Gastos</th>
                <th>Saldo</th>
                <th>Estimativa do trabalho</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.date}>
                  <td>
                    {r.date}
                    <small>{dayStatus(r.day)}</small>
                  </td>
                  <td>{money(r.gains)}</td>
                  <td>{money(r.costs)}</td>
                  <td className={r.balance < 0 ? "motorista-negative" : ""}>
                    {money(r.balance)}
                  </td>
                  <td>
                    {currency(estimates.find((e) => e.date === r.date)?.result)}
                  </td>
                  <td>
                    <button
                      className="motorista-text-button"
                      onClick={() => onDay(r.date)}
                    >
                      Abrir dia
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report.rows.length && (
          <p className="motorista-muted">
            Sem lançamentos neste período. Ausência de registro não significa
            folga.
          </p>
        )}
        {ranking.length > 0 && (
          <p>
            Maior saldo: {ranking[0].date} ({money(ranking[0].balance)},{" "}
            {dayStatus(ranking[0].day)}). Menor saldo: {ranking.at(-1)!.date} (
            {money(ranking.at(-1)!.balance)}, {dayStatus(ranking.at(-1)!.day)}).
            Um abastecimento pago nessa data não demonstra baixa rentabilidade
            da jornada.
          </p>
        )}
        {estimateRanking.length > 0 && (
          <p>
            Resultado estimado: maior em {estimateRanking[0].date} (
            {money(estimateRanking[0].result)}); menor em{" "}
            {estimateRanking.at(-1)!.date} (
            {money(estimateRanking.at(-1)!.result)}). Cobertura:{" "}
            {estimates.length} de {report.work.length} dias.
          </p>
        )}
      </div>
      <div className="motorista-card motorista-report-group">
        <h2>Rendimento do trabalho</h2>
        <div className="motorista-stats">
          <Metric
            label="Horas informadas"
            value={`${decimal(report.hours, 2)} h`}
          />
          <Metric
            label="KM do trabalho informados"
            value={`${decimal(report.km, 1)} km`}
          />
          <Metric label="Ganho por hora" value={currency(report.perHour)} />
          <Metric label="Ganho por KM" value={currency(report.perKm)} />
          <Metric
            label="Resultado estimado por hora"
            value={
              estimatedHoursTotal > 0
                ? money(
                    estimatedHours.reduce((s, e) => s + e.result, 0) /
                      estimatedHoursTotal,
                  )
                : "—"
            }
          />
          <Metric
            label="Resultado estimado por KM"
            value={
              estimatedKm > 0
                ? money(
                    estimates.reduce((s, e) => s + e.result, 0) / estimatedKm,
                  )
                : "—"
            }
          />
        </div>
        <p className="motorista-muted">
          Horas: {report.hoursCoverage} de {report.work.length} dias; KM:{" "}
          {report.kmCoverage} de {report.work.length}. Estimativa com horas:{" "}
          {estimatedHours.length}; estimativa com KM: {estimates.length}.
          Índices usam somente ganhos/resultados dos dias com divisor
          compatível, divididos pela soma das horas ou KM desses dias.
        </p>
        <div className="motorista-grid">
          <GroupTable title="Por dia da semana" rows={report.weekdays} />
          <GroupTable title="Por classificação de turno" rows={report.shifts} />
        </div>
        <p className="motorista-muted">
          Poucas observações não definem um melhor dia. Turno classifica a
          jornada inteira; não permite atribuir receitas a horas específicas ou
          comparar partes do dia com precisão.
        </p>
      </div>
      <div className="motorista-card motorista-report-group">
        <h2>Ganhos</h2>
        <div className="motorista-table-scroll">
          <table className="motorista-table">
            <thead>
              <tr>
                <th>Origem</th>
                <th>Total</th>
                <th>Participação</th>
                <th>Corridas informadas</th>
                <th>Ganho por corrida</th>
              </tr>
            </thead>
            <tbody>
              {report.perApp.map((a) => (
                <tr key={a.source}>
                  <td>
                    {a.source === "uber"
                      ? "Uber"
                      : a.source === "ninetyNine"
                        ? "99"
                        : "Outros"}
                  </td>
                  <td>{money(a.cents)}</td>
                  <td>
                    {report.gains > 0
                      ? `${decimal((a.cents / report.gains) * 100)}%`
                      : "—"}
                  </td>
                  <td>
                    {a.source === "other"
                      ? "Não aplicável"
                      : a.covered
                        ? `${a.rides} · ${a.covered} dias`
                        : "—"}
                  </td>
                  <td>{currency(a.rideAverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="motorista-muted">
          Médias por corrida usam apenas jornadas elegíveis com contagem
          positiva informada. Zeros antigos não viram médias. Totais diários por
          aplicativo não permitem distribuir horas ou custos para calcular seu
          lucro líquido.
        </p>
      </div>
      <div className="motorista-card motorista-report-group">
        <h2>Custos e veículo</h2>
        <div className="motorista-stats">
          <Metric
            label="Gastos / ganhos"
            value={
              report.gains > 0
                ? `${decimal((report.costs / report.gains) * 100)}%`
                : "—"
            }
          />
          <Metric
            label="Combustível pago"
            value={money(paidFuel.reduce((s, e) => s + e.cents, 0))}
          />
          <Metric
            label="Combustível consumido estimado"
            value={
              estimates.length
                ? money(estimates.reduce((s, e) => s + e.fuel, 0))
                : "—"
            }
          />
          <Metric
            label="Manutenção provisionada (estimativa)"
            value={
              estimates.length
                ? money(estimates.reduce((s, e) => s + e.maintenance, 0))
                : "—"
            }
          />
        </div>
        <div className="motorista-table-scroll">
          <table className="motorista-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Valor pago</th>
                <th>Classificação</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{money(c.cents)}</td>
                  <td>
                    {scopeLabel(c.scope)} · {costLabel(c.costKind)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Abastecimentos</h3>
        {paidFuel.length ? (
          paidFuel.map((e) => (
            <p key={e.id}>
              {e.date} · {money(e.cents)} ·{" "}
              {e.fuel?.fuelType || "Combustível não informado"} ·{" "}
              {e.fuel?.volume
                ? `${decimal(e.fuel.volume, 3)} ${e.fuel.unit === "m3" ? "m³" : "L"} · ${money(e.cents / e.fuel.volume)}/unidade`
                : "Volume ausente · histórico incompleto"}
              {e.fuel?.odometer != null
                ? ` · odômetro ${decimal(e.fuel.odometer)} km`
                : " · odômetro ausente"}{" "}
              ·{" "}
              {e.fuel?.tank === "full"
                ? "tanque completo"
                : e.fuel?.tank === "partial"
                  ? "parcial"
                  : "tanque não informado"}
            </p>
          ))
        ) : (
          <p className="motorista-muted">
            Nenhum abastecimento pago neste período.
          </p>
        )}
        <h3>Consumo observado</h3>
        {cycles.filter((c) => c.to >= from && c.to <= effectiveTo).length ? (
          cycles
            .filter((c) => c.to >= from && c.to <= effectiveTo)
            .map((c) => (
              <p key={c.ids.join(":")}>
                {c.from} → {c.to}: {decimal(c.consumption, 2)} km/
                {c.unit === "m3" ? "m³" : "L"} ({decimal(c.km)} km /{" "}
                {decimal(c.volume, 3)} {c.unit}) · {c.fuelType}. Odômetro total
                do veículo, não exclusivamente trabalho.
              </p>
            ))
        ) : (
          <p className="motorista-muted">
            Não há ciclo completo confiável. Parciais, registros ausentes, troca
            de combustível e ordem ambígua interrompem a medição. Litros
            comprados hoje não medem consumo da jornada de hoje.
          </p>
        )}
        <h3>Consumo manual informado</h3>
        {days.filter(
          (d) =>
            d.date >= from && d.date <= effectiveTo && (d.consumption ?? 0) > 0,
        ).length ? (
          days
            .filter(
              (d) =>
                d.date >= from &&
                d.date <= effectiveTo &&
                (d.consumption ?? 0) > 0,
            )
            .map((d) => (
              <p key={d.date}>
                {d.date}: {decimal(d.consumption!, 2)} km/L · informado na
                jornada, preservado sem substituir por medição de abastecimento.
              </p>
            ))
        ) : (
          <p className="motorista-muted">
            Nenhum consumo manual informado no período.
          </p>
        )}
        <h3>Premissas e cobertura</h3>
        <p className="motorista-muted">
          {profile
            ? `Perfil desde ${profile.effectiveFrom}: ${profile.vehicle === "owned" ? "próprio" : profile.vehicle === "financed" ? "financiado" : "alugado"}, ${profile.fuelType}, ${profile.workShare}% dos custos do veículo atribuídos ao trabalho. Cada jornada usa sua vigência.`
            : "Nenhum perfil aplicável. Cadastre premissas para estimar combustível e custos do veículo."}{" "}
          Estimativa disponível em {estimates.length} de {report.work.length}{" "}
          dias. Combustível pago não é descontado novamente; manutenção/desgaste
          efetivos são substituídos pelas provisões correspondentes, quando
          configuradas.
        </p>
        {estimates.length > 0 && (
          <details>
            <summary>Ver premissas de cada jornada estimada</summary>
            {estimates.map((e) => (
              <p key={e.date}>
                {e.date}: perfil {e.profile.effectiveFrom}, consumo{" "}
                {decimal(e.consumption, 2)} km/{e.unit === "m3" ? "m³" : "L"} (
                {e.consumptionSource}), preço {money(e.price)}/{e.unit} (
                {e.priceSource}); combustível {money(e.fuel)}, fixos{" "}
                {money(e.fixed)}, operacionais {money(e.operational)},
                manutenção {money(e.maintenance)}, desgaste {money(e.wear)}.{" "}
                {e.unclassified} gastos não classificados ficaram fora da
                atribuição estimada.
              </p>
            ))}
          </details>
        )}
        <button className="motorista-text-button" onClick={onSettings}>
          Configurar veículo e classificação
        </button>
      </div>
      <div className="motorista-card motorista-report-group">
        <h2>Meta e cenários</h2>
        <label className="motorista-form">
          Mês próprio da meta
          <input
            type="month"
            value={metaMonth}
            onChange={(e) => {
              if (e.target.value) setMetaMonth(e.target.value);
            }}
          />
        </label>
        {from.slice(0, 7) !== to.slice(0, 7) && (
          <p className="motorista-muted">
            O intervalo geral atravessa meses; a meta abaixo pertence
            exclusivamente a {metaMonth}.
          </p>
        )}
        <PlanningCard plan={plan} onSettings={onSettings} />
        <div className="motorista-stats">
          <Metric
            label="Média recente de ganho por dia"
            value={currency(plan.base.dailyGains)}
          />
          <Metric
            label="Saldo projetado no fechamento"
            value={currency(plan.projected)}
          />
        </div>
        <p className="motorista-muted">
          Projeção baseada no histórico disponível, sem garantia de ganho.
          Considera somente ganhos futuros esperados e desconta ganhos parciais
          já registrados em dias restantes.
        </p>
        {plan.pending.map((o) => (
          <p key={o.key}>
            Previsto: {o.date} ·{" "}
            {o.plan.note ||
              categories.find((c) => c.id === o.plan.categoryId)?.name}{" "}
            · {money(o.cents)}
          </p>
        ))}
        {!plan.ended && (
          <Scenario
            key={metaMonth}
            plan={plan}
            args={{
              month: metaMonth,
              reference: today,
              goals,
              days,
              expenses,
              categories,
              plans,
            }}
          />
        )}
      </div>
    </section>
  );
}

function Scenario({
  plan,
  args,
}: {
  plan: ReturnType<typeof monthlyPlanning>;
  args: Parameters<typeof monthlyPlanning>[0];
}) {
  const [dates, setDates] = useState(plan.workDates),
    [variable, setVariable] = useState(
      plan.dailyVariable == null ? "" : money(plan.dailyVariable),
    );
  const amount = variable.trim()
    ? Number(variable.replace(/[^\d]/g, ""))
    : null;
  const simulated = monthlyPlanning({
    ...args,
    workDates: dates,
    variableDailyCents: amount,
  });
  const bounds = monthBounds(args.month),
    available = datesBetween(
      args.reference > bounds.from ? args.reference : bounds.from,
      bounds.to,
    ).filter(
      (date) =>
        !args.days.some(
          (d) => d.date === date && ["closed", "off"].includes(d.status ?? ""),
        ),
    );
  return (
    <details>
      <summary>Simular dias e gastos futuros</summary>
      <div className="motorista-form">
        <p className="motorista-muted">
          Simulação local. Não altera lançamentos ou planejamento salvo.
        </p>
        <label>
          Gasto variável simulado por dia (R$)
          <MoneyField value={variable} onChange={setVariable} />
        </label>
        <div
          className="motorista-calendar"
          role="group"
          aria-label="Datas da simulação"
        >
          {available.map((date) => (
            <button
              type="button"
              key={date}
              aria-label={`Simular trabalho em ${date}`}
              aria-pressed={dates.includes(date)}
              onClick={() =>
                setDates(
                  dates.includes(date)
                    ? dates.filter((d) => d !== date)
                    : [...dates, date],
                )
              }
            >
              {Number(date.slice(-2))}
            </button>
          ))}
        </div>
        <p>
          {simulated.remaining.length} dias restantes · ganho necessário por dia{" "}
          {currency(simulated.requiredDaily)} · despesas futuras{" "}
          {money(simulated.futureCosts)} · saldo projetado{" "}
          {currency(simulated.projected)}.
        </p>
      </div>
    </details>
  );
}
function GroupTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    label: string;
    count: number;
    gains: number;
    perHour: number | null;
  }>;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="motorista-table-scroll">
        <table className="motorista-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Observações</th>
              <th>Ganhos</th>
              <th>Ganho/h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{r.count}</td>
                <td>{money(r.gains)}</td>
                <td>{currency(r.perHour)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="motorista-muted">Sem jornadas elegíveis.</p>
      )}
    </div>
  );
}
function DailyChart({
  rows,
}: {
  rows: Array<{ date: string; gains: number; costs: number; balance: number }>;
}) {
  if (!rows.length) return null;
  const max = Math.max(
      ...rows.map((r) => Math.max(r.gains, r.costs, Math.abs(r.balance))),
      1,
    ),
    height = rows.length * 38 + 24;
  return (
    <figure className="motorista-chart">
      <figcaption>
        Valores por data: ganhos, gastos e saldo (linha central = zero)
      </figcaption>
      <svg
        viewBox={`0 0 720 ${height}`}
        role="img"
        aria-label="Evolução diária dos valores registrados; valores completos na tabela"
      >
        <line
          x1="350"
          y1="0"
          x2="350"
          y2={height}
          stroke="currentColor"
          opacity="0.3"
        />
        {rows.map((r, i) => (
          <g key={r.date}>
            <text x="0" y={i * 38 + 22} fill="currentColor" fontSize="13">
              {r.date}
            </text>
            <rect
              x="350"
              y={i * 38 + 6}
              width={(r.gains / max) * 330}
              height="8"
              fill="#4285ee"
            />
            <rect
              x="350"
              y={i * 38 + 16}
              width={(r.costs / max) * 330}
              height="8"
              fill="#dc7658"
            />
            <circle
              cx={350 + (r.balance / max) * 220}
              cy={i * 38 + 30}
              r="4"
              fill="currentColor"
            >
              <title>
                {r.date}: saldo {money(r.balance)}
              </title>
            </circle>
          </g>
        ))}
      </svg>
      <p className="motorista-muted">
        Azul: ganhos · laranja: gastos · ponto: saldo. Datas sem registro não
        provam folga.
      </p>
    </figure>
  );
}
export const scopeLabel = (scope?: string) =>
  scope === "operational"
    ? "Operacional"
    : scope === "vehicle"
      ? "Veículo"
      : scope === "personal"
        ? "Pessoal"
        : "Não classificado";
export const costLabel = (kind?: string) =>
  kind === "fuel"
    ? "Combustível"
    : kind === "maintenance"
      ? "Manutenção"
      : kind === "fixed"
        ? "Fixo"
        : kind === "extraordinary"
          ? "Extraordinário"
          : kind === "wear"
            ? "Desgaste"
            : kind === "variable"
              ? "Variável"
              : "Sem classificação de custo";
