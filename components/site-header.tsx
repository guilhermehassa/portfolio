"use client";

import { useRef } from "react";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function SiteHeader() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <header className="mx-auto w-full max-w-6xl px-4 pb-4 pt-6 sm:px-6 lg:px-8">
      <div
        ref={ref}
        data-animate
        className={`glass-panel flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5 ${isVisible ? "is-visible" : ""}`}
        style={isVisible ? { transitionDelay: "50ms" } : undefined}
      >
        <a href="#hero" className="inline-flex items-center gap-3">
          <Logo className="h-10 w-10 text-brand-700 dark:text-brand-300" />
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
              {copy.brand}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{copy.role}</p>
          </div>
        </a>

        <div className="flex flex-wrap items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
