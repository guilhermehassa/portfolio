"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { ContactForm } from "@/components/sections/contact-form";

export function ContactSection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <section
      id="contact"
      ref={ref}
      data-animate
      className={`glass-panel grid gap-7 p-6 md:grid-cols-[1fr_1.2fr] md:p-8 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "240ms" } : undefined}
    >
      <div className="space-y-4">
        <h2 className="section-title">{copy.sectionContactTitle}</h2>
        <p className="section-subtitle">{copy.sectionContactText}</p>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {copy.channelsLabel}
          </p>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>
              <a
                className="underline decoration-brand-400 decoration-2 underline-offset-4 hover:text-brand-700 dark:hover:text-brand-300"
                href="https://linkedin.com/in/guilhermehassa"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                className="underline decoration-brand-400 decoration-2 underline-offset-4 hover:text-brand-700 dark:hover:text-brand-300"
                href="https://github.com/guilhermehassa"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                className="underline decoration-brand-400 decoration-2 underline-offset-4 hover:text-brand-700 dark:hover:text-brand-300"
                href="mailto:contato@hassa.dev.br"
              >
                contato@hassa.dev.br
              </a>
            </li>
          </ul>
        </div>
      </div>

      <ContactForm />
    </section>
  );
}
