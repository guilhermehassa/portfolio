# Deploy do portfólio — hassa.dev.br

Runbook de infraestrutura. O site é um **export estático** do Next servido pelo Caddy que
já roda na VPS do Agendarium. Não há container nem servidor Node em produção.

```
GitHub (push em master)
   └─ Actions: npm ci → npm run build → rsync out/ ──► VPS /opt/sites/hassa.dev.br
                                                          ▲
navegador ──► Caddy (portas 80/443, projeto agendarium) ──┘  lê via mount :ro

formulário ──► api.hassa.dev.br (Cloudflare Worker) ──► API do Brevo ──► e-mail
```

---

## Estado atual

| Item | Situação |
| --- | --- |
| DNS `hassa.dev.br` e `www` → `195.35.43.13` | Pronto, **Somente DNS** (nuvem cinza) |
| Repositório: `output: export`, build gerando `out/` | Pronto e validado |
| Workflow de deploy | Pronto, aguardando os secrets |
| Worker do formulário (`worker/`) | Código pronto, aguardando publicação |
| Pasta `/opt/sites/hassa.dev.br` na VPS | **Pendente** (o workflow cria no primeiro deploy) |
| Mount da pasta no container do Caddy | **Pendente — bloqueia o site no ar** (ver passo 2) |
| Blocos no Caddyfile | **Pendente** (passo 3) |
| Brevo: DKIM de `hassa.dev.br` + API key | **Pendente** (passo 5) |
| Cloudflare Email Routing `contato@` → Gmail | **Pendente** (passo 4) |

> ⚠️ **Nunca ligue o proxy da Cloudflare (nuvem laranja) em `hassa.dev.br` ou `www`.** O painel
> insiste nisso; ignore. Com o proxy ligado, o desafio de validação do certificado chega no
> Cloudflare em vez da VPS e o Caddy nunca emite o TLS. O subdomínio `api.` é a única exceção —
> ele é do Worker, é proxied por natureza e não interfere no apex.

---

## Passo 1 — Secrets e variável no GitHub

Em **Settings → Secrets and variables → Actions**, no environment `production`:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `VPS_SSH_HOST` | secret | `195.35.43.13` |
| `VPS_SSH_PORT` | secret | `22` |
| `VPS_SSH_USER` | secret | `root` |
| `VPS_SSH_PRIVATE_KEY` | secret | chave privada de deploy (conteúdo completo, com a linha final) |
| `VPS_SITE_PATH` | secret | `/opt/sites/hassa.dev.br` |
| `NEXT_PUBLIC_CONTACT_ENDPOINT` | **variable** | `https://api.hassa.dev.br` |

O workflow pula o deploy (sem falhar) enquanto algum secret estiver faltando, e aborta se
`VPS_SITE_PATH` não estiver sob `/opt/sites/` — proteção contra o `--delete` do rsync apagar
o diretório errado.

`NEXT_PUBLIC_CONTACT_ENDPOINT` é *variable*, não secret: ela é embutida no HTML publicado e
fica visível para qualquer visitante de qualquer forma.

> Nota de segurança: essa chave SSH dá acesso ao Docker da VPS, o que equivale a root.
> Reusá-la em vários repositórios significa que vazar o secret de um compromete a máquina toda.

---

## Passo 2 — Mount no container do Caddy ⚠️ BLOQUEANTE

**Este passo é no repositório do Agendarium, não neste.**

O Caddy roda em container e não enxerga `/opt/sites/hassa.dev.br` a menos que a pasta seja
montada nele. Falta **uma linha** no serviço `caddy` do `docker-compose.prod.yml` **do repo do
Agendarium**:

```yaml
  caddy:
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - uploads:/data/uploads:ro
      - caddy_data:/data
      - caddy_config:/config
      - /opt/sites/hassa.dev.br:/srv/hassa.dev.br:ro   # <-- adicionar
```

O `:ro` é intencional — o Caddy só precisa ler.

**Editar esse arquivo à mão na VPS não resolve de forma permanente:** o CI do Agendarium faz
`scp` do `docker-compose.prod.yml` a cada deploy e sobrescreve a edição manual. A mudança tem
que ir pelo repositório. Depois do merge, o deploy do Agendarium recria o container do Caddy
e o mount passa a existir.

Enquanto isso não acontecer, o Caddy responde erro ao tentar ler `/srv/hassa.dev.br`.

---

## Passo 3 — Blocos no Caddyfile

Edição **manual na VPS**, em `/opt/agendarium/Caddyfile`. Esse arquivo não existe em nenhum
repositório e o CI do Agendarium nunca o toca — editar à mão aqui é o fluxo correto.

Adicione ao final, **sem tocar no bloco do `agendarium.net`**:

```caddyfile
hassa.dev.br {
    root * /srv/hassa.dev.br
    encode gzip zstd

    # O export do Next gera /pagina.html; isto faz /pagina responder sem a extensão.
    try_files {path} {path}.html {path}/index.html
    file_server

    # Página 404 do próprio Next em vez da tela padrão do Caddy.
    handle_errors {
        @notfound expression {err.status_code} == 404
        rewrite @notfound /404.html
        file_server
    }
}

www.hassa.dev.br {
    redir https://hassa.dev.br{uri} permanent
}
```

O `www` precisa do próprio bloco porque o redirecionamento acontece no Caddy — e é por isso
que o registro DNS do `www` existe: sem ele resolver, não há o que redirecionar.

Aplicar, de dentro de `/opt/agendarium`:

```sh
# valida a sintaxe
docker compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile

# aplica sem downtime (config inválida é RECUSADA e a antiga continua rodando)
docker compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile

# é aqui que aparece erro de emissão de certificado
docker compose -f docker-compose.prod.yml logs -f caddy
```

Sem o `reload`, editar o arquivo não muda nada — o Caddy já leu a config na subida.
É neste passo que o certificado TLS é emitido e o site entra no ar.

---

## Passo 4 — Cloudflare Email Routing (receber em `contato@`)

O endereço `contato@hassa.dev.br` já está publicado no JSON-LD do site, mas hoje é uma caixa
que não recebe nada. O Email Routing conserta isso de graça.

No painel da Cloudflare, zona `hassa.dev.br` → **Email → Email Routing**:

1. Habilite o Email Routing (ele cria os registros MX e o TXT de SPF na zona sozinho).
2. Em **Destination addresses**, adicione `guiihassa@gmail.com` e confirme pelo link que
   chega no Gmail.
3. Em **Custom addresses**, crie `contato@hassa.dev.br` → encaminhar para `guiihassa@gmail.com`.

Teste enviando um e-mail de fora para `contato@hassa.dev.br` antes de seguir.

---

## Passo 5 — Brevo

### 5.1 Autenticar `hassa.dev.br` (DKIM)

Hoje quem está autenticado no Brevo é `agendarium.net`. **`hassa.dev.br` não está** — enviar
com remetente `@hassa.dev.br` sem isso resulta em spam ou recusa.

No Brevo, **Senders, Domains & Dedicated IPs → Domains → Add a domain**: informe
`hassa.dev.br` e adicione na zona da Cloudflare os registros que ele pedir (dois CNAME
`brevoN._domainkey` e um TXT `brevo-code`) — mesmo procedimento já feito para `agendarium.net`.

Os registros de autenticação são de e-mail; não têm relação com o proxy do site.

⚠️ Atenção ao SPF: o passo 4 cria um TXT de SPF para o Email Routing. Se o Brevo também pedir
SPF, **não crie um segundo registro TXT de SPF** — um domínio só pode ter um. Combine os
mecanismos num único registro (`v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`).
Dois registros de SPF invalidam os dois.

### 5.2 Criar a API key

O Agendarium usa **SMTP relay** com nodemailer. **Cloudflare Workers não abrem conexão SMTP**,
então o Worker usa a **API HTTP** do Brevo, que exige uma credencial diferente.

Em **SMTP & API → API Keys → Generate a new API key**. Guarde como secret do Worker (passo 6);
nunca no repositório.

---

## Passo 6 — Publicar o Worker

```sh
cd worker
npm install
npx wrangler login          # abre o navegador; autentica na conta Cloudflare
npx wrangler secret put BREVO_API_KEY   # cola a chave do passo 5.2
npx wrangler deploy
```

O `wrangler.toml` já declara `api.hassa.dev.br` como *custom domain*: a Cloudflare cria o
registro DNS sozinho ao publicar. Isso **não afeta** o apex nem o TLS do Caddy.

Se o `npm install` avisar sobre install scripts pendentes (`esbuild`, `workerd`), rode
`npm approve-scripts --allow-scripts-pending` — sem os binários o `wrangler deploy` não roda.

Teste depois de publicar:

```sh
curl -i -X POST https://api.hassa.dev.br \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hassa.dev.br' \
  -d '{"name":"Teste Manual","email":"seu@email.com","phone":"41999999999","subject":"freelance"}'
```

Esperado: `HTTP/2 200` com `{"ok":true}` e o e-mail chegando no Gmail. Para ver o erro real do
Brevo quando algo falha: `npx wrangler tail`.

### Ajustes do Worker

Tudo em `worker/wrangler.toml`:

- `CONTACT_TO` — destino das mensagens. Se o encaminhamento do passo 4 der problema, troque
  para `guiihassa@gmail.com` e o e-mail chega direto, sem o hop do Email Routing.
- `CONTACT_FROM` — remetente; precisa ser do domínio autenticado no passo 5.1.
- `ALLOWED_ORIGIN` — origem autorizada a chamar o endpoint.
- Rate limit por IP: 5 linhas comentadas no fim do arquivo. Sem Turnstile, é o que impede um
  bot de queimar a cota diária do Brevo. Descomente e publique de novo para ativar.

---

## Passo 7 — Primeiro deploy

Com os secrets do passo 1 configurados, um push em `master` faz o resto: o workflow cria
`/opt/sites/hassa.dev.br` se não existir e sincroniza o `out/`.

Também dá para disparar sem push, em **Actions → Deploy → Run workflow**.

---

## Ordem recomendada

1. Passo 1 (secrets) e passo 7 (primeiro deploy) — os arquivos chegam na VPS, ainda não servidos.
2. Passo 2 (mount no repo do Agendarium) — **bloqueante**.
3. Passo 3 (Caddyfile) — aqui o site entra no ar com HTTPS.
4. Passos 4, 5 e 6 (e-mail) — podem correr em paralelo desde o começo; só o passo 6 depende do 5.

Os passos 1, 4 e 5 não dependem de nada e podem ser feitos já.

---

## Diagnóstico

| Sintoma | Causa provável |
| --- | --- |
| Site não abre, sem certificado | Proxy laranja ligado no apex, ou passo 3 não aplicado / sem `reload` |
| `502` / erro ao carregar o site | Passo 2 (mount) pendente: o Caddy não consegue ler `/srv/hassa.dev.br` |
| Página abre mas sem CSS/JS | `out/` sincronizado pela metade — rode o deploy de novo |
| Formulário mostra "escreva para contato@" | `NEXT_PUBLIC_CONTACT_ENDPOINT` faltando no build |
| Formulário dá erro de conexão | Worker não publicado, ou `ALLOWED_ORIGIN` diferente da origem real |
| Envio responde 200 mas o e-mail não chega | DKIM (5.1) pendente, ou o Email Routing (passo 4) não confirmado |
| E-mail chega na caixa de spam | DKIM pendente, ou dois registros de SPF na zona (ver 5.1) |
