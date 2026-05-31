# Sanitário/Protocolos — Fase 2

## Contrato final do evento sanitário

O evento sanitário executado continua sendo o fato histórico. Ele preserva `protocol_item_version_id`, `protocol_item_logical_key`, `protocol_item_version` e `protocol_item_snapshot`, e passa a gravar rastreabilidade operacional em colunas estruturadas de `eventos_sanitario`.

## Campos estruturados adicionados

Foram adicionados produto, lote de estoque, dose, via, responsável, carência e custo: `produto_veterinario_id`, `produto_nome_snapshot`, `estoque_lote_id`, `estoque_lote_codigo_snapshot`, `lote_fabricante`, `validade_produto`, `dose_quantidade`, `dose_unidade`, `via_aplicacao`, `responsavel_nome`, `responsavel_tipo`, `carencia_carne_dias`, `carencia_leite_dias`, `carencia_carne_ate`, `carencia_leite_ate`, `custo_unitario_snapshot` e `custo_total_snapshot`.

## Produto, lote e dose

`buildEventGesture` copia o produto selecionado e o insumo/lote aplicado para colunas fortes e mantém `payload.insumo_snapshot` como snapshot auxiliar. Produto estruturado exige dose, unidade e via de aplicação. A UI do Registrar expõe dose/unidade/via no manejo sanitário.

## Carência

Carência é calculada somente a partir do evento executado. `carencia_*_ate` usa a data efetiva do evento somada aos dias configurados no insumo aplicado. Sem carência configurada, os campos ficam explicitamente `null`. Agenda e protocolo isolado não são fonte de carência.

## Estoque

Quando há `estoque_lote_id`, o evento copia lote, validade, fabricante e custo. A baixa sanitária gera uma movimentação `consumo_sanitario` com `source_evento_id`; o id da movimentação é o próprio id do evento e há índice único parcial para impedir duplicidade por retry/sync. Saldo negativo é bloqueado no builder local e no trigger de estoque.

## Custo

O custo unitário vem do lote de estoque e o custo total é `custo_unitario_snapshot * quantidade_consumida`. Relatórios passam a agrupar custo sanitário por produto, lote de estoque, animal e lote pecuário.

## Relatórios

`buildOperationalSummary` inclui `inventory.sanitaryTraceability`, com custo total e agrupamentos por produto, lote de estoque, animal e lote pecuário. O CSV operacional exporta esses cortes.

## Insights

Foram adicionados sinais operacionais baseados exclusivamente em eventos estruturados:

- `sanitario:carencia_ativa`
- `sanitario:livre_carencia`

Continuam bloqueados como decisão comercial:

- `comercial:pronto_venda`
- `comercial:apto_abate`

## Legado removido

A Fase 2 não reabre `protocol_item_id`/`protocolo_item_id`, não usa agenda como fonte de carência e não usa protocolo isolado como fato sanitário.

## Testes adicionados

Foram adicionados testes de rastreabilidade do evento sanitário, carência estruturada, baixa idempotente, bloqueio de saldo negativo, agrupamento de custo em relatório e sinais de carência por eventos.

## Comandos executados

- `pnpm test -- src/lib/events/__tests__/sanitaryTraceability.test.ts src/lib/insights/__tests__/sanitaryWithdrawalSignals.test.ts src/lib/reports/__tests__/operationalSummary.test.ts src/lib/insights/__tests__/tagSignals.test.ts src/pages/Registrar/__tests__/sanitaryFinalize.characterization.test.ts src/lib/events/__tests__/buildEventGesture.test.ts`

## Riscos remanescentes

- A autorização final de venda/abate permanece fora do escopo.
- A baixa automática cobre uma movimentação sanitária por evento.
- O responsável é registrado a partir do usuário autenticado quando disponível.

## Próxima fase recomendada

Implementar uma fase comercial separada para autorização de venda/abate usando os sinais sanitários estruturados como evidência, sem transformar carência em decisão comercial automática.
