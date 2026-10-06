// O modo isolado só existe no servidor de desenvolvimento quando habilitado
// explicitamente. Não autentica nem escreve no Firebase; serve à QA de formulários.
import {
  onSnapshot as firebaseSnapshot,
  setDoc as firebaseSet,
  deleteDoc as firebaseDelete,
  runTransaction as firebaseTransaction,
  writeBatch as firebaseBatch,
  type DocumentReference,
  type DocumentData,
  type Firestore,
  type Transaction,
} from "firebase/firestore";
import { DEFAULT_CATEGORIES, emptyDay, localDate } from "./motorista";

export { collection, doc } from "firebase/firestore";
export function isolatedTest() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_MOTORISTA_TEST_MODE === "true"
  );
}
type RecordData = Record<string, DocumentData>;
const listeners = new Set<() => void>();
let state: RecordData | null = null;
function records() {
  if (state) return state;
  const cached =
    typeof window !== "undefined"
      ? localStorage.getItem("motorista-isolated-qa-v4")
      : null;
  if (cached) {
    state = JSON.parse(cached) as RecordData;
    return state;
  }
  const today = localDate(),
    base = `users/isolated-test/`;
  state = {};
  DEFAULT_CATEGORIES.forEach(
    (c) =>
      (state![`${base}categories/${c.id}`] = {
        ...c,
        scope: "operational",
        costKind: c.id === "combustivel" ? "fuel" : "variable",
      }),
  );
  state[`${base}days/${today}`] = {
    ...emptyDay(today),
    uberCents: 15000,
    ninetyNineCents: 5000,
    status: "pending",
    filled: { uberCents: true, ninetyNineCents: true },
  };
  const yesterday = new Date(today + "T12:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const date = localDate(yesterday);
  state[`${base}days/${date}`] = {
    ...emptyDay(date),
    uberCents: 32000,
    minutes: 480,
    km: 160,
    status: "closed",
    filled: { uberCents: true, minutes: true, km: true },
    shift: "mixed",
  };
  state[`${base}expenses/test-fuel`] = {
    id: "test-fuel",
    date,
    categoryId: "combustivel",
    cents: 8000,
    note: "Dado isolado de QA",
    kind: "fuel",
    fuel: { incomplete: true },
  };
  state[`${base}goals/${today.slice(0, 7)}`] = {
    month: today.slice(0, 7),
    cents: 600000,
  };
  return state;
}
function publish() {
  if (typeof window !== "undefined")
    localStorage.setItem("motorista-isolated-qa-v4", JSON.stringify(records()));
  listeners.forEach((fn) => fn());
}
function snapshot(ref: DocumentReference) {
  const data = records()[ref.path];
  return {
    exists: () => data !== undefined,
    data: () => (data ? structuredClone(data) : undefined),
  };
}
export const onSnapshot: typeof firebaseSnapshot = ((
  ref: { path: string },
  next: (s: unknown) => void,
  error: unknown,
) => {
  if (!isolatedTest())
    return firebaseSnapshot(
      ref as unknown as Parameters<typeof firebaseSnapshot>[0],
      next as never,
      error as never,
    );
  const emit = () =>
    next({
      docs: Object.entries(records())
        .filter(
          ([path]) =>
            path.startsWith(ref.path + "/") &&
            !path.slice(ref.path.length + 1).includes("/"),
        )
        .map(([path, data]) => ({
          id: path.split("/").at(-1),
          data: () => structuredClone(data),
        })),
    });
  listeners.add(emit);
  queueMicrotask(emit);
  return () => {
    listeners.delete(emit);
  };
}) as unknown as typeof firebaseSnapshot;
export const setDoc: typeof firebaseSet = (async (
  ref: DocumentReference,
  data: DocumentData,
  options?: { merge?: boolean },
) => {
  if (!isolatedTest())
    return options ? firebaseSet(ref, data, options) : firebaseSet(ref, data);
  records()[ref.path] = options?.merge
    ? { ...records()[ref.path], ...structuredClone(data) }
    : structuredClone(data);
  publish();
}) as typeof firebaseSet;
export const deleteDoc: typeof firebaseDelete = async (ref) => {
  if (!isolatedTest()) return firebaseDelete(ref);
  delete records()[ref.path];
  publish();
};
export const runTransaction: typeof firebaseTransaction = (async <T>(
  db: Firestore,
  action: (tx: Transaction) => Promise<T>,
) => {
  if (!isolatedTest()) return firebaseTransaction(db, action);
  const staged: Array<() => void> = [];
  const tx = {
    get: async (ref: DocumentReference) => snapshot(ref),
    set: (
      ref: DocumentReference,
      data: DocumentData,
      options?: { merge?: boolean },
    ) => {
      staged.push(() => {
        records()[ref.path] = options?.merge
          ? { ...records()[ref.path], ...structuredClone(data) }
          : structuredClone(data);
      });
      return tx;
    },
    delete: (ref: DocumentReference) => {
      staged.push(() => {
        delete records()[ref.path];
      });
      return tx;
    },
  };
  const result = await action(tx as unknown as Transaction);
  staged.forEach((fn) => fn());
  publish();
  return result;
}) as typeof firebaseTransaction;
export const writeBatch: typeof firebaseBatch = (db) => {
  if (!isolatedTest()) return firebaseBatch(db);
  const staged: Array<() => void> = [];
  const batch = {
    set: (ref: DocumentReference, data: DocumentData) => {
      staged.push(() => {
        records()[ref.path] = structuredClone(data);
      });
      return batch;
    },
    delete: (ref: DocumentReference) => {
      staged.push(() => {
        delete records()[ref.path];
      });
      return batch;
    },
    commit: async () => {
      staged.forEach((fn) => fn());
      publish();
    },
  };
  return batch as unknown as ReturnType<typeof firebaseBatch>;
};
