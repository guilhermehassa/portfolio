"use client";
import { useState, type FormEvent } from "react";
import { civilDate, isDate, isMonth, localDate, money, parseCents, type Expense, type PaymentMethod } from "@/lib/motorista";
import { expensePaymentFields } from "@/lib/motorista-payment-methods";
import { FormError, MoneyField, PaymentMethodField } from "./motorista-forms";

export type MaintenanceDraft = {
  categoryId: string;
  totalCents: number;
  startMonth: string;
  installments: number;
  note: string;
  purchaseDate?: string;
  paymentMethodId?: string | null;
  paymentMethodSnapshot?: Expense["paymentMethodSnapshot"];
};

export function MaintenanceEditor({ initial, paymentMethods = [], saving, onSave, onCancel, installmentsPreview }: {
  initial?: Expense;
  paymentMethods?: PaymentMethod[];
  saving: boolean;
  onSave: (draft: MaintenanceDraft, previous?: Expense) => Promise<boolean>;
  onCancel: () => void;
  installmentsPreview: (draft: Pick<MaintenanceDraft, "totalCents" | "startMonth" | "installments">) => Array<{ month: string; cents: number }>;
}) {
  const [previous] = useState(initial);
  const [note, setNote] = useState(initial?.note ?? "");
  const [value, setValue] = useState(initial?.cents == null ? "" : money(initial.cents));
  const [startMonth, setStartMonth] = useState(initial?.maintenance?.startMonth ?? localDate().slice(0, 7));
  const [installments, setInstallments] = useState(String(initial?.maintenance?.installments ?? 1));
  const [purchaseDate, setPurchaseDate] = useState(initial ? initial.purchaseDate ?? "" : localDate());
  const [purchaseDateChanged, setPurchaseDateChanged] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.paymentMethodId ?? "");
  const [error, setError] = useState("");
  const totalCents = parseCents(value), count = Number(installments);
  let preview: Array<{ month: string; cents: number }> = [];
  try {
    if (Number.isSafeInteger(totalCents) && totalCents > 0 && Number.isSafeInteger(count) && count > 0 && isMonth(startMonth))
      preview = installmentsPreview({ totalCents, startMonth, installments: count });
  } catch { /* A confirmação apresenta os dados inválidos. */ }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (saving) return;
    try {
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new Error("Informe um custo total positivo válido.");
      if (!isMonth(startMonth) || !Number.isSafeInteger(count) || count < 1) throw new Error("Informe o mês inicial e um número inteiro de parcelas.");
      const savePurchaseDate = !previous || previous.purchaseDate != null || purchaseDateChanged;
      if (savePurchaseDate && !isDate(purchaseDate)) throw new Error("Informe uma data da compra válida.");
      if (await onSave({ categoryId: previous?.categoryId ?? "manutencao", note,
        totalCents, startMonth, installments: count,
        ...(savePurchaseDate ? { purchaseDate } : {}),
        ...expensePaymentFields(paymentMethodId, paymentMethods, previous) }, previous)) onCancel();
    } catch (error) { setError(error instanceof Error ? error.message : "Revise os dados da manutenção."); }
  }
  return <form className="motorista-form" onSubmit={submit}>
    <FormError>{error}</FormError>
    <label>Data da compra
      <input type="date" value={purchaseDate} required={!previous || previous.purchaseDate != null || purchaseDateChanged}
        onChange={(event) => { setPurchaseDate(event.target.value); setPurchaseDateChanged(true); }} />
    </label>
    <label>Descrição
      <textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
    </label>
    <label>Custo total (R$)
      <MoneyField value={value} onChange={setValue} required />
    </label>
    <PaymentMethodField value={paymentMethodId} paymentMethods={paymentMethods} previous={previous} onChange={setPaymentMethodId} />
    <MaintenanceFields startMonth={startMonth} installments={installments} preview={preview}
      onStartMonthChange={setStartMonth} onInstallmentsChange={setInstallments} />
    <div className="motorista-actions motorista-dialog-actions">
      <button type="button" className="motorista-secondary" disabled={saving} onClick={onCancel}>Cancelar</button>
      <button className="motorista-primary" disabled={saving}>{saving ? "Salvando…" : previous ? "Salvar manutenção" : "Registrar manutenção"}</button>
    </div>
  </form>;
}

export const maintenanceMonthLabel = (month: string) => civilDate(`${month}-01`)
  .toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });

export function MaintenanceFields({ startMonth, installments, preview, onStartMonthChange, onInstallmentsChange }: {
  startMonth: string;
  installments: string;
  preview: Array<{ month: string; cents: number }>;
  onStartMonthChange: (value: string) => void;
  onInstallmentsChange: (value: string) => void;
}) {
  return <fieldset>
    <legend>Distribuição da manutenção</legend>
    <div className="motorista-field-grid">
      <label>Mês inicial
        <input type="month" value={startMonth} required onChange={(event) => onStartMonthChange(event.target.value)} />
      </label>
      <label>Número de parcelas
        <input type="number" min={1} step={1} inputMode="numeric" value={installments} required
          onChange={(event) => onInstallmentsChange(event.target.value)} />
      </label>
    </div>
    {preview.length > 0 && <ul className="motorista-maintenance-schedule" aria-label="Custos mensais da manutenção">
      {preview.map((row) => <li key={row.month}>
        <span>{maintenanceMonthLabel(row.month)}</span><strong>{money(row.cents)}</strong>
      </li>)}
    </ul>}
  </fieldset>;
}
