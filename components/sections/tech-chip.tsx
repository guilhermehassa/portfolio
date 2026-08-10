import type { TechItem } from "@/lib/content";
import { DARK_INVERT_ICONS, getInitials, getTechIconUrl } from "@/lib/tech-icons";

export function TechChip({ item }: { item: TechItem }) {
  return (
    <li className="chip tech-chip">
      {item.icon ? (
        // Third-party per-slug SVG icon fetched at runtime from simpleicons/devicon;
        // next/image disables SVG optimization by default for security, and there's
        // no raster benefit at 16px, so a plain <img> is the right call here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getTechIconUrl(item.icon)}
          alt=""
          aria-hidden="true"
          className="tech-icon"
          data-dark-invert={DARK_INVERT_ICONS.has(item.icon) ? "true" : undefined}
        />
      ) : (
        <span className="tech-initials">{getInitials(item.name)}</span>
      )}
      <span>{item.name}</span>
    </li>
  );
}
