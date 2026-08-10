"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { Swiper as SwiperType } from "swiper";
import { useLanguage } from "@/components/language-provider";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const ProjectsCarousel = dynamic(() => import("@/components/sections/projects-carousel"), {
  ssr: false,
  loading: () => (
    <div className="projects-swiper swiper aspect-[16/9] animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
  ),
});

const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProjectsSection() {
  const { copy } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  const isVisible = useScrollReveal(ref);
  const progressRef = useRef<SVGCircleElement>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  const hasMultipleProjects = copy.projects.length > 1;

  return (
    <section
      id="projects"
      ref={ref}
      data-animate
      className={`space-y-5 ${isVisible ? "is-visible" : ""}`}
      style={isVisible ? { transitionDelay: "210ms" } : undefined}
    >
      <h2 className="section-title">{copy.sectionProjectsTitle}</h2>
      <p className="section-subtitle">{copy.sectionProjectsText}</p>

      <div className="projects-carousel glass-panel border border-slate-200/80 p-4 dark:border-slate-700 md:p-6">
        <div className="projects-toolbar">
          <p className="projects-hint">{copy.projectsCarouselHint}</p>

          <div className="projects-controls">
            <div className="projects-timer" aria-hidden="true">
              <svg className="projects-timer-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle className="projects-timer-track" cx="18" cy="18" r={RING_RADIUS} />
                <circle ref={progressRef} className="projects-timer-progress" cx="18" cy="18" r={RING_RADIUS} />
              </svg>
            </div>
            <button
              type="button"
              className="projects-control-btn"
              aria-label={copy.projectsPrevLabel}
              disabled={!hasMultipleProjects}
              onClick={() => swiperRef.current?.slidePrev()}
            >
              <span>{copy.projectsPrevShort}</span>
            </button>
            <button
              type="button"
              className="projects-control-btn"
              aria-label={copy.projectsNextLabel}
              disabled={!hasMultipleProjects}
              onClick={() => swiperRef.current?.slideNext()}
            >
              <span>{copy.projectsNextShort}</span>
            </button>
          </div>
        </div>

        <ProjectsCarousel
          projects={copy.projects}
          visitLabel={copy.projectVisitLabel}
          paginationLabel={copy.projectsCarouselLabel}
          ringRadius={RING_RADIUS}
          onSwiperReady={(swiper) => {
            swiperRef.current = swiper;
          }}
          onProgressChange={(strokeDashoffset) => {
            const node = progressRef.current;
            if (node) {
              node.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
              node.style.strokeDashoffset = String(strokeDashoffset);
            }
          }}
        />
      </div>
    </section>
  );
}
