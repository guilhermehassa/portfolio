export const TOAST_LIFETIME_MS = 5000;
export const TOAST_EXIT_MS = 240;

export type ToastSnapshot = {
  id: number;
  message: string;
  error: boolean;
  closing: boolean;
};

export type TransientClock = {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timer: unknown) => void;
};

export const transientClock: TransientClock = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

export function createMotoristaToast(clock = transientClock) {
  let snapshot: ToastSnapshot | null = null;
  let lifetime: unknown = null;
  let exit: unknown = null;
  let revision = 0;
  let nextId = 0;
  let active = true;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const cancelTimers = () => {
    if (lifetime !== null) clock.clearTimeout(lifetime);
    if (exit !== null) clock.clearTimeout(exit);
    lifetime = exit = null;
  };
  const dismiss = () => {
    if (!active || !snapshot || snapshot.closing) return;
    cancelTimers();
    const expected = ++revision;
    snapshot = { ...snapshot, closing: true };
    emit();
    exit = clock.setTimeout(() => {
      if (!active || revision !== expected) return;
      exit = null;
      snapshot = null;
      emit();
    }, TOAST_EXIT_MS);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    show: (message: string) => {
      if (!active) return;
      if (!message) return dismiss();
      cancelTimers();
      const expected = ++revision;
      snapshot = { id: ++nextId, message, error: message.startsWith("Não"), closing: false };
      emit();
      lifetime = clock.setTimeout(() => {
        if (!active || revision !== expected) return;
        lifetime = null;
        dismiss();
      }, TOAST_LIFETIME_MS);
    },
    activate: () => { active = true; },
    dispose: () => {
      active = false;
      revision++;
      cancelTimers();
      snapshot = null;
    },
  };
}
