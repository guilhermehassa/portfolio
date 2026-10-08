import { decimal, money } from "@/lib/motorista";

type Series = { id: string; label: string; color: string; values: Array<number | null> };
const dateLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export function ReportLineChart({ title, dates, series, formatValue = money }: {
  title: string;
  dates: string[];
  series: Series[];
  formatValue?: (value: number) => string;
}) {
  const values = series.flatMap((line) => line.values.filter((value): value is number => value != null));
  if (!dates.length || !values.length) return <p className="motorista-muted">Sem dados para {title.toLocaleLowerCase("pt-BR")}.</p>;
  const min = Math.min(0, ...values), max = Math.max(1, ...values), range = max - min;
  const x = (index: number) => 86 + (dates.length > 1 ? index / (dates.length - 1) : 0.5) * 600;
  const y = (value: number) => 224 - ((value - min) / range) * 190;
  const steps = [0, 0.5, 1], labelStep = Math.max(1, Math.ceil(dates.length / 7));
  return <figure className="motorista-chart motorista-report-line-chart">
    <figcaption>{title}</figcaption>
    <div className="motorista-chart-legend">
      {series.map((line) => <span key={line.id}><i style={{ background: line.color }} aria-hidden="true" />{line.label}</span>)}
    </div>
    <svg viewBox="0 0 720 270" role="img" aria-label={title}>
      {steps.map((step) => {
        const value = min + range * step;
        return <g key={step}>
          <line x1={86} x2={686} y1={y(value)} y2={y(value)} stroke="currentColor" opacity="0.15" />
          <text x={76} y={y(value) + 4} textAnchor="end" fill="currentColor" fontSize={11}>{formatValue(value)}</text>
        </g>;
      })}
      {dates.map((date, index) => (index % labelStep === 0 || index === dates.length - 1) &&
        <text key={date} x={x(index)} y={249} textAnchor="middle" fill="currentColor" fontSize={11}>{dateLabel(date)}</text>)}
      {series.map((line) => {
        let connected = false;
        const path = line.values.map((value, index) => {
          if (value == null) { connected = false; return ""; }
          const command = connected ? "L" : "M"; connected = true;
          return `${command}${x(index)} ${y(value)}`;
        }).join(" ");
        return <g key={line.id}>
          <path d={path} fill="none" stroke={line.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {line.values.map((value, index) => value != null && <circle key={dates[index]} cx={x(index)} cy={y(value)} r={3.5} fill={line.color}>
            <title>{`${dates[index]} · ${line.label}: ${formatValue(value)}`}</title>
          </circle>)}
        </g>;
      })}
    </svg>
    <table className="motorista-sr-only">
      <caption>{title}</caption>
      <thead><tr><th>Data</th>{series.map((line) => <th key={line.id}>{line.label}</th>)}</tr></thead>
      <tbody>{dates.map((date, index) => <tr key={date}>
        <th>{date}</th>{series.map((line) => <td key={line.id}>{line.values[index] == null ? "Não informado" : formatValue(line.values[index]!)}</td>)}
      </tr>)}</tbody>
    </table>
  </figure>;
}

export function ReportCategoryBars({ rows }: { rows: Array<{ id: string; label: string; cents: number }> }) {
  if (!rows.length) return <p className="motorista-muted">Nenhum gasto no período.</p>;
  const max = Math.max(...rows.map((row) => row.cents), 1);
  return <div className="motorista-origin-list motorista-report-category-bars" aria-label="Gastos por categoria">
    {rows.map((row) => <div key={row.id}>
      <div className="motorista-origin-label"><strong>{row.label}</strong><span>{money(row.cents)}</span></div>
      <div className="motorista-origin-track" aria-hidden="true"><span style={{ width: `${(row.cents / max) * 100}%` }} /></div>
    </div>)}
  </div>;
}

export const consumptionValue = (value: number) => decimal(value, 2);
