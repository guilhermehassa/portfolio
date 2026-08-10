"use client";

import Image from "next/image";
import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function HeroSection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <section
      id="hero"
      ref={ref}
      data-animate
      className={`glass-panel grid gap-8 overflow-hidden p-6 md:grid-cols-[1.3fr_1fr] md:p-10 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "90ms" } : undefined}
    >
      <div className="space-y-6">
        <h1 className="font-display text-4xl font-semibold leading-tight text-slate-900 dark:text-slate-100 md:text-5xl">
          {copy.heroTitle}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-slate-700 dark:text-slate-300 md:text-lg">
          {copy.heroText}
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#contact" className="btn-primary">
            {copy.ctaPrimary}
          </a>
          <a href="#projects" className="btn-secondary">
            {copy.ctaSecondary}
          </a>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-xs md:max-w-sm">
        <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-tr from-brand-500/40 via-brand-300/20 to-slate-300/20 blur-md dark:from-brand-300/35 dark:to-slate-700/25" />
        <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-white/70 shadow-card dark:border-slate-700">
          <Image
            src="/perfil.png"
            alt={copy.portraitAlt}
            fill
            priority
            sizes="(min-width: 768px) 384px, 320px"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
