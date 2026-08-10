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

/** Card de pratica (titulo + explicacao) usado nas secoes de IA e de entrega. */
export interface PracticeItem {
  title: string;
  text: string;
}

export interface OwnProjectHighlight {
  title: string;
  text: string;
}

export interface OwnProjectStat {
  value: string;
  label: string;
}

/** Produto autoral: sem repositorio (codigo privado), so link, logo e resumo. */
export interface OwnProject {
  name: string;
  url: string;
  /** Dominio exibido no CTA, sem protocolo. */
  urlLabel: string;
  logo: string;
  logoAlt: string;
  /** Linha curta acima da tagline (natureza do produto, forma de construcao). */
  meta: string;
  tagline: string;
  summary: string;
  stack: string[];
  highlightsTitle: string;
  highlights: OwnProjectHighlight[];
  stats: OwnProjectStat[];
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
  aiPractices: PracticeItem[];
  sectionDeliveryTitle: string;
  sectionDeliveryText: string;
  deliveryPipelineLabel: string;
  deliveryPipeline: string[];
  deliveryPractices: PracticeItem[];
  deliveryProfileLabel: string;
  deliveryProfile: string[];
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
  sectionOwnProjectsTitle: string;
  sectionOwnProjectsText: string;
  ownProjectVisitLabel: string;
  ownProjects: OwnProject[];
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
    sectionAiTitle: "Desenvolvimento com IA",
    sectionAiText:
      "IA como parte do processo de engenharia, não como gerador de código avulso: ferramental versionado no repositório, contexto controlado e revisão humana antes do merge.",
    aiPractices: [
      {
        title: "Agentes especializados por domínio",
        text: "Subagents com escopo e ferramentas próprios, versionados no repositório junto do código. O agente entra na tarefa já com o contexto certo, em vez de redescobrir o projeto a cada sessão.",
      },
      {
        title: "Skills e comandos versionados",
        text: "Fluxos recorrentes — revisão, release, checagem de acessibilidade — viram skills e slash commands no repositório. Mudar o procedimento é um pull request, não um prompt perdido no histórico.",
      },
      {
        title: "MCP ligando o assistente às ferramentas",
        text: "Servidores MCP dão acesso controlado a navegador, banco, documentação e serviços externos. A resposta vira leitura do estado real do sistema, com as permissões que eu defino.",
      },
      {
        title: "Documentação como contexto",
        text: "CLAUDE.md, ADRs e docs por funcionalidade vivem no repositório e são o que o assistente lê antes de escrever código. Onde doc e código divergem, o código vence e a doc é corrigida.",
      },
      {
        title: "Portão de qualidade humano",
        text: "Todo output passa por checagem de tipos, lint, testes e revisão minha antes do merge. A IA acelera a escrita; arquitetura e decisão de produto continuam humanas.",
      },
      {
        title: "Contexto enxuto, resultado previsível",
        text: "Tarefas fatiadas, escopo fechado por branch e prompts apontando para arquivos específicos. É o que separa “o agente resolveu” de “o agente reescreveu meio projeto”.",
      },
    ],
    sectionDeliveryTitle: "Engenharia, CI/CD e Deploy",
    sectionDeliveryText:
      "Como o código sai da minha máquina e chega em produção: pipeline automatizado, portão de qualidade antes da publicação e infraestrutura sob controle.",
    deliveryPipelineLabel: "Do commit à produção",
    deliveryPipeline: [
      "Commit e PR",
      "Lint e tipos",
      "Testes",
      "Build",
      "Deploy automatizado",
      "Produção",
    ],
    deliveryPractices: [
      {
        title: "Pipeline em GitHub Actions",
        text: "Push na branch principal dispara sempre o mesmo fluxo: dependências travadas por lockfile, lint, checagem de tipos, testes e build. Falhou uma etapa, nada é publicado.",
      },
      {
        title: "Deploy automatizado e repetível",
        text: "Publicação por SSH em VPS própria ou por imagem em container registry, com um deploy por vez e guarda-corpos que abortam antes de tocar em produção quando o artefato não confere.",
      },
      {
        title: "Migrations versionadas",
        text: "O banco evolui por migration versionada, aplicada no deploy antes de os containers subirem. Alteração manual em produção não faz parte do processo.",
      },
      {
        title: "Infraestrutura sob controle",
        text: "Docker Compose no desenvolvimento, Caddy como reverse proxy com TLS automático, secrets fora do repositório e variáveis injetadas em tempo de build ou execução.",
      },
      {
        title: "Testes e tipos como rede de segurança",
        text: "TypeScript estrito e suíte automatizada rodando no CI a cada push. Refatorar deixa de ser aposta e a regressão aparece antes do cliente.",
      },
      {
        title: "Git com escopo fechado",
        text: "Branch derivada da principal, escopo fechado por entrega, revisão antes do merge e nenhum segredo versionado. Histórico legível é o que permite reverter rápido.",
      },
    ],
    deliveryProfileLabel: "Para contratação",
    deliveryProfile: [
      "5+ anos em produtos digitais",
      "Do discovery ao deploy",
      "Inglês avançado",
      "Agile / Scrum",
      "Remoto: times nacionais e internacionais",
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
    sectionOwnProjectsTitle: "Projetos Autorais",
    sectionOwnProjectsText:
      "Produtos próprios, construídos do zero: modelagem de domínio, produto, interface, infraestrutura e deploy.",
    ownProjectVisitLabel: "Acessar",
    ownProjects: [
      {
        name: "Agendarium",
        url: "https://agendarium.net",
        urlLabel: "agendarium.net",
        logo: "/images/projects/agendarium-logo-horizontal.svg",
        logoAlt: "Logo do Agendarium",
        meta: "SaaS multi-tenant · Construído solo, ponta a ponta",
        tagline:
          "Agendamento online com horário marcado para prestadores de serviço no Brasil.",
        summary:
          "Um único núcleo de produto atende múltiplas verticais por configuração — não por código. Cada estabelecimento tem uma Vitrine pública sob URL própria, onde o cliente escolhe serviço, profissional e horário sem precisar ligar ou mandar mensagem; o gestor administra agenda, equipe, serviços, produtos, planos de cliente e cobrança por um painel próprio. Sobre isso há uma camada de plataforma: assinatura por níveis, ciclo de vida de conta integrado ao gateway de pagamento e um console interno de operação e suporte.",
        stack: [
          "Next.js 15",
          "React 19",
          "TypeScript",
          "Tailwind v4",
          "PostgreSQL 16",
          "Prisma 6",
          "Auth.js v5",
          "pg-boss",
          "Zod 4",
          "Vitest",
          "Docker",
          "GitHub Actions",
          "Caddy",
          "VPS própria",
        ],
        highlightsTitle: "Destaques técnicos",
        highlights: [
          {
            title: "Integridade de agenda garantida no banco",
            text: "O anti-double-booking é uma constraint EXCLUDE USING gist do PostgreSQL sobre o intervalo do atendimento. Duas requisições concorrentes para o mesmo horário não dependem de o código lembrar de checar: o banco recusa.",
          },
          {
            title: "Disponibilidade calculada, não persistida",
            text: "Os horários livres são computados sob demanda a partir das janelas do profissional, aplicando exceções, buffer, antecedência mínima e horizonte máximo. Sem tabela de slots para desincronizar; datas em UTC, exibição em America/Sao_Paulo.",
          },
          {
            title: "Modelo revisado quando não aguentou",
            text: "A unidade de reserva deixou de ser o agendamento e passou a ser a Comanda: um container que agrega N agendamentos, produtos e cobrança numa visita só. Cancelar um item no meio do bloco sobe os seguintes na mesma transação.",
          },
          {
            title: "Notificações no padrão outbox",
            text: "Todo e-mail nasce como linha em tabela, gravada após o commit da regra de negócio — falha de e-mail nunca derruba um agendamento. Um worker separado despacha em lote com retry e backoff, com idempotência por chave única no banco.",
          },
          {
            title: "Ciclo de conta como máquina de estados",
            text: "Seis estados, cada transição disparada por evento — webhook, job ou ação de operador —, nunca por cálculo de relógio na leitura. O efeito de acesso é resolvido por uma única função consumida por todas as rotas.",
          },
          {
            title: "Cobrança sem superfície PCI",
            text: "O cadastro não coleta nem tokeniza cartão: checkout hospedado do gateway para cartão, fatura hospedada para PIX. Nenhum dos dois muda o estado da conta — quem ativa é o webhook de pagamento, validado por token e idempotente.",
          },
        ],
        stats: [
          { value: "~59 mil", label: "linhas de TypeScript/TSX" },
          { value: "29", label: "modelos de dados" },
          { value: "63", label: "páginas e route handlers" },
          { value: "253", label: "testes automatizados" },
        ],
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
    sectionAiTitle: "AI-Driven Development",
    sectionAiText:
      "AI as part of the engineering process, not as a loose code generator: tooling versioned in the repository, controlled context and human review before the merge.",
    aiPractices: [
      {
        title: "Domain-specialized agents",
        text: "Subagents with their own scope and tools, versioned in the repository alongside the code. The agent starts a task already holding the right context instead of rediscovering the project every session.",
      },
      {
        title: "Versioned skills and commands",
        text: "Recurring flows — review, release, accessibility checks — become skills and slash commands in the repository. Changing the procedure is a pull request, not a prompt lost in someone's history.",
      },
      {
        title: "MCP wiring the assistant to real tools",
        text: "MCP servers grant controlled access to the browser, the database, documentation and external services. Answers become readings of real system state, under permissions I define.",
      },
      {
        title: "Documentation as context",
        text: "CLAUDE.md, ADRs and per-feature docs live in the repository and are what the assistant reads before writing code. Where docs and code disagree, the code wins and the docs get fixed.",
      },
      {
        title: "Human quality gate",
        text: "Every output goes through typecheck, lint, tests and my own review before the merge. AI speeds up the writing; architecture and product decisions stay human.",
      },
      {
        title: "Tight context, predictable output",
        text: "Sliced tasks, scope closed per branch and prompts pointing at specific files. That's what separates “the agent solved it” from “the agent rewrote half the project”.",
      },
    ],
    sectionDeliveryTitle: "Engineering, CI/CD and Deploy",
    sectionDeliveryText:
      "How code leaves my machine and reaches production: automated pipeline, a quality gate before publishing and infrastructure under control.",
    deliveryPipelineLabel: "From commit to production",
    deliveryPipeline: ["Commit and PR", "Lint and types", "Tests", "Build", "Automated deploy", "Production"],
    deliveryPractices: [
      {
        title: "GitHub Actions pipeline",
        text: "A push to the main branch always triggers the same flow: lockfile-pinned dependencies, lint, typecheck, tests and build. If one step fails, nothing ships.",
      },
      {
        title: "Automated, repeatable deploy",
        text: "Publishing over SSH to a self-hosted VPS or as an image in a container registry, one deploy at a time, with guardrails that abort before touching production when the artifact doesn't check out.",
      },
      {
        title: "Versioned migrations",
        text: "The database evolves through versioned migrations applied during deploy, before containers come up. Manual changes in production are not part of the process.",
      },
      {
        title: "Infrastructure under control",
        text: "Docker Compose in development, Caddy as a reverse proxy with automatic TLS, secrets kept out of the repository and variables injected at build or run time.",
      },
      {
        title: "Tests and types as a safety net",
        text: "Strict TypeScript and an automated suite running in CI on every push. Refactoring stops being a gamble and regressions show up before the client does.",
      },
      {
        title: "Git with closed scope",
        text: "Branch off the main line, scope closed per delivery, review before merge and no secrets in version control. A readable history is what makes a fast rollback possible.",
      },
    ],
    deliveryProfileLabel: "For hiring",
    deliveryProfile: [
      "5+ years in digital products",
      "From discovery to deploy",
      "Advanced English",
      "Agile / Scrum",
      "Remote: local and international teams",
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
    sectionOwnProjectsTitle: "Personal Products",
    sectionOwnProjectsText:
      "Products of my own, built from scratch: domain modeling, product, interface, infrastructure and deploy.",
    ownProjectVisitLabel: "Open",
    ownProjects: [
      {
        name: "Agendarium",
        url: "https://agendarium.net",
        urlLabel: "agendarium.net",
        logo: "/images/projects/agendarium-logo-horizontal.svg",
        logoAlt: "Agendarium logo",
        meta: "Multi-tenant SaaS · Built solo, end to end",
        tagline: "Online appointment scheduling for Brazilian SMB service providers.",
        summary:
          "A single product core serves multiple verticals through configuration — not through code. Each business gets a public booking page under its own URL, where customers pick a service, a professional and a time slot without calling or messaging; the owner runs schedule, staff, services, products, customer plans and billing from a dedicated dashboard. On top of it sits a platform layer: tiered subscriptions, account lifecycle wired to the payment gateway and an internal operations and support console.",
        stack: [
          "Next.js 15",
          "React 19",
          "TypeScript",
          "Tailwind v4",
          "PostgreSQL 16",
          "Prisma 6",
          "Auth.js v5",
          "pg-boss",
          "Zod 4",
          "Vitest",
          "Docker",
          "GitHub Actions",
          "Caddy",
          "Self-hosted VPS",
        ],
        highlightsTitle: "Technical highlights",
        highlights: [
          {
            title: "Schedule integrity enforced by the database",
            text: "Double-booking is prevented by a PostgreSQL EXCLUDE USING gist constraint over the appointment range. Two concurrent requests for the same slot don't rely on the code remembering to check: the database refuses.",
          },
          {
            title: "Availability computed, never persisted",
            text: "Free slots are computed on demand from each professional's availability windows, applying exceptions, buffers, minimum notice and booking horizon. No slot table to drift; dates stored in UTC, rendered in America/Sao_Paulo.",
          },
          {
            title: "Domain remodeled when the model gave out",
            text: "The unit of booking is no longer the appointment but the Ticket: a container aggregating N appointments, products and billing into a single visit. Cancelling an item mid-block pulls the following ones up in the same transaction.",
          },
          {
            title: "Transactional outbox for notifications",
            text: "Every email starts as a table row written after the business rule commits — a mail failure never takes down a booking. A separate worker dispatches in batches with retry and backoff, idempotent through a unique key in the database.",
          },
          {
            title: "Account lifecycle as a state machine",
            text: "Six states, each transition triggered by an event — webhook, job or operator action — never by clock math at read time. Access is resolved by a single function consumed by every route.",
          },
          {
            title: "Billing with no PCI surface",
            text: "Signup neither collects nor tokenizes cards: hosted checkout for credit card, hosted invoice for PIX. Neither one flips the account state — activation comes from the payment webhook, token-validated and idempotent.",
          },
        ],
        stats: [
          { value: "~59k", label: "lines of TypeScript/TSX" },
          { value: "29", label: "data models" },
          { value: "63", label: "pages and route handlers" },
          { value: "253", label: "automated tests" },
        ],
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
