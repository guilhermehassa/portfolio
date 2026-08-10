"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function AiAssistedSection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <section
      id="ai-assisted"
      ref={ref}
      data-animate
      className={`space-y-5 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "155ms" } : undefined}
    >
      <h2 className="section-title">{copy.sectionAiTitle}</h2>
      <p className="section-subtitle">{copy.sectionAiText}</p>
      <ul className="grid gap-3 md:grid-cols-3">
        {copy.aiPractices.map((practice) => (
          <li
            key={practice}
            className="glass-panel border border-slate-200/80 p-5 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {practice}
          </li>
        ))}
      </ul>
    </section>
  );
}
