"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Caller owns the ref (rather than this hook returning one bundled with
 * derived state) so the eslint-plugin-react-hooks ref-safety analysis can
 * see plain state values flowing into JSX, not something ref-shaped.
 */
export function useScrollReveal<T extends Element>(ref: RefObject<T | null>): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }
        setIsVisible(true);
        observer.unobserve(entry.target);
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}
