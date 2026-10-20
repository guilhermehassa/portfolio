"use client";
import { useState, type ReactNode } from "react";
import { civilDate, isDate, money, type Category, type Expense, type PaymentMethod } from "@/lib/motorista";
import { invoiceExpenseReport } from "@/lib/motorista-invoice-reporting";

type Props = {
  expenses: Expense[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
  from: string;
  to: string;
  controls: ReactNode;
};

const dateLabel = (date: string) => civilDate(date).toLocaleDateString("pt-BR");

export function MotoristaExpenseReports({ expenses, paymentMethods, categories, from, to, controls }: Props) {
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const validPeriod = isDate(from) && isDate(to) && from <= to;
  let report: ReturnType<typeof invoiceExpenseReport> | null = null;
  let reportError = "";
  if (validPeriod) {
    try {
      report = invoiceExpenseReport({ expenses, methods: paymentMethods, from, to,
        paymentMethodId: paymentMethodId || undefined, categoryId: categoryId || undefined });
    } catch (error) { reportError = error instanceof Error ? error.message : "Não foi possível consultar os gastos."; }
  }
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const availableCategories = [...new Set([...categories.map((category) => category.id), ...expenses.map((expense) => expense.categoryId)])]
    .sort((a, b) => (categoryNames.get(a) ?? a).localeCompare(categoryNames.get(b) ?? b, "pt-BR"));
  return <section className="motorista-section">
    <div>
      <p className="motorista-eyebrow">Relatórios · Gastos</p>
      <h2>Gastos por vencimento</h2>
      <p className="motorista-muted">Selecione quando vence a fatura para consultar as compras que a compõem. Pix, Dinheiro e Débito usam a data do gasto.</p>
    </div>
    {controls}
    <div className="motorista-card motorista-form">
      <div className="motorista-field-grid">
        <label>Forma de pagamento
          <select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
            <option value="">Todas as formas de pagamento</option>
            {[...paymentMethods].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((method) =>
              <option key={method.id} value={method.id}>{method.name}{method.active ? "" : " · Inativa"}</option>)}
          </select>
        </label>
        <label>Categoria
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Todas as categorias</option>
            {availableCategories.map((id) => <option key={id} value={id}>{categoryNames.get(id) ?? id}</option>)}
          </select>
        </label>
      </div>
    </div>
    {!report ? <p className={`motorista-alert${reportError ? " error" : ""}`} role={reportError ? "alert" : undefined}>
      {reportError || "Selecione um período válido de vencimentos."}
    </p> : <>
      <div className="motorista-stats" aria-live="polite">
        <div className="motorista-card motorista-metric">
          <span>Total filtrado</span><strong>{money(report.totalCents)}</strong>
        </div>
        {report.groups.map((group) => <div className="motorista-card motorista-metric" key={group.method.id}>
          <span>{group.method.name}</span><strong>{money(group.cents)}</strong>
        </div>)}
      </div>
      {report.rows.length === 0 ? <p className="motorista-muted">Nenhum gasto com vencimento nos filtros selecionados.</p> :
        <div className="motorista-card motorista-report-group">
          <div className="motorista-table-scroll motorista-invoice-table-scroll" role="region" aria-label="Listagem de gastos por vencimento" tabIndex={0}>
            <table className="motorista-table motorista-invoice-table">
              <caption>Vencimentos de {dateLabel(from)} a {dateLabel(to)} · {report.rows.length} {report.rows.length === 1 ? "gasto" : "gastos"}</caption>
              <thead><tr>
                <th scope="col">Compra</th><th scope="col">Vencimento</th><th scope="col">Forma de pagamento</th>
                <th scope="col">Categoria</th><th scope="col">Descrição</th><th scope="col">Valor</th>
              </tr></thead>
              <tbody>{report.rows.map((row) => <tr key={row.expense.id}>
                <td><time dateTime={row.purchaseDate}>{dateLabel(row.purchaseDate)}</time></td>
                <td><time dateTime={row.dueDate}>{dateLabel(row.dueDate)}</time></td>
                <td>{row.method.name}</td>
                <td>{categoryNames.get(row.expense.categoryId) ?? row.expense.categoryId}</td>
                <td>{row.expense.note ?? ""}</td><td>{money(row.cents)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>}
    </>}
  </section>;
}

export default MotoristaExpenseReports;
