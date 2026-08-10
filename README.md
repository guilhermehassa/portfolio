# Guilherme Hassã - Desenvolvedor Web

Landing page comercial bilíngue (PT-BR/EN) construída em Next.js (App Router) com Tailwind CSS e tema claro/escuro.

Publicado em **https://hassa.dev.br** como site estático (`output: "export"`), servido pelo
Caddy da VPS. O passo a passo de infraestrutura está em [DEPLOY.md](DEPLOY.md).

## Formulário de contato

O site não tem servidor próprio, então o formulário posta num Cloudflare Worker
(`worker/`) que envia o e-mail pela API HTTP do Brevo. A URL do Worker entra no build pela
variável `NEXT_PUBLIC_CONTACT_ENDPOINT`; sem ela, o formulário valida os campos e mostra um
aviso pedindo contato por e-mail, em vez de postar num endpoint inexistente.

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

Gera a pasta `out/` com HTML/CSS/JS puros. É esse conteúdo que vai para a VPS. Não existe
`npm run start`: o export estático não sobe servidor Node.

Para conferir o resultado localmente, sirva a pasta por HTTP (abrir o arquivo direto pelo
`file://` quebra o formulário e as rotas):

```
npx serve out
```

## Lint e checagem de tipos

```
npm run lint
npx tsc --noEmit
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
