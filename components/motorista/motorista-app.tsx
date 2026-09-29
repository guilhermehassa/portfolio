"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  exportCsv,
  goalPlan,
  isDate,
  localDate,
  money,
  moneyInput,
  parseCents,
  parseDecimal,
  periodBounds,
  totals,
  validateBackup,
  type Backup,
  type Category,
  type Day,
  type Expense,
  type Goal,
} from "@/lib/motorista";
import "./motorista.css";

type Tab = "resumo" | "dia" | "gastos" | "meta" | "backup";
type Filter = "day" | "week" | "month" | "custom";
const today = localDate();
const emptyDay = (date: string): Day => ({
  date,
  uberCents: 0,
  uberRides: 0,
  ninetyNineCents: 0,
  ninetyNineRides: 0,
  otherCents: 0,
  minutes: 0,
  km: 0,
});
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
  const [filter, setFilter] = useState<Filter>("month");
  const [anchor, setAnchor] = useState(today);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [dayDate, setDayDate] = useState(today);
  const [dayDraft, setDayDraft] = useState<{
    key: string;
    fields: {
      uber: string;
      uberRides: string;
      ninetyNine: string;
      ninetyNineRides: string;
      other: string;
      hours: string;
      km: string;
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
  const [goalMonth, setGoalMonth] = useState(today.slice(0, 7));
  const [goalDraft, setGoalDraft] = useState<{
    month: string;
    value: string;
  } | null>(null);
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
  const bounds = periodBounds(filter, anchor, from, to);
  const periodValid =
    isDate(bounds.from) && isDate(bounds.to) && bounds.from <= bounds.to;
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
  const goal = goals.find((item) => item.month === goalMonth)?.cents ?? 0;
  const selectedDay =
    days.find((item) => item.date === dayDate) ?? emptyDay(dayDate);
  const dayForm =
    dayDraft?.key === dayDate
      ? dayDraft.fields
      : {
          uber: moneyInput(selectedDay.uberCents),
          uberRides: selectedDay.uberRides ? String(selectedDay.uberRides) : "",
          ninetyNine: moneyInput(selectedDay.ninetyNineCents),
          ninetyNineRides: selectedDay.ninetyNineRides
            ? String(selectedDay.ninetyNineRides)
            : "",
          other: moneyInput(selectedDay.otherCents),
          hours: selectedDay.minutes
            ? (selectedDay.minutes / 60).toFixed(2).replace(".", ",")
            : "",
          km: selectedDay.km ? String(selectedDay.km).replace(".", ",") : "",
        };
  const setDayForm = (fields: typeof dayForm) =>
    setDayDraft({ key: dayDate, fields });
  const goalInput =
    goalDraft?.month === goalMonth ? goalDraft.value : moneyInput(goal);
  const setGoalInput = (value: string) =>
    setGoalDraft({ month: goalMonth, value });
  const monthTotals = totals(
    days.filter((day) => day.date.startsWith(goalMonth)),
    expenses.filter((expense) => expense.date.startsWith(goalMonth)),
  );
  const plan = goalPlan(goalMonth, goal, monthTotals.balance);
  const expenseByCategory = categories
    .map((category) => ({
      ...category,
      cents: shownExpenses
        .filter((expense) => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + expense.cents, 0),
    }))
    .filter((item) => item.cents > 0);
  const dailyEvolution = useMemo(() => {
    if (!periodValid) return [];
    const result: {
      date: string;
      gains: number;
      costs: number;
      balance: number;
    }[] = [];
    const cursor = civilDate(bounds.from);
    const end = civilDate(bounds.to);
    // Um intervalo civil amplo continua completo; a lista tem rolagem própria.
    while (cursor <= end && result.length < 3660) {
      const date = localDate(cursor);
      const dayTotals = totals(
        days.filter((day) => day.date === date),
        expenses.filter((expense) => expense.date === date),
      );
      result.push({
        date,
        gains: dayTotals.gains,
        costs: dayTotals.costs,
        balance: dayTotals.balance,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [bounds.from, bounds.to, periodValid, days, expenses]);

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
    const cents = [dayForm.uber, dayForm.ninetyNine, dayForm.other].map(
      parseCents,
    );
    const rides = [dayForm.uberRides, dayForm.ninetyNineRides].map((value) =>
      value.trim() ? Number(value) : 0,
    );
    const hours = parseDecimal(dayForm.hours);
    const km = parseDecimal(dayForm.km);
    if (
      cents.some((value) => !Number.isSafeInteger(value)) ||
      rides.some((value) => !Number.isSafeInteger(value) || value < 0) ||
      !Number.isFinite(hours) ||
      hours < 0 ||
      !Number.isSafeInteger(Math.round(hours * 60)) ||
      !Number.isFinite(km) ||
      km < 0
    )
      return setNotice(
        "Revise os valores: dinheiro com até 2 casas, corridas inteiras e horas/quilômetros positivos.",
      );
    const day: Day = {
      date: dayDate,
      uberCents: cents[0],
      uberRides: rides[0],
      ninetyNineCents: cents[1],
      ninetyNineRides: rides[1],
      otherCents: cents[2],
      minutes: Math.round(hours * 60),
      km,
    };
    await withSave(async () => {
      await setDoc(path("days", dayDate), day);
      setDayDraft(null);
    }, "Dia salvo. Indicadores atualizados.");
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
        setExpenseForm({
          id: "",
          date: expense.date,
          categoryId: expense.categoryId,
          value: "",
          note: "",
        });
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
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(goalMonth) ||
      !Number.isSafeInteger(cents) ||
      cents <= 0
    )
      return setNotice("Informe mês e meta mensal positiva válidos.");
    await withSave(async () => {
      await setDoc(path("goals", goalMonth), { month: goalMonth, cents });
      setGoalDraft(null);
    }, "Meta mensal salva.");
  }
  function downloadJson() {
    const payload: Backup = {
      version: 1,
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
              ["dia", "Dia"],
              ["gastos", "Gastos"],
              ["meta", "Meta"],
              ["backup", "Backup"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setNotice("");
              }}
            >
              {label}
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
                  <button
                    className="motorista-primary"
                    onClick={() => {
                      setDayDate(today);
                      setTab("dia");
                    }}
                  >
                    Registrar dia
                  </button>
                </div>
                <div className="motorista-card motorista-filters">
                  <label>
                    Período
                    <select
                      value={filter}
                      onChange={(event) =>
                        setFilter(event.target.value as Filter)
                      }
                    >
                      <option value="day">Dia</option>
                      <option value="week">Semana</option>
                      <option value="month">Mês</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </label>
                  {filter === "custom" ? (
                    <>
                      <label>
                        De
                        <input
                          type="date"
                          value={from}
                          onChange={(event) => setFrom(event.target.value)}
                        />
                      </label>
                      <label>
                        Até
                        <input
                          type="date"
                          value={to}
                          onChange={(event) => setTo(event.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      Data de referência
                      <input
                        type="date"
                        value={anchor}
                        onChange={(event) => setAnchor(event.target.value)}
                      />
                    </label>
                  )}
                  <span className="motorista-period">
                    {periodValid
                      ? `${dateLabel(bounds.from)} a ${dateLabel(bounds.to)}`
                      : "Intervalo inválido"}
                  </span>
                </div>
                <div className="motorista-stats">
                  <Metric
                    label="Ganhos"
                    value={money(summary.gains)}
                    emphasis="positive"
                  />
                  <Metric label="Gastos" value={money(summary.costs)} />
                  <Metric
                    label="Saldo registrado"
                    value={money(summary.balance)}
                    emphasis={summary.balance < 0 ? "negative" : "positive"}
                  />
                  <Metric label="Corridas" value={String(summary.rides)} />
                </div>
                <div className="motorista-grid">
                  <div className="motorista-card">
                    <h2>Ganhos por origem</h2>
                    <DataRow
                      label="Uber"
                      value={money(summary.uber)}
                      detail={`${summary.uberRides} corridas · média ${ratio(summary.uber, summary.uberRides)}`}
                    />
                    <DataRow
                      label="99"
                      value={money(summary.ninetyNine)}
                      detail={`${summary.ninetyNineRides} corridas · média ${ratio(summary.ninetyNine, summary.ninetyNineRides)}`}
                    />
                    <DataRow label="Outros" value={money(summary.other)} />
                    <DataRow
                      label="Média por corrida (Uber + 99)"
                      value={ratio(
                        summary.uber + summary.ninetyNine,
                        summary.rides,
                      )}
                    />
                  </div>
                  <div className="motorista-card">
                    <h2>Jornada e rendimento</h2>
                    <DataRow
                      label="Horas trabalhadas"
                      value={`${decimal(summary.minutes / 60, 1)} h`}
                    />
                    <DataRow
                      label="Quilômetros rodados"
                      value={`${decimal(summary.km, 1)} km`}
                    />
                    <DataRow
                      label="Ganho por hora"
                      value={ratio(summary.gains * 60, summary.minutes)}
                    />
                    <DataRow
                      label="Saldo por hora"
                      value={ratio(summary.balance * 60, summary.minutes)}
                    />
                    <DataRow
                      label="Ganho por km"
                      value={ratio(summary.gains, summary.km)}
                    />
                    <DataRow
                      label="Saldo por km"
                      value={ratio(summary.balance, summary.km)}
                    />
                    <DataRow
                      label="Gasto por km"
                      value={ratio(summary.costs, summary.km)}
                    />
                  </div>
                </div>
                <div className="motorista-grid">
                  <div className="motorista-card">
                    <h2>Gastos por categoria</h2>
                    {expenseByCategory.length ? (
                      expenseByCategory
                        .sort((a, b) => b.cents - a.cents)
                        .map((item) => (
                          <DataRow
                            key={item.id}
                            label={item.name}
                            value={money(item.cents)}
                          />
                        ))
                    ) : (
                      <p className="motorista-muted">
                        Nenhum gasto no período.
                      </p>
                    )}
                  </div>
                  <div className="motorista-card">
                    <h2>Evolução diária</h2>
                    <p className="motorista-muted">
                      Ganhos, gastos e saldo de cada data.
                    </p>
                    <div className="motorista-evolution">
                      {dailyEvolution.map((item) => (
                        <div
                          className="motorista-evolution-row"
                          key={item.date}
                        >
                          <time>{dateLabel(item.date)}</time>
                          <div>
                            <span className="gain">+ {money(item.gains)}</span>
                            <span className="cost">− {money(item.costs)}</span>
                            <strong
                              className={item.balance < 0 ? "negative" : ""}
                            >
                              {money(item.balance)}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                    {dailyEvolution.length >= 3660 && (
                      <p className="motorista-muted">
                        Intervalo limitado a 3.660 dias. Reduza o filtro para
                        ver o restante.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {tab === "dia" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Registro diário</p>
                    <h1>Como foi o dia?</h1>
                    <p className="motorista-muted">
                      Selecione uma data passada para corrigir seus lançamentos.
                      Valores de Uber e 99 são os totais exibidos nos
                      aplicativos.
                    </p>
                  </div>
                </div>
                <form
                  className="motorista-card motorista-form"
                  onSubmit={saveDay}
                >
                  <label>
                    Data
                    <input
                      type="date"
                      value={dayDate}
                      onChange={(event) => setDayDate(event.target.value)}
                      required
                    />
                  </label>
                  <div className="motorista-form-grid">
                    <fieldset>
                      <legend>Uber</legend>
                      <label>
                        Ganhos (R$)
                        <input
                          inputMode="decimal"
                          placeholder="0,00"
                          value={dayForm.uber}
                          onChange={(event) =>
                            setDayForm({ ...dayForm, uber: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Corridas
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={dayForm.uberRides}
                          onChange={(event) =>
                            setDayForm({
                              ...dayForm,
                              uberRides: event.target.value,
                            })
                          }
                        />
                      </label>
                    </fieldset>
                    <fieldset>
                      <legend>99</legend>
                      <label>
                        Ganhos (R$)
                        <input
                          inputMode="decimal"
                          placeholder="0,00"
                          value={dayForm.ninetyNine}
                          onChange={(event) =>
                            setDayForm({
                              ...dayForm,
                              ninetyNine: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Corridas
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={dayForm.ninetyNineRides}
                          onChange={(event) =>
                            setDayForm({
                              ...dayForm,
                              ninetyNineRides: event.target.value,
                            })
                          }
                        />
                      </label>
                    </fieldset>
                  </div>
                  <div className="motorista-form-grid">
                    <label>
                      Outros ganhos (R$)
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={dayForm.other}
                        onChange={(event) =>
                          setDayForm({ ...dayForm, other: event.target.value })
                        }
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
                      Quilômetros rodados
                      <input
                        inputMode="decimal"
                        placeholder="Ex.: 145,5"
                        value={dayForm.km}
                        onChange={(event) =>
                          setDayForm({ ...dayForm, km: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button className="motorista-primary" disabled={saving}>
                    {saving
                      ? "Salvando…"
                      : days.some((item) => item.date === dayDate)
                        ? "Atualizar dia"
                        : "Salvar dia"}
                  </button>
                </form>
              </section>
            )}

            {tab === "gastos" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Despesas</p>
                    <h1>Gastos e categorias</h1>
                    <p className="motorista-muted">
                      Registre quantos gastos precisar, mesmo sem jornada no
                      dia. Cada valor entra integralmente na data informada.
                    </p>
                  </div>
                </div>
                <div className="motorista-grid">
                  <form
                    className="motorista-card motorista-form"
                    onSubmit={saveExpense}
                  >
                    <h2>{expenseForm.id ? "Editar gasto" : "Novo gasto"}</h2>
                    <label>
                      Data
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            date: event.target.value,
                          })
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
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={expenseForm.value}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            value: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      Observação (opcional)
                      <textarea
                        maxLength={500}
                        value={expenseForm.note}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            note: event.target.value,
                          })
                        }
                        rows={3}
                      />
                    </label>
                    <div className="motorista-actions">
                      <button className="motorista-primary" disabled={saving}>
                        {saving
                          ? "Salvando…"
                          : expenseForm.id
                            ? "Atualizar gasto"
                            : "Salvar gasto"}
                      </button>
                      {expenseForm.id && (
                        <button
                          type="button"
                          className="motorista-secondary"
                          onClick={() =>
                            setExpenseForm({
                              id: "",
                              date: today,
                              categoryId: "combustivel",
                              value: "",
                              note: "",
                            })
                          }
                        >
                          Cancelar edição
                        </button>
                      )}
                    </div>
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
                                onClick={() => {
                                  setCategoryEdit(item.id);
                                  setCategoryName(item.name);
                                }}
                              >
                                Editar
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
                <div className="motorista-card">
                  <h2>Lançamentos</h2>
                  <div className="motorista-expense-list">
                    {[...expenses]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((item) => (
                        <div className="motorista-expense-row" key={item.id}>
                          <div>
                            <strong>
                              {categories.find(
                                (category) => category.id === item.categoryId,
                              )?.name ?? item.categoryId}
                            </strong>
                            <small>
                              {dateLabel(item.date)}
                              {item.note ? ` · ${item.note}` : ""}
                            </small>
                          </div>
                          <strong>{money(item.cents)}</strong>
                          <div className="motorista-actions">
                            <button
                              onClick={() => {
                                setExpenseForm({
                                  id: item.id,
                                  date: item.date,
                                  categoryId: item.categoryId,
                                  value: moneyInput(item.cents),
                                  note: item.note,
                                });
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Editar
                            </button>
                            <button
                              className="motorista-danger"
                              onClick={() => removeExpense(item)}
                              disabled={saving}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    {expenses.length === 0 && (
                      <p className="motorista-muted">Ainda não há gastos.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {tab === "meta" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Planejamento</p>
                    <h1>Meta de saldo mensal</h1>
                    <p className="motorista-muted">
                      Cada mês tem sua própria meta. O saldo soma ganhos de
                      Uber, 99 e Outros e subtrai todos os gastos registrados.
                    </p>
                  </div>
                </div>
                <div className="motorista-grid">
                  <form
                    className="motorista-card motorista-form"
                    onSubmit={saveGoal}
                  >
                    <h2>Definir meta</h2>
                    <label>
                      Mês
                      <input
                        type="month"
                        value={goalMonth}
                        onChange={(event) => setGoalMonth(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Meta de saldo (R$)
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={goalInput}
                        onChange={(event) => setGoalInput(event.target.value)}
                        required
                      />
                    </label>
                    <button className="motorista-primary" disabled={saving}>
                      {saving ? "Salvando…" : "Salvar meta"}
                    </button>
                  </form>
                  <div className="motorista-card">
                    <h2>Progresso de {goalMonth}</h2>
                    {goal > 0 ? (
                      <>
                        <DataRow label="Meta" value={money(goal)} />
                        <DataRow
                          label="Saldo acumulado"
                          value={money(monthTotals.balance)}
                        />
                        <DataRow label="Falta" value={money(plan.missing)} />
                        <div
                          className="motorista-progress"
                          role="progressbar"
                          aria-valuenow={Math.max(
                            0,
                            Math.min(100, Math.round(plan.percent)),
                          )}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span
                            style={{
                              width: `${Math.max(0, Math.min(100, plan.percent))}%`,
                            }}
                          />
                        </div>
                        <strong>{decimal(plan.percent, 1)}% atingido</strong>
                      </>
                    ) : (
                      <p className="motorista-muted">
                        Defina a meta deste mês para acompanhar o progresso.
                      </p>
                    )}
                  </div>
                </div>
                {goal > 0 && (
                  <div className="motorista-card">
                    <h2>Referências estimadas</h2>
                    <p className="motorista-muted">
                      Planejamento com média de cinco dias de trabalho por
                      semana. Você escolhe livremente os dias e pode trabalhar
                      mais ou menos.
                    </p>
                    <div className="motorista-stats">
                      <Metric
                        label="Dias estimados no mês"
                        value={String(plan.estimatedDays)}
                      />
                      <Metric
                        label="Referência diária inicial"
                        value={money(plan.daily ?? 0)}
                      />
                      <Metric
                        label="Referência semanal inicial"
                        value={money(plan.weekly ?? 0)}
                      />
                      <Metric
                        label="Necessidade diária restante"
                        value={
                          plan.requiredDaily === null
                            ? "Mês encerrado"
                            : money(plan.requiredDaily)
                        }
                      />
                    </div>
                    <p className="motorista-muted">
                      Restam aproximadamente {plan.remainingWorkDays} dias de
                      trabalho entre hoje e o fim do mês. O dia atual entra na
                      conta. Quando não houver dias restantes, o resultado final
                      é o saldo acumulado acima.
                    </p>
                  </div>
                )}
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
                          Prévia: <strong>{backup.days.length}</strong> dias,{" "}
                          <strong>{backup.expenses.length}</strong> gastos,{" "}
                          <strong>{backup.categories.length}</strong> categorias
                          e <strong>{backup.goals.length}</strong> metas.
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
                          dias,{" "}
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
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "positive" | "negative";
}) {
  return (
    <div className={`motorista-metric ${emphasis ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function DataRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="motorista-data-row">
      <div>
        <span>{label}</span>
        {detail && <small>{detail}</small>}
      </div>
      <strong>{value}</strong>
    </div>
  );
}
