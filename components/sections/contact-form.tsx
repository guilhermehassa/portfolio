"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/language-provider";
import {
  formatPhoneBr,
  validateEmail,
  validateName,
  validatePhone,
  validateSubject,
} from "@/lib/contact-validation";

type StatusType = "success" | "error" | "info";
interface Status {
  type: StatusType;
  message: string;
}

interface FieldValidity {
  name?: boolean;
  email?: boolean;
  phone?: boolean;
  subject?: boolean;
}

const STATUS_STYLES: Record<StatusType, string> = {
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  error: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  info: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200",
};

// URL do Cloudflare Worker que fala com a API do Brevo. Embutida no bundle em
// tempo de build (NEXT_PUBLIC_*), porque o site e estatico e nao ha servidor
// para ler env em runtime. Se faltar no build, o formulario valida e mostra o
// aviso para escrever no e-mail direto, em vez de postar num endpoint vazio.
const CONTACT_ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "";

export function ContactForm() {
  const { copy } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLSelectElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);

  const [invalidFields, setInvalidFields] = useState<FieldValidity>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [isSending, setIsSending] = useState(false);

  const setFieldInvalid = (field: keyof FieldValidity, invalid: boolean) => {
    setInvalidFields((prev) => (prev[field] === invalid ? prev : { ...prev, [field]: invalid }));
  };

  const handlePhoneChange = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const formatted = formatPhoneBr(input.value);
    if (input.value !== formatted) {
      input.value = formatted;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending) return;

    const nameValue = nameRef.current?.value ?? "";
    const emailValue = emailRef.current?.value ?? "";
    const phoneValue = phoneRef.current?.value ?? "";
    const subjectValue = subjectRef.current?.value ?? "";

    const isNameValid = validateName(nameValue);
    const isEmailValid = validateEmail(emailValue);
    const isPhoneValid = validatePhone(phoneValue);
    const isSubjectValid = validateSubject(subjectValue, copy.subjectOptions);

    setInvalidFields({
      name: !isNameValid,
      email: !isEmailValid,
      phone: !isPhoneValid,
      subject: !isSubjectValid,
    });

    if (!isNameValid) {
      setStatus({ type: "error", message: copy.formValidationName });
      nameRef.current?.focus();
      return;
    }
    if (!isEmailValid) {
      setStatus({ type: "error", message: copy.formValidationEmail });
      emailRef.current?.focus();
      return;
    }
    if (!isPhoneValid) {
      setStatus({ type: "error", message: copy.formValidationPhone });
      phoneRef.current?.focus();
      return;
    }
    if (!isSubjectValid) {
      setStatus({ type: "error", message: copy.formValidationSubject });
      subjectRef.current?.focus();
      return;
    }

    if (!CONTACT_ENDPOINT) {
      setStatus({ type: "info", message: copy.formStubNotice });
      return;
    }

    // O export estatico pode ser aberto direto do disco; ali fetch nao sai.
    if (typeof window !== "undefined" && window.location.protocol === "file:") {
      setStatus({ type: "error", message: copy.formLocalProtocolError });
      return;
    }

    setIsSending(true);
    setStatus({ type: "info", message: copy.formSending });

    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue,
          email: emailValue,
          phone: phoneValue,
          subject: subjectValue,
          // Rotulo legivel do assunto: o Worker monta o e-mail sem conhecer a
          // tabela de traducao, entao o texto vai junto com a chave.
          subjectLabel: copy.subjectOptions[subjectValue] ?? subjectValue,
          locale: copy.langCode,
          // Honeypot: campo invisivel que so bot preenche. Quem decide o
          // descarte e o Worker - aqui apenas repassamos o valor.
          website: websiteRef.current?.value ?? "",
        }),
      });

      if (!response.ok) {
        setStatus({ type: "error", message: copy.formError });
        return;
      }

      formRef.current?.reset();
      setInvalidFields({});
      setStatus({ type: "success", message: copy.formSuccess });
    } catch {
      // Rede indisponivel, DNS, CORS: nao houve resposta do servidor.
      setStatus({ type: "error", message: copy.formTransportError });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form ref={formRef} className="space-y-4" noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name" className="field-label">
          {copy.formNameLabel}
        </label>
        <input
          ref={nameRef}
          id="name"
          name="name"
          type="text"
          className={`field-input ${invalidFields.name ? "is-invalid" : ""}`}
          placeholder={copy.formNamePlaceholder}
          aria-invalid={invalidFields.name}
          onBlur={() => setFieldInvalid("name", !validateName(nameRef.current?.value ?? ""))}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="field-label">
            {copy.formEmailLabel}
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            className={`field-input ${invalidFields.email ? "is-invalid" : ""}`}
            placeholder={copy.formEmailPlaceholder}
            aria-invalid={invalidFields.email}
            onBlur={() => setFieldInvalid("email", !validateEmail(emailRef.current?.value ?? ""))}
            required
          />
        </div>
        <div>
          <label htmlFor="phone" className="field-label">
            {copy.formPhoneLabel}
          </label>
          <input
            ref={phoneRef}
            id="phone"
            name="phone"
            type="tel"
            className={`field-input ${invalidFields.phone ? "is-invalid" : ""}`}
            placeholder={copy.formPhonePlaceholder}
            aria-invalid={invalidFields.phone}
            onChange={handlePhoneChange}
            onBlur={() => setFieldInvalid("phone", !validatePhone(phoneRef.current?.value ?? ""))}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="field-label">
          {copy.formSubjectLabel}
        </label>
        <select
          ref={subjectRef}
          id="subject"
          name="subject"
          className={`field-input ${invalidFields.subject ? "is-invalid" : ""}`}
          aria-invalid={invalidFields.subject}
          defaultValue="custom-project"
          onChange={() =>
            setFieldInvalid("subject", !validateSubject(subjectRef.current?.value ?? "", copy.subjectOptions))
          }
          required
        >
          {Object.entries(copy.subjectOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input ref={websiteRef} id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isSending}>
        {isSending ? copy.formSending : copy.formSubmit}
      </button>

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${STATUS_STYLES[status.type]}`}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
