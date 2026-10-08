import type { Day, Journey, JourneyPause } from "./motorista";
import { dayFromFields } from "./motorista-evolution";
import {
  journeyInstant,
  journeyMinutes,
  validateJourney,
} from "./motorista-journey";

export type EndingPause = JourneyPause & { startedInput: string; endedInput: string };

export function validateEndingTime(previous: Day, input: string, now = Date.now()): string {
  if (!previous.journey || previous.journey.endedAt !== null)
    throw new Error("A jornada não está aberta. Reabra o formulário.");
  const endedAt = journeyInstant(input);
  if (Date.parse(endedAt) < Date.parse(previous.journey.startedAt))
    throw new Error("O encerramento deve ocorrer depois do início da jornada.");
  if (Date.parse(endedAt) > now)
    throw new Error("A data e hora de encerramento não podem estar no futuro.");
  return endedAt;
}

export function endingJourney(
  previous: Day,
  endedInput: string,
  pauses: EndingPause[],
  now = Date.now(),
): Journey {
  const endedAt = validateEndingTime(previous, endedInput, now);
  const journey: Journey = {
    ...previous.journey!, endedAt,
    pauses: pauses.map(({ startedInput, endedInput: pauseEnd, ...pause }) => {
      if (!pauseEnd) throw new Error("Informe o fim de todas as pausas antes de encerrar o dia.");
      return { ...pause, startedAt: journeyInstant(startedInput), endedAt: journeyInstant(pauseEnd) };
    }),
  };
  journeyMinutes(journey);
  return journey;
}

export function endingDay(
  previous: Day,
  endedInput: string,
  pauses: EndingPause[],
  fields: Record<string, string>,
  now = Date.now(),
): Day {
  const journey = endingJourney(previous, endedInput, pauses, now);
  const duration = journeyMinutes(journey)!;
  if (!fields.odometerEnd?.trim())
    throw new Error("Informe o odômetro final para encerrar o dia.");
  const day = dayFromFields(previous.date, previous, {
    ...fields,
    hours: String(Math.floor(duration / 60)),
    minutes: String(duration % 60),
  }, "closed");
  day.journey = journey;
  validateJourney(day);
  return day;
}
