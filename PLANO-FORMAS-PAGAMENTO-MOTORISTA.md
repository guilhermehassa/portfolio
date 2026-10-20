# Formas de pagamento e consulta de faturas — Motorista

## Decisões fechadas em 13/10/2026

Evolução aditiva: manter os cadastros, os cálculos e o relatório atual. Acrescentar formas de pagamento e uma subaba de consulta de gastos dentro de Relatórios.

- Em Definições, cadastrar nome e tipo **Outro** ou **Cartão de Crédito**. Crédito exige dia mensal de fechamento e de vencimento (1–31). Outro atende Pix, dinheiro e débito, por nome livre. Sem cadastros automáticos.
- Exigir a forma em todo novo gasto, abastecimento ou manutenção, mesmo cadastrado com data retroativa. Não exigir complementação dos documentos já existentes, nem mostrar aviso, marcador ou mensagem de informação ausente.
- Manutenção nova recebe **Data da compra**, preenchida com hoje e editável no cadastro e na edição. Preservar o campo `date` que ancora o rateio atual; a compra é um campo adicional. Ausência histórica não vira hoje ao editar outro campo.
- Relatórios ganha **Geral** e **Gastos**. Geral mantém integralmente os sete grupos atuais. Gastos é uma consulta somente leitura.
- O período da nova consulta representa o **vencimento da fatura**, não a data da compra. Uma fatura de novembro pode reunir compras de outubro. Aceitar dia, semana, mês e intervalo, inclusive futuros; filtros adicionais por forma e categoria.
- Listar compra, vencimento, categoria, descrição, valor e forma. Mostrar total filtrado e totais por forma. Um filtro de categoria produz subtotal, sem se apresentar como total integral de uma fatura.
- Sem agenda, controle de quitação, cobranças, juros ou novo parcelamento financeiro. Não converter os meses de rateio analítico da manutenção em parcelas de cartão. Na consulta, o total da compra de manutenção entra uma vez, usando sua data real.
- Saldo, metas, cotas de manutenção e relatórios existentes continuam com os mesmos cálculos.

## Contrato de dados e consulta

Nova coleção `users/{uid}/paymentMethods`, protegida pelo proprietário existente. Documento com `id`, `name`, `type` (`other`/`credit`), `active`, `closingDay` e `dueDay` quando crédito. Permitir ativação/desativação e edição; não excluir cadastros vinculáveis ao histórico.

Gasto acrescenta `paymentMethodId` e um snapshot dos termos (`type`, fechamento e vencimento). Renomear a forma atualiza o nome exibido pelo ID; alterar tipo/dias não recalcula silenciosamente termos já registrados. Ao escolher outra forma, capturar seus termos atuais. Conferir a seleção novamente dentro da transação de gravação.

Compra no dia do fechamento pertence à próxima fatura; antes dele, pertence à fatura que fecha naquele mês. O vencimento é a primeira ocorrência do dia configurado posterior ao fechamento; pode estar no mês seguinte. Dias inexistentes de meses curtos usam o último dia do mês. Datas são civis, sem conversão de fuso. Outro usa a própria data da compra.

Manutenção usa `purchaseDate`; não interpretar seu `date` técnico como compra. Sem forma ou sem compra histórica de manutenção, não há vencimento inferido. A consulta não fabrica dados nem cria lançamentos financeiros adicionais.

Backup JSON v5 acrescenta `paymentMethods` e preserva vínculos/termos/compra/campos desconhecidos. Continuar aceitando v1–v4. Importar cadastros de formas antes dos gastos, mantendo os limites e a proteção de conflitos existentes. CSV acrescenta as novas informações sem modificar valores ou colunas anteriores.

## Execução

| Etapa | Responsável | Situação |
| --- | --- | --- |
| Contrato, cálculo de vencimento, backup/CSV e regras locais | Subagente Firebase | Concluído localmente |
| Cadastros, formulários, relatório focado e apresentação | Subagente frontend | Concluído localmente |
| Assinatura da nova coleção, navegação e transações | Tech lead | Concluído localmente |
| Testes unitários, tipos, lint e revisão integrada | Tech lead e especialistas | 192 testes aprovados; TypeScript e lint aprovados |
| Documentação final | Tech lead | Concluída |
| Validação visual | Usuário | Usuário acompanha pelo npm run dev e confirmará o resultado |
| Publicação das regras Firebase | Subagente Firebase, autorizada pelo usuário | Concluída em 13/10/2026 às 16:34:03 (São Paulo); compilação aceita e release ativa relida igual ao arquivo local |

Nenhuma migração ou alteração de documentos históricos é necessária. Desenvolvimento usa o Firebase real, assim como produção; testes de dados devem permanecer isolados, sem gravações fictícias na conta. Publicação das regras e do site é distinta da validação local.

Restrição explícita inicial do usuário: nenhum agente deve acessar navegador, executar build, iniciar/parar/reiniciar o servidor ou commitar. Depois do erro de permissão em `paymentMethods`, o usuário autorizou expressamente o especialista Firebase a acessar o console real e publicar as regras necessárias. Essa exceção foi limitada ao console Firebase; nenhum acesso ao site/localhost para validar interface, build, alteração do servidor ou Git foi realizado. A validação visual permanece com o usuário.

Projeto `motorista-17946` e banco `(default)` conferidos. Regras remotas anteriores comparadas integralmente com o baseline, sem mudança fora do escopo. Compilação/teste do console, criação do ruleset e atualização da release `cloud.firestore` retornaram HTTP 200; release atualizada em `2026-10-13T19:34:03.455910Z`, com ruleset `dee93f96-4fb2-4ad1-aa87-bf24d20f8558`. Após reabrir o console, o texto publicado foi confirmado integralmente igual a `firestore.rules`, sem rascunho pendente. Originais, publicação e evidência preservados em `backups/motorista/2026-10-13-payment-methods-rules/`. Nenhum documento foi criado, alterado ou excluído, e nenhum dado fictício foi gravado. A publicação confirma compilação/release ativa, sem substituir a validação dos fluxos pelo usuário ou simulações exaustivas de autorização.
