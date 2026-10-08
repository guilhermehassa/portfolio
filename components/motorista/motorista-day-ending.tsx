"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { endingDay, endingJourney, validateEndingTime } from "@/lib/motorista-day-ending";
import { editingDay, editingJourney } from "@/lib/motorista-day-editing";
import { addDate } from "@/lib/motorista-evolution";
import { journeyInstant, journeyMinutes, localDateTime } from "@/lib/motorista-journey";
import { emptyDay, isDate, localDate, money, parseCents, parseDecimal, periodsFromInput, type Category, type Day, type Expense, type PlannedExpense } from "@/lib/motorista";
import { createWizardNavigation } from "@/lib/motorista-wizard-navigation";
import { dayFields, FormError, MoneyField, PauseEditor, PeriodsEditor, pauseFields } from "./motorista-forms";

const endingSteps = ["Encerramento", "Pausas", "Dados finais", "Ganhos"];
const editingSteps = ["Início", ...endingSteps];

export type EndingDaySubmission = {
  day: Day;
  previous: Day;
  expenses: Expense[];
  categories: Category[];
  plannedExpenses: PlannedExpense[];
};

type SharedWizardProps = {
  saving: boolean;
  onCancel: () => void;
};
type EndingWizardProps = SharedWizardProps & {
  day: Day;
  categories: Category[];
  plans: PlannedExpense[];
  onFinish: (submission: EndingDaySubmission) => Promise<boolean>;
};
type EditingWizardProps = SharedWizardProps & {
  mode: "edit" | "register";
  date: string;
  day?: Day;
  days: Day[];
  onSave: (day: Day, previous?: Day) => Promise<boolean>;
};

export function EndingDayWizard(props: EndingWizardProps) {
  return <DayWizard {...props} mode="end" />;
}
export function EditingDayWizard(props: EditingWizardProps) {
  return <DayWizard {...props} />;
}

function DayWizard(props: (EndingWizardProps & { mode: "end" }) | EditingWizardProps) {
  const { mode, saving, onCancel } = props;
  const steps = mode === "end" ? endingSteps : editingSteps;
  const [previous] = useState(() => props.day);
  const [date, setDate] = useState(() => props.mode === "end" ? props.day.date : props.date);
  const [definitions] = useState(() => props.mode === "end" ? { categories: props.categories, plans: props.plans } : null);
  const [navigator] = useState(() => createWizardNavigation(steps.length));
  const navigation = useSyncExternalStore(navigator.subscribe, navigator.getSnapshot, navigator.getServerSnapshot);
  const step = navigation.step;
  const moving = navigation.phase !== "idle";
  const contentRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const [pauses, setPauses] = useState(() => pauseFields(previous?.journey?.pauses ?? []));
  const [fields, setFields] = useState<Record<string, string>>(() => ({
    ...dayFields(previous ?? emptyDay(date)),
    ...(mode === "end" ? { endedAt: localDateTime() } : {}),
  }));
  const [error, setError] = useState("");
  const set = (key: string, value: string) => { setFields((current) => ({ ...current, [key]: value })); setError(""); };
  useEffect(() => {
    navigator.activate();
    return () => navigator.dispose();
  }, [navigator]);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.scrollTop = 0;
    content.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  }, [step]);
  const move = (direction: "forward" | "back") => {
    if (contentRef.current?.contains(document.activeElement) && document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    navigator.move(direction, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };
  const back = () => { if (moving || saving) return; setError(""); move("back"); };
  const stage = steps[step];
  const withTiming = !!previous?.journey || !!fields.startedAt || !!fields.endedAt || pauses.length > 0;
  const withOdometers = !!fields.odometerStart.trim() && !!fields.odometerEnd.trim();
  const startOdometer = fields.odometerStart.trim() ? parseDecimal(fields.odometerStart) : null;
  const setDateInput = (value: string) => {
    setDate(value);
    if (fields.startedAt && isDate(value)) set("startedAt", value + fields.startedAt.slice(10));
    setError("");
  };
  const setStartInput = (value: string) => {
    set("startedAt", value);
    if (isDate(value.slice(0, 10))) setDate(value.slice(0, 10));
  };
  let duration: number | null = null;
  try {
    const journey = mode === "end" ? endingJourney(previous!, fields.endedAt, pauses) : editingJourney(previous, fields, pauses);
    duration = journey ? journeyMinutes(journey) : null;
  } catch { /* Validar ao avançar. */ }
  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (moving || saving || submitLock.current) return;
    try {
      if (stage === "Início") {
        if (!isDate(date)) throw new Error("Selecione uma data válida.");
        if (mode === "register" && date >= localDate()) throw new Error("Selecione uma data anterior a hoje para registrar o dia.");
        if (date > localDate()) throw new Error("Não é possível fechar um dia futuro.");
        if (props.mode !== "end" && props.days.some((day) => day.date === date) && (mode === "register" || date !== previous?.date))
          throw new Error(mode === "register" ? "Esta data já possui um registro. Use Editar na lista de Ganhos."
            : "A nova data já possui um registro. Escolha uma data livre para transferir a jornada.");
        if (fields.startedAt && Date.parse(journeyInstant(fields.startedAt)) > Date.now())
          throw new Error("O início da jornada não pode estar no futuro.");
        if (fields.odometerStart.trim() && (!Number.isFinite(startOdometer) || startOdometer! < 0))
          throw new Error("Informe um odômetro inicial válido ou deixe em branco.");
      }
      if (stage === "Encerramento") {
        if (mode === "end") validateEndingTime(previous!, fields.endedAt);
        else if (withTiming) {
          if (!fields.startedAt.trim() || !fields.endedAt.trim())
            throw new Error("Informe início e encerramento da jornada ou deixe ambos em branco quando não houver horários registrados.");
          const start = Date.parse(journeyInstant(fields.startedAt)), end = Date.parse(journeyInstant(fields.endedAt));
          if (end > Date.now()) throw new Error("O encerramento não pode estar no futuro.");
          if (end < start) throw new Error("O encerramento deve ocorrer depois do início da jornada.");
        }
      }
      if (stage === "Pausas") {
        if (mode === "end") endingJourney(previous!, fields.endedAt, pauses);
        else editingJourney(previous, fields, pauses);
      }
      if (stage === "Dados finais") {
        const end = parseDecimal(fields.odometerEnd);
        if ((mode === "end" && !fields.odometerEnd.trim()) || (fields.odometerEnd.trim() && (!Number.isFinite(end) || end < 0 ||
          (startOdometer !== null && end < startOdometer))))
          throw new Error("Informe um odômetro final válido, igual ou maior que o inicial.");
        const consumption = fields.consumption.trim() ? parseDecimal(fields.consumption) : 0;
        if (!Number.isFinite(consumption) || consumption < 0)
          throw new Error("Informe um consumo válido ou deixe em branco.");
        if (!withOdometers && fields.km.trim() &&
          (!Number.isFinite(parseDecimal(fields.km)) || parseDecimal(fields.km) < 0))
          throw new Error("Informe quilômetros válidos ou deixe em branco.");
        if (!withTiming && ["hours", "minutes"].some((key) => fields[key].trim() &&
          (!Number.isSafeInteger(Number(fields[key])) || Number(fields[key]) < 0 || (key === "minutes" && Number(fields[key]) > 59))))
          throw new Error("Informe horas inteiras e minutos entre 0 e 59, ou deixe em branco.");
      }
      if (step === steps.length - 1) {
        submitLock.current = true;
        try {
          const success = props.mode === "end"
            ? await props.onFinish({ day: endingDay(previous!, fields.endedAt, pauses, fields), previous: previous!, expenses: [],
              categories: definitions!.categories, plannedExpenses: definitions!.plans })
            : await props.onSave(editingDay({ mode: props.mode, date, previous, fields, pauses, days: props.days }), previous);
          if (success) onCancel();
        } finally { submitLock.current = false; }
      } else move("forward");
    } catch (e) { setError(e instanceof Error ? e.message : "Revise os dados desta etapa."); }
  }
  return <div className="motorista-ending-wizard">
    <nav aria-label={mode === "end" ? "Etapas para encerrar o dia" : mode === "edit" ? "Etapas para editar o dia" : "Etapas para registrar dia anterior"}>
      <ol className="motorista-ending-steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} role="list">{steps.map((label, index) =>
        <li key={label} aria-current={index === step ? "step" : undefined}
          aria-label={`${label}: ${index < step ? "concluída" : index === step ? "etapa atual" : "a seguir"}`}
          className={index < step ? "is-complete" : index === step ? "is-current" : undefined} />)}</ol>
    </nav>
    <form className="motorista-form motorista-ending-form" onSubmit={next}>
      <div ref={contentRef} className="motorista-ending-content">
      <div key={step} inert={navigation.phase === "leaving"}
        className={`motorista-ending-step is-${navigation.phase} is-${navigation.direction}`}>
      <p className="motorista-muted">Etapa {step + 1} de {steps.length}</p>
      <h3 tabIndex={-1}>{steps[step]}</h3>
      <FormError>{error}</FormError>
      {stage === "Início" && <>
        <label>Data de início do dia
          <input type="date" value={date} required max={mode === "register" ? addDate(localDate(), -1) : localDate()}
            onChange={(event) => setDateInput(event.target.value)} />
        </label>
        <label>Data e hora de início (opcional)
          <input type="datetime-local" step={60} value={fields.startedAt} max={localDateTime()}
            onChange={(event) => setStartInput(event.target.value)} />
        </label>
        <label>Odômetro inicial (opcional)
          <input inputMode="decimal" value={fields.odometerStart} onChange={(event) => set("odometerStart", event.target.value)} />
        </label>
        <p className="motorista-muted">{mode === "register" ? "Escolha uma data anterior a hoje ainda sem registro. Em datas já cadastradas, use Editar na lista de Ganhos. " : ""}
          Horários e odômetros ausentes podem continuar em branco. Se informar horários, complete início e encerramento.</p>
        {previous && date !== previous.date && <p className="motorista-alert">Ao confirmar, o dia e seus ganhos serão transferidos para {date.split("-").reverse().join("/")}. Os gastos continuarão nas datas originais. A nova data precisa estar livre.</p>}
      </>}
      {stage === "Encerramento" && <>
        <label>Data e hora de encerramento{mode !== "end" && " (opcional)"}
          <input type="datetime-local" step={60} value={fields.endedAt} required={mode === "end" || withTiming} max={localDateTime()}
            onChange={(event) => set("endedAt", event.target.value)} />
        </label>
        {mode !== "end" && <p className="motorista-muted">A confirmação final encerra o dia. Sem horários registrados, é possível manter início e encerramento em branco.</p>}
      </>}
      {stage === "Pausas" && <>
        {pauses.length === 0 && <p className="motorista-muted">Nenhuma pausa registrada. Se trabalhou sem pausa, pode avançar.</p>}
        <PauseEditor pauses={pauses} onChange={(next) => { setPauses(next); setError(""); }} />
        {duration !== null && <p>Tempo trabalhado: <strong>{Math.floor(duration / 60)} h {duration % 60} min</strong>.</p>}
      </>}
      {stage === "Dados finais" && <>
        <div className="motorista-field-grid">
          <label>Odômetro inicial
            <input value={fields.odometerStart} readOnly />
          </label>
          <label>Odômetro final{mode !== "end" && " (opcional)"}
            <input inputMode="decimal" value={fields.odometerEnd} required={mode === "end"} onChange={(event) => set("odometerEnd", event.target.value)} />
          </label>
          {(!withOdometers && (mode !== "end" || previous?.odometerStart == null)) && <label>KM do trabalho (opcional)
            <input inputMode="decimal" value={fields.km} onChange={(event) => set("km", event.target.value)} />
          </label>}
          {mode !== "end" && !withTiming && <>
            <label>Horas trabalhadas (opcional)
              <input inputMode="numeric" value={fields.hours} onChange={(event) => set("hours", event.target.value)} />
            </label>
            <label>Minutos adicionais (opcional)
              <input inputMode="numeric" value={fields.minutes} onChange={(event) => set("minutes", event.target.value)} />
            </label>
          </>}
          <label>Consumo manual (km/L, opcional)
            <input inputMode="decimal" value={fields.consumption} onChange={(event) => set("consumption", event.target.value)} />
          </label>
          <PeriodsEditor value={periodsFromInput(fields.periods, previous)}
            onChange={(periods) => set("periods", JSON.stringify(periods))} />
        </div>
        <label>Observação (opcional)
          <textarea rows={2} maxLength={500} value={fields.note} onChange={(event) => set("note", event.target.value)} />
        </label>
        {startOdometer !== null && fields.odometerEnd.trim() && Number.isFinite(parseDecimal(fields.odometerEnd)) &&
          parseDecimal(fields.odometerEnd) >= startOdometer &&
          <p>KM do trabalho: <strong>{Math.round((parseDecimal(fields.odometerEnd) - startOdometer) * 1000) / 1000}</strong>.</p>}
        {mode !== "end" && <p className="motorista-muted">Sem horários ou odômetros completos, os minutos e KM manuais continuam disponíveis. Gastos e abastecimentos não são alterados por este formulário.</p>}
      </>}
      {stage === "Ganhos" && <>
        <div className="motorista-ending-income">
          {[["Uber", "uberCents", "uberRides"], ["99", "ninetyNineCents", "ninetyNineRides"], ["Outros", "otherCents"]].map(([label, valueKey, ridesKey]) =>
            <fieldset key={valueKey} className="motorista-ending-income-source">
              <legend>{label}</legend>
              <div className={ridesKey ? "motorista-ending-income-fields" : undefined}>
                <label>Valor (R$)
                  <MoneyField value={fields[valueKey] === "" ? "" : money(Number(fields[valueKey]))}
                    onChange={(value) => set(valueKey, value.trim() ? String(parseCents(value)) : "")} />
                </label>
                {ridesKey && <label>Corridas (opcional)
                  <input inputMode="numeric" value={fields[ridesKey]} onChange={(event) => set(ridesKey, event.target.value)} />
                </label>}
              </div>
            </fieldset>)}
        </div>
        <p className="motorista-muted">Informe ao menos um ganho, inclusive zero. Vazio significa não informado; os valores são totais, sem somar novamente lançamentos anteriores.</p>
      </>}
      </div>
      </div>
      <div className="motorista-actions motorista-dialog-actions motorista-ending-actions">
        <button type="button" className="motorista-secondary" onClick={onCancel} disabled={saving || moving}>Cancelar</button>
        {step > 0 ? <button type="button" className="motorista-secondary" onClick={back} disabled={saving || moving}>Voltar</button>
          : <span className="motorista-ending-back-space" aria-hidden="true" />}
        <button type="submit" className="motorista-primary" disabled={saving || moving}>
          {step === steps.length - 1 ? saving ? "Salvando…" : mode === "end" ? "Concluir encerramento" : mode === "edit" ? "Salvar alterações" : "Registrar dia" : "Avançar"}
        </button>
      </div>
    </form>
  </div>;
}
