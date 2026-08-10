"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function DeliverySection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <section
      id="delivery"
      ref={ref}
      data-animate
      className={`space-y-5 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "180ms" } : undefined}
    >
      <h2 className="section-title">{copy.sectionDeliveryTitle}</h2>
      <p className="section-subtitle">{copy.sectionDeliveryText}</p>

      <div className="glass-panel border border-slate-200/80 p-5 dark:border-slate-700 md:p-6">
        <p className="delivery-label">{copy.deliveryPipelineLabel}</p>
        {/* A seta entre as etapas e decorativa: a ordem ja vem do <ol>. */}
        <ol className="delivery-pipeline">
          {copy.deliveryPipeline.map((step, index) => (
            <li key={step} className="delivery-step">
              <span className="delivery-step-chip">
                <span className="delivery-step-index">{index + 1}</span>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <ul className="grid gap-3 md:grid-cols-3">
        {copy.deliveryPractices.map((practice) => (
          <li
            key={practice.title}
            className="glass-panel border border-slate-200/80 p-5 dark:border-slate-700"
          >
            <h3 className="practice-title">{practice.title}</h3>
            <p className="practice-text">{practice.text}</p>
          </li>
        ))}
      </ul>

      <div className="glass-panel border border-slate-200/80 p-5 dark:border-slate-700 md:p-6">
        <p className="delivery-label">{copy.deliveryProfileLabel}</p>
        <ul className="tech-chips mt-3">
          {copy.deliveryProfile.map((fact) => (
            <li key={fact} className="tech-chip">
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
