# F24.5D — Sync / Reconcile Health Views

Data: 2026-10-07. Status: `READY_FOR_REVIEW` (entrega local, não integrada).

## Decisão e baseline real

IMPLEMENTATION limitada a G05: projetar estado local persistido nos indicadores
de sync, sem gravar health nem modificar worker, retry ou execução de reconcile.

| Campo | Fato confirmado |
| --- | --- |
| Rebaseline | `git fetch origin --prune`, `git checkout main`, `git pull --ff-only` |
| Branch no rebaseline | `main` |
| HEAD / origin/main | `f3d0e3fb6b9929e85826381c07e08e08a623a2a5` |
| Worktree no rebaseline | Limpa, sem staged ou untracked |
| Branch D | `codex/f24-5d-health-views` |
| HEAD da entrega local | Mesmo baseline; patch não commitado |

A primeira tentativa de checkout foi bloqueada porque outro worktree usava main.
Na nova tentativa, main foi liberada e o rebaseline passou. A branch com nome
`codex/f24-5d-sync-reconcile-health` já existia e não foi reutilizada.

O intervalo desde a HEAD de C (`8b8f3178…`) incorpora os merges #184 e #185.
O merge #184 (`280cc07ac31842c79de2ca9d502fe543d9302f6a`) altera somente
`src/pages/Animais.tsx` e seu teste. Não alterou sync/health; Visual V2 preservado.
O merge #183 está no baseline incorporado por C. A narrativa de PROJECT_STATUS
ainda aponta B como próxima etapa; não substitui o baseline Git observado.

## Current health model / G05

FATO CONFIRMADO — antes:

- Header: `TopBar` observa `loadFarmSyncSummary(activeFarmId)` por `useLiveQuery`
  e passa o resultado a `SyncStatusBadge`.
- Home: seu snapshot observado chama a mesma consulta e passa `syncSummary` a
  `SyncStatusPanel`. O painel fica na Home; Dashboard não usa essa projeção.
- A consulta já conta PENDING, SYNCING e ERROR em `queue_gestures`, por fazenda.
  `pendingCount` soma PENDING e SYNCING; não significa todo trabalho de convergência.
- Os dois componentes ignoravam `errorCount`. Sem rejeição, pending/syncing ou
  último resultado alterado, um ERROR podia aparecer como “Em dia”.
- Nenhum dos dois observava `sync_reconcile_obligations`. Fila vazia ou gesture
  DONE podiam aparecer como “Em dia” mesmo com obrigação de pull pendente.
- `SyncHealthPanel` em configurações lista telemetria remota histórica. Não é
  indicador funcional da fila atual e não foi alterado nem usado como autoridade.

Depois: `getFarmSyncHealth` centraliza a prioridade fora do JSX. A consulta
acrescenta `reconcileCount`, derivado de obrigações existentes da mesma fazenda,
e `fazendaId`, atribuição transitória do resultado consultado.
Não existe tabela, store, cache paralelo, migration ou novo registro de health.

## Fontes e prioridade

| Prioridade | Fonte / condição | Mensagem |
| --- | --- | --- |
| Antes de classificar | Resumo não carregado ou pertencente a outra fazenda | Verificando sincronização |
| 1 | `queue_rejections`, mesma fazenda, contagem > 0 | Revisão necessária |
| 2 | `queue_gestures.status = ERROR`, mesma fazenda | Erro de sincronização |
| 3 | `sync_reconcile_obligations`, mesma fazenda, contagem > 0 | Reconciliação pendente |
| 4 | `queue_gestures.status = SYNCING` | Sincronizando |
| 5 | `queue_gestures.status = PENDING` | Salvo localmente |
| 6 | Última confirmação `synced_altered` | Confirmado com ajuste |
| 7 | Nenhuma condição anterior | Em dia |

A precedência existente de rejeições e confirmações com ajuste foi preservada.
ERROR e obrigações nunca produzem sucesso. O painel mostra também seus contadores,
mesmo quando outro estado domina o título. Obrigações são contadas por registro/
scope, não por número de operações ou animais. A presença da obrigação é pendência:
o executor existente remove o registro apenas ao concluir a geração correspondente.

`queue_ops` não determina o indicador: sua contagem não prova convergência e não
é adicionada a pendingCount. Os estados de envio vêm das gestures; a convergência
durável vem das obrigações. `queue_rejections` continua sendo a evidência operacional
existente, sujeita à retenção atual. Telemetry, diagnostics, pilotMetrics, tags,
logs e toast não participam da decisão funcional de saúde.

## Multi-farm e farm-switch

Todas as contagens usam `fazenda_id`. A com ERROR/obrigação e B sem pendência
produzem estados diferentes. O resultado carrega sua própria atribuição.

FATO CONFIRMADO — a implementação instalada de `useLiveQuery` conserva o resultado
anterior enquanto a nova assinatura carrega. `selectFarmSyncSummary` aceita somente
resultado com a fazenda ativa; TopBar e painel da Home mostram verificação nesse
intervalo. Não se reaproveita uma saúde antiga sob a fazenda recém-selecionada.
Ao retornar a A, a consulta observa novamente o estado persistido de A.
As demais informações do snapshot amplo da Home não foram refatoradas nesta fase.

## Auth / ownership / G06

FATO CONFIRMADO: `useAuth` expõe session e localOwnership. Ao estabelecer ownership
diferente de OWNED, não instala a sessão autenticada; perda de sessão limpa contexto
da fazenda. `LocalOwnershipBoundary` oferece a recuperação existente para UNKNOWN
com usuário conhecido. Nenhuma dessas políticas foi alterada ou contornada.

NOT_PROVEN: mensagem específica de sessão efetivamente disponível para o worker,
expiração remota em tempo real e vínculo atual entre bloqueio auth e pendência por
fazenda neste health view. Diagnostics de tentativa anterior não são fonte atual
para isso. Não se infere owner, não se adota fila e não se desbloqueia pending.
“Em dia” descreve ausência das pendências locais observadas; não certifica sessão
remota, disponibilidade de backend ou convergência de todo domínio/dispositivo.

## Arquivos

- `src/lib/offline/syncPresentation.ts`: prioridade e seleção por atribuição.
- `src/lib/offline/syncQueries.ts`: leitura indexada de obrigações por fazenda.
- `src/components/ui/sync-status-badge.tsx`: projeção compacta compartilhada.
- `src/components/offline/SyncStatusPanel.tsx`: projeção e contadores.
- `src/components/layout/TopBar.tsx`: proteção contra resumo de outra fazenda.
- `src/pages/Home.tsx`: mesma proteção no painel.
- `src/lib/offline/__tests__/syncPresentation.test.ts`: matriz e verificação.
- `src/lib/offline/__tests__/syncQueries.test.ts`: IndexedDB e isolamento.
- `src/components/offline/__tests__/SyncHealthViews.test.tsx`: componentes reais,
  TopBar com useLiveQuery real, mudança de fazenda e reatividade persistida.
- `src/pages/__tests__/Home.test.tsx`: atribuição e snapshot anterior no painel.
- Este documento: evidências e limites da entrega.

## Validações

| Comando | Resultado observado |
| --- | --- |
| `pnpm exec vitest run src/lib/offline/__tests__/syncQueries.test.ts src/lib/offline/__tests__/syncPresentation.test.ts src/components/offline/__tests__/SyncHealthViews.test.tsx src/pages/__tests__/Home.test.tsx` | 33/33 na primeira execução |
| `pnpm exec vitest run src/components/offline/__tests__/SyncHealthViews.test.tsx src/pages/__tests__/Home.test.tsx` | 15/15 após ajustes de farm-switch/Home |
| `pnpm exec vitest run src/components/offline/__tests__/SyncHealthViews.test.tsx` | 8/8 no patch final, incluindo resumo não carregado; 34 casos distintos validados no conjunto |
| `pnpm exec eslint <10 arquivos TypeScript alterados listados acima>` | Exit 0, sem findings |
| `pnpm exec fallow audit --gate new-only` | Primeira execução: exit 1 por complexidade nova no painel |
| `pnpm exec fallow audit --gate new-only --format json --output-file <TEMP>/f24-5d-fallow-final.json` | Após simplificação: exit 0, verdict pass; zero dead-code, complexity e duplication introduzidos |
| `pnpm exec fallow audit --gate new-only --summary` | Exit 0 no patch final de 11 arquivos; 14 achados herdados excluídos pelo gate |
| `pnpm run gates:docs` | Exit 0; headers, continuidade e contrato de governança passaram |
| `git diff --check` | Exit 0 |

Primeiro Fallow: SyncStatusPanel tinha cyclomatic 27 por optional reads repetidas.
A leitura dos contadores foi simplificada, preservando o estado de verificação.
Nenhum suppress ou configuração de gate foi introduzido. O Fallow ainda lista
achados herdados e quatro avisos CSS: os valores indicados já existem em HEAD,
como confirmado no diff; nenhum token ou classe visual foi adicionado nos trechos.
React Router emitiu avisos de flags futuras de v7; não bloquearam testes.
Fallow também avisou sobre ausência de node_modules nos snapshots analisados;
a atribuição automática de dependências tem essa limitação, sem findings novos.

Verification gate: READY. Tracked, staged (vazio) e os dois arquivos untracked
foram inspecionados. 11 arquivos no escopo, sem alteração preexistente transportada.
Checklist React: hooks incondicionais, dependência activeFarmId preservada,
prioridade pura compartilhada, aria-label da badge coerente com o estado,
ícones decorativos e tokens existentes preservados; sem nova dependência.

Não executados: suíte global, build, E2E, remoto e dispositivo físico, conforme
validação proporcional solicitada. Não houve commit, push, PR, merge ou deploy.

## Contratos e riscos residuais

PRESERVED: offline-first, identidades, idempotência, retry/backoff/MAX_RETRIES,
ACK, reconcile execution, CAS, writers, RLS/RPC, movement_v1, schema Dexie,
isolamento por fazenda, falha fechada e fontes históricas. O patch só lê as fontes
locais e apresenta resultado; não altera persistência funcional local/remota.

CHANGED: projeção visual de ERROR/obrigações e tratamento de loading/farm-switch.

1. G06 permanece parcial / NOT_PROVEN nos limites descritos acima.
2. Testes usam IndexedDB simulado e React real; não certificam browser/dispositivo
   físico, offline/reconnect remoto ou kill de processo.
3. “Em dia” é uma projeção das fontes locais observadas, não um certificado global
   de backend ou de todos os read models.

## Veredito

F24_5D = READY_FOR_REVIEW. G05 resolvido na matriz local testada.
G06 continua parcial nos limites NOT_PROVEN registrados; sem rollout/integração.
