"use client";
import { useState, type FormEvent } from "react";
import type { PaymentMethod } from "@/lib/motorista";
import { validatePaymentMethod } from "@/lib/motorista-payment-methods";
import { FormError } from "./motorista-forms";
import type { SaveDocument } from "./motorista-settings";

type Props = { paymentMethods: PaymentMethod[]; saving: boolean; save: SaveDocument };

export function PaymentMethodSettings({ paymentMethods, saving, save }: Props) {
  const [selected, setSelected] = useState("new");
  const [revision, setRevision] = useState(0);
  return <div className="motorista-card motorista-form">
    <h2>Formas de pagamento</h2>
    <label>Forma cadastrada
      <select value={selected} onChange={(event) => { setSelected(event.target.value); setRevision(revision + 1); }}>
        <option value="new">Nova forma de pagamento</option>
        {[...paymentMethods].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((method) =>
          <option key={method.id} value={method.id}>{method.name}{method.active ? "" : " · Inativa"}</option>)}
      </select>
    </label>
    <PaymentMethodEditor key={`${selected}-${revision}`} initial={paymentMethods.find((method) => method.id === selected)}
      paymentMethods={paymentMethods} saving={saving} save={save}
      done={() => { setSelected("new"); setRevision(revision + 1); }} />
  </div>;
}

export function PaymentMethodEditor({ initial: incoming, paymentMethods, saving, save, done }: Props & {
  initial?: PaymentMethod;
  done: () => void;
}) {
  const [initial] = useState(incoming);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<PaymentMethod["type"]>(initial?.type ?? "other");
  const [closingDay, setClosingDay] = useState(initial?.closingDay == null ? "" : String(initial.closingDay));
  const [dueDay, setDueDay] = useState(initial?.dueDay == null ? "" : String(initial.dueDay));
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (saving) return;
    try {
      const normalizedName = name.normalize("NFKC").trim().replace(/\s+/g, " ");
      const sameName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
      if (paymentMethods.some((method) => method.id !== initial?.id && sameName(method.name) === sameName(normalizedName)))
        throw new Error("Já existe uma forma de pagamento com esse nome. Selecione-a para editar.");
      const method: PaymentMethod = { ...initial, id: initial?.id ?? crypto.randomUUID(), name: normalizedName, type, active,
        ...(type === "credit" ? { closingDay: closingDay.trim() ? Number(closingDay) : null,
          dueDay: dueDay.trim() ? Number(dueDay) : null } :
          initial?.closingDay != null || initial?.dueDay != null ? { closingDay: null, dueDay: null } : {}) };
      validatePaymentMethod(method);
      if (await save("paymentMethods", method.id, method, initial)) done();
    } catch (error) { setError(error instanceof Error ? error.message : "Revise a forma de pagamento."); }
  }
  return <form className="motorista-form" onSubmit={submit}>
    <FormError>{error}</FormError>
    <div className="motorista-field-grid">
      <label>Nome
        <input value={name} required maxLength={80} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>Tipo
        <select value={type} onChange={(event) => setType(event.target.value as PaymentMethod["type"])}>
          <option value="other">Outro</option>
          <option value="credit">Cartão de Crédito</option>
        </select>
      </label>
    </div>
    {type === "credit" ? <div className="motorista-field-grid">
      <label>Dia de fechamento
        <input type="number" min={1} max={31} step={1} inputMode="numeric" value={closingDay} required
          onChange={(event) => setClosingDay(event.target.value)} />
      </label>
      <label>Dia de vencimento
        <input type="number" min={1} max={31} step={1} inputMode="numeric" value={dueDay} required
          onChange={(event) => setDueDay(event.target.value)} />
      </label>
    </div> : <small>Use Outro para Pix, Dinheiro ou Cartão de Débito.</small>}
    <label className="motorista-check">
      <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
      <span>Ativa para novos gastos</span>
    </label>
    <button className="motorista-primary" disabled={saving}>
      {saving ? "Salvando…" : initial ? "Salvar forma de pagamento" : "Cadastrar forma de pagamento"}
    </button>
  </form>;
}
