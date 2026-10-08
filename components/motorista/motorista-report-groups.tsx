import { decimal, money } from "@/lib/motorista";
import type { reportAnalysis } from "@/lib/motorista-reporting";
import { maintenanceMonthLabel } from "./motorista-maintenance";
import { ReportCategoryBars, ReportLineChart, consumptionValue } from "./motorista-report-charts";

const currency = (value: number | null | undefined) => value == null ? "—" : money(value);
const hours = (value: number | null) => value == null ? "—" : `${decimal(value, 2)} h`;

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="motorista-card motorista-metric"><span>{label}</span><strong>{value}</strong></div>;
}

export function ReportGroups({ report }: { report: ReturnType<typeof reportAnalysis> }) {
  const { summary, averages, findings, profitability, chart, platforms, categories, vehicle, coverage } = report;
  return <>
    <div className="motorista-card motorista-report-group">
      <h2>Resumos</h2>
      <div className="motorista-stats">
        <Metric label="Total Ganhos" value={money(summary.gains)} />
        <Metric label="Total Gastos" value={money(summary.costs)} />
        <Metric label="Saldo" value={money(summary.balance)} />
        <Metric label="Dias" value={String(summary.workedDays)} />
        <Metric label="Horas" value={hours(summary.hours)} />
        <Metric label="KM" value={`${decimal(summary.km, 1)} km`} />
        <Metric label="Viagens" value={summary.trips == null ? "—" : String(summary.trips)} />
      </div>
    </div>
    <div className="motorista-card motorista-report-group">
      <h2>Médias</h2>
      <div className="motorista-stats">
        <Metric label="Horas trabalhadas" value={hours(averages.hoursPerDay)} />
        <Metric label="Ganho/dia" value={currency(averages.gainsPerDay)} />
        <Metric label="Lucro/dia" value={currency(averages.profitPerDay)} />
        <Metric label="Gasto/dia" value={currency(averages.costsPerDay)} />
      </div>
      <p className="motorista-muted">Médias por dia trabalhado.</p>
    </div>
    <div className="motorista-card motorista-report-group">
      <h2>Constatações</h2>
      <div className="motorista-stats">
        <Metric label="Ganho/hora" value={currency(findings.gainsPerHour)} />
        <Metric label="Ganho/dia" value={currency(findings.gainsPerDay)} />
        <Metric label="Ganho/KM" value={currency(findings.gainsPerKm)} />
        <Metric label="Lucro/hora" value={currency(findings.profitPerHour)} />
        <Metric label="Lucro/dia" value={currency(findings.profitPerDay)} />
        <Metric label="Lucro/KM" value={currency(findings.profitPerKm)} />
        <Metric label="Ganho/viagem" value={currency(findings.gainsPerTrip)} />
      </div>
      {summary.workedDays > 0 && (!coverage.hoursComplete || !coverage.kmComplete || !coverage.tripsComplete) &&
        <p className="motorista-muted">Complete horas, KM e viagens dos dias em Ganhos para ver os índices que estão indisponíveis.</p>}
    </div>
    <div className="motorista-card motorista-report-group">
      <h2>Lucratividade</h2>
      <div className="motorista-stats">
        <Metric label="Ganhos" value={money(profitability.gains)} />
        <Metric label="Gastos" value={money(profitability.costs)} />
        <Metric label="Saldo" value={money(profitability.balance)} />
      </div>
      <ReportLineChart title="Meta diária e ganhos atingidos" dates={chart.dates} series={[
        { id: "meta", label: "Meta de ganho diário necessário", color: "var(--motorista-muted)", values: chart.meta },
        { id: "attained", label: "Atingido", color: "var(--motorista-accent)", values: chart.attained },
      ]} />
      <div className="motorista-stats">
        <Metric label={report.ended ? "Faltou para o saldo da meta" : "Falta para o saldo da meta"} value={currency(profitability.missing)} />
        <Metric label="Ganho necessário para a meta" value={currency(profitability.required)} />
      </div>
    </div>
    <div className="motorista-card motorista-report-group">
      <h2>Plataformas</h2>
      <div className="motorista-grid">
        {platforms.map((platform) => <div key={platform.id} className="motorista-report-platform">
          <h3>{platform.name}</h3>
          <div className="motorista-stats">
            <Metric label="Ganhos" value={money(platform.gains)} />
            <Metric label="Viagens" value={platform.trips == null ? "—" : String(platform.trips)} />
            <Metric label="Média por viagem" value={currency(platform.averagePerTrip)} />
            <Metric label="Participação" value={platform.share == null ? "—" : `${decimal(platform.share)}%`} />
          </div>
        </div>)}
      </div>
    </div>
    <div className="motorista-card motorista-report-group">
      <h2>Gastos</h2>
      <ReportCategoryBars rows={categories} />
    </div>
    <div className="motorista-card motorista-report-group">
      <h2>Veículo</h2>
      <div className="motorista-stats">
        <Metric label="KM" value={`${decimal(vehicle.km, 1)} km`} />
        <Metric label="Consumo médio geral" value={vehicle.consumption == null ? "—" : `${decimal(vehicle.consumption, 2)} km/L`} />
      </div>
      <ReportLineChart title="Consumo diário informado (km/L)" dates={chart.dates}
        series={[{ id: "consumption", label: "Consumo manual", color: "var(--motorista-accent)", values: vehicle.consumptionValues }]}
        formatValue={consumptionValue} />
      <p className="motorista-muted">Consumo médio ponderado pelos KM informados. Dias sem KM aparecem somente no gráfico.</p>
      <h3>Manutenções</h3>
      {vehicle.maintenance.length ? vehicle.maintenance.map((maintenance) => <p key={maintenance.expense.id}>
        <strong>{maintenance.name}</strong> · {money(maintenance.allocatedCents)} no período
        {` (${money(maintenance.totalCents)} em ${maintenance.installments}x a partir de ${maintenanceMonthLabel(maintenance.startMonth)})`}
      </p>) : <p className="motorista-muted">Nenhuma manutenção no período.</p>}
    </div>
  </>;
}
