"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Keyboard, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { ProjectCard } from "@/components/sections/project-card";
import type { Project } from "@/lib/content";

interface ProjectsCarouselProps {
  projects: Project[];
  visitLabel: string;
  paginationLabel: string;
  ringRadius: number;
  onSwiperReady: (swiper: SwiperType) => void;
  onProgressChange: (strokeDashoffset: number, circumference: number) => void;
}

export default function ProjectsCarousel({
  projects,
  visitLabel,
  paginationLabel,
  ringRadius,
  onSwiperReady,
  onProgressChange,
}: ProjectsCarouselProps) {
  const hasMultipleProjects = projects.length > 1;

  return (
    <Swiper
      modules={[Pagination, Autoplay, Keyboard]}
      className="projects-swiper swiper"
      slidesPerView={1.2}
      spaceBetween={14}
      speed={520}
      grabCursor
      loop={hasMultipleProjects}
      keyboard={{ enabled: true, onlyInViewport: true }}
      pagination={{
        clickable: true,
        bulletClass: "projects-dot",
        bulletActiveClass: "is-active",
        renderBullet: (index, className) => {
          const project = projects[index];
          const label = project ? project.name : `Slide ${index + 1}`;
          return `<button type="button" class="${className}" aria-label="${label}"></button>`;
        },
      }}
      autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
      onSwiper={(swiper) => {
        // Let Swiper create and own its default pagination container (no
        // external `el` fed in) — pointing pagination at a ref owned by a
        // sibling component is fragile (the ref is null until after this
        // mounts) and re-initializing pagination onto it after the fact
        // corrupts Swiper's internal bullet bookkeeping. Style whatever
        // element Swiper actually created instead: give it the same
        // `.projects-dots` layout class the legacy markup used, and the
        // aria-label the legacy code put on that container.
        const paginationEl = swiper.pagination?.el;
        if (paginationEl && !Array.isArray(paginationEl)) {
          paginationEl.classList.add("projects-dots");
          paginationEl.setAttribute("aria-label", paginationLabel);
        }
        onSwiperReady(swiper);
      }}
      onAutoplayTimeLeft={(swiper, time) => {
        const autoplayConfig = swiper.params.autoplay;
        const delay = autoplayConfig && typeof autoplayConfig === "object" ? (autoplayConfig.delay ?? 0) : 0;
        const remaining = delay ? Math.max(0, Math.min(1, time / delay)) : 0;
        const progress = 1 - remaining;
        const circumference = 2 * Math.PI * ringRadius;
        onProgressChange(circumference * (1 - progress), circumference);
      }}
      breakpoints={{
        640: { slidesPerView: 1.4, spaceBetween: 16 },
        768: { slidesPerView: 1.8, spaceBetween: 18 },
        1024: { slidesPerView: 2.4, spaceBetween: 20 },
      }}
    >
      {projects.map((project) => (
        <SwiperSlide key={project.name} className="project-slide">
          <ProjectCard project={project} visitLabel={visitLabel} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
