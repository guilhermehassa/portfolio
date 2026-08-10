"use client";

import Image from "next/image";
import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function OwnProjectsSection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);

  return (
    <section
      id="own-projects"
      ref={ref}
      data-animate
      className={`space-y-5 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "225ms" } : undefined}
    >
      <h2 className="section-title">{copy.sectionOwnProjectsTitle}</h2>
      <p className="section-subtitle">{copy.sectionOwnProjectsText}</p>

      {/* Um projeto embaixo do outro: a lista cresce na vertical conforme
          novos produtos autorais entram em lib/content.ts. */}
      <div className="own-projects">
        {copy.ownProjects.map((project) => (
          <article
            key={project.name}
            className="own-project glass-panel border border-slate-200/80 dark:border-slate-700"
          >
            <header className="own-project-header">
              {/* O logo tem wordmark azul-marinho sobre uma placa clara: fica
                  ilegivel direto no fundo escuro, entao mora numa superficie
                  clara nos dois temas. */}
              <span className="own-project-logo">
                <Image
                  src={project.logo}
                  alt={project.logoAlt}
                  width={480}
                  height={94}
                  className="h-8 w-auto md:h-9"
                />
              </span>
              <div className="space-y-1">
                <p className="own-project-meta">{project.meta}</p>
                <p className="own-project-tagline">{project.tagline}</p>
              </div>
            </header>

            <div className="own-project-body">
              <p className="own-project-summary">{project.summary}</p>

              <ul className="tech-chips">
                {project.stack.map((tech) => (
                  <li key={tech} className="tech-chip">
                    {tech}
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <h3 className="own-project-subtitle">{project.highlightsTitle}</h3>
                <ul className="grid gap-3 md:grid-cols-2">
                  {project.highlights.map((highlight) => (
                    <li key={highlight.title} className="own-project-highlight">
                      <h4 className="own-project-highlight-title">{highlight.title}</h4>
                      <p className="own-project-highlight-text">{highlight.text}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <dl className="own-project-stats">
                {project.stats.map((stat) => (
                  <div key={stat.label} className="own-project-stat">
                    <dt className="own-project-stat-value">{stat.value}</dt>
                    <dd className="own-project-stat-label">{stat.label}</dd>
                  </div>
                ))}
              </dl>

              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary self-start"
                aria-label={`${copy.ownProjectVisitLabel} ${project.name} - ${project.urlLabel}`}
              >
                {copy.ownProjectVisitLabel} {project.urlLabel}
                <svg
                  className="ml-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17 17 7" />
                  <path d="M9 7h8v8" />
                </svg>
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
