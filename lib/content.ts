export type Locale = "pt-BR" | "en";

export interface TechItem {
  name: string;
  icon?: string;
}

export interface TechGroup {
  title: string;
  items: TechItem[];
}

export interface Project {
  name: string;
  url: string;
  description: string;
  image: string;
  imageAlt: string;
  /** Kept for fidelity with the original data shape; not read by any component. */
  imageMode?: "background";
  tags: string[];
}

export interface Experience {
  company: string;
  period: string;
  summary: string;
}

export interface LocaleContent {
  langCode: string;
  pageTitle: string;
  pageDescription: string;
  brand: string;
  role: string;
  heroTitle: string;
  heroText: string;
  ctaPrimary: string;
  ctaSecondary: string;
  portraitAlt: string;
  sectionTechTitle: string;
  sectionTechText: string;
  techGroups: TechGroup[];
  sectionAiTitle: string;
  sectionAiText: string;
  aiPractices: string[];
  /** Section not currently rendered (dropped from the layout upstream); data kept for fidelity. */
  sectionAreasTitle: string;
  sectionAreasText: string;
  strengths: string[];
  sectionProjectsTitle: string;
  sectionProjectsText: string;
  projectsCarouselHint: string;
  projectsPrevLabel: string;
  projectsNextLabel: string;
  projectsPrevShort: string;
  projectsNextShort: string;
  projectsCarouselLabel: string;
  projectVisitLabel: string;
  projects: Project[];
  /** Section not currently rendered (dropped from the layout upstream); data kept for fidelity. */
  sectionExperienceTitle: string;
  sectionExperienceText: string;
  experiences: Experience[];
  sectionContactTitle: string;
  sectionContactText: string;
  channelsLabel: string;
  languageLabel: string;
  themeLabel: string;
  themeLightLabel: string;
  themeDarkLabel: string;
  themeLightShort: string;
  themeDarkShort: string;
  languagePt: string;
  languageEn: string;
  formNameLabel: string;
  formNamePlaceholder: string;
  formEmailLabel: string;
  formEmailPlaceholder: string;
  formPhoneLabel: string;
  formPhonePlaceholder: string;
  formSubjectLabel: string;
  formSubmit: string;
  formSending: string;
  subjectOptions: Record<string, string>;
  formSuccess: string;
  formError: string;
  formTransportError: string;
  formLocalProtocolError: string;
  /** Fallback: build sem NEXT_PUBLIC_CONTACT_ENDPOINT, sem Worker para chamar. */
  formStubNotice: string;
  formValidationName: string;
  formValidationEmail: string;
  formValidationPhone: string;
  formValidationSubject: string;
  footerText: string;
}

export const PORTFOLIO_CONTENT: Record<Locale, LocaleContent> = {
  "pt-BR": {
    langCode: "pt-BR",
    pageTitle: "Guilherme Hassã - Desenvolvedor Web",
    pageDescription:
      "Landing page profissional de Guilherme Hassã, desenvolvedor web com foco em performance, experiência e resultado.",
    brand: "Guilherme Hassã",
    role: "Desenvolvedor Web",
    heroTitle: "Projetos Web focados em usabilidade e resultado.",
    heroText:
      "Mais de 5 anos de experiência em produtos digitais diversos: landing pages, sites institucionais, blogs, e-mail marketing, e-commerces e saas completos. Atuação desde a concepção até a publicação do projeto.",
    ctaPrimary: "Entre em contato",
    ctaSecondary: "Projetos Relevantes",
    portraitAlt: "Foto profissional de Guilherme Hassã",
    sectionTechTitle: "Tecnologias e Ferramentas",
    sectionTechText:
      "Leque de tecnologias e ferramentas que domino para realizar entregas relevantes aos clientes.",
    techGroups: [
      {
        title: "Base",
        items: [
          { name: "HTML5", icon: "html5" },
          { name: "CSS3", icon: "css3" },
          { name: "Sass", icon: "sass" },
          { name: "JavaScript", icon: "javascript" },
          { name: "TypeScript", icon: "typescript" },
          { name: "Tailwind CSS", icon: "tailwindcss" },
          { name: "PHP", icon: "php" },
        ],
      },
      {
        title: "Frameworks e CMS",
        items: [
          { name: "React", icon: "react" },
          { name: "Next.js", icon: "nextdotjs" },
          { name: "Bootstrap", icon: "bootstrap" },
          { name: "Angular", icon: "angular" },
          { name: "Laravel", icon: "laravel" },
          { name: "WordPress", icon: "wordpress" },
        ],
      },
      {
        title: "E-commerce e conteúdo",
        items: [
          { name: "WooCommerce", icon: "woocommerce" },
          { name: "ACF" },
          { name: "CF7" },
          { name: "WPML" },
          { name: "Yoast SEO" },
          { name: "CPTs" },
        ],
      },
      {
        title: "Integrações e workflow",
        items: [
          { name: "REST APIs" },
          { name: "GraphQL", icon: "graphql" },
          { name: "Webhooks" },
          { name: "HubSpot", icon: "hubspot" },
          { name: "RD Station" },
          { name: "GTM", icon: "googletagmanager" },
        ],
      },
      {
        title: "Ferramentas",
        items: [
          { name: "Git", icon: "git" },
          { name: "GitHub", icon: "github" },
          { name: "VSCode", icon: "visualstudiocode" },
          { name: "Figma", icon: "figma" },
          { name: "Postman", icon: "postman" },
          { name: "Vercel", icon: "vercel" },
          { name: "Azure", icon: "microsoftazure" },
        ],
      },
    ],
    sectionAiTitle: "Desenvolvimento Assistido por IA",
    sectionAiText:
      "Atuando cada vez mais com desenvolvimento assistido por IA. Atuar dessa forma proporciona projetos cada vez melhores, entregas cada vez mais rápidas e assertivas. Além de permitir entrega com cobertura de testes e validações cada vez mais abrangentes.",
    aiPractices: [
      "GitHub Copilot e Claude Code como parceiros de planejamento, revisão de código e debugging; as decisões técnicas continuam sendo humanas.",
      "Ciclo assistido da arquitetura ao teste: planejar, implementar, revisar e iterar com mais velocidade em tarefas complexas.",
      "Resultado prático: entregas mais rápidas, menos bugs em produção e documentação técnica mantida no próprio fluxo.",
      "Validação humana em cada etapa crítica para garantir qualidade, legibilidade e manutenibilidade a longo prazo.",
    ],
    sectionAreasTitle: "Área de Atuação",
    sectionAreasText:
      "Construo soluções digitais que funcionam em produção, escalam com o negócio e são fáceis de manter (seja para um projeto pontual ou para um time que precisa de reforço).",
    strengths: [
      "E-commerce e produto digital: WooCommerce, Next.js e integrações com ERP, CRM e gateways em operações reais de venda.",
      "WordPress avançado: temas customizados, plugins, ACF, WPML, APIs e projetos multilíngues de alta complexidade.",
      "Performance técnica: refatoração orientada a resultado, código limpo e entregas sem regressão em produção.",
      "Inglês avançado e experiência em Agile/Scrum; disponível para times nacionais e internacionais.",
    ],
    sectionProjectsTitle: "Projetos Relevantes",
    sectionProjectsText: "Projetos relevantes que atuei durante minha carreira.",
    projectsCarouselHint: "",
    projectsPrevLabel: "Projeto anterior",
    projectsNextLabel: "Próximo projeto",
    projectsPrevShort: "Anterior",
    projectsNextShort: "Próximo",
    projectsCarouselLabel: "Carrossel de projetos relevantes",
    projectVisitLabel: "Ver projeto",
    projects: [
      {
        name: "Pátio Batel",
        url: "https://patiobatel.com.br",
        description:
          "Redesign da homepage orientado a UX para aumentar engajamento e conversão. Desenvolvido em WordPress com Foundation e PHP.",
        image: "/images/projects/patio-batel-composite.png",
        imageAlt: "Preview do projeto Pátio Batel",
        imageMode: "background",
        tags: ["WordPress", "PHP", "Foundation", "UX"],
      },
      {
        name: "Paraná Banco Investimentos",
        url: "https://paranabancoinvestimentos.com.br",
        description:
          "Frontend em Next.js com styled-components e SASS, integrado a WordPress, GTM e CRM para aquisição digital.",
        image: "/images/projects/parana-investimentos-composite.png",
        imageAlt: "Preview do projeto Paraná Banco Investimentos",
        imageMode: "background",
        tags: ["Next.js", "WordPress", "GTM", "CRM"],
      },
      {
        name: "HearBetter - Medel",
        url: "https://hearbetter.medel.com",
        description:
          "Plataforma multilíngue de alta complexidade para marca global de saúde auditiva, com ACF, WPML e APIs customizadas.",
        image: "/images/projects/hearbetter-composite.png",
        imageAlt: "Preview do projeto HearBetter - Medel",
        imageMode: "background",
        tags: ["WordPress", "WPML", "ACF", "API"],
      },
      {
        name: "ThorBikes",
        url: "https://thorbikes.com.br",
        description:
          "Catálogo com centenas de produtos integrado via API do ERP Tiny, com interface customizada em Foundation, PHP e SASS.",
        image: "/images/projects/thorbikes-composite.png",
        imageAlt: "Preview do projeto ThorBikes",
        imageMode: "background",
        tags: ["ERP Tiny", "API", "PHP", "SASS"],
      },
      {
        name: "Roca Cerâmica",
        url: "https://www.rocaceramica.com.br",
        description:
          "Evolução contínua do site WordPress com ganhos de SEO técnico e melhoria de experiência de navegação.",
        image: "/images/projects/roca-ceramica-composite.png",
        imageAlt: "Preview do projeto Roca Cerâmica",
        imageMode: "background",
        tags: ["WordPress", "SEO", "Front-end", "Manutenção"],
      },
      {
        name: "Dashboard Cademí",
        url: "",
        description:
          "Dashboard SaaS responsivo com componentes padronizados e requisições assíncronas para reduzir carregamento de página.",
        image: "/images/projects/cademi-dashboard.svg",
        imageAlt: "Preview do projeto Dashboard Cademí",
        tags: ["Laravel", "Blade", "jQuery", "Bootstrap"],
      },
    ],
    sectionExperienceTitle: "Experiência Recente",
    sectionExperienceText:
      "Atuação em produtos digitais, e-commerce e ambientes corporativos com entregas orientadas a negócio.",
    experiences: [
      {
        company: "Cademí",
        period: "dez/2025 a mar/2026",
        summary:
          "Performance percebida melhorada com Laravel, jQuery e Bootstrap; refatoração de legado e AJAX para reduzir requisições desnecessárias.",
      },
      {
        company: "Coopers Digital Productions",
        period: "nov/2022 a jun/2025",
        summary:
          "2,5 anos entregando e-commerces, LPs, institucionais e intranets em agência digital; foco em SEO, acessibilidade e resultado de negócio.",
      },
      {
        company: "Gráfica Belas Artes",
        period: "jan/2022 a out/2022",
        summary:
          "Lançamento e desenvolvimento do site institucional da empresa, além de criação de materiais digitais e impressos.",
      },
      {
        company: "Simpletec (freelancer)",
        period: "out/2021 a dez/2021",
        summary:
          "Fundador: planejamento, design e desenvolvimento completo de soluções digitais do zero para pequenos negócios.",
      },
    ],
    sectionContactTitle: "Contato",
    sectionContactText:
      "Fale sobre seu projeto, necessidade de reforço no time ou oportunidade de contratação. Respondo em até 24h úteis.",
    channelsLabel: "Canais diretos",
    languageLabel: "Idioma",
    themeLabel: "Tema",
    themeLightLabel: "Modo claro",
    themeDarkLabel: "Modo escuro",
    themeLightShort: "Claro",
    themeDarkShort: "Escuro",
    languagePt: "PT-BR",
    languageEn: "EN",
    formNameLabel: "Nome",
    formNamePlaceholder: "Seu nome completo",
    formEmailLabel: "E-mail",
    formEmailPlaceholder: "voce@empresa.com",
    formPhoneLabel: "Telefone",
    formPhonePlaceholder: "(11) 99999-9999",
    formSubjectLabel: "Assunto",
    formSubmit: "Enviar contato",
    formSending: "Enviando...",
    subjectOptions: {
      "custom-project": "Projeto sob medida",
      freelance: "Freelance sob demanda",
      hiring: "Contratação para time",
    },
    formSuccess: "Mensagem enviada com sucesso. Retorno em breve pelo contato@hassa.dev.br.",
    formError:
      "Nao foi possivel enviar agora. Tente novamente em instantes ou use contato@hassa.dev.br.",
    formTransportError:
      "Erro de conexao ao enviar. Se estiver em visualizacao local, use um servidor HTTP ou teste no dominio publicado.",
    formLocalProtocolError:
      "Envio indisponivel em arquivo local (file://). Acesse via http://localhost ou no dominio publicado para enviar o formulario.",
    formStubNotice:
      "Formulário validado. O envio automático ainda não está ativo nesta versão — escreva para contato@hassa.dev.br.",
    formValidationName: "Informe seu nome completo.",
    formValidationEmail: "Informe um e-mail valido para retorno.",
    formValidationPhone: "Informe um telefone valido com DDD.",
    formValidationSubject: "Selecione um assunto para a mensagem.",
    footerText: "Guilherme Hassã - Desenvolvedor Web",
  },
  en: {
    langCode: "en",
    pageTitle: "Guilherme Hassã - Web Developer",
    pageDescription:
      "Professional landing page for Guilherme Hassã, a web developer focused on performance, experience and business outcomes.",
    brand: "Guilherme Hassã",
    role: "Web Developer",
    heroTitle: "Web projects focused on usability and results.",
    heroText:
      "5+ years of experience across diverse digital products: landing pages, institutional websites, blogs, email marketing, e-commerce and complete SaaS platforms. Involved from conception through to publication.",
    ctaPrimary: "Get in touch",
    ctaSecondary: "Relevant Projects",
    portraitAlt: "Professional portrait of Guilherme Hassã",
    sectionTechTitle: "Technologies and Tools",
    sectionTechText:
      "The range of technologies and tools I master to deliver relevant results for clients.",
    techGroups: [
      {
        title: "Core",
        items: [
          { name: "JavaScript", icon: "javascript" },
          { name: "TypeScript", icon: "typescript" },
          { name: "PHP", icon: "php" },
        ],
      },
      {
        title: "Frameworks and CMS",
        items: [
          { name: "React", icon: "react" },
          { name: "Next.js", icon: "nextdotjs" },
          { name: "Angular", icon: "angular" },
          { name: "Laravel", icon: "laravel" },
          { name: "WordPress", icon: "wordpress" },
        ],
      },
      {
        title: "E-commerce and content",
        items: [
          { name: "WooCommerce", icon: "woocommerce" },
          { name: "ACF" },
          { name: "CF7" },
          { name: "WPML" },
          { name: "Yoast SEO" },
          { name: "CPTs" },
        ],
      },
      {
        title: "Integrations and workflow",
        items: [
          { name: "REST APIs" },
          { name: "GraphQL", icon: "graphql" },
          { name: "Webhooks" },
          { name: "HubSpot", icon: "hubspot" },
          { name: "RD Station" },
          { name: "GTM", icon: "googletagmanager" },
        ],
      },
      {
        title: "Tools",
        items: [
          { name: "Git", icon: "git" },
          { name: "GitHub", icon: "github" },
          { name: "VSCode", icon: "visualstudiocode" },
          { name: "Figma", icon: "figma" },
          { name: "Postman", icon: "postman" },
          { name: "Vercel", icon: "vercel" },
          { name: "Azure", icon: "microsoftazure" },
        ],
      },
    ],
    sectionAiTitle: "AI-Assisted Development",
    sectionAiText:
      "Increasingly working with AI-assisted development. This approach results in better projects, faster and more precise deliveries, as well as increasingly comprehensive test coverage and validation.",
    aiPractices: [
      "GitHub Copilot and Claude Code as partners for planning, code review and debugging; technical decisions stay human.",
      "Assisted cycle from architecture to testing: plan, implement, review and iterate faster on complex tasks.",
      "Practical outcome: faster deliveries, fewer production bugs and technical documentation maintained in the flow.",
      "Human validation at every critical step to ensure quality, readability and long-term maintainability.",
    ],
    sectionAreasTitle: "Area of Expertise",
    sectionAreasText:
      "I build digital solutions that work in production, scale with the business and stay maintainable (whether for a standalone project or a team looking for reinforcement).",
    strengths: [
      "E-commerce and digital products: WooCommerce, Next.js and real-world integrations with ERP, CRM and payment gateways.",
      "Advanced WordPress: custom themes, plugins, ACF, WPML, APIs and high-complexity multilingual projects.",
      "Technical performance: outcome-driven refactoring, clean code and regression-free production delivery.",
      "Advanced English and Agile/Scrum experience; available for national and international teams.",
    ],
    sectionProjectsTitle: "Relevant Projects",
    sectionProjectsText: "Relevant projects I worked on throughout my career.",
    projectsCarouselHint: "",
    projectsPrevLabel: "Previous project",
    projectsNextLabel: "Next project",
    projectsPrevShort: "Previous",
    projectsNextShort: "Next",
    projectsCarouselLabel: "Relevant projects carousel",
    projectVisitLabel: "Visit project",
    projects: [
      {
        name: "Pátio Batel",
        url: "https://patiobatel.com.br",
        description:
          "UX-driven homepage redesign to boost engagement and conversion, built with WordPress, Foundation and PHP.",
        image: "/images/projects/patio-batel-composite.png",
        imageAlt: "Preview of Pátio Batel project",
        imageMode: "background",
        tags: ["WordPress", "PHP", "Foundation", "UX"],
      },
      {
        name: "Paraná Banco Investimentos",
        url: "https://paranabancoinvestimentos.com.br",
        description:
          "Next.js frontend with styled-components and SASS, integrated with WordPress, GTM and CRM for digital acquisition.",
        image: "/images/projects/parana-investimentos-composite.png",
        imageAlt: "Preview of Paraná Banco Investimentos project",
        imageMode: "background",
        tags: ["Next.js", "WordPress", "GTM", "CRM"],
      },
      {
        name: "HearBetter - Medel",
        url: "https://hearbetter.medel.com",
        description:
          "High-complexity multilingual platform for a global hearing health brand, using ACF, WPML and custom APIs.",
        image: "/images/projects/hearbetter-composite.png",
        imageAlt: "Preview of HearBetter - Medel project",
        imageMode: "background",
        tags: ["WordPress", "WPML", "ACF", "API"],
      },
      {
        name: "ThorBikes",
        url: "https://thorbikes.com.br",
        description:
          "Product catalog with hundreds of SKUs integrated via Tiny ERP API, with a custom interface in Foundation, PHP and SASS.",
        image: "/images/projects/thorbikes-composite.png",
        imageAlt: "Preview of ThorBikes project",
        imageMode: "background",
        tags: ["Tiny ERP", "API", "PHP", "SASS"],
      },
      {
        name: "Roca Cerâmica",
        url: "https://www.rocaceramica.com.br",
        description:
          "Ongoing WordPress evolution with technical SEO gains and improved navigation experience.",
        image: "/images/projects/roca-ceramica-composite.png",
        imageAlt: "Preview of Roca Cerâmica project",
        imageMode: "background",
        tags: ["WordPress", "SEO", "Front-end", "Maintenance"],
      },
      {
        name: "Cademí Dashboard",
        url: "",
        description:
          "Responsive SaaS dashboard with standardized components and async requests to cut page load and improve maintainability.",
        image: "/images/projects/cademi-dashboard.svg",
        imageAlt: "Preview of Cademí Dashboard project",
        tags: ["Laravel", "Blade", "jQuery", "Bootstrap"],
      },
    ],
    sectionExperienceTitle: "Recent Experience",
    sectionExperienceText:
      "Hands-on delivery across digital products, e-commerce and corporate environments.",
    experiences: [
      {
        company: "Cademí",
        period: "Dec/2025 to Mar/2026",
        summary:
          "Improved perceived performance with Laravel, jQuery and Bootstrap; legacy refactoring and AJAX to reduce unnecessary requests.",
      },
      {
        company: "Coopers Digital Productions",
        period: "Nov/2022 to Jun/2025",
        summary:
          "2.5 years delivering e-commerce, landing pages, institutional sites and intranets at a digital agency; SEO, accessibility and business focus.",
      },
      {
        company: "Gráfica Belas Artes",
        period: "Jan/2022 to Oct/2022",
        summary:
          "Launched the company's institutional website and created digital and print materials from concept to delivery.",
      },
      {
        company: "Simpletec (freelancer)",
        period: "Oct/2021 to Dec/2021",
        summary:
          "Founder: full planning, design and development of digital solutions from scratch for small businesses.",
      },
    ],
    sectionContactTitle: "Contact",
    sectionContactText:
      "Tell me about your project, team reinforcement needs or hiring opportunity. I respond within 24 business hours.",
    channelsLabel: "Direct channels",
    languageLabel: "Language",
    themeLabel: "Theme",
    themeLightLabel: "Light mode",
    themeDarkLabel: "Dark mode",
    themeLightShort: "Light",
    themeDarkShort: "Dark",
    languagePt: "PT-BR",
    languageEn: "EN",
    formNameLabel: "Name",
    formNamePlaceholder: "Your full name",
    formEmailLabel: "Email",
    formEmailPlaceholder: "you@company.com",
    formPhoneLabel: "Phone",
    formPhonePlaceholder: "+55 11 99999-9999",
    formSubjectLabel: "Reason",
    formSubmit: "Send contact",
    formSending: "Sending...",
    subjectOptions: {
      "custom-project": "Custom project",
      freelance: "Freelance on demand",
      hiring: "Hiring for a team",
    },
    formSuccess: "Message sent successfully. I will get back soon.",
    formError: "Unable to send now. Please try again shortly or email contato@hassa.dev.br.",
    formTransportError:
      "Connection error while sending. If you are in local preview, use an HTTP server or test on the published domain.",
    formLocalProtocolError:
      "Sending is unavailable in local file mode (file://). Open via http://localhost or the published domain to submit the form.",
    formStubNotice:
      "Form validated. Automatic sending isn't live in this build yet — please email contato@hassa.dev.br.",
    formValidationName: "Please provide your full name.",
    formValidationEmail: "Please provide a valid email address.",
    formValidationPhone: "Please provide a valid phone number with area code.",
    formValidationSubject: "Please select a subject for your message.",
    footerText: "Guilherme Hassã - Web Developer",
  },
};
