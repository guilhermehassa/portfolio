import type { Firestore, Transaction } from "firebase/firestore";
import { doc, runTransaction } from "./motorista-persistence";
import {
  emptyDay, isDate, validateBackup,
  type Day, type Expense, type Category, type PlannedExpense,
} from "./motorista";
import { income, plannedOccurrences } from "./motorista-evolution";
import { validateJourney } from "./motorista-journey";

const canonical = (data: unknown): string =>
  JSON.stringify(data, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
        )
      : value,
  );

const normalizeDay = (date: string, data: object): Day => ({
  ...emptyDay(date),
  ...data,
  date,
});

const openJourney = (day: Day | undefined) =>
  !!day?.journey && day.journey.endedAt === null;

type SyncJourneyState = {
  db: Firestore;
  uid: string;
  transaction: Transaction;
  days: Day[];
  knownOpenDates?: string[];
  removedDates?: string[];
};

// Deve ser chamada depois das demais leituras e antes de qualquer escrita do lote.
// O mesmo documento serializa aberturas em datas diferentes e em outros dispositivos.
export async function syncJourneyState({
  db,
  uid,
  transaction,
  days,
  knownOpenDates = [],
  removedDates = [],
}: SyncJourneyState): Promise<void> {
  const updates = new Map<string, Day>();
  for (const day of days) {
    if (!isDate(day.date) || updates.has(day.date))
      throw new Error("Há datas de jornada inválidas ou repetidas.");
    validateJourney(day);
    updates.set(day.date, day);
  }
  const removed = new Set(removedDates);
  if (
    [...knownOpenDates, ...removedDates].some((date) => !isDate(date)) ||
    removedDates.some((date) => updates.has(date))
  )
    throw new Error("Revise as datas da transferência de jornada.");

  const stateRef = doc(db, "users", uid, "journeyState", "current");
  const stateSnapshot = await transaction.get(stateRef);
  const stateDate = stateSnapshot.data()?.date;
  if (stateDate != null && !isDate(stateDate))
    throw new Error("O controle da jornada precisa ser conferido antes de salvar.");

  const candidates = new Set([
    ...knownOpenDates,
    ...(typeof stateDate === "string" ? [stateDate] : []),
  ]);
  const openDates = new Set(
    days.filter(openJourney).map((day) => day.date),
  );
  for (const date of candidates) {
    if (updates.has(date) || removed.has(date)) continue;
    const snapshot = await transaction.get(doc(db, "users", uid, "days", date));
    if (snapshot.exists() && openJourney(normalizeDay(date, snapshot.data())))
      openDates.add(date);
  }
  if (openDates.size > 1)
    throw new Error("Encerre a jornada aberta antes de iniciar outra.");

  const nextDate = [...openDates][0] ?? null;
  if (stateSnapshot.exists() ? stateDate !== nextDate : nextDate !== null)
    transaction.set(stateRef, { date: nextDate }, { merge: true });
}

type SaveJourneyDay = {
  db: Firestore;
  uid: string;
  day: Day;
  previous?: Day;
  knownOpenDates?: string[];
};

type EndingExpenses = {
  expenses: Expense[];
  categories: Category[];
  plannedExpenses?: PlannedExpense[];
};

type SaveEndingDay = Omit<SaveJourneyDay, "previous"> & EndingExpenses & {
  previous: Day;
};

function validateEndingDraft({ day, previous, expenses, categories }: SaveEndingDay) {
  if (!openJourney(previous) || !day.journey?.endedAt || day.status !== "closed")
    throw new Error("Revise o encerramento da jornada aberta antes de finalizar.");
  if (day.date !== previous.date)
    throw new Error("O encerramento deve manter a data de início da jornada.");
  if (expenses.some((expense) => expense.cents <= 0))
    throw new Error("Os novos gastos devem ter valores positivos.");
  const links = expenses.map((expense) => expense.plannedExpenseId).filter((key): key is string => !!key);
  if (new Set(links).size !== links.length)
    throw new Error("Uma previsão está vinculada a mais de um novo gasto.");
  if (links.some((key) => !/^[a-zA-Z0-9_-]{1,128}$/.test(key) ||
    !key.endsWith("--" + key.slice(-10)) || !isDate(key.slice(-10)) || !key.slice(0, -12)))
    throw new Error("O vínculo de um novo gasto é inválido.");
  // Reaproveita a validação completa de valores/detalhes. Os vínculos reais
  // serão conferidos com o documento atual do compromisso dentro da transação.
  validateBackup({
    version: 4, exportedAt: new Date().toISOString(), days: [day],
    expenses: expenses.map((expense) => ({ ...expense, plannedExpenseId: null })),
    categories, goals: [], plannedExpenses: [], costProfiles: [],
  });
}

// Só prepara as escritas: nenhuma alteração ocorre antes das leituras do marcador.
async function prepareEndingExpenses(
  db: Firestore,
  uid: string,
  transaction: Transaction,
  { expenses, categories, plannedExpenses = [] }: EndingExpenses,
) {
  const expenseRefs = expenses.map((expense) => doc(db, "users", uid, "expenses", expense.id));
  const categoryIds = [...new Set(expenses.map((expense) => expense.categoryId))];
  const categoryRefs = categoryIds.map((id) => doc(db, "users", uid, "categories", id));
  const planIds = [...new Set(expenses.flatMap((expense) =>
    expense.plannedExpenseId ? [expense.plannedExpenseId.slice(0, -12)] : []))];
  const planRefs = planIds.map((id) => doc(db, "users", uid, "plannedExpenses", id));
  const [expenseSnapshots, categorySnapshots, planSnapshots] = await Promise.all([
    Promise.all(expenseRefs.map((ref) => transaction.get(ref))),
    Promise.all(categoryRefs.map((ref) => transaction.get(ref))),
    Promise.all(planRefs.map((ref) => transaction.get(ref))),
  ]);
  if (expenseSnapshots.some((snapshot) => snapshot.exists()))
    throw new Error("Um novo gasto já existe em outra sessão. Reabra o encerramento.");

  const missingCategories: Category[] = [];
  categoryIds.forEach((id, index) => {
    const expected = categories.find((category) => category.id === id);
    if (!expected) throw new Error("Categoria de um novo gasto não encontrada.");
    const snapshot = categorySnapshots[index];
    if (snapshot.exists()) {
      if (canonical({ ...snapshot.data(), id }) !== canonical(expected))
        throw new Error("Categoria alterada em outra sessão. Reabra o encerramento.");
    } else missingCategories.push(expected);
  });

  const plans = new Map<string, PlannedExpense>();
  planIds.forEach((id, index) => {
    const snapshot = planSnapshots[index];
    if (!snapshot.exists()) throw new Error("Previsão removida. Reabra o encerramento.");
    const current = { ...snapshot.data(), id } as PlannedExpense;
    const expected = plannedExpenses.find((plan) => plan.id === id);
    if (!expected || canonical(current) !== canonical(expected))
      throw new Error("Previsão alterada em outra sessão. Reabra o encerramento.");
    plans.set(id, current);
  });
  for (const expense of expenses) {
    const key = expense.plannedExpenseId;
    if (!key) continue;
    const plan = plans.get(key.slice(0, -12))!;
    if (!plannedOccurrences([plan], key.slice(-10, -3), []).some((occurrence) => occurrence.key === key))
      throw new Error("Ocorrência da previsão inválida.");
    if (plan.payments?.[key])
      throw new Error("Essa previsão já tem um pagamento. Reabra o encerramento.");
    plan.payments = { ...plan.payments, [key]: expense.id };
  }
  return () => {
    // Atualiza somente payments; todos os demais campos do compromisso permanecem.
    plans.forEach((plan, id) => transaction.set(
      doc(db, "users", uid, "plannedExpenses", id), { payments: plan.payments }, { merge: true },
    ));
    missingCategories.forEach((category) => transaction.set(
      doc(db, "users", uid, "categories", category.id), category,
    ));
    expenses.forEach((expense, index) => transaction.set(expenseRefs[index], expense));
  };
}

// Preserva também propriedades históricas desconhecidas dentro dos novos mapas.
function preserveFields(stored: Day | undefined, next: Day): Day {
  const result: Day = {
    ...stored,
    ...next,
    filled: { ...stored?.filled, ...next.filled },
  };
  if (next.journey) {
    result.journey = {
      ...stored?.journey,
      ...next.journey,
      pauses: next.journey.pauses.map((pause) => ({
        ...stored?.journey?.pauses.find((old) => old.id === pause.id),
        ...pause,
      })),
    };
  }
  return result;
}

async function persistJourneyDay({
  db,
  uid,
  day,
  previous,
  knownOpenDates = [],
}: SaveJourneyDay, ending?: EndingExpenses): Promise<void> {
  if (!isDate(day.date) || (previous && !isDate(previous.date)))
    throw new Error("Informe uma data de início válida.");
  validateJourney(day);
  await runTransaction(db, async (transaction) => {
    const sourceDate = previous?.date ?? day.date;
    const moving = sourceDate !== day.date;
    const sourceRef = doc(db, "users", uid, "days", sourceDate);
    const destinationRef = moving
      ? doc(db, "users", uid, "days", day.date)
      : sourceRef;
    const sourceSnapshot = await transaction.get(sourceRef);
    const destinationSnapshot = moving
      ? await transaction.get(destinationRef)
      : sourceSnapshot;
    if (moving && destinationSnapshot.exists())
      throw new Error("Já existe um registro na data de destino. Escolha outra data.");

    const stored = sourceSnapshot.exists()
      ? normalizeDay(sourceDate, sourceSnapshot.data())
      : undefined;
    if (
      stored &&
      (!previous || canonical(stored) !== canonical(normalizeDay(sourceDate, previous)))
    )
      throw new Error(
        "Este registro foi alterado em outra sessão. Reabra o formulário antes de salvar.",
      );
    if (previous && !stored)
      throw new Error("Este registro foi removido em outra sessão. Reabra o formulário.");
    if (!stored?.journey && openJourney(day) && stored && income(stored) > 0)
      throw new Error(
        "Esta data já tem ganhos. Corrija o registro existente antes de iniciar uma jornada.",
      );
    if (stored?.journey?.endedAt && openJourney(day))
      throw new Error("Esta jornada já foi encerrada. Use a correção do registro.");
    if (stored?.status === "off" && openJourney(day))
      throw new Error("Esta data está marcada como folga. Corrija o registro existente.");

    const preserved = preserveFields(stored, day);
    validateJourney(preserved);
    const saveExpenses = ending
      ? await prepareEndingExpenses(db, uid, transaction, ending)
      : undefined;
    await syncJourneyState({
      db,
      uid,
      transaction,
      days: [preserved],
      knownOpenDates,
      removedDates: moving ? [sourceDate] : [],
    });
    transaction.set(destinationRef, preserved, { merge: true });
    saveExpenses?.();
    // A origem só é removida na transferência explícita e atômica de todo o registro.
    if (moving) transaction.delete(sourceRef);
  });
}

export async function saveJourneyDay(options: SaveJourneyDay): Promise<void> {
  await persistJourneyDay(options);
}

// Finalizar é a única gravação do fluxo por etapas. Jornada, ganhos, marcador,
// categorias necessárias e novos gastos/vínculos são confirmados ou abortados juntos.
export async function saveEndingDay(options: SaveEndingDay): Promise<void> {
  validateEndingDraft(options);
  await persistJourneyDay(options, options);
}
