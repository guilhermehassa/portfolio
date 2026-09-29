"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type MouseEvent,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  motoristaAuth,
  motoristaDb,
  MOTORISTA_UID,
} from "@/lib/motorista-firebase";
import {
  DEFAULT_CATEGORIES,
  civilDate,
  decimal,
  emptyDay,
  expectedGoal,
  exportCsv,
  goalForMonth,
  isDate,
  isoWeek,
  legacyGains,
  localDate,
  maskMoney,
  monthBounds,
  money,
  moneyInput,
  parseCents,
  parseDecimal,
  periodBounds,
  totals,
  validateBackup,
  weekBounds,
  type Backup,
  type Category,
  type Day,
  type Expense,
  type Gain,
  type Goal,
} from "@/lib/motorista";
import "./motorista.css";

type Tab = "resumo" | "ganhos" | "gastos" | "definicoes" | "backup";
type Filter = "day" | "week" | "month" | "custom";
type PeriodSelection = {
  filter: Filter;
  anchor: string;
  week: string;
  month: string;
  from: string;
  to: string;
};
const today = localDate();
const initialPeriod = (): PeriodSelection => ({
  filter: "week",
  anchor: today,
  week: isoWeek(today),
  month: today.slice(0, 7),
  from: `${today.slice(0, 7)}-01`,
  to: today,
});
const selectedBounds = (period: PeriodSelection) =>
  period.filter === "week"
    ? weekBounds(period.week)
    : period.filter === "month"
      ? monthBounds(period.month)
      : periodBounds(period.filter, period.anchor, period.from, period.to);
const validBounds = (bounds: { from: string; to: string }) =>
  isDate(bounds.from) && isDate(bounds.to) && bounds.from <= bounds.to;
const fileDownload = (content: string, name: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const ratio = (numerator: number, denominator: number, currency = true) =>
  denominator > 0
    ? currency
      ? money(numerator / denominator)
      : decimal(numerator / denominator, 2)
    : "—";
const dateLabel = (date: string) => civilDate(date).toLocaleDateString("pt-BR");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Tente novamente.";

export default function MotoristaApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("resumo");
  const [days, setDays] = useState<Day[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [savedCategories, setSavedCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [summaryPeriod, setSummaryPeriod] = useState(initialPeriod);
  const [gainsPeriod, setGainsPeriod] = useState(initialPeriod);
  const [expensesPeriod, setExpensesPeriod] = useState(initialPeriod);
  const [dayDate, setDayDate] = useState(today);
  const [modal, setModal] = useState<"gain" | "expense" | "day" | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const [gainForm, setGainForm] = useState<Gain>({
    id: "",
    date: today,
    source: "uber",
    cents: 0,
  });
  const [gainValue, setGainValue] = useState("");
  const [dayDraft, setDayDraft] = useState<{
    key: string;
    fields: {
      hours: string;
      km: string;
      consumption: string;
    };
  } | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    id: "",
    date: today,
    categoryId: "combustivel",
    value: "",
    note: "",
  });
  const [categoryEdit, setCategoryEdit] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [importMode, setImportMode] = useState<"new" | "update">("new");

  const authorized = !!user && !!MOTORISTA_UID && user.uid === MOTORISTA_UID;
  const categories = useMemo(
    () =>
      [
        ...DEFAULT_CATEGORIES.filter(
          (category) =>
            !savedCategories.some((saved) => saved.id === category.id),
        ),
        ...savedCategories,
      ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [savedCategories],
  );
  const allLoaded = ["days", "expenses", "categories", "goals"].every(
    (key) => loaded[key],
  );
  const bounds = selectedBounds(summaryPeriod);
  const periodValid = validBounds(bounds);
  const shownDays = useMemo(
    () =>
      periodValid
        ? days.filter((day) => day.date >= bounds.from && day.date <= bounds.to)
        : [],
    [days, bounds.from, bounds.to, periodValid],
  );
  const shownExpenses = useMemo(
    () =>
      periodValid
        ? expenses.filter(
            (expense) =>
              expense.date >= bounds.from && expense.date <= bounds.to,
          )
        : [],
    [expenses, bounds.from, bounds.to, periodValid],
  );
  const summary = totals(shownDays, shownExpenses);
  const expenseByCategory = useMemo(() => {
    const amounts = new Map<string, number>();
    shownExpenses.forEach((expense) => {
      amounts.set(
        expense.categoryId,
        (amounts.get(expense.categoryId) ?? 0) + expense.cents,
      );
    });
    return [...amounts]
      .map(([id, cents]) => ({
        id,
        name: categories.find((category) => category.id === id)?.name ?? id,
        cents,
      }))
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR"));
  }, [shownExpenses, categories]);
  const expected = periodValid
    ? expectedGoal(bounds.from, bounds.to, goals)
    : null;
  const missing =
    expected === null ? null : Math.max(expected - summary.balance, 0);
  const progressMonth =
    periodValid &&
    !(summaryPeriod.filter === "custom" && bounds.from.slice(0, 7) !== bounds.to.slice(0, 7))
      ? bounds.from.slice(0, 7)
      : null;
  const monthlyGoal = progressMonth
    ? goalForMonth(goals, progressMonth)?.cents
    : null;
  const monthlyBalance = progressMonth
    ? totals(
        days.filter((day) => day.date.startsWith(progressMonth)),
        expenses.filter((expense) => expense.date.startsWith(progressMonth)),
      ).balance
    : 0;
  const monthlyPercent = monthlyGoal
    ? (monthlyBalance / monthlyGoal) * 100
    : null;
  const currentMonth = localDate().slice(0, 7);
  const goal = goalForMonth(goals, currentMonth)?.cents ?? 0;
  const selectedDay =
    days.find((item) => item.date === dayDate) ?? emptyDay(dayDate);
  const dayForm =
    dayDraft?.key === dayDate
      ? dayDraft.fields
      : {
          hours: selectedDay.minutes
            ? (selectedDay.minutes / 60).toFixed(2).replace(".", ",")
            : "",
          km: selectedDay.km ? String(selectedDay.km).replace(".", ",") : "",
          consumption: selectedDay.consumption
            ? String(selectedDay.consumption).replace(".", ",")
            : "",
        };
  const setDayForm = (fields: typeof dayForm) =>
    setDayDraft({ key: dayDate, fields });
  const goalInput = goalDraft ?? moneyInput(goal);

  useEffect(() => {
    if (!modal) return;
    const dialog = modalRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [modal]);

  useEffect(
    () =>
      onAuthStateChanged(
        motoristaAuth,
        (current) => {
          setLoaded({});
          setLoadError("");
          setUser(current);
          setAuthReady(true);
        },
        (error) => {
          setAuthError(errorMessage(error));
          setAuthReady(true);
        },
      ),
    [],
  );
  useEffect(() => {
    if (!authorized || !user) return;
    const listen = <T,>(
      name: string,
      setter: (items: T[]) => void,
      transform: (id: string, data: Record<string, unknown>) => T,
    ) =>
      onSnapshot(
        collection(motoristaDb, "users", user.uid, name),
        (snapshot) => {
          setter(snapshot.docs.map((item) => transform(item.id, item.data())));
          setLoaded((current) => ({ ...current, [name]: true }));
        },
        (error) =>
          setLoadError(`Falha ao carregar ${name}: ${errorMessage(error)}`),
      );
    const unsubscribers = [
      listen<Day>("days", setDays, (id, data) => ({
        ...emptyDay(id),
        ...data,
        date: id,
      })),
      listen<Expense>(
        "expenses",
        setExpenses,
        (id, data) => ({ id, ...data }) as Expense,
      ),
      listen<Category>(
        "categories",
        setSavedCategories,
        (id, data) => ({ id, ...data }) as Category,
      ),
      listen<Goal>(
        "goals",
        setGoals,
        (id, data) => ({ month: id, ...data }) as Goal,
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [authorized, user]);

  async function withSave(action: () => Promise<void>, success: string) {
    setSaving(true);
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (error) {
      setNotice(`Não foi possível salvar: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }
  const path = (name: string, id: string) =>
    doc(motoristaDb, "users", user!.uid, name, id);

  async function saveDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDate(dayDate)) return setNotice("Selecione uma data válida.");
    const hours = parseDecimal(dayForm.hours);
    const km = parseDecimal(dayForm.km);
    const consumption = parseDecimal(dayForm.consumption);
    if (
      !Number.isFinite(hours) ||
      hours < 0 ||
      !Number.isSafeInteger(Math.round(hours * 60)) ||
      !Number.isFinite(km) ||
      km < 0 ||
      !Number.isFinite(consumption) ||
      consumption < 0
    )
      return setNotice("Revise os valores de horas, quilômetros e consumo.");
    await withSave(async () => {
      await setDoc(
        path("days", dayDate),
        {
          date: dayDate,
          minutes: Math.round(hours * 60),
          km,
          consumption,
        },
        { merge: true },
      );
      setDayDraft(null);
      setModal(null);
    }, "Dados do dia salvos. Indicadores atualizados.");
  }

  const gainsBounds = selectedBounds(gainsPeriod);
  const gainsPeriodValid = validBounds(gainsBounds);
  const registeredDays = [...days]
    .filter(
      (day) =>
        gainsPeriodValid &&
        day.date >= gainsBounds.from &&
        day.date <= gainsBounds.to &&
        (day.uberCents > 0 ||
          day.ninetyNineCents > 0 ||
          day.otherCents > 0 ||
          day.minutes > 0 ||
          day.km > 0 ||
          (day.consumption ?? 0) > 0),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const gainsTotal = totals(registeredDays, []).gains;
  const expensesBounds = selectedBounds(expensesPeriod);
  const expensesPeriodValid = validBounds(expensesBounds);
  const listedExpenses = expenses.filter(
    (expense) =>
      expensesPeriodValid &&
      expense.date >= expensesBounds.from &&
      expense.date <= expensesBounds.to,
  );
  const expensesTotal = listedExpenses.reduce(
    (sum, expense) => sum + expense.cents,
    0,
  );
  const expenseDays = [
    ...new Set(listedExpenses.map((expense) => expense.date)),
  ]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const items = listedExpenses.filter((expense) => expense.date === date);
      return {
        date,
        items,
        total: items.reduce((sum, expense) => sum + expense.cents, 0),
      };
    });
  function newGain(date = localDate()) {
    setGainForm({ id: "", date, source: "uber", cents: 0 });
    setGainValue("");
    setModal("gain");
    setNotice("");
  }
  function editGain(gain: Gain) {
    setGainForm(gain);
    setGainValue(moneyInput(gain.cents));
    setModal("gain");
    setNotice("");
  }
  function editDay(date: string) {
    setDayDate(date);
    setDayDraft(null);
    setModal("day");
    setNotice("");
  }
  function newExpense(date = localDate()) {
    setExpenseForm({
      id: "",
      date,
      categoryId: "combustivel",
      value: "",
      note: "",
    });
    setModal("expense");
    setNotice("");
  }
  function editExpense(expense: Expense) {
    setExpenseForm({
      id: expense.id,
      date: expense.date,
      categoryId: expense.categoryId,
      value: moneyInput(expense.cents),
      note: expense.note ?? "",
    });
    setModal("expense");
    setNotice("");
  }
  const clearLegacyGain = (source: Gain["source"]) => ({
    [`${source}Cents`]: 0,
    ...(source === "uber" ? { uberRides: 0 } : {}),
    ...(source === "ninetyNine" ? { ninetyNineRides: 0 } : {}),
  });
  async function saveGain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseCents(gainValue);
    if (!isDate(gainForm.date) || !Number.isSafeInteger(cents) || cents <= 0)
      return setNotice("Informe data e valor positivo válidos.");
    const originalDate = gainForm.id ? gainForm.id.split(":")[1] : "";
    const originalSource = gainForm.id
      ? (gainForm.id.split(":")[2] as Gain["source"])
      : null;
    await withSave(
      async () => {
        await runTransaction(motoristaDb, async (transaction) => {
          const destination = path("days", gainForm.date);
          const origin = originalDate ? path("days", originalDate) : null;
          const sameDate = originalDate === gainForm.date;
          const originSnapshot = origin ? await transaction.get(origin) : null;
          const destinationSnapshot =
            sameDate && originSnapshot
              ? originSnapshot
              : await transaction.get(destination);
          const destinationDay = {
            ...emptyDay(gainForm.date),
            ...destinationSnapshot.data(),
          };
          const key = `${gainForm.source}Cents` as const;
          const sameSlot = sameDate && originalSource === gainForm.source;
          if (destinationDay[key] > 0 && !sameSlot)
            throw new Error(
              "Já existe um ganho desta origem nessa data. Edite o registro existente.",
            );
          if (originalSource && origin) {
            const previous = clearLegacyGain(originalSource);
            if (sameSlot) {
              transaction.set(
                destination,
                { date: gainForm.date, [key]: cents },
                { merge: true },
              );
            } else if (sameDate) {
              transaction.set(
                destination,
                { date: gainForm.date, ...previous, [key]: cents },
                { merge: true },
              );
            } else {
              transaction.set(
                origin,
                { date: originalDate, ...previous },
                { merge: true },
              );
              transaction.set(
                destination,
                { date: gainForm.date, [key]: cents },
                { merge: true },
              );
            }
          } else {
            transaction.set(
              destination,
              { date: gainForm.date, [key]: cents },
              { merge: true },
            );
          }
        });
        setModal(null);
        setGainValue("");
      },
      gainForm.id ? "Ganho atualizado." : "Ganho registrado.",
    );
  }
  async function removeGain(gain: Gain) {
    if (
      !window.confirm(
        `Excluir o ganho de ${money(gain.cents)} em ${dateLabel(gain.date)}?`,
      )
    )
      return;
    await withSave(
      () =>
        setDoc(
          path("days", gain.date),
          { date: gain.date, ...clearLegacyGain(gain.source) },
          { merge: true },
        ),
      "Ganho excluído.",
    );
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseCents(expenseForm.value);
    if (
      !isDate(expenseForm.date) ||
      !categories.some((item) => item.id === expenseForm.categoryId) ||
      !Number.isSafeInteger(cents) ||
      cents <= 0 ||
      expenseForm.note.length > 500
    )
      return setNotice(
        "Informe data, categoria e valor positivo válidos. A observação pode ter até 500 caracteres.",
      );
    const id = expenseForm.id || crypto.randomUUID();
    const expense: Expense = {
      id,
      date: expenseForm.date,
      categoryId: expenseForm.categoryId,
      cents,
      note: expenseForm.note.trim(),
    };
    await withSave(
      async () => {
        const batch = writeBatch(motoristaDb);
        if (
          DEFAULT_CATEGORIES.some((item) => item.id === expense.categoryId) &&
          !savedCategories.some((item) => item.id === expense.categoryId)
        ) {
          batch.set(
            path("categories", expense.categoryId),
            DEFAULT_CATEGORIES.find((item) => item.id === expense.categoryId)!,
          );
        }
        batch.set(path("expenses", id), expense);
        await batch.commit();
        setModal(null);
      },
      expenseForm.id ? "Gasto atualizado." : "Gasto salvo.",
    );
  }
  async function removeExpense(expense: Expense) {
    if (
      !window.confirm(
        `Excluir o gasto de ${money(expense.cents)} em ${dateLabel(expense.date)}?`,
      )
    )
      return;
    await withSave(
      () => deleteDoc(path("expenses", expense.id)),
      "Gasto excluído.",
    );
  }
  async function saveCategory(id: string | null, name: string) {
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed.length > 80 ||
      categories.some(
        (category) =>
          category.name.toLocaleLowerCase("pt-BR") ===
            trimmed.toLocaleLowerCase("pt-BR") && category.id !== id,
      )
    )
      return setNotice("Informe um nome único com até 80 caracteres.");
    const nextId = id ?? crypto.randomUUID();
    await withSave(async () => {
      await setDoc(path("categories", nextId), { id: nextId, name: trimmed });
      setCategoryEdit(null);
      setNewCategory("");
    }, "Categoria salva sem alterar os gastos anteriores.");
  }
  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseCents(goalInput);
    if (!Number.isSafeInteger(cents) || cents <= 0)
      return setNotice("Informe uma meta mensal positiva válida.");
    const month = localDate().slice(0, 7);
    await withSave(async () => {
      await setDoc(path("goals", month), { month, cents });
      setGoalDraft(null);
    }, "Meta mensal salva para este mês e os seguintes.");
  }
  function downloadJson() {
    const payload: Backup = {
      version: 3,
      exportedAt: new Date().toISOString(),
      days,
      expenses,
      categories,
      goals,
    };
    fileDownload(
      JSON.stringify(payload, null, 2),
      `motorista-backup-${today}.json`,
      "application/json",
    );
  }
  async function chooseBackup(file?: File) {
    setBackup(null);
    if (!file) return;
    if (file.size > 5_000_000) return setNotice("O arquivo excede 5 MB.");
    try {
      setBackup(validateBackup(JSON.parse(await file.text())));
      setNotice("Backup validado. Confira a prévia antes de importar.");
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }
  async function importBackup() {
    if (!backup) return;
    const count =
      backup.days.length +
      backup.expenses.length +
      backup.categories.length +
      backup.goals.length;
    if (
      !window.confirm(
        `Importar ${count} itens? ${importMode === "new" ? "Itens existentes com o mesmo ID serão preservados." : "Itens existentes com o mesmo ID serão atualizados."} Nenhum item ausente do backup será apagado.`,
      )
    )
      return;
    const currentIds: Record<string, Set<string>> = {
      days: new Set(days.map((item) => item.date)),
      expenses: new Set(expenses.map((item) => item.id)),
      categories: new Set(savedCategories.map((item) => item.id)),
      goals: new Set(goals.map((item) => item.month)),
    };
    const entries = [
      ...backup.categories.map((item) => ({
        name: "categories",
        id: item.id,
        data: item,
      })),
      ...backup.days.map((item) => ({
        name: "days",
        id: item.date,
        data: item,
      })),
      ...backup.expenses.map((item) => ({
        name: "expenses",
        id: item.id,
        data: item,
      })),
      ...backup.goals.map((item) => ({
        name: "goals",
        id: item.month,
        data: item,
      })),
    ].filter(
      (item) => importMode === "update" || !currentIds[item.name].has(item.id),
    );
    await withSave(
      async () => {
        for (let offset = 0; offset < entries.length; offset += 400) {
          const batch = writeBatch(motoristaDb);
          entries
            .slice(offset, offset + 400)
            .forEach((item) => batch.set(path(item.name, item.id), item.data));
          await batch.commit();
        }
        setBackup(null);
      },
      `${entries.length} ${entries.length === 1 ? "item importado" : "itens importados"}. ${importMode === "new" ? `${count - entries.length} já existiam e foram preservados.` : "Itens com o mesmo ID foram atualizados."}`,
    );
  }

  if (!authReady)
    return (
      <main className="motorista">
        <div className="motorista-shell">
          <p>Verificando acesso…</p>
        </div>
      </main>
    );
  if (!user || !authorized)
    return (
      <main className="motorista">
        <div className="motorista-shell motorista-login">
          <div className="motorista-brand">
            <span className="motorista-brand-mark">M</span>
            <div>
              <strong>Motorista</strong>
              <small>Controle financeiro pessoal</small>
            </div>
          </div>
          <h1>Seus números, no seu ritmo.</h1>
          <p>
            Entre com a conta Google autorizada para consultar e registrar seus
            dados. É necessária conexão com a internet.
          </p>
          {user ? (
            <div className="motorista-alert">
              Esta conta não tem acesso aos dados.
              {!MOTORISTA_UID && (
                <>
                  <br />
                  Configuração pendente. UID da conta conectada:{" "}
                  <code>{user.uid}</code>
                </>
              )}
            </div>
          ) : null}
          {authError && <div className="motorista-alert">{authError}</div>}
          <button
            className="motorista-primary"
            onClick={async () => {
              try {
                setAuthError("");
                await signInWithPopup(motoristaAuth, new GoogleAuthProvider());
              } catch (error) {
                setAuthError(errorMessage(error));
              }
            }}
          >
            {user ? "Trocar de conta Google" : "Entrar com Google"}
          </button>
          {user && (
            <button
              className="motorista-text-button"
              onClick={() => signOut(motoristaAuth)}
            >
              Sair
            </button>
          )}
        </div>
      </main>
    );

  return (
    <main className="motorista">
      <div className="motorista-shell">
        <header className="motorista-header">
          <div className="motorista-brand">
            <span className="motorista-brand-mark">M</span>
            <div>
              <strong>Motorista</strong>
              <small>Controle financeiro pessoal</small>
            </div>
          </div>
          <div className="motorista-account">
            <span>{user.displayName || user.email}</span>
            <button onClick={() => signOut(motoristaAuth)}>Sair</button>
          </div>
        </header>
        <nav className="motorista-tabs" aria-label="Seções do controle">
          {(
            [
              ["resumo", "Resumo"],
              ["ganhos", "Ganhos"],
              ["gastos", "Gastos"],
              ["definicoes", "Definições"],
              ["backup", "Backup"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "true" : undefined}
              onClick={() => {
                setTab(id);
                setNotice("");
                window.scrollTo({ top: 0, behavior: "auto" });
              }}
            >
              <TabIcon tab={id} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {notice && (
          <div
            role="status"
            className={`motorista-alert ${notice.startsWith("Não") || notice.startsWith("Revise") || notice.startsWith("Informe") || notice.startsWith("Há") ? "error" : "success"}`}
          >
            {notice}
          </div>
        )}
        {loadError && (
          <div role="alert" className="motorista-alert error">
            {loadError}
          </div>
        )}
        {!allLoaded && !loadError ? (
          <p className="motorista-loading">Carregando registros…</p>
        ) : null}
        {allLoaded && (
          <>
            {tab === "resumo" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Painel</p>
                    <h1>Resultado do período</h1>
                    <p className="motorista-muted">
                      Saldo = ganhos registrados − gastos registrados. Custos
                      ainda não lançados ficam fora do cálculo.
                    </p>
                  </div>
                  <div className="motorista-actions motorista-quick-actions">
                    <button
                      className="motorista-primary"
                      onClick={() => {
                        newGain();
                        setTab("ganhos");
                      }}
                    >
                      Registrar ganho
                    </button>
                    <button
                      className="motorista-secondary"
                      onClick={() => {
                        newExpense();
                        setTab("gastos");
                      }}
                    >
                      Registrar gasto
                    </button>
                  </div>
                </div>
                <PeriodFilter
                  selection={summaryPeriod}
                  onChange={setSummaryPeriod}
                />
                <div className="motorista-overview">
                  <div className="motorista-card motorista-overview-card">
                    <span>Meta</span>
                    <div className="motorista-goal-value">
                      <strong
                        className={
                          expected === null
                            ? ""
                            : summary.balance >= expected
                              ? "met"
                              : "behind"
                        }
                      >
                        {money(summary.balance)}
                      </strong>
                      <span>/ {expected === null ? "—" : money(expected)}</span>
                    </div>
                    {periodValid && expected === null && (
                      <small>Defina a meta de cada mês deste período.</small>
                    )}
                  </div>
                  <Metric label="Saldo" value={money(summary.balance)} />
                  <Metric
                    label="Falta"
                    value={missing === null ? "—" : money(missing)}
                  />
                  <div className="motorista-card motorista-overview-card">
                    <span>% da meta do mês</span>
                    <strong>
                      {monthlyPercent === null
                        ? "—"
                        : `${decimal(monthlyPercent, 1)}%`}
                    </strong>
                    {monthlyPercent !== null && (
                      <div
                        className="motorista-progress"
                        role="progressbar"
                        aria-label="Progresso da meta mensal"
                        aria-valuenow={Math.max(
                          0,
                          Math.min(100, Math.round(monthlyPercent)),
                        )}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(100, monthlyPercent))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="motorista-card">
                  <h2>Origem de ganhos</h2>
                  <div className="motorista-origin-list">
                    {[
                      { label: "Uber", cents: summary.uber, kind: "uber" },
                      {
                        label: "99",
                        cents: summary.ninetyNine,
                        kind: "ninety-nine",
                      },
                      { label: "Outros", cents: summary.other, kind: "other" },
                    ].map((origin) => {
                      const percent =
                        summary.gains > 0
                          ? (origin.cents / summary.gains) * 100
                          : 0;
                      return (
                        <div className="motorista-origin" key={origin.label}>
                          <div className="motorista-origin-label">
                            <strong>{origin.label}</strong>
                            <span>
                              {money(origin.cents)} ({decimal(percent, 1)}%)
                            </span>
                          </div>
                          <div
                            className="motorista-origin-track"
                            role="progressbar"
                            aria-label={`Participação de ${origin.label} nos ganhos`}
                            aria-valuenow={Math.round(percent)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span
                              className={origin.kind}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="motorista-card">
                  <h2>Origem dos gastos</h2>
                  {expenseByCategory.length === 0 ? (
                    <p className="motorista-muted">
                      {periodValid
                        ? "Nenhum gasto neste período."
                        : "Selecione um período válido."}
                    </p>
                  ) : (
                    <div className="motorista-origin-list">
                      {expenseByCategory.map((category) => {
                        const percent =
                          summary.costs > 0
                            ? (category.cents / summary.costs) * 100
                            : 0;
                        return (
                          <div className="motorista-origin" key={category.id}>
                            <div className="motorista-origin-label">
                              <strong>{category.name}</strong>
                              <span>
                                {money(category.cents)} ({decimal(percent, 1)}%)
                              </span>
                            </div>
                            <div
                              className="motorista-origin-track"
                              role="progressbar"
                              aria-label={`Participação de ${category.name} nos gastos`}
                              aria-valuenow={Math.round(percent)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span
                                className="expense"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="motorista-card">
                  <h2>Estatísticas</h2>
                  <div className="motorista-stats">
                    <Metric
                      label="Horas trabalhadas"
                      value={`${decimal(summary.minutes / 60, 1)} h`}
                    />
                    <Metric
                      label="Ganho por hora (média)"
                      value={ratio(summary.gains * 60, summary.minutes)}
                    />
                    <Metric
                      label="KM rodados"
                      value={`${decimal(summary.km, 1)} km`}
                    />
                    <Metric
                      label="Ganho por KM (média)"
                      value={ratio(summary.gains, summary.km)}
                    />
                    <Metric
                      label="Consumo médio"
                      value={
                        summary.consumption === null
                          ? "—"
                          : `${decimal(summary.consumption, 2)} km/L`
                      }
                    />
                  </div>
                </div>
              </section>
            )}

            {tab === "ganhos" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Entradas</p>
                    <h1>Ganhos</h1>
                    <p className="motorista-muted">
                      Ganhos e dados de trabalho organizados por dia.
                    </p>
                  </div>
                  <div className="motorista-actions motorista-quick-actions">
                    <button
                      className="motorista-primary"
                      onClick={() => newGain()}
                    >
                      Registrar ganho
                    </button>
                    <button
                      className="motorista-secondary"
                      onClick={() => editDay(localDate())}
                    >
                      Registrar dados do dia
                    </button>
                  </div>
                </div>
                <div className="motorista-list-controls">
                  <div className="motorista-card motorista-period-total">
                    <span>Total de ganhos no período</span>
                    <strong>{gainsPeriodValid ? money(gainsTotal) : "—"}</strong>
                  </div>
                  <PeriodFilter
                    selection={gainsPeriod}
                    onChange={setGainsPeriod}
                  />
                </div>
                {registeredDays.length === 0 ? (
                  <div className="motorista-card">
                    <p className="motorista-muted">
                      {gainsPeriodValid
                        ? "Nenhum ganho ou dado de dia neste período."
                        : "Selecione um período válido."}
                    </p>
                  </div>
                ) : (
                  registeredDays.map((day) => (
                    <div
                      className="motorista-card motorista-day-group"
                      key={day.date}
                    >
                      <div className="motorista-day-heading">
                        <div className="motorista-day-heading-info">
                          <h2>{dateLabel(day.date)}</h2>
                          <span>
                            Total do dia:{" "}
                            <strong>
                              {money(
                                day.uberCents +
                                  day.ninetyNineCents +
                                  day.otherCents,
                              )}
                            </strong>
                          </span>
                        </div>
                        <button
                          className="motorista-secondary"
                          onClick={() => newGain(day.date)}
                        >
                          Registrar ganho
                        </button>
                      </div>
                      {legacyGains([day]).map((gain) => (
                        <div className="motorista-day-row" key={gain.id}>
                          <span className="motorista-day-value">
                            <strong>
                              {gain.source === "ninetyNine"
                                ? "99"
                                : gain.source === "uber"
                                  ? "Uber"
                                  : "Outros"}
                            </strong>
                            <span>{money(gain.cents)}</span>
                          </span>
                          <div className="motorista-actions motorista-icon-actions">
                            <button
                              className="motorista-icon-button"
                              type="button"
                              aria-label={
                                "Editar ganho de " +
                                (gain.source === "ninetyNine"
                                  ? "99"
                                  : gain.source === "uber"
                                    ? "Uber"
                                    : "Outros") +
                                " de " +
                                dateLabel(day.date)
                              }
                              title="Editar ganho"
                              onClick={() => editGain(gain)}
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="motorista-icon-button motorista-danger"
                              type="button"
                              aria-label={
                                "Excluir ganho de " +
                                (gain.source === "ninetyNine"
                                  ? "99"
                                  : gain.source === "uber"
                                    ? "Uber"
                                    : "Outros") +
                                " de " +
                                dateLabel(day.date)
                              }
                              title="Excluir ganho"
                              onClick={() => removeGain(gain)}
                              disabled={saving}
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="motorista-day-row motorista-day-stats">
                        <div>
                          <strong>Dados do dia</strong>
                          <span>
                            Horas trabalhadas:{" "}
                            {day.minutes
                              ? decimal(day.minutes / 60, 2) + " h"
                              : "—"}
                          </span>
                          <span>
                            KM rodados:{" "}
                            {day.km ? decimal(day.km, 1) + " km" : "—"}
                          </span>
                          <span>
                            Consumo:{" "}
                            {day.consumption
                              ? decimal(day.consumption, 2) + " km/L"
                              : "—"}
                          </span>
                        </div>
                        <button
                          className="motorista-icon-button"
                          type="button"
                          aria-label={
                            "Editar dados do dia " + dateLabel(day.date)
                          }
                          title="Editar dados do dia"
                          onClick={() => editDay(day.date)}
                        >
                          <EditIcon />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </section>
            )}
            {tab === "gastos" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Despesas</p>
                    <h1>Gastos</h1>
                    <p className="motorista-muted">
                      Gastos organizados por dia, inclusive sem jornada
                      registrada.
                    </p>
                  </div>
                  <div className="motorista-actions motorista-quick-actions motorista-single-action">
                    <button
                      className="motorista-primary"
                      onClick={() => newExpense()}
                    >
                      Registrar gasto
                    </button>
                  </div>
                </div>
                <div className="motorista-list-controls">
                  <div className="motorista-card motorista-period-total">
                    <span>Total de gastos no período</span>
                    <strong>
                      {expensesPeriodValid ? money(expensesTotal) : "—"}
                    </strong>
                  </div>
                  <PeriodFilter
                    selection={expensesPeriod}
                    onChange={setExpensesPeriod}
                  />
                </div>
                {expenseDays.length === 0 ? (
                  <div className="motorista-card">
                    <p className="motorista-muted">
                      {expensesPeriodValid
                        ? "Nenhum gasto neste período."
                        : "Selecione um período válido."}
                    </p>
                  </div>
                ) : (
                  expenseDays.map(({ date, items, total }) => (
                    <div
                      className="motorista-card motorista-day-group"
                      key={date}
                    >
                      <div className="motorista-day-heading">
                        <div className="motorista-day-heading-info">
                          <h2>{dateLabel(date)}</h2>
                          <span>
                            Total do dia: <strong>{money(total)}</strong>
                          </span>
                        </div>
                        <button
                          className="motorista-secondary"
                          onClick={() => newExpense(date)}
                        >
                          Registrar gasto
                        </button>
                      </div>
                      {items.map((item) => {
                        const category =
                          categories.find(
                            (entry) => entry.id === item.categoryId,
                          )?.name ?? item.categoryId;
                        return (
                          <div
                            className="motorista-day-row motorista-expense-day-row"
                            key={item.id}
                          >
                            <div className="motorista-expense-details">
                              <strong>{category}</strong>
                              {item.note && <small>{item.note}</small>}
                            </div>
                            <strong>{money(item.cents)}</strong>
                            <div className="motorista-actions motorista-icon-actions">
                              <button
                                className="motorista-icon-button"
                                type="button"
                                aria-label={`Editar gasto de ${category} de ${dateLabel(date)}`}
                                title="Editar gasto"
                                onClick={() => editExpense(item)}
                              >
                                <EditIcon />
                              </button>
                              <button
                                className="motorista-icon-button motorista-danger"
                                type="button"
                                aria-label={`Excluir gasto de ${category} de ${dateLabel(date)}`}
                                title="Excluir gasto"
                                onClick={() => removeExpense(item)}
                                disabled={saving}
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </section>
            )}

            {tab === "definicoes" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Preferências</p>
                    <h1>Definições</h1>
                    <p className="motorista-muted">
                      Defina a meta mensal de saldo e organize as categorias dos
                      gastos.
                    </p>
                  </div>
                </div>
                <div className="motorista-grid motorista-settings-grid">
                  <form
                    className="motorista-card motorista-form"
                    onSubmit={saveGoal}
                  >
                    <h2>Qual sua meta mensal?</h2>
                    <label>
                      Meta mensal de saldo (R$)
                      <MoneyInput
                        value={goalInput}
                        onChange={setGoalDraft}
                        required
                      />
                      <small>
                        Vale deste mês em diante, até você alterar o valor.
                      </small>
                    </label>
                    <button className="motorista-primary" disabled={saving}>
                      {saving ? "Salvando…" : "Salvar meta"}
                    </button>
                  </form>
                  <div className="motorista-card">
                    <h2>Categorias</h2>
                    <p className="motorista-muted">
                      Renomear mantém a identificação dos gastos antigos.
                    </p>
                    <div className="motorista-category-list">
                      {categories.map((item) => (
                        <div key={item.id} className="motorista-category-row">
                          {categoryEdit === item.id ? (
                            <>
                              <input
                                aria-label={`Nome da categoria ${item.name}`}
                                value={categoryName}
                                onChange={(event) =>
                                  setCategoryName(event.target.value)
                                }
                                maxLength={80}
                              />
                              <button
                                onClick={() =>
                                  saveCategory(item.id, categoryName)
                                }
                                disabled={saving}
                              >
                                Salvar
                              </button>
                              <button onClick={() => setCategoryEdit(null)}>
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <span>{item.name}</span>
                              <button
                                className="motorista-icon-button"
                                aria-label={`Editar categoria ${item.name}`}
                                title="Editar categoria"
                                onClick={() => {
                                  setCategoryEdit(item.id);
                                  setCategoryName(item.name);
                                }}
                              >
                                <EditIcon />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="motorista-actions">
                      <input
                        aria-label="Nova categoria"
                        placeholder="Nova categoria"
                        value={newCategory}
                        onChange={(event) => setNewCategory(event.target.value)}
                        maxLength={80}
                      />
                      <button
                        className="motorista-secondary"
                        onClick={() => saveCategory(null, newCategory)}
                        disabled={saving}
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "backup" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Portabilidade</p>
                    <h1>Backup e exportação</h1>
                    <p className="motorista-muted">
                      Guarde uma cópia dos registros, categorias e metas. A
                      importação usa identificadores estáveis para evitar
                      duplicações.
                    </p>
                  </div>
                </div>
                <div className="motorista-grid">
                  <div className="motorista-card">
                    <h2>Exportar</h2>
                    <p className="motorista-muted">
                      JSON para restauração completa ou CSV para análise em
                      planilha.
                    </p>
                    <div className="motorista-actions">
                      <button
                        className="motorista-primary"
                        onClick={downloadJson}
                      >
                        Baixar JSON
                      </button>
                      <button
                        className="motorista-secondary"
                        onClick={() =>
                          fileDownload(
                            exportCsv(days, expenses, categories),
                            `motorista-lancamentos-${today}.csv`,
                            "text/csv;charset=utf-8",
                          )
                        }
                      >
                        Baixar CSV
                      </button>
                    </div>
                  </div>
                  <div className="motorista-card motorista-form">
                    <h2>Importar JSON</h2>
                    <label>
                      Selecione um backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) =>
                          chooseBackup(event.target.files?.[0])
                        }
                      />
                    </label>
                    {backup && (
                      <>
                        <p>
                          Prévia: <strong>{backup.days.length}</strong> dados de
                          dia,{" "}
                          <strong>{legacyGains(backup.days).length}</strong>{" "}
                          ganhos, <strong>{backup.expenses.length}</strong>{" "}
                          gastos, <strong>{backup.categories.length}</strong>{" "}
                          categorias e <strong>{backup.goals.length}</strong>{" "}
                          metas.
                        </p>
                        <p className="motorista-muted">
                          Data da cópia:{" "}
                          {new Date(backup.exportedAt).toLocaleString("pt-BR")}.
                          Coincidências por ID:{" "}
                          {
                            backup.days.filter((item) =>
                              days.some(
                                (current) => current.date === item.date,
                              ),
                            ).length
                          }{" "}
                          dados de dia,{" "}
                          {
                            backup.expenses.filter((item) =>
                              expenses.some(
                                (current) => current.id === item.id,
                              ),
                            ).length
                          }{" "}
                          gastos,{" "}
                          {
                            backup.categories.filter((item) =>
                              savedCategories.some(
                                (current) => current.id === item.id,
                              ),
                            ).length
                          }{" "}
                          categorias e{" "}
                          {
                            backup.goals.filter((item) =>
                              goals.some(
                                (current) => current.month === item.month,
                              ),
                            ).length
                          }{" "}
                          metas.
                        </p>
                        <label>
                          Como tratar itens já existentes
                          <select
                            value={importMode}
                            onChange={(event) =>
                              setImportMode(
                                event.target.value as "new" | "update",
                              )
                            }
                          >
                            <option value="new">
                              Preservar existentes (importar só novos)
                            </option>
                            <option value="update">
                              Atualizar itens com o mesmo ID
                            </option>
                          </select>
                        </label>
                        <button
                          className="motorista-primary"
                          onClick={importBackup}
                          disabled={saving}
                        >
                          {saving ? "Importando…" : "Confirmar importação"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
        {modal && (
          <dialog
            ref={modalRef}
            className="motorista-dialog"
            aria-labelledby="motorista-dialog-title"
            onCancel={() => setModal(null)}
          >
            <div className="motorista-dialog-header">
              <h2 id="motorista-dialog-title">
                {modal === "gain"
                  ? gainForm.id
                    ? "Editar ganho"
                    : "Registrar ganho"
                  : modal === "expense"
                    ? expenseForm.id
                      ? "Editar gasto"
                      : "Registrar gasto"
                  : days.some((day) => day.date === dayDate)
                    ? "Editar dados do dia"
                    : "Registrar dados do dia"}
              </h2>
              <button
                type="button"
                className="motorista-icon-button"
                aria-label="Fechar"
                onClick={() => setModal(null)}
              >
                ×
              </button>
            </div>
            {notice &&
              (notice.startsWith("Não") ||
                notice.startsWith("Revise") ||
                notice.startsWith("Informe")) && (
                <p role="alert" className="motorista-alert error">
                  {notice}
                </p>
              )}
            {modal === "gain" ? (
              <form className="motorista-form" onSubmit={saveGain}>
                <label>
                  Data
                  <PickerInput
                    type="date"
                    value={gainForm.date}
                    required
                    onChange={(event) =>
                      setGainForm({ ...gainForm, date: event.target.value })
                    }
                  />
                </label>
                <label>
                  Origem
                  <select
                    value={gainForm.source}
                    onChange={(event) =>
                      setGainForm({
                        ...gainForm,
                        source: event.target.value as Gain["source"],
                      })
                    }
                  >
                    <option value="uber">Uber</option>
                    <option value="ninetyNine">99</option>
                    <option value="other">Outros</option>
                  </select>
                </label>
                <label>
                  Valor (R$)
                  <MoneyInput
                    value={gainValue}
                    onChange={setGainValue}
                    required
                  />
                </label>
                <div className="motorista-actions motorista-dialog-actions">
                  <button
                    type="button"
                    className="motorista-secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button className="motorista-primary" disabled={saving}>
                    {saving ? "Salvando…" : "Salvar ganho"}
                  </button>
                </div>
              </form>
            ) : modal === "expense" ? (
              <form className="motorista-form" onSubmit={saveExpense}>
                <label>
                  Data
                  <PickerInput
                    type="date"
                    value={expenseForm.date}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, date: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Categoria
                  <select
                    value={expenseForm.categoryId}
                    onChange={(event) =>
                      setExpenseForm({
                        ...expenseForm,
                        categoryId: event.target.value,
                      })
                    }
                  >
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Valor (R$)
                  <MoneyInput
                    value={expenseForm.value}
                    onChange={(value) => setExpenseForm({ ...expenseForm, value })}
                    required
                  />
                </label>
                <label>
                  Observação (opcional)
                  <textarea
                    maxLength={500}
                    value={expenseForm.note}
                    onChange={(event) =>
                      setExpenseForm({ ...expenseForm, note: event.target.value })
                    }
                    rows={3}
                  />
                </label>
                <div className="motorista-actions motorista-dialog-actions">
                  <button
                    type="button"
                    className="motorista-secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button className="motorista-primary" disabled={saving}>
                    {saving ? "Salvando…" : "Salvar gasto"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="motorista-form" onSubmit={saveDay}>
                <label>
                  Data
                  <PickerInput
                    type="date"
                    value={dayDate}
                    onChange={(event) => setDayDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Horas trabalhadas
                  <input
                    inputMode="decimal"
                    placeholder="Ex.: 8,5"
                    value={dayForm.hours}
                    onChange={(event) =>
                      setDayForm({ ...dayForm, hours: event.target.value })
                    }
                  />
                </label>
                <label>
                  KM rodados
                  <input
                    inputMode="decimal"
                    placeholder="Ex.: 145,5"
                    value={dayForm.km}
                    onChange={(event) =>
                      setDayForm({ ...dayForm, km: event.target.value })
                    }
                  />
                </label>
                <label>
                  Consumo (km/L)
                  <input
                    inputMode="decimal"
                    placeholder="Ex.: 12,5"
                    value={dayForm.consumption}
                    onChange={(event) =>
                      setDayForm({
                        ...dayForm,
                        consumption: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="motorista-actions motorista-dialog-actions">
                  <button
                    type="button"
                    className="motorista-secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button className="motorista-primary" disabled={saving}>
                    {saving ? "Salvando…" : "Salvar dados do dia"}
                  </button>
                </div>
              </form>
            )}
          </dialog>
        )}
      </div>
    </main>
  );
}

function MoneyInput({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      className="motorista-money-input"
      inputMode="numeric"
      autoComplete="off"
      placeholder="R$ 0,00"
      value={value}
      onChange={(event) => onChange(maskMoney(event.target.value))}
      onFocus={(event) => event.target.select()}
      onPaste={(event) => {
        event.preventDefault();
        const cents = parseCents(event.clipboardData.getData("text"));
        if (Number.isSafeInteger(cents) && cents >= 0)
          onChange(cents ? money(cents) : "");
      }}
      required={required}
    />
  );
}

function PeriodFilter({
  selection,
  onChange,
}: {
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}) {
  const bounds = selectedBounds(selection);
  const weekLabel = validBounds(bounds)
    ? `${dateLabel(bounds.from)} a ${dateLabel(bounds.to)}`
    : "Selecione uma semana";
  const update = (change: Partial<PeriodSelection>) =>
    onChange({ ...selection, ...change });

  return (
    <div
      className={`motorista-card motorista-filters ${selection.filter === "custom" ? "is-custom" : ""}`}
    >
      <label>
        Período
        <select
          value={selection.filter}
          onChange={(event) => update({ filter: event.target.value as Filter })}
        >
          <option value="day">Dia</option>
          <option value="week">Semana</option>
          <option value="month">Mês</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      {selection.filter === "custom" ? (
        <>
          <label>
            De
            <PickerInput
              type="date"
              value={selection.from}
              onChange={(event) => update({ from: event.target.value })}
            />
          </label>
          <label>
            Até
            <PickerInput
              type="date"
              value={selection.to}
              onChange={(event) => update({ to: event.target.value })}
            />
          </label>
        </>
      ) : selection.filter === "day" ? (
        <label>
          Dia
          <PickerInput
            type="date"
            value={selection.anchor}
            onChange={(event) => update({ anchor: event.target.value })}
          />
        </label>
      ) : selection.filter === "week" ? (
        <label>
          Semana
          <PickerInput
            type="week"
            value={selection.week}
            displayValue={weekLabel}
            aria-label={`Semana: ${weekLabel}`}
            onChange={(event) => update({ week: event.target.value })}
          />
        </label>
      ) : (
        <label>
          Mês
          <PickerInput
            type="month"
            value={selection.month}
            onChange={(event) => update({ month: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}

function PickerInput({
  type,
  displayValue,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type: "date" | "week" | "month";
  displayValue?: string;
}) {
  const openPicker = (event: MouseEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker();
    } catch {
      event.currentTarget.focus();
    }
  };

  return (
    <span className={`motorista-picker${displayValue ? " is-formatted" : ""}`}>
      <input {...props} type={type} onClick={openPicker} />
      {displayValue && (
        <span className="motorista-picker-value" aria-hidden="true">
          {displayValue}
        </span>
      )}
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </svg>
    </span>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const paths: Record<Tab, React.ReactNode> = {
    resumo: <><path d="M3 11.5 12 4l9 7.5V20H3v-8.5Z" /><path d="M8 20v-6h8v6" /></>,
    ganhos: <><path d="M3 17.5 9 11l4 4 8-8" /><path d="M16 7h5v5" /></>,
    gastos: <><path d="M3 7h18v12H3z" /><path d="M3 10h18M16 15h2" /></>,
    definicoes: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
    backup: <><path d="M5 14a7 7 0 1 0 1-6" /><path d="M5 4v4h4M12 8v5l3 2" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[tab]}
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="motorista-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7" />
    </svg>
  );
}
