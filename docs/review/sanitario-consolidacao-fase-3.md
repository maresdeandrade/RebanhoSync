# Sanitario - Consolidacao Operacional - Fase 3

## Contrato sanitario final

O evento sanitario executado e a fonte factual do dominio sanitario. A agenda continua sendo intencao futura, e o protocolo continua sendo regra operacional versionada. Carencia, custo, produto aplicado, lote de estoque e baixa de estoque sao lidos exclusivamente de `eventos_sanitario` estruturado e de movimentacoes de estoque vinculadas ao evento.

O contrato preserva:

- `protocol_item_version_id` como versao fisica usada no evento;
- `protocol_item_logical_key` como identidade logica auxiliar;
- `protocol_item_version` como snapshot legivel;
- `protocol_item_snapshot` como regra historica aplicada;
- produto, lote, dose, via, responsavel, carencia e custo em colunas estruturadas do evento.

`protocol_item_version_id` segue como detalhe tecnico. Historico e relatorios exibem `item_code`/versao quando disponivel no snapshot.

## Fontes de verdade

- Historico sanitario: `eventos` + `eventos_sanitario`.
- Carencia: colunas `carencia_*` de `eventos_sanitario`.
- Produto/lote/dose/via/responsavel: colunas estruturadas de `eventos_sanitario`.
- Custo sanitario: `custo_unitario_snapshot` e `custo_total_snapshot`.
- Estoque: `insumo_movimentacoes` vinculadas ao evento, com idempotencia por evento.
- Agenda: apenas necessidade futura/intencao.
- Protocolo: regra versionada, nunca execucao factual.

## Telas e relatorios atualizados

O historico de eventos sanitarios passou a exibir em uma leitura unica:

- produto aplicado;
- lote de estoque;
- validade;
- dose e unidade;
- via de aplicacao;
- responsavel;
- carencia de carne/leite;
- custo total;
- item de protocolo e versao, quando houver.

O resumo operacional passa a consolidar a rastreabilidade sanitaria com:

- gasto sanitario por produto;
- gasto por animal;
- gasto por lote pecuario;
- gasto por lote de estoque;
- historico por item/version de protocolo;
- eventos sem rastreabilidade completa;
- produtos aplicados sem lote de estoque;
- eventos sem custo;
- inconsistencias de estoque, incluindo lote sem snapshot essencial ou vencido na data do evento.

## Sinais sanitarios disponiveis

Sinais emitidos a partir de eventos estruturados:

- `sanitario:carencia_ativa`;
- `sanitario:livre_carencia`;
- `sanitario:evento_sem_rastreabilidade`;
- `sanitario:produto_sem_lote`;
- `sanitario:estoque_inconsistente`;
- `sanitario:custo_ausente`.

Esses sinais sao recalculaveis, read-only e nao persistem marcador operacional.

## Sinais explicitamente bloqueados

Continuam bloqueados como decisao automatica:

- `comercial:pronto_venda`;
- `comercial:apto_abate`;
- `peso:atual_confiavel`;
- `protocolo:executado`;
- `agenda:concluida_como_fato`.

Livre de carencia nao autoriza venda. Agenda e protocolo isolado nao geram carencia.

## Bordas testadas

Foram cobertos:

- evento sem produto estruturado;
- produto manual sem lote;
- produto de estoque;
- lote vencido na data do evento;
- carencia ativa e expirada;
- evento sem carencia configurada;
- custo ausente sem quebra de relatorio;
- agrupamento de custo por produto, animal, lote pecuario, lote de estoque e protocolo;
- historico exibindo produto/lote/dose/via/carencia/custo;
- sinais sanitarios sem fonte em agenda/protocolo;
- venda/abate permanecendo bloqueados como sinais.

## Integridade offline/sync

A Fase 3 preserva o contrato offline-first da Fase 2:

- Dexie conhece os campos estruturados de `eventos_sanitario`;
- pull/sync transporta os campos novos;
- baixa de estoque sanitaria permanece idempotente por evento;
- retry/sync nao deve duplicar movimentacao;
- recompute nao usa `protocol_item_id` legado;
- agenda/protocolo nao entram como fonte de carencia.

## O que ficou fora do escopo

Nao foi implementado:

- autorizacao de venda;
- autorizacao de abate;
- sociedade;
- resultado comercial;
- motor financeiro completo;
- decisao automatica de aptidao comercial.

## Testes adicionados ou ajustados

- `src/lib/insights/__tests__/sanitaryWithdrawalSignals.test.ts`;
- `src/features/operationalInsights/__tests__/operationalInsightsAdapter.test.ts`;
- `src/lib/reports/__tests__/operationalSummary.test.ts`;
- `src/pages/__tests__/Eventos.test.tsx`.

## Comandos executados

- `powershell -File scripts/codex/preflight.ps1 -Paths "src/lib/sanitario","src/lib/offline","src/pages/Registrar","src/pages/Agenda","src/lib/events","src/lib/insights","src/features/operationalInsights","src/lib/reports","supabase/migrations","docs/review"`
- `pnpm test src/lib/insights/__tests__/sanitaryWithdrawalSignals.test.ts src/lib/reports/__tests__/operationalSummary.test.ts src/pages/__tests__/Eventos.test.tsx src/features/operationalInsights/__tests__/operationalInsightsAdapter.test.ts`
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`
- `powershell -File scripts/codex/validate.ps1 -TouchedPaths "src/lib/sanitario","src/lib/offline","src/pages/Registrar","src/pages/Agenda","src/lib/events","src/lib/insights","src/features/operationalInsights","src/lib/reports","supabase/migrations","scripts/codex/validate-supabase-baseline-functional.mjs"`
- `graphify update .`
- `git diff --check`
- `supabase db reset`
- `node scripts/codex/validate-supabase-baseline-functional.mjs`

## Resultado das validacoes

- `pnpm test`: passou.
- `pnpm run lint`: passou.
- `pnpm run build`: passou.
- `powershell -File scripts/codex/validate.ps1 ...`: passou.
- `graphify update .`: passou e atualizou `graphify-out/GRAPH_REPORT.md` e `graphify-out/graph.json`.
- `git diff --check`: passou.
- `supabase db reset`: passou apos Docker local ficar disponivel.
- `node scripts/codex/validate-supabase-baseline-functional.mjs`: passou com `run_id=c56ac0ce`, cobrindo RLS, estrutura produtiva/FKs compostas, papeis, agenda -> evento sanitario via RPC e `sync-batch` real.

## Riscos remanescentes

1. O historico exibe o snapshot disponivel; eventos antigos sem colunas estruturadas aparecem como incompletos, sem fallback legado.
2. A baixa de estoque segue dependente do contrato idempotente do evento e da movimentacao; nao foi criado motor avancado de reconciliacao.
3. Sinais sanitarios sao auxiliares de operacao e nao substituem autorizacao comercial futura.

## Veredito

Fase 3 sanitaria concluida. Historico, relatorios, sinais, offline/sync e baseline Supabase foram validados dentro do escopo sanitario. Venda, abate e sociedade permanecem fora desta fase.

## Proxima fase recomendada

Consolidar revisao operacional de estoque sanitario: reconciliacao assistida de eventos sem lote/custo, painel de excecoes e fluxo de correcao historica por complemento/contra-lancamento, ainda sem abrir venda ou abate.
