"use client";

import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { copy } = useLanguage();
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <div
      className="theme-toggle"
      role="group"
      aria-label={copy.themeLabel}
      data-theme={theme}
      suppressHydrationWarning
    >
      <button
        type="button"
        className={`theme-toggle-option ${isLight ? "is-active" : ""}`}
        aria-pressed={isLight}
        aria-label={copy.themeLightLabel}
        onClick={() => setTheme("light")}
        suppressHydrationWarning
      >
        <span>{copy.themeLightShort}</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-option ${!isLight ? "is-active" : ""}`}
        aria-pressed={!isLight}
        aria-label={copy.themeDarkLabel}
        onClick={() => setTheme("dark")}
        suppressHydrationWarning
      >
        <span>{copy.themeDarkShort}</span>
      </button>

      <span className="theme-toggle-knob" aria-hidden="true">
        <svg className="knob-icon icon-sun" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M12 19V22" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M2 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M19 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M4.93 4.93L7.05 7.05" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M16.95 16.95L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M19.07 4.93L16.95 7.05" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <path d="M7.05 16.95L4.93 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        </svg>
        <svg className="knob-icon icon-moon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20.5 14.2C19.2 14.8 17.7 15.1 16.2 15.1C10.8 15.1 6.4 10.7 6.4 5.3C6.4 4 6.6 2.7 7.1 1.5C3.6 3 1 6.4 1 10.5C1 15.9 5.4 20.3 10.8 20.3C15.4 20.3 19.3 17.1 20.5 12.8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
    </div>
  );
}
