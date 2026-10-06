# Motorista — documentação da aplicação

Aplicação pessoal em `/motorista` para registrar jornadas, pagamentos e abastecimentos e planejar uma meta mensal de saldo. Esta documentação corresponde à evolução implementada em **06/10/2026**. O [plano de evolução](PLANO-EVOLUCAO-MOTORISTA.md) contém o acompanhamento; o [plano original](PLANO-MOTORISTA.md) é referência histórica.

Código validado localmente. Novas regras e enriquecimento aditivo do histórico aplicados ao Firebase pelo Chrome real via Playwright MCP. O site não foi publicado nesta execução.

## Acesso e navegação

Login Google restrito ao proprietário, com verificação do UID tanto no cliente quanto nas regras do Firestore. Outra conta não carrega os registros. A configuração web do Firebase é pública; não concede acesso aos documentos.

| Seção | Uso |
| --- | --- |
| Início | Registrar; última jornada; planejamento do mês atual. |
| Ganhos | Fechar e corrigir o dia; registrar/editar ganhos rápidos. |
| Gastos | Registrar, complementar e excluir pagamentos e abastecimentos. |
| Relatórios | Resultado e meus dias; rendimento; ganhos; custos e veículo; meta e cenários. |
| Definições, no menu da conta | Meta por mês, calendário, base histórica, perfis do veículo, compromissos e categorias. |
| Exportar, no menu da conta | Backup JSON, CSV e importação com prévia. |

Seções são estados internos, sem URL própria. Recarregar retorna ao Início. Ganhos e Gastos têm filtros próprios; Relatórios usa um filtro comum aos cinco grupos. Dia, semana segunda–domingo, mês e intervalo personalizado incluem início e fim. No mês corrente dos Relatórios, a análise observada termina hoje. Período inválido não produz indicadores.

Início vinculado ao mês atual, sem ratear meta por filtro semanal. Última jornada oferece correção e relatório da data. Ganhos são informados manualmente; não há integração com os aplicativos.

## Registrar e fechar um dia

**Fechar dia** reúne data de início, totais Uber/99/Outros, corridas opcionais, horas inteiras e minutos adicionais, KM do trabalho, odômetros opcionais, consumo manual histórico, turno e observação.

- Use um único tempo real, incluindo espera e deslocamentos de trabalho e excluindo pausas pessoais. Não some tempos online simultâneos.
- Informe os KM ou os dois odômetros; a diferença substitui os KM diretos. Exclua uso pessoal.
- Se atravessar meia-noite, escolha a data de início. Gastos mantêm suas datas reais.
- Vazio é não informado; zero digitado é confirmado. Para fechar, informe pelo menos uma origem de ganho, inclusive zero.
- **Salvar pendente** preserva dados incompletos. **Fechar dia** confirma encerramento. **Marcar folga** exige ausência de ganhos e jornada positivos.
- Gastos existentes da data aparecem como apoio e não são regravados.
- Corrigir data anterior atualiza o mesmo documento, sem duplicar dias. Não há exclusão completa da jornada.

Ganho rápido usa os mesmos totais por origem/data e cria pendência quando não há fechamento. Não soma dois cadastros da mesma origem: edite o total. Mudança de origem/data e exclusão são transacionais; preservam outros ganhos, jornada e campos históricos. Contagens não são transferidas automaticamente.

Formulários guardam o estado inicial; alteração concorrente recusa a gravação para evitar sobrescrever outra sessão.

## Gastos e abastecimentos

Cadastro rápido exige data, categoria e valor positivo; observação opcional até 500 caracteres. Gasto não cria jornada nem confirma folga.

**Abastecer** admite combustível, volume, unidade `L` ou `m3` (m³), odômetro, tanque completo/parcial e registro anterior ausente. Salve só o valor e complete depois. Há um único pagamento em `expenses`; detalhes não geram outra dedução.

Histórico antigo sem volume/odômetro é incompleto. Categorias/gastos admitem escolha explícita operacional, veículo ou pessoal. Saldo inclui todos os pagamentos; atribuição à jornada depende de classificação. Renomear categoria mantém ID/associações. Não há exclusão de categoria.

Gasto pode pagar ocorrência prevista. Gravar/trocar/remover vínculo atualiza pagamento e compromisso na mesma transação. Exclusão pede confirmação e torna a previsão pendente novamente.

## Definições e planejamento

Selecione o mês da meta para editar histórico ou futuro. Somente o valor positivo da meta é herdado; calendário, base e ajuste diário pertencem ao mês selecionado.

Calendário inicial segunda–sexta é sugestão editável. Hoje participa dos dias restantes se planejado e ainda não fechado/folga. Não é necessário abrir o app no início do trabalho.

Previsão variável usa últimos **30 dias elegíveis disponíveis**, configuráveis de 1 a 365. Quantidade/datas são visíveis; valor diário pode ser ajustado. Pagamentos fixos, extraordinários e vinculados ficam separados da base. Custos não classificados permanecem na previsão variável com aviso.

Perfis registram início de vigência, próprio/financiado/alugado, combustível/unidade, consumo/preço de referência, parcela profissional, fixo mensal e provisões por KM opcionais. Informe aluguel, parcela ou custos correspondentes ao regime do veículo, evitando equivalentes duplicados. Nova vigência preserva antigas; revisão de vigência existente exige confirmação.

Compromissos têm data, categoria, valor, nota, recorrência mensal opcional e data final. Ocorrências são `id--AAAA-MM-DD`; vencimentos 29–31 usam último dia em meses curtos. Ocorrências vencidas não pagas do mês continuam pendentes.

## Resultados e fórmulas

O [modelo detalhado](MODELO-EVOLUCAO-MOTORISTA.md) documenta campos, fórmulas e reversão.

**Saldo dos lançamentos** = todos os ganhos − todos os pagamentos nas datas registradas, incluindo pessoais, folgas, pendências e dias sem jornada. Não é necessariamente saldo bancário ou data do repasse.

**Resultado estimado do trabalho** = ganhos − combustível consumido estimado − despesas atribuíveis − custos estimados do veículo. Identificado separadamente, com premissas por data.

| Indicador | Base |
| --- | --- |
| Dia elegível | Fechado, inclusive zero confirmado; ou legado com evidência positiva de trabalho. Pendência/folga fora das médias. |
| Ganho por dia | Ganhos dos dias elegíveis / quantidade desses dias. |
| Gasto por dia corrido | Pagamentos até referência / dias observados, sem futuro. |
| Gasto por dia trabalhado | Todos os pagamentos do período / dias elegíveis; distribuição inclusive de gastos em folgas. |
| Ganho por hora/KM | Soma dos ganhos com divisor positivo informado / soma dos divisores correspondentes. |
| Média por corrida | Ganhos/contagens da mesma origem nos dias elegíveis com ambos informados e contagem positiva. |
| Estimativa por hora/KM | Somente jornadas com estimativa e divisor compatível; cobertura visível. |

Insuficiência aparece como `—`. Zeros legados não fabricam médias por corrida. Turno classifica o dia inteiro, sem distribuir ganhos por hora/aplicativo. Amostras e cobertura são visíveis.

### Combustível e custos

Consumo observado exige dois tanques completos identificados. Distância entre odômetros / volumes parciais intermediários e do abastecimento final. Ausências, mudança de combustível/unidade, odômetro não crescente e ordem ambígua na mesma data quebram o ciclo. Medição do veículo inteiro; ciclo futuro não retroage a jornada anterior.

Consumo manual antigo permanece visível, sem substituição. Para estimativa em litros: manual diário, depois perfil, depois ciclo válido aplicável. Preço vem do perfil ou de abastecimento conhecido até a jornada. Sem perfil/preço/consumo/KM, estimativa indisponível.

Combustível = KM do trabalho / consumo × preço. Fixos = mensal × parcela profissional / dias corridos do mês. Provisões = KM do trabalho × valor por KM; valor por KM já deve corresponder ao trabalho.

Abastecimento pago fica fora dessa dedução. Provisão equivalente de manutenção/desgaste ou fixo configurado substitui seu pagamento, sem soma dupla. Pessoais não são atribuídos; não classificados ficam fora com contagem. Custos do veículo sem provisão equivalente usam parcela profissional. Provisões não afetam saldo/meta.

### Meta

```text
ganho necessário = máximo(meta − saldo realizado + despesas futuras, 0)
ganho necessário por dia = ganho necessário / dias planejados restantes
saldo projetado = saldo realizado + ganhos futuros estimados − despesas futuras
```

Futuro = variáveis ainda esperadas + compromissos pendentes + pagamentos já cadastrados com data futura. Vinculados substituem sua previsão; variáveis já lançadas em datas restantes reduzem a estimativa daquela data. Fixos/extraordinários não se repetem na média variável.

Projeção usa média histórica × dias restantes, desconta ganhos parciais nessas datas e identifica lançamentos futuros. Mês encerrado mostra realizado; futuro mostra planejamento. Zero dias não divide; meta atingida pode exigir ganho por causa de despesas futuras.

Intervalo entre meses identifica mês próprio da meta. Comparações têm mesma quantidade de dias; mês corrente usa trecho correspondente anterior. Se o mês anterior for curto, janela retrocede para conservar duração; datas são exibidas.

Cenários são locais ao relatório e não salvam registros/metas. Projeção não garante ganho.

## Arquitetura e modelo

Next.js/App Router, React, TypeScript e Firebase web. Site estático (`output: "export"`); navegador acessa Authentication/Firestore. Sem API própria do Motorista ou participação do Worker de contato.

| Arquivo | Responsabilidade |
| --- | --- |
| `components/motorista/motorista-app.tsx` | Login, seis assinaturas, navegação, transações, filtros e backups. |
| `motorista-forms.tsx` | Fechamento e gasto/abastecimento. |
| `motorista-settings.tsx` | Planejamento, perfis, compromissos e categorias. |
| `motorista-reports.tsx` | Cinco grupos, gráficos/tabelas, cobertura e cenários. |
| `lib/motorista.ts` | Tipos, datas, validação v1–v4, lotes e CSV. |
| `lib/motorista-evolution.ts` | Elegibilidade, consumo, estimativas e planejamento. |
| `lib/motorista-persistence.ts` | Firestore e modo isolado de QA. |
| `lib/motorista-firebase.ts` | Configuração web e proprietário. |
| `firestore.rules` | Autorização das seis coleções. |
| `tests/motorista.test.mjs` | Exemplos controlados, compatibilidade e importação. |

Coleções em `users/{uid}`:

| Coleção | ID e evolução |
| --- | --- |
| `days` | Data; ganhos/jornada, status, filled, origem, turno, nota e odômetros. |
| `expenses` | UUID; pagamento, data/categoria/nota, tipo/escopo, combustível e vínculo opcionais. |
| `categories` | ID preservado; nome, escopo e tipo de custo. |
| `goals` | Mês; meta, calendário, base histórica e ajuste opcional. |
| `plannedExpenses` | UUID; compromisso e mapa de ocorrências pagas. |
| `costProfiles` | UUID; vigência e premissas. |

Centavos/minutos inteiros; KM/volumes decimais; datas civis locais. Consumo antigo em km/L. Sem coleção persistida gains; ganho rápido deriva de days.

Seis onSnapshot carregam todo o histórico. Filtros/cálculos em memória, sem paginação. Tela espera as seis respostas, mostra erro/nova tentativa e gravação em andamento. Escritas transacionais detectam conflitos. Categorias padrão persistidas apenas quando necessárias.

Regras exigem sessão, UID proprietário e caminho correspondente; outros caminhos não liberados. Regras validam autorização; esquema/valores são validados no cliente.

## Migração do histórico real

Backup bruto reaberto antes de qualquer escrita em `backups/motorista/2026-10-05-2330/`: campos/tipos Firestore, metadados e percurso recursivo completo. Pasta privada ignorada pelo Git, fora de public/out.

Inventário, proposta semântica, aplicação, regras originais e relatório final estão ao lado. Preservados **29 documentos**; enriquecidas oito jornadas legadas e oito abastecimentos incompletos, com mesmos IDs. Todos os campos originais relidos e comparados sem divergência. Não inventados volumes/odômetros ou classificação pessoal/profissional.

Originais intactos. Reversão deve conferir precondições e remover apenas enriquecimento aplicado ou restaurar campos originais, preservando edições posteriores; conflito exige reconciliação. Clientes antigos mantêm seus campos e o novo lê documentos legados.

Regras publicadas relidas iguais ao arquivo local. Quarenta simulações de get/list/create/update/delete nas duas novas coleções: proprietário permitido; outra conta/anônimo negados; proprietário negado em caminho de outro usuário.

## Backup e CSV

Exportação inclui todo o histórico, independentemente do filtro.

JSON **v4**: exportedAt, days, expenses, categories, goals, plannedExpenses, costProfiles. Inclui calendário, perfis históricos e vínculos. Desconhecidos compatíveis com JSON nos documentos são preservados; cópia bruta Firestore é referência para metadados/tipos externos ao formato da aplicação.

Versões **1/2/3** aceitas, normalizadas para v4 sem fabricar fechamento. V2 soma gains aos totais conforme contrato anterior.

1. Selecione JSON, confira prévia e escolha preservar existentes (padrão) ou atualizar mesmos IDs.
2. Confirme: preservar ignora existentes; atualizar substitui documento inteiro. Ausentes não são apagados; ganhos não são somados novamente.
3. Importador valida também estado combinado e vínculos.

Limites: 5.000.000 bytes; 10.000 itens; datas/IDs/categorias/vínculos coerentes e inteiros seguros não negativos. Aceita desconhecidos JSON, rejeita chaves perigosas e profundidade excessiva.

Categorias primeiro. Lotes transacionais até **150 documentos**, mantendo compromisso/pagamentos importados juntos. Grupo maior recusado antes de gravar. Arquivo inteiro não atômico: erro posterior preserva lotes confirmados e informa contagem aplicada. Alteração concorrente interrompe o lote; reexporte/confira antes de repetir.

CSV UTF-8/BOM, separador ponto e vírgula, aspas, CRLF. Identifica centavos/corridas/minutos/KM/consumo, situação, combustível/unidade/volume/odômetro e estimativas em colunas próprias. Zero confirmado preservado; ausente vazio. Linha estimativa_trabalho não é pagamento. CSV não restaura; use JSON.

QA exportou conteúdo gerado pelo botão e recuperou 16 documentos fictícios nas seis coleções, sem diferença de campos; segunda prévia propôs zero gravações. Evento de download do Chrome não fornecido pela sessão MCP; bytes do Blob e restauração conferidos diretamente. Importações de teste não alteraram conta real.

## Executar e validar

```powershell
npm ci
npm run dev
# http://localhost:3000/motorista
npm run test:motorista
npm run lint
npx tsc --noEmit
npm run build
```

**Desenvolvimento normal usa Firebase real.** Para testar gravações isoladas:

```powershell
$env:NEXT_PUBLIC_MOTORISTA_TEST_MODE = "true"
npm run dev -- --port 3001
```

Modo exige NODE_ENV=development e variável explícita. Dados fictícios em `localStorage["motorista-isolated-qa-v4"]`, aviso permanente, sem login/Firestore nesse servidor. Cache `.next-motorista-qa/` separado. Build de produção não habilita esse acesso. Remova a variável na sessão ao voltar ao ambiente normal.

Build gera out/motorista.html. Sirva out/ por HTTP, com resolução de URLs para HTML, por exemplo npx serve out. npm run start existe, mas usa next start; não é o modelo do export estático.

Workflow publica o site em push para master ou acionamento manual; regras separadamente. Não houve commit, push ou deploy na execução.

## Limitações e verificações

- Sem paginação, importação CSV, exclusão de categoria/dia, várias jornadas por data, integração com aplicativos ou offline garantido.
- Histórico incompleto não mede consumo até complementação. Estimativa depende de classificação/premissas; saldo funciona sem elas.
- Manifesto/ícones permitem adicionar à tela inicial; sem service worker. Login/leitura/escrita precisam de conexão.
- Rota fora da navegação pública, noindex/nofollow, bloqueio robots e fora sitemap; isso não substitui autorização.
- Chrome real exercitado em celular/desktop, recarga, vazio, cálculos e regras. Segundo dispositivo físico e instalação móvel não exercitados.
- Backups, inventário privado, screenshots e dados de QA ignorados pelo Git e fora do export estático.
