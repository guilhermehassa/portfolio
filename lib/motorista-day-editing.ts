import { dayFromFields } from "./motorista-evolution";
import { isDate, localDate, type Day, type Journey, type JourneyPause } from "./motorista";
import { journeyFromFields, journeyMinutes, validateJourney } from "./motorista-journey";

export type EditingPause = JourneyPause & { startedInput?: string; endedInput?: string };
export type EditingDayInput = {
  mode: "edit" | "register";
  date: string;
  previous?: Day;
  fields: Record<string, string>;
  pauses: EditingPause[];
  days: Day[];
  now?: number;
};

// Horários ausentes continuam ausentes; qualquer cronologia informada é encerrada.
export function editingJourney(
  previous: Day | undefined,
  fields: Record<string, string>,
  pauses: EditingPause[],
  now = Date.now(),
): Journey | undefined {
  if (!previous?.journey && !fields.startedAt?.trim() && !fields.endedAt?.trim() && !pauses.length)
    return undefined;
  const journey = journeyFromFields(
    previous?.journey ?? { startedAt: "", endedAt: null, pauses: [] },
    fields.startedAt ?? "",
    fields.endedAt ?? "",
    pauses.map((pause) => ({
      ...previous?.journey?.pauses.find((stored) => stored.id === pause.id),
      ...pause,
    })),
  );
  if (journey.endedAt === null)
    throw new Error("Informe o horário de encerramento para fechar a jornada.");
  const timestamps = [journey.startedAt, journey.endedAt,
    ...journey.pauses.flatMap((pause) => [pause.startedAt, pause.endedAt])];
  if (timestamps.some((instant) => instant !== null && Date.parse(instant) > now))
    throw new Error("Os horários da jornada não podem estar no futuro.");
  return journey;
}

// Este helper só monta o rascunho. A confirmação usa saveJourneyDay com previous
// intacto para conferir concorrência e transferir data/marcador atomicamente.
export function editingDay({
  mode, date, previous, fields, pauses, days, now = Date.now(),
}: EditingDayInput): Day {
  if (!isDate(date)) throw new Error("Selecione uma data válida.");
  if (mode === "edit" && !previous)
    throw new Error("O dia não foi encontrado. Feche e reabra a edição.");
  if (mode === "register" && previous)
    throw new Error("Esta data já possui um registro. Use Editar na lista de Ganhos.");
  const journey = editingJourney(previous, fields, pauses, now);
  const destinationDate = journey?.startedAt.slice(0, 10) ?? date;
  const today = localDate(new Date(now));
  if (mode === "register" && destinationDate >= today)
    throw new Error("Selecione uma data anterior a hoje para registrar o dia.");
  if (destinationDate > today)
    throw new Error("Não é possível fechar um dia futuro.");
  if (days.some((day) => day.date === destinationDate)
    && (mode === "register" || destinationDate !== previous?.date))
    throw new Error(mode === "register"
      ? "Esta data já possui um registro. Use Editar na lista de Ganhos."
      : "A nova data já possui um registro. Escolha uma data livre para transferir a jornada.");
  const duration = journey ? journeyMinutes(journey) : null;
  const day = dayFromFields(destinationDate, previous,
    duration === null ? fields : {
      ...fields, hours: String(Math.floor(duration / 60)), minutes: String(duration % 60),
    }, "closed");
  if (journey) day.journey = journey;
  // O formulário vazio não inventa odômetros ou consumo em documentos antigos.
  for (const key of ["odometerStart", "odometerEnd", "consumption"] as const) {
    if (!fields[key]?.trim() && !Object.prototype.hasOwnProperty.call(previous ?? {}, key))
      delete day[key];
  }
  validateJourney(day);
  return day;
}
