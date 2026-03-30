(() => {
  const content = window.PORTFOLIO_CONTENT;
  const LANGUAGE_KEY = "portfolio.lang";
  const THEME_KEY = "portfolio.theme";

  const techGroupsContainer = document.getElementById("tech-groups");
  const strengthsContainer = document.getElementById("strengths-list");
  const subjectSelect = document.getElementById("subject");
  const contactForm = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");
  const submitButton = document.getElementById("form-submit");
  const currentYear = document.getElementById("current-year");
  const themeToggle = document.getElementById("theme-toggle");
  const languagePt = document.getElementById("lang-pt");
  const languageEn = document.getElementById("lang-en");

  const prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const state = {
    lang: getInitialLanguage(),
    theme: getInitialTheme(),
  };

  function getInitialLanguage() {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored && content[stored]) {
      return stored;
    }

    return "pt-BR";
  }

  function getInitialTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return prefersDarkQuery.matches ? "dark" : "light";
  }

  function setTheme(theme, persist = true) {
    state.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");

    if (persist) {
      localStorage.setItem(THEME_KEY, theme);
    }

    updateThemeButton();
  }

  function setLanguage(lang, persist = true) {
    if (!content[lang]) {
      return;
    }

    state.lang = lang;

    if (persist) {
      localStorage.setItem(LANGUAGE_KEY, lang);
    }

    renderPage();
  }

  function getCurrentCopy() {
    return content[state.lang];
  }

  function resolveValue(data, key) {
    return key.split(".").reduce((acc, item) => (acc ? acc[item] : undefined), data);
  }

  function renderBindings() {
    const copy = getCurrentCopy();

    document.documentElement.lang = copy.langCode;
    document.title = copy.pageTitle;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", copy.pageDescription);
    }

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      const value = resolveValue(copy, key);
      if (typeof value === "string") {
        element.textContent = value;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.getAttribute("data-i18n-placeholder");
      const value = resolveValue(copy, key);
      if (typeof value === "string") {
        element.setAttribute("placeholder", value);
      }
    });

    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      const key = element.getAttribute("data-i18n-alt");
      const value = resolveValue(copy, key);
      if (typeof value === "string") {
        element.setAttribute("alt", value);
      }
    });
  }

  function renderTechGroups() {
    const copy = getCurrentCopy();
    techGroupsContainer.innerHTML = "";

    copy.techGroups.forEach((group) => {
      const card = document.createElement("article");
      card.className =
        "glass-panel p-6 border border-slate-200/70 dark:border-slate-700/80";

      const title = document.createElement("h3");
      title.className = "font-display text-xl font-semibold text-slate-900 dark:text-slate-100";
      title.textContent = group.title;

      const list = document.createElement("ul");
      list.className = "mt-4 flex flex-wrap gap-2";

      group.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "chip";
        li.textContent = item;
        list.appendChild(li);
      });

      card.appendChild(title);
      card.appendChild(list);
      techGroupsContainer.appendChild(card);
    });
  }

  function renderStrengths() {
    const copy = getCurrentCopy();
    strengthsContainer.innerHTML = "";

    copy.strengths.forEach((strength) => {
      const item = document.createElement("li");
      item.className =
        "rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200";
      item.textContent = strength;
      strengthsContainer.appendChild(item);
    });
  }

  function renderSubjectOptions() {
    const copy = getCurrentCopy();
    const previousValue = subjectSelect.value;
    subjectSelect.innerHTML = "";

    Object.entries(copy.subjectOptions).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      subjectSelect.appendChild(option);
    });

    const hasPrevious = Object.prototype.hasOwnProperty.call(copy.subjectOptions, previousValue);
    subjectSelect.value = hasPrevious ? previousValue : "custom-project";
  }

  function updateThemeButton() {
    const copy = getCurrentCopy();
    const targetTheme = state.theme === "dark" ? "light" : "dark";
    const label = targetTheme === "dark" ? copy.themeButtonDark : copy.themeButtonLight;

    themeToggle.textContent = label;
    themeToggle.setAttribute("aria-label", label);
  }

  function updateLanguageButtons() {
    languagePt.classList.toggle("bg-brand-700", state.lang === "pt-BR");
    languagePt.classList.toggle("text-white", state.lang === "pt-BR");
    languagePt.classList.toggle("text-slate-700", state.lang !== "pt-BR");
    languagePt.classList.toggle("dark:text-slate-200", state.lang !== "pt-BR");

    languageEn.classList.toggle("bg-brand-700", state.lang === "en");
    languageEn.classList.toggle("text-white", state.lang === "en");
    languageEn.classList.toggle("text-slate-700", state.lang !== "en");
    languageEn.classList.toggle("dark:text-slate-200", state.lang !== "en");

    languagePt.setAttribute("aria-pressed", String(state.lang === "pt-BR"));
    languageEn.setAttribute("aria-pressed", String(state.lang === "en"));
  }

  function renderPage() {
    renderBindings();
    renderTechGroups();
    renderStrengths();
    renderSubjectOptions();
    updateThemeButton();
    updateLanguageButtons();
  }

  function showStatus(type, message) {
    formStatus.className =
      "mt-4 rounded-xl border px-4 py-3 text-sm" +
      (type === "success"
        ? " border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
        : " border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200");
    formStatus.textContent = message;
    formStatus.classList.remove("hidden");
  }

  function validatePhone(phoneValue) {
    return /^[0-9+()\-\s]{8,20}$/.test(phoneValue.trim());
  }

  async function submitForm(event) {
    event.preventDefault();
    const copy = getCurrentCopy();
    const formData = new FormData(contactForm);

    const phoneValue = String(formData.get("phone") || "");
    if (!validatePhone(phoneValue)) {
      showStatus("error", copy.formValidationPhone);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = copy.formSending;

    try {
      const response = await fetch("contact.php", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      let payload;
      try {
        payload = await response.json();
      } catch (_error) {
        throw new Error(copy.formError);
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || copy.formError);
      }

      contactForm.reset();
      showStatus("success", payload.message || copy.formSuccess);
    } catch (error) {
      showStatus("error", error.message || copy.formError);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = getCurrentCopy().formSubmit;
    }
  }

  function setupAnimations() {
    const animatedElements = document.querySelectorAll("[data-animate]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const delay = entry.target.getAttribute("data-delay") || "0";
          entry.target.style.animationDelay = `${delay}ms`;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2 }
    );

    animatedElements.forEach((element) => observer.observe(element));
  }

  function bindEvents() {
    themeToggle.addEventListener("click", () => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme, true);
    });

    languagePt.addEventListener("click", () => setLanguage("pt-BR", true));
    languageEn.addEventListener("click", () => setLanguage("en", true));

    contactForm.addEventListener("submit", submitForm);

    prefersDarkQuery.addEventListener("change", (event) => {
      const userTheme = localStorage.getItem(THEME_KEY);
      if (userTheme === "light" || userTheme === "dark") {
        return;
      }

      setTheme(event.matches ? "dark" : "light", false);
    });
  }

  function init() {
    if (currentYear) {
      currentYear.textContent = String(new Date().getFullYear());
    }

    setTheme(state.theme, false);
    renderPage();
    bindEvents();
    setupAnimations();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
