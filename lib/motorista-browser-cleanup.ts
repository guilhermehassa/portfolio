// Limpeza de resíduos: estas chaves nunca pertencem ao Auth ou ao Firebase real.
const retiredKeys = ["motorista-local-sandbox-v1", "motorista-isolated-qa-v4"] as const;

export function clearRetiredMotoristaStorage(storage: Pick<Storage, "removeItem">) {
  let failure: unknown;
  for (const key of retiredKeys) {
    try { storage.removeItem(key); }
    catch (error) { failure = error; }
  }
  if (failure !== undefined) throw failure;
}
