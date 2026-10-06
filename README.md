# Guilherme Hassã - Desenvolvedor Web

Landing page comercial bilíngue (PT-BR/EN) construída em Next.js (App Router) com Tailwind CSS e tema claro/escuro.

Publicado em **https://hassa.dev.br** como site estático (`output: "export"`), servido pelo
Caddy da VPS. O passo a passo de infraestrutura está em [DEPLOY.md](DEPLOY.md).

## Formulário de contato

O site não tem servidor próprio, então o formulário posta num Cloudflare Worker
(`worker/`) que envia o e-mail pela API HTTP do Brevo. A URL do Worker entra no build pela
variável `NEXT_PUBLIC_CONTACT_ENDPOINT`; sem ela, o formulário valida os campos e mostra um
aviso pedindo contato por e-mail, em vez de postar num endpoint inexistente.

## Controle financeiro do motorista

A documentação de uso, arquitetura, dados, cálculos, backup e manutenção está em
[MOTORISTA.md](MOTORISTA.md).

`/motorista` é uma página estática fora da navegação do portfólio, com login Google e dados no
Cloud Firestore do projeto `motorista-17946`. O acesso aos dados é restrito pelo UID do
proprietário em [`firestore.rules`](firestore.rules), publicado também no Firebase. A configuração
do app web em `lib/motorista-firebase.ts` é pública; a proteção depende das regras. O Firestore
usa a região `southamerica-east1` e o app requer conexão para ler e gravar.

Um novo deploy do site não altera os dados. Para mudar o proprietário, atualize o UID tanto no
arquivo de regras quanto em `lib/motorista-firebase.ts`, publique as novas regras no Firebase e
faça o deploy do site. O login Google aceita `localhost` e `hassa.dev.br` como domínios autorizados.
O fechamento reúne Uber, 99 e Outros, horas/minutos e quilômetros em um registro por data.
Abastecimentos possuem detalhes opcionais, e os relatórios separam saldo dos lançamentos
do resultado estimado do trabalho. Definições reúne metas por mês, calendário, compromissos
e premissas históricas do veículo. O backup JSON v4 inclui as seis coleções e preserva IDs,
campos históricos e vínculos; continua aceitando versões 1, 2 e 3.

No celular, abra `https://hassa.dev.br/motorista` e use **Instalar aplicativo** no menu do
Chrome para criar um atalho que abre em tela própria. No iPhone, use **Compartilhar** →
**Adicionar à Tela de Início** no Safari. O aplicativo continua exigindo conexão para login,
leitura e gravação dos dados. O manifesto e os ícones são exclusivos da área do motorista.

## Requisitos

- Node.js 20+
- npm

## Setup

```
npm install
```

## Desenvolvimento

```
npm run dev
```

Acesse http://localhost:3000.

## Build de produção

```
npm run build
```

Gera a pasta `out/` com HTML/CSS/JS puros. É esse conteúdo que vai para a VPS.
`npm run start` executa `next start`; a publicação deste projeto serve o export estático.

Para conferir o resultado localmente, sirva a pasta por HTTP (abrir o arquivo direto pelo
`file://` quebra o formulário e as rotas):

```
npx serve out
```

## Lint e checagem de tipos

```
npm run lint
npx tsc --noEmit
npm run test:motorista
```

## Estrutura

- `app/` — layout raiz, metadata/SEO e a página única do site.
- `components/` — header, footer, toggles de tema/idioma e as seções da página (`components/sections/`).
- `lib/` — conteúdo bilíngue tipado (`content.ts`), validação do formulário e mapeamento de ícones de tecnologias.
- `hooks/` — hook de scroll-reveal usado pelas seções.
- `public/` — imagens, `robots.txt` e `sitemap.xml`.
- `worker/` — Cloudflare Worker do formulário de contato (projeto npm separado, com o próprio `tsconfig`).
- `old/` — versão anterior do site (PHP/HTML estático), mantida temporariamente como referência da migração.

## Deploy

Push em `master` dispara [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): build
do export e `rsync` do `out/` para a VPS. O Worker é publicado à parte, com `wrangler`.

Configuração de DNS, Caddy, Brevo e secrets: veja [DEPLOY.md](DEPLOY.md).
