"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { TechChip } from "@/components/sections/tech-chip";

export function TechStackSection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <section
      id="stack"
      ref={ref}
      data-animate
      className={`space-y-5 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "130ms" } : undefined}
    >
      <h2 className="section-title">{copy.sectionTechTitle}</h2>
      <p className="section-subtitle">{copy.sectionTechText}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {copy.techGroups.map((group) => (
          <article
            key={group.title}
            className="glass-panel border border-slate-200/70 p-6 dark:border-slate-700/80"
          >
            <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
              {group.title}
            </h3>
            <ul className="tech-chips mt-4 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <TechChip key={item.name} item={item} />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
