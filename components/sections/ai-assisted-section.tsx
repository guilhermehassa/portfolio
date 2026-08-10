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
            key={practice.title}
            className="glass-panel border border-slate-200/80 p-5 dark:border-slate-700"
          >
            <h3 className="practice-title">{practice.title}</h3>
            <p className="practice-text">{practice.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
