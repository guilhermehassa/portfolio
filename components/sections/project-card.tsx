import Image from "next/image";
import type { Project } from "@/lib/content";

export function ProjectCard({ project, visitLabel }: { project: Project; visitLabel: string }) {
  return (
    <>
      <div className="project-media">
        <Image
          src={project.image}
          alt={project.imageAlt}
          fill
          className="project-image"
          sizes="(min-width: 1024px) 40vw, (min-width: 640px) 55vw, 85vw"
        />
      </div>
      <div className="project-content">
        <h3 className="project-title">{project.name}</h3>
        <p className="project-description">{project.description}</p>
        {project.tags.length > 0 && (
          <ul className="project-meta">
            {project.tags.map((tag) => (
              <li key={tag} className="project-chip">
                {tag}
              </li>
            ))}
          </ul>
        )}
        {project.url && (
          <a href={project.url} target="_blank" rel="noreferrer" className="project-link">
            {visitLabel}
          </a>
        )}
      </div>
    </>
  );
}
