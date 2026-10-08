"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
  doc,
  onSnapshot,
  runTransaction,
} from "@/lib/motorista-persistence";
import {
  getMotoristaAuth,
  getMotoristaDb,
  MOTORISTA_UID,
} from "@/lib/motorista-firebase";
import {
  DEFAULT_CATEGORIES,
  assertBackupEnvironment,
  civilDate,
  decimal,
  emptyDay,
  importBatches,
  exportCsv,
  isDate,
  isoWeek,
  legacyGains,
  localDate,
  monthBounds,
  money,
  periodBounds,
  totals,
  validateBackup,
  weekBounds,
  type Backup,
  type Category,
  type CostProfile,
  type Day,
  type Expense,
  type Goal,
  type PlannedExpense,
} from "@/lib/motorista";
import {
  dayStatus,
  addDate,
  estimateDay,
  fuelExpense,
  income,
  monthlyPlanning,
  plannedOccurrences,
} from "@/lib/motorista-evolution";
import { DayEditor, ExpenseEditor, JourneyActionEditor, journeyActionTitles, type JourneyAction } from "./motorista-forms";
import { journeyState } from "@/lib/motorista-journey";
import { saveEndingDay, saveJourneyDay, syncJourneyState } from "@/lib/motorista-journey-persistence";
import { EditingDayWizard, EndingDayWizard, type EndingDaySubmission } from "./motorista-day-ending";
import MotoristaSettings, { type SaveDocument } from "./motorista-settings";
import MotoristaReports, { Metric } from "./motorista-reports";
import MotoristaHomeCards from "./motorista-home-cards";
import { PickerInput } from "./motorista-picker-input";
import "./motorista.css";
import { MotoristaToast, useMotoristaToast } from "./motorista-toast";
import { clearRetiredMotoristaStorage } from "@/lib/motorista-browser-cleanup";
import { weeklyGoalPlanning } from "@/lib/motorista-weekly-goal";
import { installmentsPreview, maintenanceExpenseFromInput, maintenanceRows, periodTotals } from "@/lib/motorista-maintenance";
import { MaintenanceEditor, maintenanceMonthLabel, type MaintenanceDraft } from "./motorista-maintenance";

type Tab =
  "resumo" | "ganhos" | "gastos" | "relatorios" | "definicoes" | "backup";
type PeriodSelection = {
  filter: "day" | "week" | "month" | "custom";
  anchor: string;
  week: string;
  month: string;
  from: string;
  to: string;
};
type Filter = PeriodSelection["filter"];
const initialPeriod = (): PeriodSelection => {
  const today = localDate();
  return {
    filter: "week",
    anchor: today,
    week: isoWeek(today),
    month: today.slice(0, 7),
    from: today.slice(0, 7) + "-01",
    to: today,
  };
};
const selectedBounds = (p: PeriodSelection) =>
  p.filter === "week"
    ? weekBounds(p.week)
    : p.filter === "month"
      ? monthBounds(p.month)
      : periodBounds(p.filter, p.anchor, p.from, p.to);
const validBounds = (b: { from: string; to: string }) =>
  isDate(b.from) && isDate(b.to) && b.from <= b.to;
const dateLabel = (date: string) => civilDate(date).toLocaleDateString("pt-BR");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Tente novamente.";
const canonical = (data: unknown): string =>
  JSON.stringify(data, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, value[k]]),
        )
      : value,
  );
const normalize = (name: string, id: string, data: object) =>
  name === "days"
    ? { ...emptyDay(id), ...data, date: id }
    : name === "goals"
      ? { ...data, month: id }
      : { ...data, id };
function fileDownload(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function MotoristaApp() {
  const [today, setToday] = useState(localDate);
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("resumo");
  const [days, setDays] = useState<Day[]>([]),
    [expenses, setExpenses] = useState<Expense[]>([]),
    [savedCategories, setCategories] = useState<Category[]>([]),
    [goals, setGoals] = useState<Goal[]>([]),
    [plans, setPlans] = useState<PlannedExpense[]>([]),
    [profiles, setProfiles] = useState<CostProfile[]>([]);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({}),
    [loadError, setLoadError] = useState(""),
    [saving, setSaving] = useState(false);
  const { toast, setNotice } = useMotoristaToast();
  const saveLock = useRef(false);
  const [gainsPeriod, setGainsPeriod] = useState(initialPeriod),
    [expensesPeriod, setExpensesPeriod] = useState(initialPeriod),
    [reportsPeriod, setReportsPeriod] = useState(initialPeriod);
  const [homeWeek, setHomeWeek] = useState(() => isoWeek(today));
  const [modal, setModal] = useState<"day" | "expense" | "maintenance" | "journey" | null>(null),
    [dayDate, setDayDate] = useState(localDate);
  const [dayMode, setDayMode] = useState<"edit" | "end" | "register" | "legacy">("edit");
  const [dayDraft, setDayDraft] = useState<Day | undefined>();
  const [journeyAction, setJourneyAction] = useState<JourneyAction>("start");
  const [journeyDraft, setJourneyDraft] = useState<Day | undefined>();
  const [expenseDraft, setExpenseDraft] = useState<
    Partial<Expense> & { date: string }
  >({ date: today });
  const [maintenanceDraft, setMaintenanceDraft] = useState<Expense>(),
    [maintenanceNewId, setMaintenanceNewId] = useState("");
  const [backup, setBackup] = useState<Backup | null>(null),
    [importMode, setImportMode] = useState<"new" | "update">("new"),
    [importError, setImportError] = useState("");
  const modalRef = useRef<HTMLDialogElement>(null);
  const authorized = !!user && user.uid === MOTORISTA_UID;
  const names = [
    "days",
    "expenses",
    "categories",
    "goals",
    "plannedExpenses",
    "costProfiles",
  ];
  const allLoaded = names.every((name) => loaded[name]);
  const categories = useMemo(
    () =>
      [
        ...DEFAULT_CATEGORIES.filter(
          (c) => !savedCategories.some((s) => s.id === c.id),
        ),
        ...savedCategories,
      ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [savedCategories],
  );
  const currentPlan = monthlyPlanning({
    month: today.slice(0, 7),
    reference: today,
    goals,
    days,
    expenses,
    categories,
    plans,
  });
  const currentWeeklyPlan = weeklyGoalPlanning({ reference: today, goals, days, expenses });
  const openDays = days.filter((d) => d.journey?.endedAt === null);
  const activeDay = openDays.length === 1 ? openDays[0] : undefined;
  const activeState = journeyState(activeDay);
  const gainsBounds = selectedBounds(gainsPeriod),
    expenseBounds = selectedBounds(expensesPeriod),
    reportBounds = selectedBounds(reportsPeriod);
  const listedDays = validBounds(gainsBounds)
    ? [...days]
        .filter(
          (d) =>
            d.date >= gainsBounds.from &&
            d.date <= gainsBounds.to &&
            (d.status || income(d) > 0 || d.minutes > 0 || d.km > 0),
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const listedExpenses = validBounds(expenseBounds)
    ? expenses.filter(
        (e) => e.kind !== "maintenance" && e.date >= expenseBounds.from && e.date <= expenseBounds.to,
      )
    : [];
  const expenseDates = [...new Set(listedExpenses.map((e) => e.date))].sort(
    (a, b) => b.localeCompare(a),
  );
  const listedMaintenance = validBounds(expenseBounds)
    ? maintenanceRows(expenses, goals, expenseBounds.from, expenseBounds.to, today)
      .sort((a, b) => b.month.localeCompare(a.month) || a.expense.id.localeCompare(b.expense.id))
    : [];
  const expensePeriodCosts = validBounds(expenseBounds)
    ? periodTotals([], expenses, goals, expenseBounds.from, expenseBounds.to, today).costs : 0;
  const path = (name: string, id: string) =>
    doc(getMotoristaDb(), "users", user!.uid, name, id);

  useEffect(() => {
    try { clearRetiredMotoristaStorage(window.localStorage); }
    catch {
      setNotice("Não foi possível remover os antigos dados locais de teste. As chaves são motorista-local-sandbox-v1 e motorista-isolated-qa-v4.");
    }
  }, [setNotice]);

  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    return onAuthStateChanged(
      getMotoristaAuth(),
      (current) => {
        setLoaded({});
        setLoadError("");
        setModal(null);
        setBackup(null);
        setImportError("");
        setUser(current);
        setAuthReady(true);
      },
      (error) => {
        setAuthError(errorMessage(error));
        setAuthReady(true);
      },
    );
  }, []);
  useEffect(() => {
    if (!authorized || !user) return;
    const listen = <T,>(name: string, setter: (items: T[]) => void) =>
      onSnapshot(
        collection(getMotoristaDb(), "users", user.uid, name),
        (snapshot) => {
          setter(
            snapshot.docs.map(
              (item) => normalize(name, item.id, item.data()) as T,
            ),
          );
          setLoaded((current) => ({ ...current, [name]: true }));
        },
        (error) =>
          setLoadError(
            "Falha ao carregar " + name + ": " + errorMessage(error),
          ),
      );
    const stops = [
      listen<Day>("days", setDays),
      listen<Expense>("expenses", setExpenses),
      listen<Category>("categories", setCategories),
      listen<Goal>("goals", setGoals),
      listen<PlannedExpense>("plannedExpenses", setPlans),
      listen<CostProfile>("costProfiles", setProfiles),
    ];
    return () => stops.forEach((stop) => stop());
  }, [authorized, user]);
  useEffect(() => {
    if (!modal) return;
    const dialog = modalRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [modal]);
  async function withSave(
    action: () => Promise<void>,
    success: string,
  ): Promise<boolean> {
    if (!authorized || !allLoaded || loadError) {
      setNotice("Aguarde o carregamento dos dados para salvar.");
      return false;
    }
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    setNotice("");
    try {
      await action();
      setNotice(success);
      return true;
    } catch (error) {
      setNotice("Não foi possível salvar: " + errorMessage(error));
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  const saveDocument: SaveDocument = async (name, id, data, previous) =>
    withSave(async () => {
      await runTransaction(getMotoristaDb(), async (transaction) => {
        const ref = path(name, id),
          snapshot = await transaction.get(ref);
        if (
          snapshot.exists() &&
          (!previous ||
            canonical(normalize(name, id, snapshot.data())) !==
              canonical(normalize(name, id, previous)))
        )
          throw new Error(
            "Este registro foi alterado em outra sessão. Reabra o formulário antes de salvar.",
          );
        if (previous && !snapshot.exists() && name !== "categories")
          throw new Error(
            "Este registro foi removido em outra sessão. Reabra o formulário.",
          );
        transaction.set(ref, data, { merge: true });
      });
    }, "Registro salvo. Planejamento e relatórios atualizados.");
  const openDay = (date = activeDay?.date ?? today, mode: "edit" | "end" = "edit") => {
    const previous = days.find((day) => day.date === date);
    setDayDate(date);
    setDayDraft(previous);
    setDayMode(mode === "edit" && !previous ? "legacy" : mode);
    setNotice("");
    setModal("day");
  };
  const openPreviousDay = () => {
    setDayDate(addDate(today, -1));
    setDayDraft(undefined);
    setDayMode("register");
    setNotice("");
    setModal("day");
  };
  const openJourney = (action: JourneyAction) => {
    setJourneyAction(action);
    setJourneyDraft(activeDay);
    setNotice("");
    setModal("journey");
  };
  const saveDay = (day: Day, previous?: Day) => withSave(async () => {
    await saveJourneyDay({ db: getMotoristaDb(), uid: user!.uid, day, previous, knownOpenDates: openDays.map((d) => d.date) });
  }, "Atualização salva.");
  const finishDay = (submission: EndingDaySubmission) => withSave(async () => {
    await saveEndingDay({ db: getMotoristaDb(), uid: user!.uid, ...submission,
      knownOpenDates: openDays.map((day) => day.date) });
  }, "Dia encerrado. Planejamento e relatórios atualizados.");
  const newExpense = (date = today, fuel = false) => {
    setExpenseDraft({
      date,
      categoryId: fuel ? "combustivel" : "outros",
      kind: fuel ? "fuel" : "expense",
    });
    setNotice("");
    setModal("expense");
  };
  const editExpense = (expense: Expense) => {
    if (expense.kind === "maintenance") {
      setMaintenanceDraft(expense);
      setNotice("");
      setModal("maintenance");
      return;
    }
    setExpenseDraft({
      ...expense,
      kind: fuelExpense(expense, categories) ? "fuel" : "expense",
    });
    setNotice("");
    setModal("expense");
  };
  const newMaintenance = () => {
    setMaintenanceDraft(undefined);
    setMaintenanceNewId(crypto.randomUUID());
    setNotice("");
    setModal("maintenance");
  };
  const saveMaintenance = (draft: MaintenanceDraft, previous?: Expense) =>
    saveExpense(maintenanceExpenseFromInput(draft, previous, maintenanceNewId), previous);
  async function saveExpense(expense: Expense, previous?: Expense) {
    return withSave(async () => {
      await runTransaction(getMotoristaDb(), async (tx) => {
        const ref = path("expenses", expense.id),
          current = await tx.get(ref);
        if (
          current.exists() &&
          (!previous ||
            canonical(normalize("expenses", expense.id, current.data())) !==
              canonical(previous))
        )
          throw new Error("Gasto alterado em outra sessão. Reabra a edição.");
        if (previous && !current.exists())
          throw new Error("Gasto removido em outra sessão.");
        const oldKey = previous?.plannedExpenseId,
          newKey = expense.plannedExpenseId;
        const planId = (key: string) => key.slice(0, -12);
        const ids = [
          ...new Set(
            [oldKey, newKey].filter((k): k is string => !!k).map(planId),
          ),
        ];
        const snapshots = await Promise.all(
          ids.map(async (id) => ({
            id,
            snapshot: await tx.get(path("plannedExpenses", id)),
          })),
        );
        const changes = new Map(
          snapshots.map(({ id, snapshot }) => [
            id,
            { ...snapshot.data(), id } as PlannedExpense,
          ]),
        );
        const categoryRef = path("categories", expense.categoryId),
          category = await tx.get(categoryRef);
        if (oldKey) {
          const old = changes.get(planId(oldKey));
          if (!old || old.payments?.[oldKey] !== expense.id)
            throw new Error("O vínculo anterior mudou. Reabra o gasto.");
          old.payments = { ...old.payments };
          delete old.payments[oldKey];
        }
        if (newKey) {
          const next = changes.get(planId(newKey));
          if (!next?.date) throw new Error("Previsão não encontrada.");
          if (
            !plannedOccurrences([next], newKey.slice(-10, -3), []).some(
              (o) => o.key === newKey,
            )
          )
            throw new Error("Ocorrência da previsão inválida.");
          if (next.payments?.[newKey] && next.payments[newKey] !== expense.id)
            throw new Error(
              "Essa previsão já tem um pagamento. Escolha outra.",
            );
          next.payments = { ...next.payments, [newKey]: expense.id };
        }
        changes.forEach((data, id) =>
          tx.set(path("plannedExpenses", id), data, { merge: true }),
        );
        if (!category.exists())
          tx.set(
            categoryRef,
            categories.find((c) => c.id === expense.categoryId)!,
          );
        tx.set(ref, expense, { merge: true });
      });
    }, "Gasto salvo e previsão reconciliada.");
  }
  async function removeExpense(expense: Expense) {
    if (!window.confirm(expense.kind === "maintenance"
      ? `Excluir a manutenção de ${money(expense.cents)} e toda sua distribuição mensal?`
      : "Excluir o gasto de " + money(expense.cents) + " em " + dateLabel(expense.date) + "?"))
      return;
    await withSave(async () => {
      await runTransaction(getMotoristaDb(), async (tx) => {
        const ref = path("expenses", expense.id),
          snap = await tx.get(ref);
        if (
          !snap.exists() ||
          canonical(normalize("expenses", expense.id, snap.data())) !==
            canonical(expense)
        )
          throw new Error("Gasto alterado em outra sessão. Reabra a lista.");
        const key = expense.plannedExpenseId;
        const planRef = key ? path("plannedExpenses", key.slice(0, -12)) : null;
        const planSnap = planRef ? await tx.get(planRef) : null;
        if (key && planRef) {
          const data = planSnap?.data() as PlannedExpense | undefined;
          if (!data || data.payments?.[key] !== expense.id)
            throw new Error("Vínculo alterado. Reabra a lista.");
          const payments = { ...data.payments };
          delete payments[key];
          tx.set(planRef, { payments }, { merge: true });
        }
        tx.delete(ref);
      });
    }, "Gasto excluído. A previsão vinculada voltou a ficar pendente.");
  }
  function downloadJson() {
    const payload: Backup = {
      version: 4,
      exportedAt: new Date().toISOString(),
      days,
      expenses,
      categories,
      goals,
      plannedExpenses: plans,
      costProfiles: profiles,
    };
    validateBackup(payload);
    fileDownload(
      JSON.stringify(payload, null, 2),
      "motorista-backup-" + today + ".json",
      "application/json",
    );
  }
  async function chooseBackup(file?: File) {
    setBackup(null);
    setImportError("");
    if (!file) return;
    if (file.size > 5000000) return setImportError("O arquivo excede 5 MB.");
    try {
      const input = JSON.parse(await file.text());
      assertBackupEnvironment(input);
      setBackup(validateBackup(input));
    } catch (error) {
      setImportError(errorMessage(error));
    }
  }
  const currentLists = {
    days,
    expenses,
    categories: savedCategories,
    goals,
    plannedExpenses: plans,
    costProfiles: profiles,
  };
  const itemId = (name: string, item: object) =>
    name === "days"
      ? (item as Day).date
      : name === "goals"
        ? (item as Goal).month
        : (item as { id: string }).id;
  const importEntries = backup
    ? Object.entries(currentLists)
        .flatMap(([name]) =>
          ((backup[name as keyof Backup] as object[]) ?? []).map((data) => ({
            name,
            id: itemId(name, data),
            data,
          })),
        )
        .filter(
          (e) =>
            importMode === "update" ||
            !currentLists[e.name as keyof typeof currentLists].some(
              (item) => itemId(e.name, item) === e.id,
            ),
        )
    : [];
  async function importBackup() {
    if (!backup) return;
    try { assertBackupEnvironment(backup); }
    catch (error) { setImportError(errorMessage(error)); return; }
    if (
      !window.confirm(
        "Importar " +
          importEntries.length +
          " itens? " +
          (importMode === "new"
            ? "Itens existentes serão preservados."
            : "Itens de mesmo ID serão atualizados.") +
          " Itens ausentes não serão apagados.",
      )
    )
      return;
    await withSave(async () => {
      // Valida também o estado combinado: preservar por ID não pode quebrar vínculos.
      const combined = Object.fromEntries(
        Object.entries(currentLists).map(([name, current]) => {
          const map = new Map(
            current.map((item) => [itemId(name, item), item]),
          );
          importEntries
            .filter((e) => e.name === name)
            .forEach((e) => map.set(e.id, e.data as never));
          return [name, [...map.values()]];
        }),
      );
      validateBackup({
        version: 4,
        exportedAt: new Date().toISOString(),
        ...combined,
        categories: [
          ...categories.filter(
            (c) =>
              !(combined.categories as Category[]).some((x) => x.id === c.id),
          ),
          ...combined.categories,
        ],
      });
      // Lotes transacionais detectam alterações ocorridas após a prévia.
      const batches = importBatches(importEntries, 150, [
        ...openDays.map((d) => d.date),
        ...importEntries.filter((e) => e.name === "days" && (e.data as Day).journey?.endedAt === null).map((e) => e.id),
      ]);
      let confirmed = 0;
      for (const group of batches) {
        try {
          await runTransaction(getMotoristaDb(), async (tx) => {
            const checks = await Promise.all(
              group.map(async (e) => ({
                entry: e,
                snapshot: await tx.get(path(e.name, e.id)),
              })),
            );
            for (const { entry: e, snapshot } of checks) {
              const previous = currentLists[
                e.name as keyof typeof currentLists
              ].find((item) => itemId(e.name, item) === e.id);
              if (
                snapshot.exists() &&
                (!previous ||
                  canonical(normalize(e.name, e.id, snapshot.data())) !==
                    canonical(normalize(e.name, e.id, previous)))
              )
                throw new Error(
                  "Registro alterado desde a prévia: " + e.name + "/" + e.id,
                );
              if (previous && !snapshot.exists())
                throw new Error("Registro removido desde a prévia.");
            }
            const changedDays = group.filter((e) => e.name === "days").map((e) => e.data as Day);
            if (changedDays.length) await syncJourneyState({
              db: getMotoristaDb(), uid: user!.uid, transaction: tx, days: changedDays,
              knownOpenDates: openDays.map((d) => d.date),
            });
            group.forEach((e) => tx.set(path(e.name, e.id), e.data));
          });
          confirmed += group.length;
        } catch (error) {
          throw new Error(
            "Importação interrompida após " +
              confirmed +
              " itens confirmados. " +
              errorMessage(error) +
              " Reexporte e confira antes de repetir.",
          );
        }
      }
      setBackup(null);
    }, importEntries.length + " itens importados sem duplicação.");
  }
  if (!authReady)
    return (
      <main className="motorista">
        <div className="motorista-shell">
          <p>Verificando acesso…</p>
        </div>
      </main>
    );
  if (!authorized || !user)
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
            Entre com a conta Google autorizada. É necessária conexão com a
            internet.
          </p>
          {user && (
            <p className="motorista-alert">
              Esta conta não tem acesso aos dados.
            </p>
          )}
          {authError && (
            <p className="motorista-alert" role="alert">
              {authError}
            </p>
          )}
          <button
            className="motorista-primary"
            onClick={async () => {
              try {
                setAuthError("");
                await signInWithPopup(getMotoristaAuth(), new GoogleAuthProvider());
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
              onClick={() => signOut(getMotoristaAuth())}
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
            <AccountMenu
              user={user}
              onSettings={() => setTab("definicoes")}
              onExport={() => setTab("backup")}
              onSignOut={() => signOut(getMotoristaAuth())}
            />
          </div>
        </header>
        <nav className="motorista-tabs" aria-label="Seções do motorista">
          {(["resumo", "ganhos", "gastos", "relatorios"] as Tab[]).map(
            (item) => (
              <button
                key={item}
                aria-current={tab === item ? "page" : undefined}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                <TabIcon tab={item} />
                {item === "resumo"
                  ? "Início"
                  : item === "ganhos"
                    ? "Ganhos"
                    : item === "gastos"
                      ? "Gastos"
                      : "Relatórios"}
              </button>
            ),
          )}
        </nav>
        {!modal && <MotoristaToast toast={toast} />}
        {loadError ? (
          <div className="motorista-card">
            <p className="motorista-alert" role="alert">
              {loadError}
            </p>
            <button
              className="motorista-secondary"
              onClick={() => window.location.reload()}
            >
              Tentar carregar novamente
            </button>
          </div>
        ) : !allLoaded ? (
          <p>Carregando seus registros…</p>
        ) : (
          <>
            {tab === "resumo" && (
              <section className="motorista-section">
                <div>
                  <h1>Início</h1>
                </div>
                <div className="motorista-home-actions">
                  <div className="motorista-home-actions-row">
                    {openDays.length <= 1 && <div className="motorista-journey-actions">
                      {openDays.length === 0 && <button className="motorista-primary motorista-journey-action" disabled={saving}
                        onClick={() => openJourney("start")}>Iniciar dia</button>}
                      {activeState === "running" && <>
                        <button className="motorista-primary motorista-journey-action" disabled={saving} onClick={() => openJourney("pause")}>Iniciar pausa</button>
                        <button className="motorista-secondary motorista-journey-action" disabled={saving} onClick={() => openDay(activeDay!.date, "end")}>Encerrar dia</button>
                      </>}
                      {activeState === "paused" && <button className="motorista-primary motorista-journey-action" disabled={saving}
                        onClick={() => openJourney("resume")}>Encerrar pausa</button>}
                    </div>}
                    <button
                      className="motorista-secondary"
                      onClick={() => newExpense()}
                    >
                      Registrar gasto
                    </button>
                    <button
                      className="motorista-secondary"
                      onClick={() => newExpense(today, true)}
                    >
                      Abastecer
                    </button>
                  </div>
                  {activeDay && <div className="motorista-journey-status">
                    <p><strong>{dayStatus(activeDay)}</strong> · {dateLabel(activeDay.date)}</p>
                    <p className="motorista-muted">Início: {new Date(activeDay.journey!.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {activeDay.odometerStart != null && ` · Odômetro: ${decimal(activeDay.odometerStart, 1)} km`}</p>
                  </div>}
                  {openDays.length > 1 && <p className="motorista-alert">Há mais de uma jornada aberta. Corrija os dias existentes antes de iniciar outra.</p>}
                </div>
                <MotoristaHomeCards
                  plan={currentPlan}
                  weeklyPlan={currentWeeklyPlan}
                  days={days}
                  today={today}
                  week={homeWeek}
                  onWeekChange={setHomeWeek}
                />
              </section>
            )}
            {tab === "ganhos" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Ganhos</p>
                  </div>
                  <div className="motorista-actions motorista-quick-actions motorista-single-action">
                    <button
                      className="motorista-primary"
                      onClick={openPreviousDay}
                    >
                      Registrar dia anterior
                    </button>
                  </div>
                </div>
                <PeriodFilter
                  selection={gainsPeriod}
                  onChange={setGainsPeriod}
                />
                <Metric
                  label="Ganhos registrados no período"
                  value={money(totals(listedDays, []).gains)}
                />
                {!validBounds(gainsBounds) ? (
                  <p className="motorista-alert">
                    Selecione um período válido.
                  </p>
                ) : !listedDays.length ? (
                  <p className="motorista-card">
                    Nenhum dia neste período. Use Registrar dia anterior para cadastrar uma data passada.
                  </p>
                ) : (
                  listedDays.map((day) => (
                    <div
                      key={day.date}
                      className="motorista-card motorista-day-group"
                    >
                      <div className="motorista-day-heading">
                        <div>
                          <h2>{dateLabel(day.date)}</h2>
                          <p>
                            {dayStatus(day)} · {money(income(day))}
                          </p>
                        </div>
                        <button
                          className="motorista-secondary"
                          onClick={() => openDay(day.date)}
                        >
                          Editar
                        </button>
                      </div>
                      {legacyGains([day]).map((gain) => (
                        <div className="motorista-day-row" key={gain.id}>
                          <span className="motorista-day-value">
                            <strong>
                              {gain.source === "uber"
                                ? "Uber"
                                : gain.source === "ninetyNine"
                                  ? "99"
                                  : "Outros"}
                            </strong>
                            <span>{money(gain.cents)}</span>
                          </span>
                        </div>
                      ))}
                      <p className="motorista-muted">
                        {day.minutes > 0
                          ? decimal(day.minutes / 60, 2) + " h"
                          : "Horas não informadas"}{" "}
                        ·{" "}
                        {day.km > 0
                          ? decimal(day.km) + " km"
                          : "KM não informados"}
                        {day.note ? " · " + day.note : ""}
                      </p>
                    </div>
                  ))
                )}
              </section>
            )}
            {tab === "gastos" && (
              <section className="motorista-section">
                <div className="motorista-title-row">
                  <div>
                    <p className="motorista-eyebrow">Gastos</p>
                  </div>
                  <div className="motorista-actions">
                    <button
                      className="motorista-primary"
                      onClick={() => newExpense()}
                    >
                      Registrar gasto
                    </button>
                    <button
                      className="motorista-secondary"
                      onClick={() => newExpense(today, true)}
                    >
                      Abastecer
                    </button>
                    <button className="motorista-secondary" onClick={newMaintenance}>
                      Registrar manutenção
                    </button>
                  </div>
                </div>
                <PeriodFilter
                  selection={expensesPeriod}
                  onChange={setExpensesPeriod}
                />
                <Metric
                  label="Total de gastos no período"
                  value={money(expensePeriodCosts)}
                />
                {!validBounds(expenseBounds) ? (
                  <p className="motorista-alert">
                    Selecione um período válido.
                  </p>
                ) : !expenseDates.length && !listedMaintenance.length ? (
                  <p className="motorista-card">Nenhum gasto neste período.</p>
                ) : (
                  <>{expenseDates.map((date) => (
                    <div
                      className="motorista-card motorista-day-group"
                      key={date}
                    >
                      <div className="motorista-day-heading">
                        <h2>{dateLabel(date)}</h2>
                        <button
                          className="motorista-secondary"
                          onClick={() => newExpense(date)}
                        >
                          Registrar gasto
                        </button>
                      </div>
                      {listedExpenses
                        .filter((e) => e.date === date)
                        .map((expense) => (
                          <div
                            className="motorista-day-row motorista-expense-day-row"
                            key={expense.id}
                          >
                            <div className="motorista-expense-details">
                              <strong>
                                {categories.find(
                                  (c) => c.id === expense.categoryId,
                                )?.name ?? expense.categoryId}
                              </strong>
                              {expense.note && <small>{expense.note}</small>}
                              {fuelExpense(expense, categories) && (
                                <small>
                                  {expense.fuel?.incomplete !== false
                                    ? "Abastecimento incompleto · completar detalhes"
                                    : `${expense.fuel?.fuelType} · ${expense.fuel?.volume} ${expense.fuel?.unit === "m3" ? "m³" : "L"}`}
                                </small>
                              )}
                              {expense.plannedExpenseId && (
                                <small>Pagamento vinculado à previsão</small>
                              )}
                            </div>
                            <strong>{money(expense.cents)}</strong>
                            <div className="motorista-actions motorista-icon-actions">
                              <button
                                className="motorista-icon-button"
                                aria-label={"Editar gasto " + expense.id}
                                onClick={() => editExpense(expense)}
                              >
                                <EditIcon />
                              </button>
                              <button
                                className="motorista-icon-button motorista-danger"
                                aria-label={"Excluir gasto " + expense.id}
                                disabled={saving}
                                onClick={() => removeExpense(expense)}
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                  {listedMaintenance.map((row) => <div key={`${row.expense.id}:${row.month}`} className="motorista-card motorista-day-group">
                    <div className="motorista-day-heading">
                      <div>
                        <h2>Manutenção · {maintenanceMonthLabel(row.month)}</h2>
                        <p>{row.expense.note || "Manutenção"}</p>
                      </div>
                    </div>
                    <div className="motorista-day-row motorista-expense-day-row">
                      <div className="motorista-expense-details">
                        <strong>Total: {money(row.expense.cents)} · {row.installments} {row.installments === 1 ? "parcela" : "parcelas"}</strong>
                        <small>Parcela {row.installment} de {row.installments} · Cota do mês: {money(row.monthlyCents)}</small>
                        <small>Custo reconhecido no período</small>
                        {row.futureCents > 0 && <small>Previsto neste período: {money(row.futureCents)}</small>}
                      </div>
                      <strong>{money(row.allocatedCents)}</strong>
                      <div className="motorista-actions motorista-icon-actions">
                        <button className="motorista-icon-button" aria-label={`Editar manutenção ${row.expense.id}`}
                          onClick={() => editExpense(row.expense)}><EditIcon /></button>
                        <button className="motorista-icon-button motorista-danger" disabled={saving}
                          aria-label={`Excluir manutenção ${row.expense.id}`} onClick={() => removeExpense(row.expense)}><DeleteIcon /></button>
                      </div>
                    </div>
                  </div>)}
                  </>
                )}
              </section>
            )}
            {tab === "relatorios" &&
              (validBounds(reportBounds) && reportBounds.from <= today ? (
                <MotoristaReports
                  days={days}
                  expenses={expenses}
                  categories={categories}
                  goals={goals}
                  from={reportBounds.from}
                  to={reportBounds.to}
                  reference={today}
                  filter={reportsPeriod.filter === "month" ? "month" : "week"}
                  controls={
                    <PeriodFilter
                      selection={reportsPeriod}
                      onChange={setReportsPeriod}
                      allowedFilters={["week", "month"]}
                      maxReference={today}
                    />
                  }
                />
              ) : (
                <section className="motorista-section">
                  <h1>Relatórios</h1>
                  <PeriodFilter
                    selection={reportsPeriod}
                    onChange={setReportsPeriod}
                    allowedFilters={["week", "month"]}
                    maxReference={today}
                  />
                  <p className="motorista-alert">
                    {validBounds(reportBounds) && reportBounds.from > today
                      ? "Selecione a semana ou o mês atual, ou um período passado."
                      : "Selecione um período válido."}
                  </p>
                </section>
              ))}
            {tab === "definicoes" && (
              <MotoristaSettings
                days={days}
                expenses={expenses}
                categories={categories}
                goals={goals}
                plans={plans}
                profiles={profiles}
                saving={saving}
                save={saveDocument}
              />
            )}
            {tab === "backup" && (
              <section className="motorista-section">
                <h1>Exportar e importar</h1>
                <div className="motorista-grid">
                  <div className="motorista-card motorista-form">
                    <h2>Exportar todo o histórico</h2>
                    <p>
                      Backup v4 inclui jornadas, pagamentos, categorias, metas,
                      calendário, compromissos, vínculos e premissas históricas.
                      Campos desconhecidos em documentos JSON são preservados.
                    </p>
                    <button
                      className="motorista-primary"
                      onClick={() => {
                        try {
                          downloadJson();
                        } catch (error) {
                          setNotice(
                            "Não foi possível exportar: " + errorMessage(error),
                          );
                        }
                      }}
                    >
                      Baixar JSON
                    </button>
                    <button
                      className="motorista-secondary"
                      onClick={() =>
                        fileDownload(
                          exportCsv(
                            days,
                            expenses,
                            categories,
                            days
                              .map((d) =>
                                estimateDay(d, expenses, categories, profiles, undefined, goals),
                              )
                              .filter((e) => e !== null),
                            goals,
                            today,
                          ),
                          "motorista-lancamentos-" + today + ".csv",
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      Baixar CSV
                    </button>
                  </div>
                  <div className="motorista-card motorista-form">
                    <h2>Importar backup JSON</h2>
                    <label>
                      Selecione um backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => chooseBackup(e.target.files?.[0])}
                      />
                    </label>
                    {importError && (
                      <p className="motorista-alert error" role="alert">
                        {importError}
                      </p>
                    )}
                    {backup && (
                      <>
                        <p>
                          Prévia validada ·{" "}
                          {new Date(backup.exportedAt).toLocaleString("pt-BR")}
                        </p>
                        {Object.entries(currentLists).map(([name, current]) => (
                          <p key={name}>
                            {name}:{" "}
                            {(backup[name as keyof Backup] as object[]).length}{" "}
                            itens ·{" "}
                            {
                              (backup[name as keyof Backup] as object[]).filter(
                                (item) =>
                                  current.some(
                                    (c) =>
                                      itemId(name, c) === itemId(name, item),
                                  ),
                              ).length
                            }{" "}
                            IDs existentes
                          </p>
                        ))}
                        <label>
                          Como tratar IDs existentes
                          <select
                            value={importMode}
                            onChange={(e) =>
                              setImportMode(e.target.value as typeof importMode)
                            }
                          >
                            <option value="new">
                              Preservar existentes (somente novos)
                            </option>
                            <option value="update">
                              Atualizar itens de mesmo ID
                            </option>
                          </select>
                        </label>
                        <p>
                          {importEntries.length} itens serão gravados. Nenhum
                          item ausente será apagado. Lotes de até 150 documentos
                          são atômicos; uma falha posterior preserva os lotes
                          anteriores e informa o ponto de parada.
                        </p>
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
            className={`motorista-dialog${modal === "day" && dayMode !== "legacy" ? " motorista-ending-dialog" : ""}`}
            aria-labelledby="motorista-dialog-title"
            onCancel={(event) => {
              if (saving) event.preventDefault();
              else setModal(null);
            }}
          >
            <div className="motorista-dialog-header">
              <h2 id="motorista-dialog-title">
                {modal === "day"
                  ? dayMode === "end" ? "Encerrar dia" : dayMode === "register" ? "Registrar dia anterior" : dayMode === "edit" ? "Editar dia" : "Abrir ou corrigir dia"
                  : modal === "journey"
                    ? journeyActionTitles[journeyAction]
                  : modal === "maintenance"
                    ? maintenanceDraft ? "Editar manutenção" : "Registrar manutenção"
                    : expenseDraft.id
                      ? "Editar gasto"
                      : expenseDraft.kind === "fuel"
                        ? "Abastecer"
                        : "Registrar gasto"}
              </h2>
              <button
                type="button"
                className="motorista-icon-button"
                aria-label="Fechar"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                ×
              </button>
            </div>
            <MotoristaToast toast={toast} />
            {modal === "day" ? (
              dayMode === "end" ? dayDraft ? (
                <EndingDayWizard key={dayDate} day={dayDraft} categories={categories}
                  plans={plans} saving={saving} onFinish={finishDay} onCancel={() => setModal(null)} />
              ) : <p className="motorista-alert error">A jornada não foi encontrada. Feche e reabra o encerramento.</p> : dayMode === "legacy" ? (
              <DayEditor
                key={dayDate}
                date={dayDate}
                days={days}
                expenses={expenses}
                saving={saving}
                mode="edit"
                onSave={saveDay}
                onCancel={() => setModal(null)}
              />
              ) : (
                <EditingDayWizard key={`${dayMode}:${dayDate}`} mode={dayMode} date={dayDate} day={dayDraft}
                  days={days} saving={saving} onSave={saveDay} onCancel={() => setModal(null)} />
              )
            ) : modal === "journey" ? (
              <JourneyActionEditor action={journeyAction} day={journeyDraft} days={days} saving={saving}
                onSave={saveDay} onCancel={() => setModal(null)} onCorrect={(date) => openDay(date)} />
            ) : modal === "expense" ? (
              <ExpenseEditor
                key={expenseDraft.id ?? "new"}
                initial={expenseDraft}
                expenses={expenses}
                categories={categories}
                saving={saving}
                onSave={saveExpense}
                onCancel={() => setModal(null)}
              />
            ) : modal === "maintenance" ? (
              <MaintenanceEditor key={maintenanceDraft?.id ?? maintenanceNewId} initial={maintenanceDraft}
                saving={saving} onSave={saveMaintenance} installmentsPreview={installmentsPreview} onCancel={() => setModal(null)} />
            ) : null}
          </dialog>
        )}
      </div>
    </main>
  );
}

function PeriodFilter({
  selection,
  onChange,
  allowedFilters = ["day", "week", "month", "custom"],
  maxReference,
}: {
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
  allowedFilters?: readonly Filter[];
  maxReference?: string;
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
          {allowedFilters.map((filter) => <option key={filter} value={filter}>
            {filter === "day" ? "Dia" : filter === "week" ? "Semana" : filter === "month" ? "Mês" : "Personalizado"}
          </option>)}
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
            max={maxReference ? isoWeek(maxReference) : undefined}
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
            max={maxReference?.slice(0, 7)}
            onChange={(event) => update({ month: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}

function AccountMenu({
  user,
  onSettings,
  onExport,
  onSignOut,
}: {
  user: User;
  onSettings: () => void;
  onExport: () => void;
  onSignOut?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const name = user.displayName || user.email || "Minha conta";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <button
        type="button"
        className="motorista-avatar"
        aria-label="Abrir menu da conta"
        aria-haspopup="dialog"
        aria-controls="motorista-account-dialog"
        aria-expanded={open}
        onClick={(event) => {
          const dialog = dialogRef.current;
          if (!dialog) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          dialog.style.top = `${bounds.bottom + 8}px`;
          dialog.style.right = `${document.documentElement.clientWidth - bounds.right}px`;
          dialog.showModal();
          setOpen(true);
        }}
      >
        {user.photoURL && failedPhoto !== user.photoURL ? (
          <Image
            src={user.photoURL}
            alt=""
            width={44}
            height={44}
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => setFailedPhoto(user.photoURL)}
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </button>
      <dialog
        ref={dialogRef}
        id="motorista-account-dialog"
        className="motorista-account-dialog"
        aria-labelledby="motorista-account-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            dialogRef.current?.close();
        }}
      >
        <div className="motorista-account-details">
          <strong id="motorista-account-title">{name}</strong>
          {user.email && user.email !== name && <small>{user.email}</small>}
        </div>
        <button
          type="button"
          onClick={() => {
            dialogRef.current?.close();
            onSettings();
          }}
        >
          Definições
        </button>
        <button
          type="button"
          onClick={() => {
            dialogRef.current?.close();
            onExport();
          }}
        >
          Exportar
        </button>
        {onSignOut && <button
          type="button"
          className="motorista-account-signout"
          onClick={() => {
            dialogRef.current?.close();
            onSignOut();
          }}
        >
          Sair
        </button>}
      </dialog>
    </>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const paths: Record<Tab, React.ReactNode> = {
    relatorios: (
      <>
        <path d="M5 3h10l4 4v14H5z" />
        <path d="M14 3v5h5M8 17v-3M12 17v-6M16 17v-4" />
      </>
    ),
    resumo: (
      <>
        <path d="M3 11.5 12 4l9 7.5V20H3v-8.5Z" />
        <path d="M8 20v-6h8v6" />
      </>
    ),
    ganhos: (
      <>
        <path d="M3 17.5 9 11l4 4 8-8" />
        <path d="M16 7h5v5" />
      </>
    ),
    gastos: (
      <>
        <path d="M3 7h18v12H3z" />
        <path d="M3 10h18M16 15h2" />
      </>
    ),
    definicoes: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    backup: (
      <>
        <path d="M5 14a7 7 0 1 0 1-6" />
        <path d="M5 4v4h4M12 8v5l3 2" />
      </>
    ),
  };

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
      {paths[tab]}
    </svg>
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
