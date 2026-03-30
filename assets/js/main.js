(() => {
  const content = window.PORTFOLIO_CONTENT;
  const LANGUAGE_KEY = "portfolio.lang";
  const THEME_KEY = "portfolio.theme";

  const techGroupsContainer = document.getElementById("tech-groups");
  const aiListContainer = document.getElementById("ai-list");
  const strengthsContainer = document.getElementById("strengths-list");
  const projectsSwiperElement = document.getElementById("projects-swiper");
  const projectsContainer = document.getElementById("projects-list");
  const projectsPrevButton = document.getElementById("projects-prev");
  const projectsNextButton = document.getElementById("projects-next");
  const projectsDotsContainer = document.getElementById("projects-dots");
  const experienceContainer = document.getElementById("experience-list");
  const subjectSelect = document.getElementById("subject");
  const contactForm = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");
  const submitButton = document.getElementById("form-submit");
  const currentYear = document.getElementById("current-year");
  const languageToggle = document.getElementById("language-toggle");
  const themeToggleContainer = document.getElementById("theme-toggle");
  const themeLightButton = document.getElementById("theme-light");
  const themeDarkButton = document.getElementById("theme-dark");
  const languagePt = document.getElementById("lang-pt");
  const languageEn = document.getElementById("lang-en");

  const prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const state = {
    lang: getInitialLanguage(),
    theme: getInitialTheme(),
  };

  let projectsSwiper = null;

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

    updateThemeButtons();
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

    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      const key = element.getAttribute("data-i18n-aria");
      const value = resolveValue(copy, key);
      if (typeof value === "string") {
        element.setAttribute("aria-label", value);
      }
    });
  }

  function getInitials(label) {
    return label
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
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
      list.className = "mt-4 flex flex-wrap gap-2 tech-chips";

      group.items.forEach((item) => {
        const label = typeof item === "string" ? item : item.name;
        const icon = typeof item === "object" ? item.icon : null;

        const li = document.createElement("li");
        li.className = "chip tech-chip";

        if (icon) {
          const iconEl = document.createElement("img");
          iconEl.className = "tech-icon";
          iconEl.src = `https://cdn.jsdelivr.net/npm/simple-icons@11/icons/${icon}.svg`;
          iconEl.alt = "";
          iconEl.setAttribute("aria-hidden", "true");
          li.appendChild(iconEl);
        } else {
          const initials = document.createElement("span");
          initials.className = "tech-initials";
          initials.textContent = getInitials(label);
          li.appendChild(initials);
        }

        const text = document.createElement("span");
        text.textContent = label;
        li.appendChild(text);
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

  function renderAiPractices() {
    const copy = getCurrentCopy();
    aiListContainer.innerHTML = "";

    copy.aiPractices.forEach((practice) => {
      const item = document.createElement("li");
      item.className =
        "glass-panel border border-slate-200/80 p-5 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:text-slate-200";
      item.textContent = practice;
      aiListContainer.appendChild(item);
    });
  }

  function renderProjects() {
    const copy = getCurrentCopy();

    if (!projectsContainer) {
      return;
    }

    const previousIndex = projectsSwiper ? projectsSwiper.realIndex : 0;
    destroyProjectsSwiper();
    projectsContainer.innerHTML = "";

    copy.projects.forEach((project) => {
      const card = document.createElement("article");
      card.className = "project-slide swiper-slide";

      const media = document.createElement("div");
      media.className = "project-media";

      const image = document.createElement("img");
      image.className = "project-image";
      image.src = project.image || "assets/images/projects/project-placeholder.svg";
      image.alt = project.imageAlt || project.name;
      image.loading = "lazy";
      image.decoding = "async";

      if (project.imageMode === "background") {
        media.classList.add("has-background");
        media.style.backgroundImage = `url('${image.src}')`;
        image.classList.add("project-image--hidden");
      }

      media.appendChild(image);

      const contentWrapper = document.createElement("div");
      contentWrapper.className = "project-content";

      const title = document.createElement("h3");
      title.className = "project-title";
      title.textContent = project.name;

      const description = document.createElement("p");
      description.className = "project-description";
      description.textContent = project.description;

      contentWrapper.appendChild(title);
      contentWrapper.appendChild(description);

      if (Array.isArray(project.tags) && project.tags.length) {
        const meta = document.createElement("ul");
        meta.className = "project-meta";

        project.tags.forEach((tag) => {
          const item = document.createElement("li");
          item.className = "project-chip";
          item.textContent = tag;
          meta.appendChild(item);
        });

        contentWrapper.appendChild(meta);
      }

      if (project.url) {
        const link = document.createElement("a");
        link.href = project.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.className = "project-link";
        link.textContent = copy.projectVisitLabel;
        contentWrapper.appendChild(link);
      }

      card.appendChild(media);
      card.appendChild(contentWrapper);
      projectsContainer.appendChild(card);
    });

    initProjectsSwiper(copy.projects, previousIndex);
  }

  function destroyProjectsSwiper() {
    if (projectsSwiper && typeof projectsSwiper.destroy === "function") {
      projectsSwiper.destroy(true, true);
    }

    projectsSwiper = null;
  }

  function initProjectsSwiper(projects, initialIndex = 0) {
    if (!projectsSwiperElement || !projectsContainer || !window.Swiper) {
      return;
    }

    const hasMultipleProjects = projects.length > 1;

    if (projectsPrevButton) {
      projectsPrevButton.disabled = !hasMultipleProjects;
    }

    if (projectsNextButton) {
      projectsNextButton.disabled = !hasMultipleProjects;
    }

    projectsSwiper = new window.Swiper(projectsSwiperElement, {
      slidesPerView: 1.1,
      spaceBetween: 14,
      speed: 520,
      grabCursor: true,
      loop: hasMultipleProjects,
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      navigation: {
        prevEl: projectsPrevButton,
        nextEl: projectsNextButton,
      },
      pagination: {
        el: projectsDotsContainer,
        clickable: true,
        bulletClass: "projects-dot",
        bulletActiveClass: "is-active",
        renderBullet(index, className) {
          const project = projects[index];
          const label = project && project.name ? project.name : `Slide ${index + 1}`;
          return `<button type=\"button\" class=\"${className}\" aria-label=\"${label}\"></button>`;
        },
      },
      breakpoints: {
        640: {
          slidesPerView: 1.4,
          spaceBetween: 16,
        },
        768: {
          slidesPerView: 2.1,
          spaceBetween: 18,
        },
        1024: {
          slidesPerView: 3.1,
          spaceBetween: 20,
        },
      },
    });

    if (initialIndex > 0 && hasMultipleProjects) {
      projectsSwiper.slideToLoop(initialIndex, 0, false);
    }
  }

  function renderExperience() {
    const copy = getCurrentCopy();
    experienceContainer.innerHTML = "";

    copy.experiences.forEach((experience) => {
      const item = document.createElement("li");
      item.className =
        "glass-panel border border-slate-200/80 p-5 dark:border-slate-700";

      const header = document.createElement("div");
      header.className = "flex flex-col gap-1";

      const company = document.createElement("h3");
      company.className = "font-display text-xl font-semibold text-slate-900 dark:text-slate-100";
      company.textContent = experience.company;

      const period = document.createElement("p");
      period.className = "text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300";
      period.textContent = experience.period;

      const summary = document.createElement("p");
      summary.className = "mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300";
      summary.textContent = experience.summary;

      header.appendChild(company);
      header.appendChild(period);
      item.appendChild(header);
      item.appendChild(summary);
      experienceContainer.appendChild(item);
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

  function updateThemeButtons() {
    const copy = getCurrentCopy();
    const isLight = state.theme === "light";

    themeToggleContainer.setAttribute("data-theme", state.theme);

    themeLightButton.classList.toggle("is-active", isLight);
    themeDarkButton.classList.toggle("is-active", !isLight);

    themeLightButton.setAttribute("aria-pressed", String(isLight));
    themeDarkButton.setAttribute("aria-pressed", String(!isLight));
    themeLightButton.setAttribute("aria-label", copy.themeLightLabel);
    themeDarkButton.setAttribute("aria-label", copy.themeDarkLabel);
  }

  function updateLanguageButtons() {
    languageToggle.setAttribute("data-value", state.lang);

    languagePt.classList.toggle("is-active", state.lang === "pt-BR");
    languageEn.classList.toggle("is-active", state.lang === "en");

    languagePt.setAttribute("aria-pressed", String(state.lang === "pt-BR"));
    languageEn.setAttribute("aria-pressed", String(state.lang === "en"));
  }

  function renderPage() {
    renderBindings();
    renderTechGroups();
    renderAiPractices();
    renderStrengths();
    renderProjects();
    renderExperience();
    renderSubjectOptions();
    updateThemeButtons();
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
    themeLightButton.addEventListener("click", () => setTheme("light", true));
    themeDarkButton.addEventListener("click", () => setTheme("dark", true));

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
