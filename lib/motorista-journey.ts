import type { Day, Journey, JourneyPause } from "./motorista";

export type JourneyState = "not-started" | "running" | "paused" | "ended";

const pad = (value: number) => String(value).padStart(2, "0");
const minute = 60_000;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/;

export function localDateTime(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function instantToLocalInput(instant: string): string {
  return localDateTime(new Date(instant));
}

export function journeyInstant(input: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))
    throw new Error("Informe uma data e hora válidas.");
  const date = new Date(input);
  if (!Number.isFinite(date.getTime()) || localDateTime(date) !== input)
    throw new Error("Informe uma data e hora válidas.");
  const offset = -date.getTimezoneOffset();
  return `${input}:00${offset >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

function instantTime(value: unknown): number {
  if (typeof value !== "string" || !instantPattern.test(value))
    throw new Error("Os horários da jornada devem incluir data, hora e fuso.");
  const result = Date.parse(value);
  const civil = value.slice(0, 16);
  const [year, month, day, hour, minutes] = civil.match(/\d+/g)!.map(Number);
  const civilDate = new Date(Date.UTC(year, month - 1, day, hour, minutes));
  if (
    !Number.isFinite(result) ||
    civilDate.getUTCFullYear() !== year ||
    civilDate.getUTCMonth() !== month - 1 ||
    civilDate.getUTCDate() !== day ||
    hour > 23 || minutes > 59 ||
    Number(value.slice(20, 22)) > 23 || Number(value.slice(23, 25)) > 59
  )
    throw new Error("Há uma data ou hora inválida na jornada.");
  return result;
}

export function journeyMinutes(journey: Journey): number | null {
  const start = instantTime(journey.startedAt);
  if (!Array.isArray(journey.pauses))
    throw new Error("As pausas da jornada são inválidas.");
  const end = journey.endedAt === null ? null : instantTime(journey.endedAt);
  if (end !== null && end < start)
    throw new Error("O encerramento deve ocorrer depois do início da jornada.");
  let previousEnd = start;
  let paused = 0;
  const ids = new Set<string>();
  for (const [index, pause] of journey.pauses.entries()) {
    if (
      !pause || typeof pause !== "object" ||
      typeof pause.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(pause.id) ||
      ids.has(pause.id)
    ) throw new Error("Há uma pausa inválida ou duplicada.");
    ids.add(pause.id);
    const pauseStart = instantTime(pause.startedAt);
    if (pauseStart < previousEnd || (end !== null && pauseStart > end))
      throw new Error("As pausas devem ocorrer em ordem, dentro da jornada e sem sobreposição.");
    if (pause.endedAt === null) {
      if (end !== null || index !== journey.pauses.length - 1)
        throw new Error("Encerre a pausa antes de encerrar a jornada ou iniciar outra pausa.");
      return null;
    }
    const pauseEnd = instantTime(pause.endedAt);
    if (pauseEnd < pauseStart || (end !== null && pauseEnd > end))
      throw new Error("O fim da pausa deve ocorrer depois de seu início e dentro da jornada.");
    paused += pauseEnd - pauseStart;
    previousEnd = pauseEnd;
  }
  if (end === null) return null;
  const result = (end - start - paused) / minute;
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error("A duração da jornada deve ser um número inteiro de minutos.");
  return result;
}

export function validateJourney(day: Pick<Day, "date" | "journey" | "minutes" | "filled" | "status">): void {
  if (day.journey === undefined) return;
  if (!day.journey || typeof day.journey !== "object")
    throw new Error("Os horários da jornada são inválidos.");
  if (typeof day.journey.startedAt !== "string" || day.journey.startedAt.slice(0, 10) !== day.date)
    throw new Error("A data do dia deve ser a data de início da jornada.");
  const duration = journeyMinutes(day.journey);
  if (duration !== null && duration !== day.minutes)
    throw new Error("Os minutos gravados não correspondem aos horários e pausas da jornada.");
}

export function journeyState(day?: Pick<Day, "journey">): JourneyState {
  if (!day?.journey) return "not-started";
  if (day.journey.endedAt !== null) return "ended";
  return day.journey.pauses.some((pause) => pause.endedAt === null) ? "paused" : "running";
}

export const journeyLabels: Record<JourneyState, string> = {
  "not-started": "Não iniciado",
  running: "Em andamento",
  paused: "Em pausa",
  ended: "Encerrado",
};

export function journeyFromFields(
  previous: Journey,
  startedAt: string,
  endedAt: string,
  pauses: Array<JourneyPause & { startedInput?: string; endedInput?: string }>,
): Journey {
  const result: Journey = {
    ...previous,
    startedAt: journeyInstant(startedAt),
    endedAt: endedAt ? journeyInstant(endedAt) : null,
    pauses: pauses.map(({ startedInput, endedInput, ...pause }) => ({
      ...pause,
      startedAt: startedInput === undefined ? pause.startedAt : journeyInstant(startedInput),
      endedAt: endedInput === undefined ? pause.endedAt : endedInput ? journeyInstant(endedInput) : null,
    })),
  };
  journeyMinutes(result);
  return result;
}
