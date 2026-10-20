import { isDate, safeInt, type Expense, type PaymentMethod } from "./motorista";
import { expensePaymentDueDate, expensePurchaseDate } from "./motorista-payment-methods";

export type InvoiceExpenseRow = {
  expense: Expense;
  method: PaymentMethod;
  purchaseDate: string;
  dueDate: string;
  cents: number;
};
export type InvoiceExpenseGroup = { method: PaymentMethod; cents: number; rows: InvoiceExpenseRow[] };

function addCents(total: number, cents: number) {
  const result = total + cents;
  if (!safeInt(cents) || !Number.isSafeInteger(result))
    throw new Error("A soma dos gastos ultrapassa o limite de centavos permitido.");
  return result;
}

export function invoiceExpenseReport({ expenses, methods, from, to, paymentMethodId, categoryId }: {
  expenses: Expense[];
  methods: PaymentMethod[];
  from: string;
  to: string;
  paymentMethodId?: string;
  categoryId?: string;
}): { rows: InvoiceExpenseRow[]; groups: InvoiceExpenseGroup[]; totalCents: number } {
  if (!isDate(from) || !isDate(to) || from > to) return { rows: [], groups: [], totalCents: 0 };
  const byMethod = new Map(methods.map((method) => [method.id, method]));
  // Recebe os mestres originais: rateios de manutenção são custos analíticos, não compras.
  const rows = expenses.flatMap((expense): InvoiceExpenseRow[] => {
    const dueDate = expensePaymentDueDate(expense, methods);
    const method = expense.paymentMethodId ? byMethod.get(expense.paymentMethodId) : undefined;
    if (!dueDate || !method || dueDate < from || dueDate > to ||
      (paymentMethodId && method.id !== paymentMethodId) ||
      (categoryId && expense.categoryId !== categoryId)) return [];
    const purchaseDate = expensePurchaseDate(expense)!;
    if (!safeInt(expense.cents)) throw new Error("Há um gasto com valor inválido em centavos.");
    return [{ expense, method, purchaseDate, dueDate, cents: expense.cents }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) ||
    a.purchaseDate.localeCompare(b.purchaseDate) || a.expense.id.localeCompare(b.expense.id));
  const grouped = new Map<string, InvoiceExpenseGroup>();
  let totalCents = 0;
  for (const row of rows) {
    const group = grouped.get(row.method.id) ?? { method: row.method, cents: 0, rows: [] };
    group.cents = addCents(group.cents, row.cents);
    group.rows.push(row);
    grouped.set(row.method.id, group);
    totalCents = addCents(totalCents, row.cents);
  }
  return { rows, groups: [...grouped.values()].sort((a, b) => a.method.name.localeCompare(b.method.name, "pt-BR")), totalCents };
}
