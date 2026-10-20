import { isDate, type Expense, type PaymentMethod, type PaymentMethodSnapshot } from "./motorista";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const day = (value: unknown) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31;

export function validatePaymentMethodSnapshot(value: unknown): asserts value is PaymentMethodSnapshot {
  if (!record(value) || !["other", "credit"].includes(String(value.type)) ||
    (value.type === "credit"
      ? !day(value.closingDay) || !day(value.dueDay)
      : value.closingDay != null || value.dueDay != null))
    throw new Error("Revise o tipo, o dia de fechamento e o dia de vencimento da forma de pagamento.");
}

export function validatePaymentMethod(value: unknown): asserts value is PaymentMethod {
  if (!record(value) || typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.id) ||
    typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > 80 ||
    typeof value.active !== "boolean")
    throw new Error("Informe um nome de até 80 caracteres e uma forma de pagamento válida.");
  validatePaymentMethodSnapshot(value);
}

export function expensePaymentFields(
  paymentMethodId: string,
  methods: PaymentMethod[],
  previous?: Expense,
): Pick<Expense, "paymentMethodId" | "paymentMethodSnapshot"> {
  if (!paymentMethodId) {
    if (!previous || previous.paymentMethodId)
      throw new Error("Selecione uma forma de pagamento para o gasto.");
    // Salvar outro campo não fabrica informação no histórico nem converte null em ausência.
    return {
      ...(Object.hasOwn(previous, "paymentMethodId") ? { paymentMethodId: previous.paymentMethodId } : {}),
      ...(Object.hasOwn(previous, "paymentMethodSnapshot") ? { paymentMethodSnapshot: previous.paymentMethodSnapshot } : {}),
    };
  }
  const method = methods.find((item) => item.id === paymentMethodId);
  if (!method) throw new Error("A forma de pagamento selecionada não existe mais. Revise o cadastro.");
  validatePaymentMethod(method);
  if (!method.active && previous?.paymentMethodId !== paymentMethodId)
    throw new Error("Selecione uma forma de pagamento ativa.");
  if (previous?.paymentMethodId === paymentMethodId && previous.paymentMethodSnapshot) {
    validatePaymentMethodSnapshot(previous.paymentMethodSnapshot);
    return { paymentMethodId, paymentMethodSnapshot: previous.paymentMethodSnapshot };
  }
  return {
    paymentMethodId,
    paymentMethodSnapshot: method.type === "credit"
      ? { type: method.type, closingDay: method.closingDay, dueDay: method.dueDay }
      : { type: method.type },
  };
}

export function expensePurchaseDate(expense: Expense): string | null {
  const date = expense.kind === "maintenance" ? expense.purchaseDate : expense.date;
  if (date === undefined || date === null) return null;
  if (!isDate(date)) throw new Error("Há um gasto com data de compra inválida.");
  return date;
}

function dateInMonth(index: number, configuredDay: number): string {
  const year = Math.floor(index / 12), month = index % 12 + 1;
  if (year > 9999 || year < 100) throw new Error("O vencimento da fatura ultrapassa o calendário permitido.");
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(configuredDay, lastDay)).padStart(2, "0")}`;
}

export function expensePaymentDueDate(expense: Expense, methods: PaymentMethod[]): string | null {
  if (!expense.paymentMethodId) return null;
  const method = methods.find((item) => item.id === expense.paymentMethodId);
  if (!method) throw new Error("Há um gasto vinculado a uma forma de pagamento ausente.");
  const purchaseDate = expensePurchaseDate(expense);
  if (!purchaseDate) return null;
  const terms = expense.paymentMethodSnapshot ?? method;
  validatePaymentMethodSnapshot(terms);
  if (terms.type === "other") return purchaseDate;
  const [year, month] = purchaseDate.split("-").map(Number);
  let closingMonth = year * 12 + month - 1;
  // Compra no próprio fechamento pertence ao ciclo seguinte.
  if (purchaseDate >= dateInMonth(closingMonth, terms.closingDay!)) closingMonth++;
  const closingDate = dateInMonth(closingMonth, terms.closingDay!);
  const sameMonthDue = dateInMonth(closingMonth, terms.dueDay!);
  return sameMonthDue > closingDate ? sameMonthDue : dateInMonth(closingMonth + 1, terms.dueDay!);
}
