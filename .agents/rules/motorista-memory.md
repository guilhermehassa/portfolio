---
trigger: always_on
---

# Memória do Projeto: Portfólio (`hassa.dev.br`) e Aplicação `/motorista`

Este repositório contém um projeto **Next.js 16 (App Router)** com exportação estática (`output: "export"` em `next.config.ts`), React 19 e Tailwind CSS v4, publicado em `https://hassa.dev.br` via Caddy na VPS. Ele abriga duas aplicações independentes:

---

## 1. Landing Page Comercial (`/`)

- **Propósito**: Portfólio comercial bilíngue (`pt-BR` / `en`) de Guilherme Hassã com suporte a tema claro/escuro e SEO técnico.
- **Arquivos Principais**:
  - `app/layout.tsx` e `app/page.tsx`: Layout raiz, metadados, JSON-LD, script inline pré-hidratação de tema (`INIT_SCRIPT`) e composição das seções.
  - `lib/content.ts`: Conteúdo bilíngue tipado.
  - `components/sections/*`: Seções da landing page (`HeroSection`, `OwnProjectsSection`, `ProjectsSection`, `TechStackSection`, `AiAssistedSection`, `DeliverySection`, `ContactSection`).
  - `worker/src/index.ts`: Cloudflare Worker que recebe o `POST` do formulário de contato (`NEXT_PUBLIC_CONTACT_ENDPOINT`), aplica CORS, rate limit e honeypot (`website`), valida os dados e envia o e-mail via API HTTP do Brevo.

---

## 2. Subaplicação `/motorista` (Controle Financeiro e Jornadas)

Aplicação web progressiva (PWA, `noindex`, manifesto em `/pwa/motorista.webmanifest`) de uso pessoal para controle de jornadas, ganhos, gastos, abastecimentos, manutenções, formas de pagamento/faturas, relatórios e metas mensais/semanais.

### Firebase e Persistência de Dados
- **Projeto Firebase**: `motorista-17946` (região `southamerica-east1`, banco `(default)`).
- **UID do Proprietário**: `Yc7qwiq4tPcRpw4tgtrw3VfxOOh1` (definido em `lib/motorista-firebase.ts` como `MOTORISTA_UID` e validado em `firestore.rules`).
- **URL do Console do Firebase / Firestore (configuração e dados do usuário)**:
  `https://console.firebase.google.com/project/motorista-17946/firestore/databases/-default-/data/~2Fusers~2FYc7qwiq4tPcRpw4tgtrw3VfxOOh1`
- **Ambiente Único**: Tanto em desenvolvimento (`localhost`) quanto em produção (`hassa.dev.br`), `/motorista` conecta-se ao **mesmo Firebase real**, exigindo login Google do proprietário. Não há banco de testes local nem dados fictícios.
- **Servidor de Desenvolvimento**: Fica a encargo do usuário iniciar e manter a aplicação rodando localmente com `npm run dev`. A aplicação responde em `http://localhost:3000/` (e a subaplicação em `http://localhost:3000/motorista`). Não inicie um novo servidor de desenvolvimento sem necessidade.
- **Regras de Segurança**: `firestore.rules` valida propriedade (`owner(userId)`), integridade transacional da jornada aberta (`journeyState/current` apontando para `days/{date}`) e validade de `paymentMethods` e termos de pagamento nos gastos/manutenções.

### Estrutura e Fluxos Funcionais (`components/motorista/*` e `lib/motorista*.ts`)
1. **Início (`motorista-home-cards.tsx`, `motorista-day-ending.tsx`, `lib/motorista-weekly-goal.ts`)**:
   - Controle de jornada única aberta (*Iniciar dia*, *Iniciar/Encerrar pausa* e *Encerrar dia*).
   - O encerramento do dia ocorre em **4 etapas em rascunho** (*Encerramento → Pausas → Dados finais → Ganhos*) e grava tudo em uma única transação ao concluir.
   - Atalhos rápidos para *Registrar gasto* e *Abastecer*.
   - Quatro cards inferiores: **Meta pra hoje**, **Meta da semana** (rateio das metas mensais pelos dias planejados na semana segunda–domingo), **Meta do mês** e gráfico **Ganhos da semana** (com seletor próprio de semanas segunda–domingo).
2. **Ganhos (`lib/motorista-day-editing.ts`, `lib/motorista-wizard-navigation.ts`)**:
   - Ação principal **Registrar dia anterior** e botão único **Editar** por dia listado.
   - Usa um *wizard* de **5 etapas** (*Início → Encerramento → Pausas → Dados finais → Ganhos*), permitindo corrigir horários, pausas, odômetros, KM/minutos manuais, períodos (*Manhã, Tarde, Noite, Madrugada*) e totais por plataforma (*Uber, 99, Outros*).
   - Gravação atômica com verificação de concorrência; alteração de data transfere a jornada e os ganhos sem mover gastos.
3. **Gastos, Abastecimentos e Manutenção (`motorista-forms.tsx`, `motorista-maintenance.tsx`, `lib/motorista-maintenance.ts`)**:
   - **Novos registros** (gasto comum, abastecimento ou manutenção) exigem uma **forma de pagamento ativa** (`paymentMethodId` + snapshot dos termos em `paymentMethodSnapshot`). Registros antigos sem forma permanecem válidos e editáveis sem aviso.
   - **Abastecimentos**: Informam combustível, volume (`L` ou `m3`) e checkbox **Tanque cheio** (`full` vs `partial`), sem pedir odômetro no formulário (preservando odômetros e metadados históricos ao editar).
   - **Manutenção por meses**: Registra custo total, quantidade de parcelas, mês inicial e `purchaseDate` (data da compra). O valor é 100% profissional e rateado analiticamente em centavos pelas datas planejadas de cada mês consecutivo.
4. **Relatórios (`motorista-reports.tsx`, `lib/motorista-reporting.ts`, `motorista-expense-reports.tsx`, `lib/motorista-invoice-reporting.ts`)**:
   - **Subaba Geral**: Somente leitura para semanas (seg–dom) ou meses atuais/passados (limitados até hoje), organizada em 7 grupos: *Resumos, Médias, Constatações, Lucratividade, Plataformas, Gastos e Veículo*.
   - **Subaba Gastos (Faturas)**: Consulta somente leitura filtrada por **data de vencimento** (inclusive futura), forma de pagamento e categoria. Calcula o ciclo de fechamento/vencimento de cartões de crédito a partir do `paymentMethodSnapshot` salvo na compra (compras no dia do fechamento entram no próximo ciclo; manutenção entra uma única vez pelo total na `purchaseDate`).
5. **Definições e Backup (`motorista-settings.tsx`, `motorista-payment-methods.tsx`, `lib/motorista-payment-methods.ts`)**:
   - Configuração de metas mensais, calendário planejado, compromissos recorrentes, perfis de veículo, categorias e **formas de pagamento** (*Outro* ou *Cartão de Crédito* com dias de fechamento e vencimento de 1 a 31).
   - Exportação e importação de **Backup JSON v5** (retrocompatível com v1–v4, preservando todas as 7 coleções e campos históricos) e exportação CSV.

### Documentação e Testes
- Documentação detalhada no repositório: `MOTORISTA.md` e `MODELO-EVOLUCAO-MOTORISTA.md`.
- Testes automatizados do domínio e UI do motorista: `npm run test:motorista` (`tests/motorista*.test.mjs`).
