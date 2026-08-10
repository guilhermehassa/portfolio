"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageToggle() {
  const { locale, copy, setLocale } = useLanguage();

  return (
    <div className="segmented-toggle" role="group" aria-label={copy.languageLabel} data-value={locale}>
      <span className="segmented-indicator" aria-hidden="true" />
      <button
        type="button"
        className={`segmented-option ${locale === "pt-BR" ? "is-active" : ""}`}
        aria-pressed={locale === "pt-BR"}
        onClick={() => setLocale("pt-BR")}
      >
        {copy.languagePt}
      </button>
      <button
        type="button"
        className={`segmented-option ${locale === "en" ? "is-active" : ""}`}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        {copy.languageEn}
      </button>
    </div>
  );
}
