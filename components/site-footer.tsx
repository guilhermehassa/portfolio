"use client";

import { useLanguage } from "@/components/language-provider";

export function SiteFooter() {
  const { copy } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-300/80 pt-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300 md:flex-row md:items-center">
        <p>{copy.footerText}</p>
        <p>
          {year} · hassa.dev.br
        </p>
      </div>
    </footer>
  );
}
