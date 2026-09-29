# Plano de execução — controle financeiro para motorista

## Objetivo

Criar um sistema pessoal em `/motorista` para registrar ganhos, gastos, horas e quilômetros trabalhados, acompanhar o saldo e medir o progresso de uma meta mensal. A interface deve ser simples para uso diário no celular e permitir consultar e corrigir datas anteriores.

## Arquitetura e acesso

- Usar o Next.js existente para gerar a página no export estático já publicado pelo Caddy, sem servidor Node em produção nem novos contêineres.
- Usar Firebase Authentication com login pela conta Google do proprietário e Cloud Firestore para persistir os dados entre dispositivos.
- Restringir leitura e escrita no Firestore ao UID da conta autorizada por meio de regras de segurança. A tela de login, a URL da página e a configuração pública do Firebase não substituem essas regras.
- Manter os dados no Firestore, separados dos arquivos publicados pelo deploy do portfólio. Um novo deploy do site não deve alterar os lançamentos.
- Definir metadados próprios para `/motorista` e impedir sua indexação. A página pode ser acessada diretamente pelo endereço, sem incluí-la na navegação do portfólio.
- A primeira versão requer conexão para consultar e salvar dados; a interface deve indicar claramente sucesso, carregamento e falha de gravação.

## Registro de um dia

Ao abrir o cadastro, preencher a data com o dia atual no fuso local. Permitir selecionar uma data anterior e editar o registro existente desse dia.

| Campo | Regra |
| --- | --- |
| Uber | Valor total do dia e número de corridas, ambos opcionais. |
| 99 | Valor total do dia e número de corridas, ambos opcionais. |
| Outros | Valor total opcional que reúne caixinhas fora dos aplicativos, corridas particulares e demais ganhos. |
| Horas trabalhadas | Duração total opcional da jornada, incluindo espera e deslocamentos enquanto estava trabalhando. |
| Quilômetros rodados | Distância total opcional da jornada, incluindo deslocamentos enquanto estava trabalhando. |

Os valores dos aplicativos representam os ganhos exibidos neles. Corridas são pagas diretamente pelos aplicativos; portanto, não é necessário controlar repasses ou dinheiro recebido por essas corridas. Uma caixinha lançada posteriormente pode ser atribuída e corrigida no dia a que se refere. Ganhos recebidos dentro do aplicativo entram no total do respectivo aplicativo; ganhos externos entram em **Outros**, sem duplicação.

Permitir zero corrida com valor positivo, pois ajustes ou caixinhas do aplicativo podem chegar depois da jornada. A média por corrida considera somente Uber e 99; **Outros** não possui quantidade de corridas, pois mistura tipos diferentes de ganhos.

## Gastos

- Permitir vários gastos no mesmo dia, inclusive em dias sem jornada registrada.
- Cada gasto contém data, categoria, valor e observação opcional.
- Oferecer inicialmente as categorias combustível, manutenção, alimentação, pedágio, estacionamento, lavagem e outros.
- Permitir criar e editar categorias sem perder a identificação dos lançamentos antigos.
- Permitir editar e excluir gastos; a exclusão deve pedir confirmação.
- Lançar cada gasto integralmente na data informada. Assim, um gasto eventual maior afeta o saldo do respectivo período.

## Dashboard

Oferecer filtros por dia, semana, mês e intervalo personalizado. Todos os indicadores devem ser recalculados quando um registro passado for alterado.

- Ganhos totais e por origem: Uber, 99 e Outros.
- Gastos totais e por categoria.
- Saldo do período: ganhos registrados menos gastos registrados, podendo ser negativo.
- Número de corridas por aplicativo e total de Uber + 99.
- Ganho médio por corrida de Uber, 99 e do conjunto desses dois aplicativos.
- Horas e quilômetros trabalhados.
- Ganho e saldo por hora; ganho, saldo e gasto por quilômetro.
- Evolução diária de ganhos, gastos e saldo no período selecionado.

Mostrar indicadores por hora, quilômetro ou corrida somente quando o respectivo divisor for maior que zero. Identificar o saldo como **resultado dos valores registrados**, já que custos ainda não lançados não entram no cálculo.

## Meta mensal

- Configurar e editar uma meta de **saldo mensal** para cada mês. O saldo é a soma de Uber, 99 e Outros menos todos os gastos registrados naquele mês.
- Exibir meta, saldo acumulado, percentual atingido e quanto falta: `máximo(meta - saldo acumulado, 0)`.
- Usar cinco dias de trabalho por semana **apenas como referência de planejamento**, sem exigir dias fixos ou limitar quantos dias podem ser trabalhados.
- Estimar os dias de trabalho do mês arredondando `dias corridos do mês × 5 ÷ 7`. A referência diária inicial é `meta mensal ÷ dias estimados`; a semanal é `referência diária × 5`.
- Recalcular a necessidade diária ao longo do mês: `máximo(meta - saldo acumulado, 0) ÷ dias de trabalho estimados entre hoje e o fim do mês`. Incluir hoje enquanto ainda for o dia atual; quando não houver dias restantes, mostrar o resultado final do mês sem divisão por zero.
- Tratar referências diárias e semanais como **estimativas**, pois o motorista pode trabalhar mais ou menos que cinco dias e escolher os dias livremente.
- Permitir metas distintas em meses diferentes e preservar a meta histórica ao editar outro mês.

## Backup e portabilidade

- Exportar todos os registros, categorias e metas em JSON para backup.
- Importar um backup JSON com validação, prévia do conteúdo e confirmação antes de aplicar mudanças, evitando duplicações ou substituições acidentais.
- Exportar lançamentos em CSV para análise em planilha.
- Registrar valores monetários em centavos na persistência e usar a data civil local (`AAAA-MM-DD`) para evitar erros de arredondamento e deslocamentos de data por fuso horário.

## Etapas de execução

1. Configurar projeto Firebase, aplicativo web, login Google, Firestore e regras que autorizem exclusivamente o UID do proprietário. Verificar acesso autorizado e negado.
2. Definir a estrutura persistida para dias, gastos, categorias e metas mensais; preparar a configuração de desenvolvimento e produção.
3. Criar `/motorista`, a autenticação e a interface de cadastro diário, priorizando o uso no celular.
4. Implementar cadastro e manutenção dos gastos e categorias, com edição retroativa dos dados.
5. Implementar filtros, indicadores e visualizações do dashboard, com proteção contra divisões por zero.
6. Implementar a meta mensal e as referências diária e semanal, incluindo o recálculo do restante do mês.
7. Implementar exportação JSON/CSV e importação validada do backup.
8. Validar regras de segurança, cálculos, edição de datas anteriores, meses de tamanhos diferentes, saldos negativos, estados de erro, layout móvel, lint, tipos e build estático.
9. Publicar as regras e a configuração do Firebase e, depois, a página pelo fluxo de deploy existente. Conferir o acesso real em `/motorista` e a persistência entre dispositivos.

## Critérios de aceite

- Somente a conta Google autorizada consegue ler ou alterar os dados, inclusive ao tentar acessar o Firestore fora da interface.
- Um lançamento salvo em um dispositivo aparece em outro após o login.
- A data começa no dia atual e pode ser alterada para corrigir dias anteriores.
- Uber e 99 aceitam valor e quantidade de corridas; Outros aceita valor; todos podem ser editados depois.
- Gastos podem ser cadastrados várias vezes no mesmo dia, editados e excluídos.
- O dashboard e o progresso da meta refletem imediatamente os dados corrigidos.
- A meta permanece mensal e baseada no saldo; os valores diários e semanais são claramente apresentados como estimativas para uma média de cinco dias de trabalho por semana.
- Exportação e restauração preservam registros, categorias e metas sem duplicá-los.
- O build estático gera a página `/motorista`, e novos deploys do portfólio não apagam os dados persistidos.
