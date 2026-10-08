# Plano de trabalho — evolução da aplicação Motorista

## Objetivo e escopo

Reorganizar a aplicação para os três momentos reais de uso do proprietário:

1. Durante o trabalho, registrar rapidamente um gasto ou abastecimento.
2. No fim do dia, registrar os ganhos e os dados da jornada em um único fluxo.
3. Em uma sessão de análise, avaliar os dias, os custos e o planejamento da meta.

O Início deve facilitar os registros e orientar o planejamento do mês. Relatórios deve concentrar a análise detalhada. A meta continua sendo de **saldo**, e a aplicação deve estimar quanto será necessário **ganhar** para alcançá-la depois das despesas previstas.

Execução concluída em **06/10/2026**, após inspeção do código, backup integral, migração aditiva reconciliada e validações. O código permanece local, sem commit, push ou publicação do site. As regras e o enriquecimento autorizado do histórico foram aplicados no Firebase.

## Fluxo de jornada — 07/10/2026

| Trabalho | Situação |
| --- | --- |
| Início com iniciar dia, iniciar pausa, encerrar pausa e encerrar dia conforme estado | Concluído localmente |
| Data/hora atual editável, correções retroativas e duração fixa descontando pausas | Concluído localmente |
| Correção da data inicial transferindo jornada/ganhos e preservando datas dos gastos | Concluído localmente |
| Compatibilidade de backup/CSV, importação e preservação de campos históricos | Concluído localmente |
| Firebase: regras, exclusividade transacional e enriquecimento aditivo dos horários antigos | Concluído e reconciliado |

Decisões confirmadas pelo usuário: apenas uma jornada aberta; ganho rápido sugere a data inicial da jornada aberta; início bloqueado em data com ganhos sem início; pausas possuem somente horários; KM derivam dos odômetros inicial/final; correção da data inicial exige destino sem registro. Horários antigos com duração usam 00:00 + minutos preservados, sem novo identificador de estimativa; sem duração/odômetro não se inventam esses dados.

Verificação local: **46 testes** na execução conjunta dos cálculos/compatibilidade e persistência isolada, lint e checagem de tipos aprovados. Não houve build, QA adicional da interface do Motorista, mudança no servidor de desenvolvimento, Git ou publicação do site.

Firebase concluído pelo responsável pelo backend: regras publicadas e relidas iguais ao conteúdo local, com acesso restrito ao proprietário e **20 simulações** de autorização/exclusividade/fechamento/transferência aprovadas. Foram adicionados horários a **9 jornadas** em operação atômica, com máscara somente no campo `journey` e precondições de versão. Reconciliação recursiva final: **31 de 31 documentos preservados**, zero diferenças nos campos originais e datas de criação, zero divergências nos horários propostos e zero documentos adicionais. Nenhum dado real foi usado para gravação fictícia de teste.

Backup original, proposta, aplicação, releitura e regras estão em `backups/motorista/2026-10-07-jornadas/`; o registro final é `relatorio-final.md`, no mesmo diretório privado. Fluxo concluído, sem pendência documental ou de Firebase.

## Retorno ao Firebase real — 07/10/2026

| Trabalho | Situação |
| --- | --- |
| Getters e persistência usam Authentication/Firestore reais em desenvolvimento e produção | Concluído |
| Remoção do adaptador local, usuário fictício, componente de carga, flags/cache QA e testes exclusivos | Concluída |
| Remoção dos quatro arquivos privados da preparação de teste, preservando backups reais | Concluída; 20 arquivos reais com hashes intactos |
| Preservação das funcionalidades e testes do produto, sem importar lançamentos temporários | Concluída |
| Leitura de dados reais e regras vigentes, sem escritas remotas | Concluída; 31 documentos exatamente preservados |
| Limpeza somente das duas chaves antigas no navegador | Implementada; executa na recarga do usuário |
| Documentação de acesso real e retirada das instruções do ambiente temporário | Concluída |

Decisão explícita do usuário após concluir os ajustes: voltar a atuar diretamente no Firebase e excluir o ambiente de teste. `/motorista` agora usa o projeto original `motorista-17946` em desenvolvimento e produção, com login Google do proprietário. Nenhum lançamento temporário é promovido. Horários/pausas, períodos múltiplos, fechamento em quatro etapas, correções e transferência permanecem com os contratos aditivos existentes.

Leitura remota em **07/10/2026 às 15:06:46 (São Paulo)** confirmou **31 documentos** — nove dias, 18 gastos, duas categorias e duas metas — com todos os campos, IDs, datas de criação e atualização exatamente iguais à reconciliação real preservada. Regras publicadas iguais às locais; nenhuma migração, escrita de dados ou publicação de regras necessária. Os backups reais de `2026-10-05-2330` e `2026-10-07-jornadas` foram preservados, com seus 20 arquivos conferidos por hash após excluir a preparação temporária.

Verificação desta retirada, em execuções separadas: **16 testes transacionais do backend** e **cinco casos focados do frontend** aprovados. Checagem de tipos, lint e análise de CSS/JSON aprovados. A suíte ampla não foi reexecutada. Nenhum teste criou/alterou registros reais; não houve QA de tela, build, comando de restart, Git ou publicação do site. A remoção da configuração QA pode produzir recarregamento automático normal do Next, autorizado no escopo de retirada.

Acesso atual: recarregar `http://localhost:3000/motorista` e entrar com a conta Google autorizada, se necessário. A rotina remove somente as duas chaves antigas de teste da origem atual, sem importar seu conteúdo ou limpar autenticação. Não houve acesso nem verificação dessa limpeza no perfil do usuário pelo agente. Backups antigos marcados como teste continuam recusados na importação real.

## Encerramento em quatro etapas — 07/10/2026

| Trabalho | Situação |
| --- | --- |
| Data/hora final com valor atual e edição retroativa | Implementado localmente |
| Revisão, inclusão e remoção de pausas com validação cronológica | Implementado localmente |
| Dados finais, odômetro final e cálculo dos KM | Implementado localmente |
| Totais de ganhos preenchidos, sem soma duplicada | Implementado localmente |
| Gastos e abastecimentos mantidos no cadastro separado, sem etapa Custos no encerramento | Concluído localmente |
| Navegação preserva rascunho; cancelar antes de concluir não grava | Implementado localmente |
| Confirmação da jornada e ganhos ao concluir Ganhos, sem novos campos/coleções | Concluído localmente; contrato preservado |
| Verificação técnica da revisão de quatro etapas e documentação final | Concluídas; 12 casos focados aprovados |

Decisão atual do usuário: remover a etapa **Custos**. O fluxo tem **Encerramento → Pausas → Dados finais → Ganhos**; a terceira etapa mantém o odômetro final, e **Ganhos** passa a ser a última. **Tudo é salvo somente ao concluir Ganhos**. Cancelar, fechar ou sair antes dessa confirmação mantém horários, pausas, ganhos e odômetros no estado anterior. O encerramento não lista nem registra custos; gastos e abastecimentos continuam separados e os registros existentes permanecem intactos.

Iniciar dia, iniciar/encerrar pausa e o editor histórico de correção mantêm o comportamento existente. A confirmação usa a transação atual para jornada, ganhos e marcador de jornada aberta, sem novos gastos. O contrato já aceita essa lista vazia; não foi necessário alterar helper, modelo ou banco. Nenhuma migração ou mudança remota faz parte desse ajuste de UX; o snapshot bruto de origem permanece intacto.

Verificação desta revisão concluída pelo frontend: **12 casos focados aprovados**, em duas execuções — oito novos de avisos/navegação e quatro existentes relevantes ao encerramento. Checagem de tipos, lint e análise sintática do CSS aprovados. A suíte consolidada não foi reexecutada nesta rodada. O suporte transacional ao encerramento sem gastos foi mantido, sem alteração do helper ou banco.

Execução anterior do encerramento: **67 testes, 67 aprovados, zero falhas ou testes ignorados**; lint e checagem de tipos aprovados naquela entrega. Essa contagem é histórica e distinta dos 12 casos focados desta revisão. Não houve QA visual adicional, acesso ao Firebase real, alteração do snapshot bruto, build, Git ou interferência no servidor de desenvolvimento nesta revisão.

## Contexto obrigatório para quem executar

- Ler integralmente `MOTORISTA.md` e este plano. Usar `PLANO-MOTORISTA.md` como referência histórica, considerando as diferenças documentadas.
- Na execução, inspecionar o código para confirmar o estado real antes de alterar. Não assumir que propostas deste arquivo já existem.
- A aplicação já possui aproximadamente uma semana de dados reais. O usuário aceita mudanças na estrutura, desde que nenhum dado seja perdido.
- Após a conclusão dos refinamentos em 07/10/2026, desenvolvimento e produção usam diretamente o Firebase real original. O ambiente temporário foi retirado, sem importar seus lançamentos; preservar dados e backups reais continua obrigatório.
- A persistência é Cloud Firestore: neste plano, ajuste de DB significa ajuste de documentos, coleções e regras, não migração de tabelas SQL.
- Usar Git exclusivamente pelo terminal com `git`. Não fazer commit, push ou publicação do site como consequência automática da execução deste plano.
- Preservar o acesso restrito ao proprietário e o comportamento de autenticação.
- Para os ajustes no Firebase, usar o Chrome real autenticado via Playwright MCP e seguir as regras do projeto e do ambiente. A execução foi solicitada pelo proprietário; os ajustes autorizados no Firebase foram realizados com backup e reconciliação.

## Decisões de produto

### Dois resultados diferentes

**Saldo dos lançamentos:** ganhos registrados menos despesas registradas nas respectivas datas. Não representa necessariamente o saldo bancário ou a data do repasse dos aplicativos. É a base da meta mensal.

**Resultado estimado do trabalho:** ganhos menos combustível estimado como consumido, despesas atribuíveis à jornada e custos estimados do veículo. Serve para comparar a rentabilidade das jornadas. Deve mostrar as premissas e ser identificado como estimativa.

Não misturar as duas bases. Não descontar, no mesmo resultado, abastecimento pago e combustível consumido estimado. Não descontar manutenção efetiva e provisão equivalente duas vezes.

### Registro diário como unidade principal

- Manter um fechamento por data, com ganhos por aplicativo, tempo e quilômetros do trabalho.
- Registrar tempo real da jornada, incluindo espera e deslocamentos de trabalho e excluindo pausas pessoais. Não somar tempos online simultâneos de Uber e 99.
- Quilômetros devem incluir deslocamentos do trabalho sem passageiro. Não considerar quilômetros pessoais como trabalho.
- Quantidade de corridas, turno e observação são opcionais.
- Não exigir cadastro de cada corrida nem conexão com Uber ou 99.
- Na primeira entrega, turno é uma classificação do dia: manhã, tarde, noite, madrugada ou misto. Não apresentar um mapa por hora nem atribuir ganhos a partes de uma jornada com base apenas nessa classificação.
- Divisão em várias jornadas por dia fica para uma evolução posterior, caso o uso demonstre necessidade. Comparações precisas entre turnos exigirão ganhos, horas e quilômetros de cada jornada.

### Ausência de dados não é zero

- Diferenciar informação não preenchida de zero informado.
- Um gasto lançado durante o trabalho não encerra o dia e não cria uma jornada com ganho zero para as médias.
- Ausência de registro não significa folga.
- Histórico importado sem indicação de fechamento não deve ser rotulado automaticamente como conferido pelo usuário.

## Etapas e acompanhamento

Atualizar esta tabela ao executar. Só marcar uma etapa como concluída quando seus critérios de aceite forem atendidos.

| Etapa | Trabalho | Dependências | Situação |
| --- | --- | --- | --- |
| 1 | Inventário e backup dos dados atuais | Nenhuma | Concluída |
| 2 | Definir e documentar o modelo de dados e os cálculos | 1 | Concluída |
| 3 | Ajustar Firebase e realocar o histórico preservado | 2 | Concluída |
| 4 | Ajustar Definições e planejamento mensal | 3 | Concluída |
| 5 | Unificar cadastro e fechamento do dia | 3 | Concluída |
| 6 | Ajustar Gastos e cadastro de abastecimento | 3 | Concluída |
| 7 | Reorganizar Início | 4, 5, 6 | Concluída |
| 8 | Implementar Relatórios | 4, 5, 6 | Concluída |
| 9 | Atualizar backup, importação e exportação | 2, 3 | Concluída |
| 10 | Validar dados, cálculos, interface e documentação | 4 a 9 | Concluída |

## Registro da execução — 06/10/2026

- Etapas 1–3: backup bruto anterior às escritas, inventário e interpretação semântica; 29 documentos preservados, 16 enriquecidos nos mesmos IDs, zero divergências nos campos originais. Regras publicadas e 40 testes de autorização aprovados.
- Etapas 4–8: calendário/meta por mês, perfis com vigência, compromissos vinculados, fechamento unificado, abastecimento opcional, Início em três grupos e Relatórios em cinco grupos com filtros, cobertura e cenários.
- Etapa 9: JSON v4 compatível com v1/v2/v3, desconhecidos JSON preservados, vínculos consistentes por ocorrência, importação transacional em lotes e CSV com unidades/estimativas. Restauração isolada de 16 documentos sem diferenças; segunda prévia com zero itens novos.
- Etapa 10: Chrome real no celular e desktop; export estático leu a conta real, sem escrita de teste. **27 testes**, lint, checagem de tipos, build e verificação de exclusão de dados privados aprovados.
- Documentação final: [MOTORISTA.md](MOTORISTA.md) e [modelo e cálculos](MODELO-EVOLUCAO-MOTORISTA.md).
- Evidências privadas: `backups/motorista/2026-10-05-2330/`, incluindo original, inventário, proposta, aplicação, reconciliação e `relatorio-final.md`. Screenshots e dados fictícios em `output/playwright/`. Pastas ignoradas pelo Git e fora do export.
- Limites registrados: segundo dispositivo físico e instalação PWA não exercitados. A sessão MCP não forneceu o evento de download do Chrome; bytes gerados pelo botão e restauração foram conferidos. Abastecimentos antigos continuam incompletos onde faltavam evidências, e classificação pessoal/profissional permanece explícita.

## Etapa 1 — inventário e backup local

Antes de qualquer escrita no Firebase:

1. Identificar o projeto, o UID proprietário e todas as coleções/documentos existentes.
2. Confirmar quais documentos correspondem à semana já registrada.
3. Exportar **todo o histórico**, incluindo dias, gastos, categorias e metas, para um arquivo JSON local. Incluir novas coleções existentes que a documentação eventualmente não mencione.
4. Conferir que o exportador atual preserva todos os campos existentes. Se ele selecionar somente campos conhecidos, obter também uma cópia integral dos documentos antes de modificar a estrutura.
5. Salvar os arquivos em uma pasta local de backup, fora de diretórios públicos e de arquivos publicados pelo site. Exemplo: `backups/motorista/AAAA-MM-DD-HHMM/`.
6. Garantir que dados privados, UID, observações e relatórios de migração não entrem em commits ou no export estático. Ajustar as exclusões necessárias na execução.
7. Reabrir e validar o JSON. Registrar em Markdown um inventário com contagens, datas, IDs, totais por origem de ganho, totais de gastos por categoria e metas existentes.
8. Guardar a cópia original sem modificá-la. Arquivos transformados devem ter outro nome.

Evitar novos lançamentos enquanto o histórico estiver sendo transformado. Caso apareçam alterações depois do backup, incorporar essas diferenças antes da reconciliação final.

**Aceite:** arquivo original legível e completo; inventário reconciliado; nenhum ajuste no DB executado antes dessa verificação.

## Etapa 2 — modelo de dados e regras de cálculo

### Estrutura proposta

Preferir evolução aditiva dos documentos atuais. Preservar IDs e campos existentes sempre que possível. Confirmar nomes finais e compatibilidade depois da inspeção do código.

| Local | Ajuste proposto |
| --- | --- |
| `days`, com ID por data | Manter ganhos e jornada existentes. Acrescentar situação do dia, turno opcional, observação opcional, informações de preenchimento e odômetro inicial/final opcionais. |
| `expenses` | Manter ID, data, categoria, centavos e observação. Acrescentar tipo do registro e detalhes opcionais de abastecimento. O valor monetário da despesa continua sendo a fonte única do valor pago. |
| `categories` | Preservar IDs e associações. Permitir distinguir despesas operacionais, custos do veículo e gastos pessoais, com classificação explícita. Não reclassificar ambiguidades silenciosamente. |
| `goals`, com ID por mês | Preservar meta e histórico. Acrescentar o planejamento de datas de trabalho daquele mês; permitir consultar e editar meses específicos. |
| Nova coleção `plannedExpenses` | Despesas futuras conhecidas, com data prevista, valor, categoria e vínculo opcional com a despesa efetivamente registrada. |
| Nova coleção `costProfiles` | Premissas de custo com início de vigência: consumo estimado, custos fixos atribuídos ao trabalho e provisões por quilômetro opcionais. Preservar premissas históricas. |

As situações do dia devem distinguir pendente, fechado e folga. Para dados antigos, manter uma indicação de origem legada e de informações não confirmadas. Não usar documento vazio como prova de trabalho ou folga.

Os detalhes de abastecimento devem admitir combustível, volume, unidade, odômetro, tanque completo/parcial e indicação de abastecimento anterior ausente. Litros e m³ precisam permanecer identificados. O preço por unidade é derivado do valor e do volume.

Preservar o consumo diário antigo como informação manual histórica. Não substituí-lo por um consumo calculado sem evidência. Contagens antigas zeradas sem evidência de preenchimento não devem produzir falsas médias por corrida.

### Cálculos obrigatórios

- Ganhos e gastos em centavos inteiros; datas civis locais; semana de segunda-feira a domingo.
- Saldo do período = ganhos registrados menos despesas registradas.
- Ganho médio por dia trabalhado = ganhos dos dias elegíveis divididos pelo número desses dias. Mostrar o número de dias e a base utilizada.
- Gasto médio por dia corrido = gastos do período dividido pelos dias corridos do período. Não incluir dias futuros numa média observada do mês em andamento.
- Gasto médio por dia trabalhado = todos os gastos do período divididos pelos dias trabalhados elegíveis, incluindo despesas ocorridas nas folgas. Identificar que é uma distribuição do gasto, não o gasto efetivo de cada jornada.
- Indicadores por hora e quilômetro usam soma dos valores dividida pela soma dos divisores, não média simples dos índices diários.
- Quando houver jornada sem horas ou quilômetros informados, usar somente os registros com dados compatíveis no numerador e no denominador do respectivo índice. Exibir a cobertura, como “6 de 7 dias com horas informadas”.
- Nenhum divisor zero deve produzir número inválido. Informação ausente deve aparecer como indisponível.
- Dados pendentes ficam fora das médias de jornadas encerradas, mas despesas já registradas continuam no saldo financeiro.
- Histórico legado pode participar das análises quando houver dados suficientes, com indicação de cobertura e necessidade de conferência. Não fingir que foi fechado explicitamente.
- Comparações por dia da semana devem mostrar quantidade de observações. Amostras pequenas não devem gerar afirmações definitivas de melhor dia.
- Receita por aplicativo é possível com totais diários. Resultado líquido ou ganho por hora por aplicativo só pode aparecer se houver dados suficientes para atribuir tempo e custos a cada origem.

### Estimativa de custo da jornada

- Estimar combustível a partir de quilômetros do trabalho, consumo aplicável e preço por unidade. Mostrar a origem do consumo: manual ou histórico de abastecimentos válidos.
- Calcular consumo observado somente quando a sequência de abastecimentos permitir. Tratar abastecimentos parciais, registros ausentes e troca de combustível sem inventar precisão.
- Não obter consumo pela simples divisão dos quilômetros de hoje pelos litros comprados hoje.
- Custos fixos, manutenção e desgaste precisam ter regras explícitas de atribuição. Carro próprio, financiado e alugado possuem premissas diferentes.
- No resultado estimado, substituir gastos eventuais pelas estimativas equivalentes quando esse for o método escolhido; não acumular as duas deduções.
- Depreciação e provisões não são pagamentos. Manter sua apresentação separada do saldo dos lançamentos e da meta de saldo.
- Se o carro também tiver uso pessoal, permitir definir a parcela atribuída ao trabalho. Não imputar automaticamente todo custo do veículo à atividade.

### Planejamento da meta

```text
ganho necessário restante = máximo(meta mensal − saldo acumulado + despesas futuras previstas, 0)
ganho necessário por dia = ganho necessário restante ÷ dias planejados restantes
saldo projetado no fim do mês = saldo acumulado + ganhos futuros estimados − despesas futuras previstas
```

- Considerar saldo realizado do mês até a data de referência, sem confundir lançamentos futuros com realizados.
- Despesas futuras previstas = variáveis estimadas + compromissos recorrentes pendentes + despesas extraordinárias conhecidas.
- Não incluir despesas fixas já representadas separadamente na média de variáveis; evitar duplicidade.
- Vincular despesa prevista ao pagamento registrado. Ao efetivar o gasto, retirar sua previsão pendente sem duplicar o lançamento.
- Para recorrências, identificar cada ocorrência mensal/data de forma única.
- Usar uma base histórica visível e configurável para a estimativa de variáveis, inicialmente os últimos 30 dias encerrados disponíveis. Com pouco histórico, mostrar a quantidade de dias usada e permitir ajustar a estimativa.
- Não excluir despesas extraordinárias do histórico silenciosamente. Elas continuam nos resultados; a previsão pode tratá-las separadamente, explicando o critério.
- Permitir planejar as datas restantes de trabalho. Cinco dias por semana é apenas um preenchimento inicial ajustável.
- Incluir hoje nos dias restantes somente quando estiver planejado e não encerrado. Não exigir abertura do app no início da jornada.
- Se houver registros parciais de hoje, considerar o que já foi lançado e somente o custo futuro ainda esperado. Evitar projetar novamente um gasto pago.
- Com zero dias restantes, mostrar resultado final ou valor que falta, sem divisão por zero.
- Atingir a meta no momento não zera necessariamente a necessidade de ganhos: despesas previstas ainda podem reduzir o saldo até o fechamento.
- Para mês encerrado, mostrar resultado histórico. Para mês futuro, apresentar planejamento. Não calcular necessidade atual sobre intervalo que atravesse vários meses.

**Aceite:** modelo e fórmulas documentados, com compatibilidade e tratamento do histórico definidos antes de mudar dados reais.

## Etapa 3 — Firebase e realocação assistida por IA

### Sequência obrigatória para reestruturação dos abastecimentos

O usuário solicitou expressamente este fluxo se a estrutura de registro de combustível mudar:

**Salvar os dados atuais em arquivo local JSON ou Markdown → fazer os ajustes necessários no Firebase via Playwright → usar IA para realocar semanticamente os dados preservados.**

Usar JSON como cópia completa e Markdown como inventário e relatório. A realocação deve interpretar o histórico, não apenas copiar e colar os documentos antigos em uma estrutura nova.

1. Confirmar o backup e inventário da etapa 1.
2. Preparar um plano de migração, a estrutura de destino e a reversão. Preservar os registros antigos durante a preparação sempre que possível.
3. Pelo Chrome real via Playwright MCP, conferir projeto e UID e realizar os ajustes de estrutura e regras necessários no Firebase. A evolução deve manter os dados antigos legíveis enquanto o cliente é adaptado.
4. Com IA, analisar cada registro preservado usando categoria, data, valor, observação e demais evidências. Gerar **um novo arquivo local** com os registros propostos para o modelo de destino.
5. Manter um mapeamento de ID original para ID de destino e registrar a justificativa das transformações, com campos inferidos e pendências separados.
6. Preservar valores monetários, datas, categorias e observações originais. Um abastecimento antigo sem volume ou odômetro passa a ser abastecimento histórico incompleto; não fabricar esses números.
7. Extrair dados de observações somente quando houver evidência explícita e unidade inequívoca. Preservar também o texto original. Dúvidas permanecem como pendências para conferência.
8. Validar o arquivo transformado e revisar as ambiguidades antes de gravar. A IA auxilia a interpretação; cálculos determinísticos fazem a reconciliação.
9. Aplicar a realocação no Firebase por Playwright, em pequenos grupos conferíveis. Se precisar de uma ferramenta auxiliar para transformação local, ela trabalha sobre cópias e não substitui o fluxo solicitado de alteração no Firebase.
10. Reler os dados gravados e comparar com o inventário original. Reexecutar a migração não pode criar duplicatas: preservar IDs ou usar mapeamento estável.
11. Não remover estruturas antigas até concluir a reconciliação e validar a leitura pela aplicação. Guardar os backups originais após a conclusão.

Aplicar a mesma proteção a qualquer outra transformação estrutural necessária. Se a inspeção demonstrar que somente enriquecimento aditivo é suficiente, evitar mover documentos sem necessidade, mas documentar a transformação dos gastos de combustível.

### Conferências obrigatórias

- Todos os registros de origem têm destino ou estão preservados integralmente com uma pendência explícita.
- Ganhos totais por data e por origem permanecem iguais.
- Gastos totais por data e por categoria permanecem iguais.
- IDs, notas, jornadas, horas, quilômetros, consumos manuais e metas foram preservados.
- Nenhum gasto perdeu a associação com sua categoria.
- Campos legados sem equivalente continuam preservados, mesmo que não sejam exibidos.
- Novos detalhes ausentes permanecem ausentes, e não viram fatos inventados.
- As regras das novas coleções continuam restritas ao proprietário. Não ampliar leitura ou escrita pública.
- Em falha parcial, interromper a aplicação da transformação, registrar o ponto de parada e restaurar ou completar a partir do backup e do mapeamento, sem reaplicar cegamente todos os itens.

**Aceite:** histórico integralmente reconciliado, sem diferença monetária ou perda de informação; relatório local da migração; reversão possível.

## Etapa 4 — Definições e planejamento

- Permitir selecionar o mês da meta, preservando metas históricas e a regra de herança onde for aplicável.
- Adicionar calendário simples das datas que pretende trabalhar no mês.
- Cadastrar perfil do veículo: próprio, financiado ou alugado; combustível; consumo de referência; atribuição de custos ao trabalho.
- Permitir configurar premissas de custos com início de vigência. Alterar uma premissa atual não deve reescrever silenciosamente o resultado estimado de jornadas históricas.
- Permitir registrar compromissos recorrentes e despesas futuras conhecidas, com estado previsto ou realizado.
- Tornar provisões de manutenção/desgaste opcionais e separadas da meta de saldo.
- Permitir definir a base histórica e ajustar a previsão de gastos, mostrando o valor sugerido pelos registros.

**Aceite:** planejamento funciona com a semana disponível; campos não preenchidos não bloqueiam o saldo atual; premissas e datas ficam visíveis nas estimativas.

## Etapa 5 — Ganhos e fechamento do dia

- Unificar ganhos por aplicativo e dados da jornada num formulário “Fechar dia”, com data atual preenchida e edição retroativa.
- Manter registro rápido de ganhos e edição existentes se forem úteis, usando a mesma fonte de dados e sem duplicação.
- Solicitar tempo em horas e minutos; manter compatibilidade com minutos persistidos.
- Permitir informar quilômetros diretamente ou calcular por odômetro inicial/final. O preenchimento deve funcionar no fim do dia, sem exigir uma abertura anterior.
- Acrescentar quantidade opcional de corridas por aplicativo, turno e observação.
- Exibir os gastos já registrados para a data, sem obrigar o usuário a digitá-los novamente.
- Permitir salvar incompleto e fechar explicitamente. Destacar o que está ausente para os indicadores de hora, quilômetro ou combustível.
- Permitir corrigir um dia fechado e recalcular seus relatórios e a meta.
- Preservar a prevenção de conflitos de origem/data e a segurança das gravações ao editar.
- Para trabalho que atravesse meia-noite, definir uma data da jornada consistente, inicialmente a data de início escolhida pelo usuário. Despesas mantêm suas datas reais; não movê-las silenciosamente.

**Aceite:** fechamento em um único fluxo; gastos prévios preservados; dias incompletos identificados; correção retroativa sem duplicação.

## Etapa 6 — Gastos e abastecimentos

- Manter cadastro rápido com valor, categoria e data; observação opcional.
- Ao escolher abastecimento, mostrar os detalhes específicos de combustível em vez de um formulário genérico extenso.
- Permitir salvar um abastecimento com apenas o valor pago e completar detalhes depois. Ele afeta o saldo, mas não cria uma medição de consumo sem os dados necessários.
- Não duplicar abastecimento como gasto e como outro lançamento financeiro independente.
- Permitir vincular um gasto à despesa prevista correspondente, com atualização consistente de ambos.
- Distinguir gastos pessoais e operacionais por escolha explícita. Preservar a abrangência do saldo atual; qualquer filtro de escopo precisa ser identificado na tela.
- Manter edição e exclusão com confirmação. Corrigir abastecimento deve recalcular os ciclos de consumo afetados.
- Exibir o histórico antigo como incompleto quando faltarem detalhes, permitindo complementação manual.

**Aceite:** registrar gasto continua rápido; abastecimentos alimentam saldo e análise sem dupla contagem; histórico existente permanece acessível.

## Etapa 7 — Início

Organizar em três grupos, nesta ordem:

| Grupo | Conteúdo |
| --- | --- |
| Registrar | Ações principais: registrar gasto, abastecer e fechar dia. |
| Última jornada | Data, situação, ganhos, gastos registrados naquela data e saldo. Horas e quilômetros como apoio; acesso para completar ou corrigir. Identificar eventual registro pendente. |
| Planejamento do mês | Meta de saldo, saldo realizado, quanto falta, dias planejados restantes e ganho necessário por dia, considerando despesas futuras. Mostrar data de referência e base da previsão. |

- Priorizar celular e poucos elementos simultâneos.
- Não apresentar ganhos em tempo real nem “quanto falta ganhar hoje” como se houvesse integração com os aplicativos.
- Não colocar detalhamento por categoria, aplicativo ou gráficos extensos no Início.
- Manter o planejamento vinculado ao mês atual e fornecer acesso direto ao relatório da meta.
- Oferecer ligação da última jornada para seu detalhamento em Relatórios.

**Aceite:** os três momentos de uso estão atendidos; nenhum valor aparenta atualização automática de ganhos; ações principais são fáceis de alcançar.

## Etapa 8 — Relatórios

Adicionar filtros por dia, semana, mês e intervalo personalizado. O filtro deve ser visível e consistente entre os grupos de análise. A seção de meta deve identificar o mês próprio quando o intervalo geral atravessar meses.

| Grupo | Subgrupos e conteúdo |
| --- | --- |
| Resultado e meus dias | Totais de ganhos, gastos e saldo; médias diárias; dias trabalhados; gráfico diário; tabela por data; comparação com período anterior equivalente. |
| Rendimento do trabalho | Ganho e resultado estimado por hora e quilômetro; horas e quilômetros totais; comparação por dia da semana e classificação de turno; cobertura dos dados. |
| Ganhos | Totais por Uber, 99 e Outros; participação; corridas quando informadas; ganho médio por corrida apenas sobre dados compatíveis. |
| Custos e veículo | Gastos por categoria; proporção dos ganhos consumida por gastos; abastecimentos; consumo observado ou informado; combustível pago versus consumido estimado; manutenção e premissas do veículo. |
| Meta e cenários | Progresso mensal; despesas futuras; ganho necessário por dia restante; comparação com a média recente; projeção de fechamento; simulação de outros dias de trabalho e gastos previstos. |

- A tabela diária deve incluir datas com gastos e sem jornada, além de saldo negativo.
- Exibir melhor e pior dia por saldo dos lançamentos e, separadamente, por resultado estimado quando houver cobertura suficiente. Um grande abastecimento não deve ser apresentado como prova de jornada pouco rentável.
- Comparar períodos de duração equivalente. No mês em andamento, comparar até a data correspondente, identificando a regra.
- Simulações não alteram registros reais ou metas até uma ação explícita para salvar o planejamento.
- Nenhuma projeção deve ser apresentada como garantia de ganho.
- Mostrar estados sem dados, dados incompletos e poucas observações de maneira útil.

**Aceite:** cada indicador tem base identificável; os dados da semana existente já produzem relatórios; análises sem informação suficiente ficam indisponíveis ou claramente limitadas.

## Etapa 9 — backup, importação e exportação

- Atualizar a versão do backup para incluir campos e coleções novos, preservando a leitura das versões antigas documentadas.
- A transformação do histórico da etapa 3 deve poder ser validada antes da gravação, independentemente da ordem de entrega da interface de exportação.
- Manter importação com prévia, validação, preservação/atualização por ID e confirmação.
- Preservar desconhecidos históricos relevantes por uma estratégia documentada; não descartar informação em ciclos de exportação/importação.
- Incluir planejamento, premissas históricas e vínculos de despesas previstas no backup.
- No CSV, identificar unidades, situações do dia e a diferença entre valores registrados e estimados. Estimativas não viram lançamentos reais ao exportar.
- Conferir o ciclo exportar → validar → reimportar sobre dados de teste isolados, sem substituir a conta real para testar restauração.

**Aceite:** backup da nova versão recupera o estado completo; versões antigas continuam aceitas; nenhum teste de importação duplica ou substitui os dados reais.

## Etapa 10 — validação e entrega

### Dados e cálculos

Verificar com exemplos controlados e testes apropriados:

- Fechamento com Uber e 99 simultâneos, sem duplicar horas.
- Dia somente com gasto; folga com manutenção; dia pendente; dia fechado com zero ganho.
- Dia com ganhos e sem horas/KM; indicadores calculados somente sobre cobertura compatível.
- Abastecimentos completos, parciais e históricos incompletos; combustível consumido em dias posteriores ao pagamento.
- Custos fixos, despesas extraordinárias e vínculo entre previsão e pagamento.
- Prevenção de dupla contagem de combustível, manutenção e compromissos previstos.
- Meta com saldo negativo, meta atingida mas despesas futuras pendentes e ausência de dias restantes.
- Hoje antes/depois do fechamento; último dia do mês; mês futuro e encerrado; filtros que cruzam meses.
- Correção de registro antigo e mudança de premissa com vigência histórica.
- Totais, IDs e campos da semana original reconciliados depois de todas as alterações.

### Interface e funcionamento

- Validar os fluxos no celular e no desktop pelo Chrome real via Playwright MCP.
- No Firebase real, usar leitura para conferência; para testes de gravação, usar dados isolados ou registros explicitamente destinados ao teste. Não alterar lançamentos reais só para exercitar formulários.
- Confirmar autorização do proprietário e negação de acesso a outras contas nas coleções novas.
- Verificar estados de carregamento, erro, vazio e gravação; persistência entre sessões e dispositivos quando disponível.
- Executar lint, checagem de tipos e build estático conforme documentação e scripts efetivos do projeto.
- Atualizar `MOTORISTA.md` com comportamento final, modelo, fórmulas, compatibilidade e limitações reais.
- Atualizar a tabela de etapas e entregar um relato objetivo do que foi concluído, validado e eventualmente bloqueado.

**Aceite final:** Início e Relatórios atendem ao uso descrito; fechamento e abastecimentos funcionam; projeções usam saldo e despesas futuras; a semana original permanece integralmente preservada; backup e documentação correspondem à entrega.

## Referências que fundamentam o plano

As funcionalidades abaixo foram consultadas em páginas públicas, não verificadas por uso dos aplicativos. Discussões de fórum são relatos qualitativos, não uma amostra representativa.

- [Lucro do Motor — descrição do aplicativo](https://play.google.com/store/apps/details?hl=pt_BR&id=br.com.mibersistemas.lucro_do_motor): fechamento de turno, indicadores por hora/KM e custos do veículo.
- [Drivvo](https://www.drivvo.com/pt-BR/) e [FAQ](https://www.drivvo.com/pt-BR/faq/): abastecimentos, consumo, despesas e manutenção.
- [Fuelio](https://play.google.com/store/apps/details?hl=pt_BR&id=com.kajda.fuelio): histórico de abastecimentos, consumo e registros parciais.
- [ContaMotorista](https://www.contamotorista.com.br/): baixo esforço de registro, metas e indicadores.
- [Motoristas brasileiros discutindo ganhos e gastos](https://www.reddit.com/r/brasil/comments/192s3n4/): custos além de combustível e comparação por quilômetro.
- [Motoristas discutindo avaliação por hora e distância](https://www.reddit.com/r/uberdrivers/comments/1rqd63x/how_do_you_actually_calculate_your_real_hourly/): necessidade de considerar tempo e uso do veículo juntos.
- [Relato de motorista e desenvolvedor em Campinas](https://www.reddit.com/r/campinas/comments/1vyxf7f/): visibilidade dos quilômetros sem passageiro; o relato também divulga o aplicativo do autor.
