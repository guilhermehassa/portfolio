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

Em produção, `/motorista` é uma página estática fora da navegação do portfólio, com login Google e dados no
Cloud Firestore do projeto `motorista-17946`. O acesso aos dados é restrito pelo UID do
proprietário em [`firestore.rules`](firestore.rules), publicado também no Firebase. A configuração
do app web em `lib/motorista-firebase.ts` é pública; a proteção depende das regras. O Firestore
usa a região `southamerica-east1` e o app requer conexão para ler e gravar.

Um novo deploy do site não altera os dados. Para mudar o proprietário, atualize o UID tanto no
arquivo de regras quanto em `lib/motorista-firebase.ts`, publique as novas regras no Firebase e
faça o deploy do site. O login Google aceita `localhost` e `hassa.dev.br` como domínios autorizados.
O Início reúne ações da jornada, gasto e abastecimento e termina nos cards Meta pra hoje,
Meta da semana, Meta do mês e ganhos da semana. A meta semanal rateia as metas mensais pelos
dias planejados de trabalho, combinando os meses quando necessário. Os progressos usam o saldo
realizado até hoje. O gráfico tem seletor exclusivo de semanas; a seleção altera somente seus
registros, sem mudar as metas do Início. Correções continuam em Ganhos,
análises em Relatórios e planejamento em Definições.
As ações permitem iniciar, pausar, retomar e encerrar uma única jornada aberta. Horários e pausas
calculam os minutos fixos; odômetros inicial/final calculam os quilômetros. O fechamento reúne
Uber, 99 e Outros em um registro pela data de início, inclusive ao atravessar meia-noite.
Encerrar dia tem quatro etapas: horário final, pausas, dados finais e ganhos; tudo fica
em rascunho até concluir Ganhos, quando a jornada é gravada integralmente. Gastos e
abastecimentos continuam no cadastro separado e não são alterados pelo encerramento.
Em Ganhos, o filtro permanece e há somente **Registrar dia anterior** e um **Editar** por dia.
Cadastro e edição usam cinco etapas: Início, Encerramento, Pausas, Dados finais e Ganhos.
O cadastro começa em ontem, permite outra data passada e bloqueia datas já ocupadas,
orientando usar Editar na lista. A edição abre os dados preenchidos e permite corrigi-los.
Horários e odômetros são opcionais no cadastro anterior e nos registros históricos;
ausências, minutos e KM manuais são preservados sem inventar valores. A confirmação exige
ganho informado, inclusive zero, e fecha o dia em uma única transação, sem Salvar pendente
ou Marcar folga nesse novo modal. Editar uma jornada aberta ou pausada exige encerrá-la validamente.
Cancelar descarta o rascunho; conflitos recusam a gravação, e mudar a data transfere o
registro sem duplicar dias nem mover gastos, preservando os campos históricos.
Relatórios é somente leitura; cadastro e correção dos dias ficam em Ganhos.
Período é opcional e permite selecionar manhã, tarde, noite e madrugada em conjunto;
as escolhas manuais preservam os turnos históricos e os totais da jornada.
Abastecimentos têm detalhes opcionais e um checkbox **Tanque cheio**: marcado significa
completo; desmarcado, parcial. O formulário não pede odômetro e não oferece classificação
ou vínculo com previsão, tanto em abastecimentos quanto em gastos comuns; Observação permanece.
Editar outros dados preserva odômetros, classificações e vínculos históricos. Tanque antigo
ausente ou não informado é preservado quando o checkbox não foi alterado. A opção de marcar
abastecimento anterior ausente foi removida; sinalizadores antigos são preservados como
metadados e não afetam o cálculo de consumo. Novos abastecimentos
sem odômetro não permitem consumo observado.
Relatórios aceita somente semanas e meses atuais/passados, com sete grupos: Resumos,
Médias, Constatações, Lucratividade, Plataformas, Gastos e Veículo. Tudo financeiro termina
hoje; lucro é ganhos menos gastos registrados e manutenção proporcional. Médias diárias
dividem pelos dias efetivamente trabalhados. Indicadores por hora/KM/viagem ficam em “—”
quando faltam dados. A linha Meta reconstrói a necessidade no começo de cada data, usando
saldo até o dia anterior e metas/calendário atuais; Atingido mostra ganhos informados.
Falta e ganho necessário usam somente o déficit atual, sem projetar custos futuros.
Consumo é exclusivamente manual diário: ausente vira lacuna; a média é distância total
dividida pelo volume implícito desses dias. Dias sem KM podem aparecer apenas na linha.
Em Gastos, **Registrar manutenção** cria um registro com custo total, quantidade de parcelas
e mês inicial; à vista equivale a uma parcela. As parcelas são custos analíticos de meses
consecutivos, com soma exata em centavos, sem vencimento, situação de pagamento ou lembretes.
Cada parcela é reconhecida aos poucos nos dias planejados do próprio mês; sem dias planejados,
usa os dias corridos. Dias, semanas, meses e metas usam essas mesmas cotas até hoje, mantendo
as futuras no planejamento e sem somar novamente o total do registro. A manutenção usa 100%
do valor como custo do trabalho. A estimativa de manutenção por KM foi retirada; campos antigos
permanecem como metadados inertes. Estimativas de desgaste e custos fixos também foram retiradas,
com seus campos antigos preservados e sem efeito. Registros antigos
não são convertidos por categoria ou descrição e nenhuma manutenção de exemplo é cadastrada.
Definições reúne metas por mês, calendário, compromissos
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

Em desenvolvimento, `/motorista` usa o mesmo Firebase real da aplicação publicada,
com login Google restrito ao proprietário. Não há ambiente local de teste nem carga de
cópia. Jornadas, pausas, ganhos, gastos, relatórios, definições e backups usam os dados
originais. O retorno ao Firebase não importou os lançamentos temporários; os backups
das migrações reais continuam preservados, conforme [MOTORISTA.md](MOTORISTA.md).

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
