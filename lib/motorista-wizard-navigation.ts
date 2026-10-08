import { transientClock, type TransientClock } from "./motorista-toast";

export const WIZARD_SLIDE_OUT_MS = 150;
export const WIZARD_SLIDE_IN_MS = 180;

export type WizardNavigation = {
  step: number;
  direction: "forward" | "back";
  phase: "idle" | "leaving" | "entering";
};

export function createWizardNavigation(count: number, clock: TransientClock = transientClock) {
  let snapshot: WizardNavigation = { step: 0, direction: "forward", phase: "idle" };
  const initial = snapshot;
  let timer: unknown = null;
  let active = true;
  let revision = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const cancelTimer = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    move: (direction: "forward" | "back", reducedMotion = false) => {
      const next = snapshot.step + (direction === "forward" ? 1 : -1);
      if (!active || snapshot.phase !== "idle" || next < 0 || next >= count) return false;
      if (reducedMotion) {
        snapshot = { step: next, direction, phase: "idle" };
        emit();
        return true;
      }
      const expected = ++revision;
      snapshot = { ...snapshot, direction, phase: "leaving" };
      emit();
      timer = clock.setTimeout(() => {
        if (!active || revision !== expected) return;
        snapshot = { step: next, direction, phase: "entering" };
        emit();
        timer = clock.setTimeout(() => {
          if (!active || revision !== expected) return;
          timer = null;
          snapshot = { ...snapshot, phase: "idle" };
          emit();
        }, WIZARD_SLIDE_IN_MS);
      }, WIZARD_SLIDE_OUT_MS);
      return true;
    },
    activate: () => { active = true; },
    dispose: () => {
      active = false;
      revision++;
      cancelTimer();
      snapshot = { ...snapshot, phase: "idle" };
    },
  };
}
