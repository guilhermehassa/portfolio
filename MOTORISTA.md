# Motorista — documentação da aplicação

Aplicação pessoal em `/motorista` para registrar jornadas, pagamentos e abastecimentos e planejar uma meta mensal de saldo. Esta documentação inclui a evolução de **06/10/2026**, o fluxo de horários/pausas e os refinamentos de **07/10/2026**, com acesso ao Firebase real restabelecido. O [plano de evolução](PLANO-EVOLUCAO-MOTORISTA.md) contém o acompanhamento; o [plano original](PLANO-MOTORISTA.md) é referência histórica.

Código validado localmente. Novas regras e enriquecimento aditivo do histórico aplicados ao Firebase pelo Chrome real via Playwright MCP. O site não foi publicado nesta execução.

## Acesso e navegação

Em desenvolvimento e produção, login Google restrito ao proprietário, com verificação do UID tanto no cliente quanto nas regras do Firestore. Outra conta não carrega os registros. A configuração web do Firebase é pública; não concede acesso aos documentos. Ambos usam o Firebase real original, sem usuário fictício, seleção de ambiente ou carga de cópia local.

| Seção | Uso |
| --- | --- |
| Início | Ações da jornada, registrar gasto e abastecer; cards Meta pra hoje, Meta da semana, Meta do mês e ganhos da semana com seletor semanal. |
| Ganhos | Registrar dia anterior e editar cada dia em cinco etapas, mantendo o filtro de período. |
| Gastos | Registrar, complementar e excluir gastos, abastecimentos e registros de manutenção por meses. |
| Relatórios | Resumos, Médias, Constatações, Lucratividade, Plataformas, Gastos e Veículo. |
| Definições, no menu da conta | Meta por mês, calendário, base histórica, perfis do veículo, compromissos e categorias. |
| Exportar, no menu da conta | Backup JSON, CSV e importação com prévia. |

Seções são estados internos, sem URL própria. Recarregar retorna ao Início. Ganhos e Gastos têm filtros próprios de dia, semana, mês e intervalo personalizado. Relatórios usa um único filtro de **semana segunda–domingo ou mês**, corrente/passado, comum aos sete grupos. Períodos totalmente futuros ficam bloqueados; tanto a semana quanto o mês correntes terminam hoje para realizado e gráficos. Os limites são inclusivos. Período inválido não produz indicadores.

O Início termina nos quatro cards independentes, nesta ordem: **Meta pra hoje**, **Meta da semana**, **Meta do mês** e **Ganhos da semana**. Meta pra hoje mantém o ganho necessário por dia restante do planejamento do mês atual. Os dois cards de progresso mostram título, Mês/Ano, percentual, barra e ganhos, gastos e saldo realizados até hoje; o percentual mensal mantém o saldo realizado em relação à meta.

A meta semanal considera a semana atual completa de segunda a domingo. Cada mês contribui com sua meta de saldo multiplicada pelos dias planejados na semana e dividida pelos dias planejados totais daquele mês. Ao atravessar meses, as contribuições são somadas e o cabeçalho identifica ambos os Mês/Ano. A herança aplica-se somente ao valor da meta; cada mês usa seu calendário próprio ou a sugestão inicial. Meta ausente ou calendário mensal vazio torna o alvo indisponível; alvo semanal zero não produz divisão. Nenhuma meta semanal é gravada separadamente.

O seletor de **Ganhos da semana** começa na semana atual, permite somente semanas de segunda a domingo e muda apenas o intervalo, as sete barras e o total desse gráfico. Inclui todos os ganhos registrados na semana selecionada, inclusive pendentes e datas futuras, distinguindo ganho zero informado de ausência em tooltip e acessibilidade. Valores positivos ficam nas barras; o gráfico termina nos rótulos dia/data. A seleção não muda as metas do Início. Correções dos dias ficam em Ganhos; análises ficam em Relatórios e definições do planejamento em Definições. Ganhos são informados manualmente; não há integração com os aplicativos.

## Registrar e fechar um dia

No Início, **Iniciar dia** pede odômetro inicial e data/hora, preenchidas com o momento atual e editáveis retroativamente. Há apenas uma jornada aberta por vez, inclusive após recarregar ou entrar por outra sessão. Se a data escolhida já tiver ganhos ou uma jornada, corrija o registro existente.

- Em andamento: **Iniciar pausa** e **Encerrar dia**.
- Em pausa: **Encerrar pausa**; retome antes de encerrar o dia.
- Pausas registram somente início e fim, sem odômetro.
- **Encerrar dia** pede odômetro final, data/hora e os demais valores da jornada. Os KM são a diferença entre os odômetros; o tempo é o intervalo de início a fim menos as pausas. A duração é gravada em minutos e permanece fixa depois do encerramento.
- Todos esses horários são editáveis retroativamente. Depois do encerramento também é possível corrigir início, fim e pausas, recalculando a duração.
- A jornada pode atravessar meia-noite; data e ganhos pertencem ao dia do início. Gastos mantêm as datas reais.
- Corrigir a data de início transfere a jornada e seus ganhos para a nova data, preservando os demais campos, somente se o destino não tiver registro. Os gastos não se movem. Transferência e controle de jornada aberta são transacionais.

### Encerrar dia em etapas

O botão **Encerrar dia** abre um fluxo específico, com quatro etapas:

1. **Encerramento:** definir data e hora do fim, preenchidas com o momento atual e editáveis retroativamente.
2. **Pausas:** conferir as pausas existentes, ajustar horários, adicionar ou remover pausas. Sem pausas registradas, é possível inserir as que faltam ou avançar se não houve pausa. O tempo trabalhado desconta esses intervalos.
3. **Dados finais:** informar odômetro final; conferir KM, períodos escolhidos e observação. O odômetro inicial já registrado aparece como referência.
4. **Ganhos:** conferir os totais Uber, 99 e Outros, com ganhos já lançados preenchidos, e corridas opcionais. O total editado substitui o anterior, sem somar novamente. Ao menos uma origem deve ser informada, inclusive zero.

**Voltar** mantém o preenchimento entre etapas. Somente **Concluir encerramento**, na etapa **Ganhos**, grava os horários, pausas, dados finais e ganhos da jornada em uma única transação, com atualização do marcador de jornada aberta.

Gastos e abastecimentos continuam no cadastro separado, disponível pelo Início e pela seção Gastos. O encerramento não lista, adiciona, edita ou remove custos; os gastos existentes mantêm seus valores, datas e vínculos.

Cancelar, fechar a janela, sair ou recarregar antes da confirmação final descarta os rascunhos, sem salvar qualquer parte desse fluxo; a jornada permanece no estado anterior. Pausas e gastos que já estavam salvos permanecem intactos. Falha ou conflito na confirmação não aplica gravações parciais e mantém o formulário disponível para revisão. Iniciar dia e iniciar/encerrar pausa mantêm o comportamento existente. O encerramento pelo Início continua com as quatro etapas descritas acima.

Revisão de quatro etapas concluída localmente. O contrato existente aceita o encerramento sem novos gastos, sem ajuste de helper ou banco. Nesta rodada, o frontend executou **12 casos focados, todos aprovados**: oito novos sobre avisos/navegação e quatro existentes sobre encerramento sem gastos, horários, rascunho e pendências. Checagem de tipos, lint e análise sintática do CSS aprovados. A suíte consolidada não foi reexecutada nesta rodada.

Verificação anterior do encerramento: **67 testes aprovados** na suíte conjunta, incluindo preservação de ganhos/campos desconhecidos, confirmação atômica, conflito concorrente e rollback por falha de armazenamento. Esse número permanece como resultado histórico. Não houve QA visual, acesso ao Firebase real, alteração do snapshot original, build, Git ou mudança no servidor nesta revisão.

### Registrar dia anterior e editar um dia

Na seção **Ganhos**, o único botão principal é **Registrar dia anterior**. O filtro de período permanece, e cada dia tem somente um botão **Editar**, que reúne a correção da jornada e dos totais por origem; não há botões separados de editar dia e editar ganho.

Cadastro anterior e edição usam o mesmo formulário com cinco etapas:

1. **Início:** data, horário e odômetro inicial. O cadastro começa em ontem e permite escolher outra data passada. Se essa data já possuir um registro, o cadastro é bloqueado com orientação para usar **Editar** na lista, sem carregar ou sobrescrever o dia existente silenciosamente.
2. **Encerramento:** conferir ou informar data e horário final.
3. **Pausas:** conferir, adicionar, corrigir ou remover pausas; os intervalos devem estar em ordem e dentro da jornada.
4. **Dados finais:** odômetro final, KM, duração manual quando não houver horários completos, consumo manual histórico, períodos e observação.
5. **Ganhos:** totais Uber, 99 e Outros e corridas opcionais. Os valores editados substituem os totais anteriores, sem somar novamente.

**Editar** abre os dados existentes preenchidos e editáveis, inclusive início, fim, pausas e odômetros. Horários e odômetros podem permanecer em branco tanto no cadastro anterior quanto nos registros antigos. Não se inventam horários, odômetros ou duração/KM confirmados; os minutos e KM manuais permanecem disponíveis e são preservados sem cronologia completa ou sem os dois odômetros. Dados parciais incoerentes exigem correção, sem preenchimento automático. Com início, fim e pausas válidos, a duração é recalculada em minutos fixos; com os dois odômetros, a diferença substitui os KM manuais.

A confirmação final fecha o dia e exige ao menos uma origem de ganho explicitamente informada, inclusive zero. Esse novo modal de Ganhos/edição não oferece **Salvar pendente** ou **Marcar folga**. Ao editar uma jornada ainda aberta ou pausada, esse fluxo serve para encerrá-la: é preciso informar o fim da jornada e resolver as pausas para uma confirmação válida. Dias pendentes, folgas e legados existentes continuam legíveis; não são convertidos apenas por abrir o formulário.

O layout atual de **Relatórios** é somente leitura. O cadastro manual anterior, a tabela com Abrir dia e os demais recursos não descritos nos sete grupos foram retirados dessa seção; os registros existentes continuam intactos e a correção permanece em Ganhos.

Todos os campos permanecem em rascunho até a confirmação na etapa **Ganhos**. **Voltar** mantém o preenchimento; cancelar, fechar, sair ou recarregar descarta o rascunho sem gravar partes da edição. A confirmação usa uma única transação, confere o estado original para evitar sobrescrever outra sessão e atualiza o marcador de jornada aberta quando necessário. Falha ou conflito não aplica gravações parciais. Corrigir a data inicial transfere a jornada inteira e seus ganhos, recusa destino ocupado e preserva campos históricos/desconhecidos, sem duplicar dias. Gastos e abastecimentos ficam separados, com suas datas, valores e vínculos intactos.

**Período** é opcional e permite marcar Manhã, Tarde, Noite e Madrugada em conjunto, tanto no encerramento quanto na correção. As escolhas permanecem ao voltar entre etapas e não são inferidas dos horários. Registros antigos com um único turno abrem com essa seleção; Misto antigo abre sem opção marcada. O campo histórico `shift` é preservado. `periods` só é alterado quando há escolha explícita; uma lista vazia limpa a seleção e não retorna ao turno antigo. Horas e ganhos continuam totais da jornada.

Registros antigos continuam editáveis. Onde já existia duração, os horários históricos foram preenchidos a partir de 00:00 e dessa duração, sem alterar os minutos originais. Dias sem duração permanecem sem horários; odômetros ausentes não são inventados. O preenchimento manual de horas e minutos continua disponível quando não há horários da jornada.

- Use um único tempo real, incluindo espera e deslocamentos de trabalho e excluindo pausas pessoais. Não some tempos online simultâneos.
- Informe os KM ou os dois odômetros; a diferença substitui os KM diretos. Exclua uso pessoal.
- Se atravessar meia-noite, escolha a data de início. Gastos mantêm suas datas reais.
- Vazio é não informado; zero digitado é confirmado. Para fechar, informe pelo menos uma origem de ganho, inclusive zero.
- A confirmação salva o dia fechado; dados de trabalho opcionais não informados continuam sem cobertura nos indicadores correspondentes.
- Gastos existentes não são regravados nem transferidos junto com a jornada.
- Corrigir data anterior atualiza o mesmo documento, sem duplicar dias. Não há exclusão completa da jornada.

Ganhos rápidos já salvos continuam nos mesmos totais por origem/data, inclusive em registros pendentes. A seção Ganhos agora corrige esses valores pelo único **Editar** do dia, sem cadastro ou edição separada por origem. Não soma dois cadastros da mesma origem: edite o total. Os registros históricos e as contagens continuam preservados até uma alteração explícita.

Formulários guardam o estado inicial; alteração concorrente recusa a gravação para evitar sobrescrever outra sessão.

## Gastos e abastecimentos

Cadastro rápido exige data, categoria e valor positivo; observação opcional até 500 caracteres. Gasto não cria jornada nem confirma folga.

**Abastecer** admite combustível, volume, unidade `L` ou `m3` (m³) e o checkbox **Tanque cheio**. Tanque cheio marcado significa completo (`full`); desmarcado significa parcial (`partial`) nos novos registros ou após escolha explícita. Não há campo de odômetro nem opção de marcar abastecimento anterior ausente nesse formulário. Salve só o valor e complete os detalhes disponíveis depois. Há um único pagamento em `expenses`; detalhes não geram outra dedução.

Ao editar um abastecimento antigo, odômetros já registrados e campos desconhecidos são preservados, inclusive a ausência original de odômetro. Tanque ausente, não informado (`unknown`) ou parcial antigo não é reclassificado apenas por salvar outros campos; o checkbox só altera esse histórico após escolha explícita. O antigo campo `fuel.previousMissing` permanece como metadado legado quando existir, sem efeito nos cálculos e sem ser criado em novos registros. Backups preservam esse metadado com a mesma proteção JSON dos demais campos históricos, sem mudança de versão. Observação continua disponível.

O bloco **Classificação e vínculo com previsão** foi retirado do formulário de abastecimentos e de gastos comuns: não há seleção de atribuição ou de despesa prevista no cadastro/edição. Classificações e vínculos antigos permanecem nos documentos ao editar data, categoria, valor, detalhes ou observação. Novos cadastros não inventam essas informações ocultas. Classificações nas categorias, Definições e Relatórios continuam com o contrato existente; saldo inclui todos os pagamentos e a atribuição à jornada depende dessas classificações. Renomear categoria mantém ID/associações. Não há exclusão de categoria.

Pagamentos já vinculados mantêm a ocorrência prevista paga. Sua edição preserva o vínculo e sua reciprocidade com o compromisso na mesma transação; mudar a data do pagamento não desvincula a ocorrência automaticamente. Conflito ou ocorrência inválida recusa a gravação, sem limpar o vínculo. Exclusão de gasto continua pedindo confirmação e torna a previsão vinculada pendente novamente.

Histórico sem volume/odômetro é incompleto. Novos abastecimentos sem odômetro não permitem compor ciclos de consumo observado; valores históricos conhecidos continuam disponíveis e não são substituídos pelo odômetro da jornada. Não há migração ou remoção desses campos nos dados, backups ou relatórios.

### Manutenção por meses

O botão próprio **Registrar manutenção**, em Gastos, abre o cadastro com custo total positivo, quantidade de parcelas, mês inicial e descrição opcional. O novo registro usa a categoria Manutenção; a edição mantém a categoria anterior. À vista equivale a uma parcela. O formulário começa sem valor informado; nenhum exemplo é cadastrado automaticamente. Não há vencimento em dia específico, controle de pago ou lembretes: o registro representa custos do trabalho atribuídos a meses consecutivos.

O total é dividido em centavos inteiros; eventuais centavos restantes ficam nas primeiras parcelas. Cada parcela usa os dias planejados do seu próprio mês, ordenados; quando nenhum dia estiver planejado, usa todos os dias corridos daquele mês. Na ausência de calendário próprio, vale a sugestão segunda a sexta. A parcela é dividida nas datas com a mesma regra de centavos restantes, mantendo sua soma exata. O reconhecimento avança até hoje; cotas posteriores permanecem previstas. Semana cruzando meses soma as cotas de cada um deles. Fechado o mês, o custo é a parcela inteira.

Manutenção nova representa **100%** de custo profissional, sem aplicar a parcela profissional do perfil. O total do registro não é um gasto diário nem é deduzido junto das cotas. Essas cotas alimentam custos e saldo de dias, semanas e meses, metas, relatórios e estimativas por hora/KM. Não entram na média variável nem criam compromissos, pagamentos ou novas provisões.

A lista mostra o total do registro, a parcela do mês e o custo reconhecido no intervalo filtrado, separando o que ainda é previsto. Editar usa o mesmo ID e conserva campos desconhecidos; excluir usa a confirmação e a transação já existentes para o registro mestre. Gastos comuns antigos não são reinterpretados por nome, categoria ou descrição, e o cadastro próprio não oferece sua conversão automática. Alterar calendário redistribui analiticamente as cotas sem reescrever gastos históricos.

## Definições e planejamento

Selecione o mês da meta para editar histórico ou futuro. Somente o valor positivo da meta é herdado; calendário, base e ajuste diário pertencem ao mês selecionado.

Calendário inicial segunda–sexta é sugestão editável. Hoje participa dos dias restantes se planejado e ainda não fechado/folga. O fluxo do Início registra a abertura; datas antigas ainda podem ser corrigidas pelo formulário do dia.

Previsão variável usa últimos **30 dias elegíveis disponíveis**, configuráveis de 1 a 365. Quantidade/datas são visíveis; valor diário pode ser ajustado. Pagamentos fixos, extraordinários e vinculados ficam separados da base. Custos não classificados permanecem na previsão variável com aviso.

Perfis registram início de vigência, próprio/financiado/alugado, combustível/unidade, consumo/preço de referência e parcela profissional. Estimativas de manutenção por KM, desgaste por KM e custos fixos mensais foram removidas do produto: `maintenanceCentsPerKm`, `wearCentsPerKm` e `fixedMonthlyCents` antigos permanecem somente como metadados JSON inertes, sem ser apagados dos perfis ou backups. Gastos reais classificados como fixos/desgaste continuam gastos normais, sem transformação ou exclusão. Nova vigência preserva antigas; revisão de vigência existente exige confirmação.

Compromissos têm data, categoria, valor, nota, recorrência mensal opcional e data final. Ocorrências são `id--AAAA-MM-DD`; vencimentos 29–31 usam último dia em meses curtos. Ocorrências vencidas não pagas do mês continuam pendentes.

## Resultados e fórmulas

O [modelo detalhado](MODELO-EVOLUCAO-MOTORISTA.md) documenta campos, fórmulas e reversão.

**Saldo dos lançamentos** = todos os ganhos − gastos comuns/abastecimentos nas datas registradas − cotas de manutenção reconhecidas nas datas de alocação. Inclui pessoais, folgas, pendências e dias sem jornada. O total do mestre de manutenção não entra novamente. Não é necessariamente saldo bancário ou data do repasse.

**Lucro nos Relatórios** é o mesmo saldo real dos lançamentos: ganhos − gastos registrados − manutenção proporcional. Combustível entra pelo gasto lançado, sem substituição por consumo estimado, parcela profissional, desgaste ou fixos estimados.

| Indicador | Base |
| --- | --- |
| Dia elegível | Fechado, inclusive zero confirmado; ou legado com evidência positiva de trabalho. Pendência/folga fora das médias. |
| Horas médias por dia | Horas informadas / dias elegíveis, somente com horários completos nessa base. |
| Ganho por dia | Todos os ganhos registrados do período / dias elegíveis. |
| Lucro por dia | Saldo real total do período / dias elegíveis. |
| Gasto por dia corrido | Custos até referência, incluindo cotas reconhecidas / dias observados, sem futuro. |
| Gasto por dia trabalhado | Custos do período, incluindo cotas reconhecidas / dias elegíveis; distribuição inclusive de gastos em folgas. |
| Ganho por hora/KM | Ganhos reais totais / horas ou KM informados dos dias elegíveis, somente com dados completos. |
| Lucro por hora/KM | Saldo real total, inclusive gastos/cotas em folgas e sem jornada / horas ou KM dos dias elegíveis, somente com dados completos. |
| Média por viagem | Totais Uber/99 / viagens dessas origens, exigindo contagens e ganhos informados; Outros não possui viagens modeladas. |

Insuficiência aparece como `—`; faltando horas, KM ou viagens na base do indicador, ele não usa um denominador parcial para inflar a média. Totais conhecidos continuam registrados. Zero confirmado completa o preenchimento, mas divisor total zero não gera divisão. Dias elegíveis seguem fechados, inclusive ganho zero confirmado, ou legados com evidência positiva; pendências e folgas não criam dias trabalhados. Médias por dia usam esse número de dias; gastos sem jornada não criam trabalho.

Os grupos atuais são **Resumos** (ganhos, gastos, saldo, dias, horas, KM e viagens), **Médias** (horas e valores por dia), **Constatações** (valores brutos/lucro por hora, dia e KM e ganho por viagem), **Lucratividade** (ganhos/gastos/saldo, Meta × Atingido e déficit), **Plataformas** (Uber/99), **Gastos** (barras horizontais por categoria) e **Veículo** (KM, consumo manual e manutenções). Não há comparação, rankings, tabela de edição, turno, simulador ou seletor de meta independente. Plataformas usam seus próprios ganhos/viagens e completude; participação divide pelo total de entradas, incluindo Outros.

### Combustível e custos

Consumo observado exige dois tanques completos identificados. Distância entre odômetros / volumes parciais intermediários e do abastecimento final. Dados obrigatórios ausentes, mudança de combustível/unidade, odômetro não crescente e ordem ambígua na mesma data quebram o ciclo. O sinalizador legado de abastecimento anterior ausente não participa dessa avaliação. Medição do veículo inteiro; ciclo futuro não retroage a jornada anterior.

O gráfico e a média de consumo de Relatórios usam **somente o consumo manual do dia**, em km/L. Ausente é lacuna, sem completar com perfil/ciclo e sem ligar pontos por cima da ausência. A média física é `soma(KM) / soma(KM / consumo)`, somente para dias com KM informado positivo e consumo positivo. Exemplo isolado: 10 KM a 10 km/L e 30 KM a 20 km/L resultam em 16 km/L. Dia com consumo sem KM aparece na linha, mas não recebe peso na média; cobertura é informada. Zero confirmado pode aparecer na linha, sem gerar volume infinito ou média artificial.

Nos Relatórios, combustível = valor real registrado; manutenção = cota atribuída à data, com 100% do valor. Custos fixos e desgaste estimados não são calculados. Os campos antigos são preservados somente como metadados inertes.

O helper de estimativa de combustível mantido para compatibilidade/CSV continua separado dos lucros dos Relatórios. Não deduz mais fixos nem desgaste estimados nem substitui pagamentos dessas categorias; despesas normais preservam sua classificação. Isso não altera o histórico nem cria lançamentos. A manutenção inserida pelo usuário é a única manutenção analítica, com suas cotas reais.

### Meta no Início e nas Definições

```text
ganho necessário = máximo(meta − saldo realizado + despesas futuras, 0)
ganho necessário por dia = ganho necessário / dias planejados restantes
saldo projetado = saldo realizado + ganhos futuros estimados − despesas futuras
```

Futuro = variáveis ainda esperadas + compromissos pendentes + pagamentos já cadastrados com data futura + cotas de manutenção posteriores à referência. Vinculados substituem sua previsão; variáveis já lançadas em datas restantes reduzem a estimativa daquela data. Fixos/extraordinários e mestres de manutenção não se repetem na média variável; a manutenção é contabilizada uma única vez por suas cotas.

Projeção usa média histórica × dias restantes, desconta ganhos parciais nessas datas e identifica lançamentos futuros. Mês encerrado mostra realizado; futuro mostra planejamento. Zero dias não divide; meta atingida pode exigir ganho por causa de despesas futuras.

Intervalo entre meses identifica mês próprio da meta. Comparações têm mesma quantidade de dias; mês corrente usa trecho correspondente anterior. Se o mês anterior for curto, janela retrocede para conservar duração; datas são exibidas.

Essa projeção do planejamento permanece separada da análise realizada de Relatórios; ela não garante ganho.

### Meta e déficit nos Relatórios

O alvo acompanha a semana/mês selecionado. Mês usa sua meta de saldo positiva ou herança existente; semana usa a fração dos calendários mensais, combinando meses quando necessário. Falta de meta, calendário semanal vazio ou divisor sem dias tornam o indicador correspondente indisponível.

`falta de saldo = ganho necessário = máximo(meta do período − saldo real até referência, 0)`. Não soma variável futura, compromissos, despesas futuras registradas ou manutenção futura. No período encerrado, é somente o déficit histórico; não inventa dias de trabalho passados. Sem dias restantes, não divide por dia.

A linha **Meta** é reconstruída no início de cada data: calcula saldo realizado até **data − 1**, subtrai-o do alvo do período e divide pelos dias planejados daquele ponto até o fim do período. Não usa ganhos, gastos ou encerramentos dos dias seguintes para antecipar o resultado. Usa metas/calendário atuais, porque não há versionamento de quando foram editados; não é um histórico auditado de configurações passadas. **Atingido** usa ganhos informados em cada data; ausência é lacuna e zero confirmado é zero. Ambos os gráficos terminam hoje.

## Arquitetura e modelo

Next.js/App Router, React, TypeScript e Firebase web. Site estático (`output: "export"`); o navegador acessa Authentication/Firestore reais em desenvolvimento e produção. Getters inicializam os serviços somente no navegador; a persistência delega diretamente ao SDK Firebase, preservando as transações do produto. Sem API própria do Motorista ou participação do Worker de contato.

| Arquivo | Responsabilidade |
| --- | --- |
| `components/motorista/motorista-app.tsx` | Login, seis assinaturas, navegação, transações, filtros e backups. |
| `motorista-forms.tsx` | Campos compartilhados de jornada, pausas, períodos e gasto/abastecimento. |
| `motorista-day-ending.tsx` | Quatro etapas do encerramento no Início e cinco etapas de cadastro/edição em Ganhos, com navegação e rascunho até a confirmação final. |
| `motorista-settings.tsx` | Planejamento, perfis, compromissos e categorias. |
| `motorista-reports.tsx` | Sete grupos de Relatórios, gráficos de linhas/categorias e cobertura, somente semanas/meses correntes ou passados. |
| `lib/motorista.ts` | Tipos, datas, validação v1–v4, lotes e CSV. |
| `lib/motorista-evolution.ts` | Elegibilidade, consumo, estimativas e planejamento. |
| `lib/motorista-weekly-goal.ts` | Rateio da meta semanal por dias planejados de cada mês e realizado até a referência. |
| `lib/motorista-maintenance.ts` | Mestre de manutenção, parcelas exatas, cotas por data/calendário e custos analíticos para metas/relatórios. |
| `lib/motorista-reporting.ts` | Valores reais, completude dos indicadores, Meta histórica diária, consumo manual ponderado e agrupamentos do relatório. |
| `lib/motorista-journey.ts` | Horários, pausas, duração fixa e validação cronológica. |
| `lib/motorista-day-ending.ts` | Validação das etapas e montagem do encerramento preservando a data inicial e campos originais. |
| `lib/motorista-day-editing.ts` | Montagem do cadastro/edição encerrados, preservação de ausências e dados históricos e validação da data de destino. |
| `lib/motorista-journey-persistence.ts` | Transações da jornada, exclusividade, transferência de data e fechamento atômico com proteção contra conflitos. |
| `lib/motorista-persistence.ts` | Exporta as operações do SDK Firestore real. |
| `lib/motorista-firebase.ts` | Configuração web original, proprietário e getters de Authentication/Firestore reais, sem inicialização no SSR. |
| `lib/motorista-browser-cleanup.ts` | Remove somente as duas chaves de armazenamento do ambiente retirado, sem acessar autenticação ou importar dados. |
| `firestore.rules` | Autorização do proprietário e controle transacional da jornada aberta. |
| `tests/motorista.test.mjs` | Exemplos controlados, compatibilidade e importação. |
| `tests/motorista-journey-persistence.test.mjs` | Conflitos, exclusividade, fechamento, transferência e preservação transacionais, com Firestore simulado sem gravações reais. |
| `tests/motorista-day-editing.test.mjs` | Cadastro/edição, dados opcionais, preservação histórica e integração transacional simulada. |

Coleções em `users/{uid}`:

| Coleção | ID e evolução |
| --- | --- |
| `days` | Data; ganhos/jornada, status, filled, origem, períodos opcionais, turno legado, nota, odômetros e `journey` opcional com início/fim/pausas. |
| `expenses` | UUID; pagamento, data/categoria/nota, tipo/escopo, combustível e vínculo opcionais. |
| `categories` | ID preservado; nome, escopo e tipo de custo. |
| `goals` | Mês; meta, calendário, base histórica e ajuste opcional. |
| `plannedExpenses` | UUID; compromisso e mapa de ocorrências pagas. |
| `costProfiles` | UUID; vigência e premissas. |

Centavos/minutos inteiros; KM/volumes decimais; datas civis locais. Consumo antigo em km/L. Sem coleção persistida gains; ganho rápido deriva de days.

`journey` contém `startedAt`, `endedAt` (null enquanto aberta) e `pauses` (`id`, `startedAt`, `endedAt`). Horários têm precisão de minuto e fuso explícito. Situação em andamento/pausa/encerrada deriva desses horários, preservando os status financeiros existentes. O marcador interno `journeyState/current` controla a exclusividade; o backup guarda a jornada, e a importação reconstrói o marcador a partir dos dias, recusando duas jornadas abertas.

Seis onSnapshot carregam todo o histórico. Filtros/cálculos em memória, sem paginação. Tela espera as seis respostas, mostra erro/nova tentativa e gravação em andamento. Escritas transacionais detectam conflitos. Categorias padrão persistidas apenas quando necessárias.

Regras exigem sessão, UID proprietário e caminho correspondente; outros caminhos não liberados. Regras validam autorização e exclusividade da jornada; esquema/valores são validados no cliente. `periods` é opcional e aditivo: jornadas reais antigas continuam legíveis sem migrar turnos ou inventar períodos.

## Migração do histórico real

Backup bruto reaberto antes de qualquer escrita em `backups/motorista/2026-10-05-2330/`: campos/tipos Firestore, metadados e percurso recursivo completo. Pasta privada ignorada pelo Git, fora de public/out.

Inventário, proposta semântica, aplicação, regras originais e relatório final estão ao lado. Preservados **29 documentos**; enriquecidas oito jornadas legadas e oito abastecimentos incompletos, com mesmos IDs. Todos os campos originais relidos e comparados sem divergência. Não inventados volumes/odômetros ou classificação pessoal/profissional.

Originais intactos. Reversão deve conferir precondições e remover apenas enriquecimento aplicado ou restaurar campos originais, preservando edições posteriores; conflito exige reconciliação. Clientes antigos mantêm seus campos e o novo lê documentos legados.

Regras publicadas relidas iguais ao arquivo local. Quarenta simulações de get/list/create/update/delete nas duas novas coleções: proprietário permitido; outra conta/anônimo negados; proprietário negado em caminho de outro usuário.

### Horários históricos — 07/10/2026

Backup bruto anterior à alteração, proposta, aplicação, releitura, regras e relatório final em `backups/motorista/2026-10-07-jornadas/`, diretório privado. O responsável pelo Firebase acrescentou somente `journey` a nove jornadas que já possuíam minutos, com início 00:00, fim após os minutos existentes e nenhuma pausa inicial. A operação foi atômica e usou precondições de versão; não alterou minutos, origem, status, ganhos, odômetros ou campos desconhecidos.

Reconciliação recursiva final confirmou 31 de 31 documentos, nenhum documento adicional e nenhuma diferença nos campos originais ou datas de criação; os nove horários gravados correspondem à proposta. Regras do marcador de exclusividade publicadas e relidas, com 20 simulações de autorização, exclusividade, encerramento e transferência aprovadas. A suíte local conjunta executou 46 testes aprovados; lint e checagem de tipos também passaram. Não houve gravação fictícia de teste no Firebase nem QA adicional da interface, build, Git, deploy ou interferência no servidor de desenvolvimento.

## Backup e CSV

Exportação inclui todo o histórico, independentemente do filtro.

JSON **v4**: exportedAt, days, expenses, categories, goals, plannedExpenses, costProfiles. Inclui horários/pausas quando presentes, calendário, perfis históricos e vínculos. Desconhecidos compatíveis com JSON nos documentos são preservados; cópia bruta Firestore é referência para metadados/tipos externos ao formato da aplicação.

Exportações usam os dados reais. Arquivos antigos identificados com `sourceEnvironment: "local-test"` são recusados na importação para não promover lançamentos temporários à base original. A antiga seleção de ambiente foi removida; backups reais das versões aceitas continuam legíveis.

Versões **1/2/3** aceitas, normalizadas para v4 sem fabricar fechamento. V2 soma gains aos totais conforme contrato anterior.

1. Selecione JSON, confira prévia e escolha preservar existentes (padrão) ou atualizar mesmos IDs.
2. Confirme: preservar ignora existentes; atualizar substitui documento inteiro. Ausentes não são apagados; ganhos não são somados novamente.
3. Importador valida também estado combinado e vínculos.

Limites: 5.000.000 bytes; 10.000 itens; datas/IDs/categorias/vínculos coerentes e inteiros seguros não negativos. Aceita desconhecidos JSON, rejeita chaves perigosas e profundidade excessiva.

Categorias primeiro. Lotes transacionais até **150 documentos**, mantendo compromisso/pagamentos importados juntos. Grupo maior recusado antes de gravar. Arquivo inteiro não atômico: erro posterior preserva lotes confirmados e informa contagem aplicada. Alteração concorrente interrompe o lote; reexporte/confira antes de repetir.

CSV UTF-8/BOM, separador ponto e vírgula, aspas, CRLF. Identifica centavos/corridas/minutos/KM/consumo, situação, combustível/unidade/volume/odômetro e estimativas em colunas próprias. Também inclui início/fim da jornada, pausas em JSON e odômetros inicial/final. Zero confirmado preservado; ausente vazio. Linha estimativa_trabalho não é pagamento. CSV não restaura; use JSON.

Períodos opcionais são preservados no JSON v4; backups antigos continuam aceitos sem conversão dos turnos. CSV acrescenta `periodos`, `periodos_json` e `turno_legado`: distingue seleção vazia explícita (`[]`) de campo ausente e mantém o valor bruto histórico, sem distribuir ganhos ou horas entre escolhas.

Manutenção permanece na coleção `expenses`, com `kind=maintenance`, total em `cents` e `maintenance={startMonth,installments}`. `date` é apenas uma âncora técnica no primeiro dia do mês inicial; não representa vencimento nem pagamento. Não há documentos extras de parcelas, migração de gastos existentes ou mudança de regras/versão do JSON. Backup/importação preservam o mestre e campos legados, inclusive a provisão por KM inerte. Versões anteriores do aplicativo não entendem esse novo tipo; use a versão atual para importar/analisar backups que contenham manutenção.

CSV acrescenta colunas de identificação, total, início, número de parcelas, mês/valor da parcela, modo de alocação e cotas futuras. `manutencao_registro` guarda o total em coluna própria, sem repetir `valor_centavos`; `manutencao_custo` preenche o custo reconhecido nessa coluna; `manutencao_prevista` usa somente a coluna `manutencao_prevista_centavos`. Assim o total do mestre não se soma novamente às cotas e o futuro não aparece como realizado.

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

Desenvolvimento e produção usam o Firebase real `motorista-17946`. Acesse `http://localhost:3000/motorista` e entre com a conta Google proprietária, se necessário. Não existe modo de teste, flag de QA, usuário fictício ou etapa de carga inicial.

No retorno autorizado de **07/10/2026**, recarregar a página remove somente `motorista-local-sandbox-v1` e `motorista-isolated-qa-v4` do armazenamento da origem atual, sem limpar sessão Google, armazenamento de autenticação ou outros dados. O agente não acessou nem confirmou essa limpeza no perfil do usuário; ela é executada pela aplicação ao recarregar. Nenhum lançamento temporário é importado.

Leitura do Firebase em **07/10/2026 às 15:06:46 (São Paulo)** confirmou **31 documentos reais** — nove dias, 18 gastos, duas categorias e duas metas — com campos, IDs, `createTime` e `updateTime` exatamente iguais à reconciliação preservada. Regras publicadas iguais às locais já suportam jornadas/pausas, períodos múltiplos opcionais, encerramento em quatro etapas e transferência de data. Não foi necessária nenhuma escrita, migração ou publicação de regras nesse retorno.

Removidos os módulos/adaptador local, componente de preparação, testes exclusivos dessa infraestrutura, flag/cache QA e os quatro arquivos privados de preparação da cópia. Backups reais em `backups/motorista/2026-10-05-2330/` e `backups/motorista/2026-10-07-jornadas/` preservados: os 20 arquivos mantiveram seus hashes após a limpeza. Os testes funcionais de jornada/períodos continuam no projeto.

Verificações desta retirada: **16 testes transacionais do backend** e **cinco casos focados do frontend** aprovados, em execuções separadas; checagem de tipos, lint e análise de CSS/JSON aprovados. A suíte ampla não foi reexecutada, nem houve teste de gravação em dados reais ou QA de tela.

Build gera out/motorista.html. Sirva out/ por HTTP, com resolução de URLs para HTML, por exemplo npx serve out. npm run start existe, mas usa next start; não é o modelo do export estático.

Workflow publica o site em push para master ou acionamento manual; regras separadamente. Não houve commit, push ou deploy na execução.

## Limitações e verificações

- Sem paginação, importação CSV, exclusão de categoria/dia, várias jornadas por data, integração com aplicativos ou offline garantido.
- Histórico incompleto não mede consumo até complementação. Estimativa depende de classificação/premissas; saldo funciona sem elas.
- Manifesto/ícones permitem adicionar à tela inicial; sem service worker. Login, leitura e escrita precisam de conexão em desenvolvimento e produção.
- Rota fora da navegação pública, noindex/nofollow, bloqueio robots e fora sitemap; isso não substitui autorização.
- Chrome real exercitado em celular/desktop, recarga, vazio, cálculos e regras. Segundo dispositivo físico e instalação móvel não exercitados.
- Backups, inventário privado, screenshots e dados de QA ignorados pelo Git e fora do export estático.
