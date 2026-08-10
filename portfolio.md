# Handoff — Portfólio `hassa.dev.br` na VPS compartilhada

> Documento de contexto para o agente que vai trabalhar **no repositório do portfólio**.
> Escrito em 09/08/2026 a partir do repositório do Agendarium (`D:\projects\agendarium`), que é
> quem hoje "manda" na borda da VPS. Autocontido: você não precisa daquele repo para executar,
> mas precisa saber o que ele controla — está descrito abaixo.

---

## 1. Objetivo

Publicar um **portfólio pessoal em Next.js** no domínio `hassa.dev.br`, na **mesma VPS** que já
roda o Agendarium (produto principal, em produção), **sem que um interfira no outro**.

A decisão de arquitetura já foi tomada e está justificada na seção 5: **site estático
(`output: export`)**, servido direto pelo Caddy, **sem container e sem imagem Docker**.

---

## 2. O que JÁ está pronto

**DNS (feito e verificado em 09/08/2026).** O domínio `hassa.dev.br` foi comprado no registro.br e a
zona é administrada pela **Cloudflare** (conta `guiihassa@gmail.com`, a mesma de `agendarium.net`).
A zona estava vazia; foram criados dois registros:

| Tipo | Nome | Conteúdo | Proxy | TTL |
| --- | --- | --- | --- | --- |
| A | `hassa.dev.br` (`@`) | `195.35.43.13` | **Somente DNS** (nuvem cinza) | Auto |
| A | `www.hassa.dev.br` | `195.35.43.13` | **Somente DNS** (nuvem cinza) | Auto |

Ambos já propagam corretamente (`hassa.dev.br -> 195.35.43.13` e o mesmo para `www`).

> ⚠️ **Nunca ligue o proxy da Cloudflare (nuvem laranja) nesses registros.** O painel exibe um
> banner insistindo nisso ("A proxy é necessária para a maioria dos recursos…") — **ignore**. Com o
> proxy ligado, o desafio de validação do certificado chega no Cloudflare em vez da VPS, e o Caddy
> nunca consegue emitir o TLS. `agendarium.net` está em Somente DNS pelo mesmo motivo.

**Nada mais foi feito.** Não existe pasta na VPS, nem bloco no Caddy, nem repositório configurado.

---

## 3. Acesso e topologia da VPS

**IP:** `195.35.43.13` (é o mesmo IP de `agendarium.net`; não é segredo, resolve por DNS público).

**Acesso ao terminal:**

```sh
ssh root@195.35.43.13
```

A chave SSH **já está instalada na máquina local do humano** — o acesso é direto, sem senha e sem
credencial nova. Porta padrão (22). O login é **root**, portanto não há barreira de permissão para
criar pastas em `/opt` nem para escrever nelas.

> O agente não lê, não imprime e não digita a chave privada. Só usa o comando acima.

**Sistema:** Docker + Docker Compose. Tudo roda em container; não há aplicação instalada no host.

### Quem já ocupa o quê

| Recurso | Quem ocupa | Observação |
| --- | --- | --- |
| Portas `80` e `443` | container **Caddy** do projeto `agendarium` | **Só um processo pode ter essas portas.** Você NÃO vai subir proxy próprio. |
| Porta `127.0.0.1:5432` | Postgres do Agendarium | só loopback; irrelevante para o portfólio |
| `/opt/agendarium` | projeto Compose do Agendarium | **não mexa aqui**, exceto o Caddyfile (seção 4) |
| Volumes `agendarium_*` | db, uploads, certificados do Caddy | prefixados pelo nome da pasta do projeto |

### Isolamento entre projetos (por que isso funciona)

O Docker Compose separa recursos pelo **nome do projeto**, que vem do nome da pasta. Volumes, redes
e containers nascem prefixados (`agendarium_db_data`, `agendarium-web-1`, …). Um projeto novo em
outra pasta não colide com nada automaticamente. **No cenário estático escolhido isso nem entra em
jogo**, porque o portfólio não terá container nenhum.

---

## 4. Como a borda (Caddy) funciona — leia antes de mexer

O Caddy é o "porteiro": recebe **toda** requisição da internet nas portas 80/443, olha o cabeçalho
`Host` para decidir de qual site se trata, e então serve arquivos do disco ou repassa para uma
aplicação. Ele também emite e renova os certificados HTTPS sozinho (Let's Encrypt), e redireciona
HTTP→HTTPS sem configuração.

| O quê | Onde |
| --- | --- |
| Arquivo de config (host) | `/opt/agendarium/Caddyfile` |
| Onde o container vê | `/etc/caddy/Caddyfile`, **somente leitura** |
| Certificados TLS | volume `agendarium_caddy_data` |
| Versionado em Git? | **NÃO.** Existe só na VPS, editado à mão. |

**O Caddyfile não está em nenhum repositório** — o CI do Agendarium copia apenas o
`docker-compose.prod.yml` e deliberadamente não toca no Caddyfile. Então "adicionar o portfólio ao
Caddy" é **sempre** uma edição manual na VPS.

### Ciclo de edição

Editar `/opt/agendarium/Caddyfile`, depois, de dentro de `/opt/agendarium`:

```sh
# valida a sintaxe
docker compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile

# aplica sem downtime (se a config for inválida, ele RECUSA e mantém a antiga rodando)
docker compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile

# é aqui que aparece erro de emissão de certificado
docker compose -f docker-compose.prod.yml logs -f caddy
```

Sem o `reload`, editar o arquivo não muda nada — o Caddy já leu a config na subida.

---

## 5. Tipo de repositório: Next.js com `output: export`

**Indicação: site estático.** O portfólio serve "alguns arquivos e um formulário de contato".

**Por quê:** manter um container Node ligado 24h/dia consumindo 200–300MB de RAM para atender um
formulário que recebe poucas mensagens por mês é o pior custo-benefício de memória da VPS. Estático
elimina, de uma vez: imagem Docker, GHCR, rede Docker, `reverse_proxy`, container e consumo de RAM.
De bônus, o site fica imune aos **resets frequentes do Agendarium** — não há container para cair junto.

**O que `output: export` desliga** (não é limitação de config, é o que "exportar para arquivos"
significa):

- Server Actions
- Route Handlers / rotas de API
- ISR e revalidação
- Middleware
- `next/image` com otimização em runtime (use `images: { unoptimized: true }`)

**Consequência prática: o formulário de contato NÃO pode ser um Server Action.** Ver seção 7.

**Quando reconsiderar SSR:** se o portfólio virar blog com CMS, área logada, ou qualquer coisa que
precise de dados por requisição. Para vitrine + contato, não vale.

### Configuração esperada

```js
// next.config.js — esboço
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false, // ver nota do try_files na seção 6
};
```

O build gera a pasta `out/` com HTML/CSS/JS puros. **É essa pasta que vai para a VPS.**

---

## 6. Publicação na VPS

### 6.1 Pasta no host (executar uma vez)

```sh
mkdir -p /opt/sites/hassa.dev.br
```

Como o login é root, não há ajuste de permissão a fazer — nem `sudo`. Também não existe aqui o
problema de UID que afeta o volume de uploads do Agendarium: o container do Caddy roda como root e
só precisa **ler** esta pasta.

### 6.2 Dependência no repositório do Agendarium (⚠️ não é você quem faz)

O Caddy roda em container e **não vê** `/opt/sites/hassa.dev.br` a menos que a pasta seja montada
nele. Isso exige **uma linha** no serviço `caddy` do `docker-compose.prod.yml` **do repositório do
Agendarium**:

```yaml
- /opt/sites/hassa.dev.br:/srv/hassa.dev.br:ro
```

Dois pontos críticos:

1. **Editar esse arquivo à mão na VPS é inútil**: o CI do Agendarium faz `scp` do
   `docker-compose.prod.yml` sobre a VPS a cada deploy, e sua edição manual seria sobrescrita. A
   mudança tem que ir **pelo repositório** do Agendarium.
2. **Essa alteração é tarefa do repositório do Agendarium, não deste.** Ela está pendente de
   aprovação do humano. **Enquanto ela não for aplicada e o Caddy recriado, o site não sobe** — o
   Caddy responderá erro ao tentar ler `/srv/hassa.dev.br`.

O `:ro` é intencional: o Caddy só precisa de leitura.

### 6.3 Bloco no Caddyfile (edição manual na VPS)

Adicionar em `/opt/agendarium/Caddyfile`, **sem tocar no bloco existente do `agendarium.net`**:

```caddyfile
hassa.dev.br {
    root * /srv/hassa.dev.br
    encode gzip zstd
    # O export do Next gera /sobre.html; isto faz /sobre funcionar sem a extensão.
    try_files {path} {path}.html {path}/index.html
    file_server
}

www.hassa.dev.br {
    redir https://hassa.dev.br{uri} permanent
}
```

O `www` precisa do próprio bloco porque o redirecionamento acontece no Caddy — e é justamente por
isso que o registro DNS do `www` foi criado: sem ele resolver, não há o que redirecionar.

Depois: `validate` → `reload` → conferir o log (seção 4).

### 6.4 Deploy (workflow no repositório do portfólio)

Pipeline: **GitHub Actions → SSH → rsync**. Sem GHCR, sem imagem Docker, sem migração.

Passos do job: `npm ci` → `npm run build` (gera `out/`) → sincronizar `out/` para
`/opt/sites/hassa.dev.br` via SSH.

```sh
rsync -az --delete out/ root@195.35.43.13:/opt/sites/hassa.dev.br/
```

> ⚠️ **Cuidado com `--delete`**: ele apaga na VPS o que não existe em `out/`. Confirme o caminho de
> destino antes do primeiro deploy. Se preferir mais segurança no começo, rode sem `--delete`.
> A barra final em `out/` importa (copia o *conteúdo*, não a pasta).

**Secrets do GitHub necessários** no repositório do portfólio (nomes sugeridos, espelhando o padrão
do Agendarium): `VPS_SSH_HOST`, `VPS_SSH_PORT`, `VPS_SSH_USER`, `VPS_SSH_PRIVATE_KEY`. O humano
preenche os valores — **o agente não lê, não imprime e não digita segredo**.

Nota de segurança, para conhecimento: a chave SSH de deploy dá acesso ao Docker da VPS, o que
equivale a root. Reusar a mesma chave em vários repositórios significa que comprometer o secret de
um compromete a máquina toda. Para projetos pessoais é risco aceitável — só não é invisível.

---

## 7. Formulário de contato

Como o site é estático, o `<form>` precisa postar para **algo fora da VPS**. Três caminhos, com a
conta honesta:

| Opção | Esforço | Usa Brevo? | Peça nova |
| --- | --- | --- | --- |
| **A. Serviço de formulário** (Web3Forms, Formspree, Basin) | ~5 min | não | nenhuma |
| **B. Cloudflare Worker + API do Brevo** | ~1 tarde | **sim** | Worker + `wrangler` |
| C. Next SSR em container + Brevo por SMTP | maior | sim | container, GHCR, RAM |

**Comece pela A se o objetivo é estar no ar hoje.** O `<form>` dá POST direto no endpoint do serviço
e eles enviam o e-mail; zero backend. Desvantagem: dependência de terceiro e o e-mail sai da infra deles.

**A opção B é a recomendada se o humano quer o e-mail sob controle próprio** (foi o que ele sinalizou
ao pedir Brevo). A opção C está listada só para registro — reintroduz tudo que a decisão de
arquitetura eliminou.

### 7.1 Detalhes do Brevo — leia, tem armadilha

O Brevo **já está configurado e em produção para o Agendarium**, mas de uma forma que **não serve
diretamente** para um Cloudflare Worker:

- O Agendarium usa **SMTP relay** (`smtp-relay.brevo.com:587`, STARTTLS) via nodemailer, com as
  variáveis `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASSWORD` / `MAIL_FROM` no `.env` da VPS.
- **Cloudflare Workers não abrem conexão SMTP.** Não existe nodemailer num Worker. Você **precisa
  usar a API HTTP do Brevo**: `POST https://api.brevo.com/v3/smtp/email`, autenticada por header
  `api-key`.
- Essa API key **é diferente das credenciais SMTP** e **não existe hoje** no projeto do Agendarium
  (não há `BREVO_API_KEY` em nenhum lugar do código dele). **É preciso criar uma nova** no painel do
  Brevo e guardá-la como **secret do Worker** (`wrangler secret put`), nunca no repositório.

**Segunda armadilha — autenticação de domínio.** No Brevo, quem está autenticado por **DKIM** é
`agendarium.net` (dois CNAMEs `brevoN._domainkey` + TXT `brevo-code`), e o remetente validado é
`no-reply@agendarium.net`. **`hassa.dev.br` NÃO está autenticado no Brevo.** Portanto:

- Enviar com remetente `@hassa.dev.br` sem autenticar o domínio → alta chance de cair em spam ou ser
  rejeitado.
- Duas saídas: **(a)** autenticar `hassa.dev.br` no Brevo — mesmo procedimento já feito para
  `agendarium.net`, adicionando os CNAMEs de DKIM e o TXT na zona do Cloudflare; ou **(b)** usar o
  remetente já validado `no-reply@agendarium.net`, que funciona mas é esquisito num portfólio pessoal.
- Recomendado: **(a)**, e é um passo no Cloudflare, não no código.

**Padrão de e-mail para formulário de contato:** remetente = endereço autenticado do seu domínio;
destinatário = a caixa pessoal do humano; **`reply-to` = o e-mail que o visitante digitou**. Assim
responder a mensagem responde para a pessoa certa, e a autenticação do domínio não é violada.

**Anti-abuso:** um endpoint de formulário público vira alvo de bot. O Agendarium usa **Cloudflare
Turnstile** no formulário público dele (a site key é `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, embutida no
bundle em tempo de build; o secret valida no servidor). Mesmo padrão serve aqui, e você já está no
ecossistema Cloudflare. Sem alguma proteção, espere spam.

---

## 8. Ordem de execução sugerida

1. **[repo do portfólio]** Criar o projeto Next 15 com `output: export`; garantir que `npm run build`
   gera `out/`.
2. **[VPS]** `sudo mkdir -p /opt/sites/hassa.dev.br` e ajustar permissão de escrita para o usuário do deploy.
3. **[repo do Agendarium — outro agente/humano]** Adicionar o mount `/opt/sites/hassa.dev.br:/srv/hassa.dev.br:ro`
   no serviço `caddy`, promover e redeployar. **Bloqueante para o passo 5.**
4. **[repo do portfólio]** Workflow de deploy (build + rsync) e secrets SSH; primeiro deploy — os
   arquivos chegam na VPS mas ainda não são servidos.
5. **[VPS]** Adicionar os dois blocos no Caddyfile, `validate`, `reload`, conferir o log do Caddy.
   Aqui o certificado é emitido e o site entra no ar.
6. **[formulário]** Opção A para estar no ar rápido; ou opção B (Worker + API key do Brevo + DKIM de
   `hassa.dev.br` no Cloudflare) para controle próprio.
7. **[opcional]** Turnstile no formulário.

O passo 3 é a única dependência externa ao repositório do portfólio. Os passos 1, 2 e 4 podem
avançar em paralelo a ele.

---

## 9. Convenções de trabalho do humano (valem em qualquer repositório dele)

- **Responder sempre em português do Brasil**, inclusive a narração entre chamadas de ferramenta.
- **Conhecimento de containers é básico**: explique termos avançados de forma simplificada.
- **Não concorde por default** — ponderar e dizer a verdade, inclusive discordando, é o esperado.
- **Git só pelo terminal, com `git`.** `gh` e MCP de Git não fazem parte do fluxo.
- **Nunca commitar, dar push ou merge por conta própria**, nem para "salvar" trabalho. Deixe as
  mudanças no working tree; a gravação no Git é disparada pelo humano.
- **Trabalhar em branch derivada de `master`**, criada **antes** do primeiro arquivo editado.
- **Nunca versionar `.env`, credenciais, dumps ou secrets.**
- **Segredo (senha, chave, token) o agente não lê, não imprime e não digita.**
- **Validação visual** é feita no Chrome real logado (MCP `claude-in-chrome`), nunca em browser
  headless ou `next dev` paralelo.
- **"Apagar vence adaptar"**: nesta infra não existe nada a preservar. Diante de
  *migrar/adaptar* vs. *apagar e recriar limpo*, escolher recriar.

---

## 10. Suposições a confirmar com o humano

Itens que eu **não** verifiquei e que não devem ser assumidos como fato:

1. **`/opt/sites/hassa.dev.br` é um caminho proposto por mim**, não uma convenção existente na VPS.
   Se o humano preferir outro, ajuste o mount, o `root` do Caddyfile e o destino do rsync juntos.
3. **E-mail de destino do formulário** não foi definido.
4. **Escolha entre a opção A e B do formulário** não foi feita.
5. **RAM e disco da VPS são desconhecidos.** Irrelevante para o portfólio estático; volta a importar
   se surgirem micro apps com servidor.
6. A decisão de **manter o Caddy dentro do projeto do Agendarium** (em vez de extraí-lo para um
   projeto próprio de borda) foi tomada por simplicidade. O efeito colateral aceito: derrubar ou
   resetar o projeto do Agendarium tira o portfólio do ar junto, e os certificados TLS dele moram no
   volume `agendarium_caddy_data`. Se um dia isso incomodar, a extração do Caddy para `/opt/edge`
   com uma rede Docker compartilhada é o caminho já mapeado.