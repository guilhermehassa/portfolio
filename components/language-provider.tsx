"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { type Locale, type LocaleContent, PORTFOLIO_CONTENT } from "@/lib/content";

const LANGUAGE_KEY = "portfolio.lang";
const DEFAULT_LOCALE: Locale = "pt-BR";

interface LanguageContextValue {
  locale: Locale;
  copy: LocaleContent;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Module-level store: localStorage writes made from this tab don't fire the
// native "storage" event (only other tabs get that), so the store tracks
// its own listeners and notifies them itself on every write.
let cachedLocale: Locale | null = null;
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

function getSnapshot(): Locale {
  if (cachedLocale === null) {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    cachedLocale = stored === "en" ? "en" : DEFAULT_LOCALE;
  }
  return cachedLocale;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function writeLocale(next: Locale) {
  cachedLocale = next;
  window.localStorage.setItem(LANGUAGE_KEY, next);
  emitChange();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore (not state+effect) is the documented React tool for
  // reading external, client-only state like localStorage: it renders the
  // server-matching default on the first pass and switches to the stored
  // value right after, without a setState-in-effect cascade.
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const copy = PORTFOLIO_CONTENT[locale];

  useEffect(() => {
    document.documentElement.lang = copy.langCode;

    // Next's metadata system re-asserts its own (locale-less, SSR-default)
    // <title> at an unpredictable point during/after hydration, reverting a
    // one-time write here regardless of how long it's deferred. Since there's
    // no reliable moment to "go last", watch the title node instead and
    // correct it back whenever something else changes it.
    const desiredTitle = copy.pageTitle;
    document.title = desiredTitle;

    const titleElement = document.querySelector("title");
    if (!titleElement) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.title !== desiredTitle) {
        document.title = desiredTitle;
      }
    });
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, [copy.langCode, copy.pageTitle]);

  const setLocale = useCallback((next: Locale) => writeLocale(next), []);

  const value = useMemo<LanguageContextValue>(() => ({ locale, copy, setLocale }), [locale, copy, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
}
