# F24.2A — Inventário offline/reconnect

Data da inspeção: 2026-09-15
Baseline: `main@155dab4ddee73aedc83a9a53c6e075de7a5bd3ad`
Natureza: diagnóstico read-only; nenhum código funcional foi alterado.

## Critério de evidência

- **CONFIRMED**: comportamento demonstrado por código, migration ou teste existente.
- **INFERENCE**: consequência técnica direta, ainda sem teste específico.
- **UNKNOWN**: a evidência disponível não permite concluir.

## Pipeline real

```text
writer chama createGesture() ou writer sanitário transacional
→ transação Dexie grava queue_gestures + queue_ops + estado/fato otimista
→ AppShell inicia syncWorker (poll de 5 s)
→ processGesture seleciona PENDING, ordena ops e obtém sessão
→ POST /functions/v1/sync-batch
→ Edge valida JWT + membership da fazenda
→ operação genérica via PostgREST OU comando composto via RPC
→ resposta por operação
→ worker remove/reclassifica queue_ops e atualiza queue_gestures
→ pull pós-sync seletivo
→ merge/replace Dexie, com proteção de registros pendentes
→ startup pull + recovery parcial de ERROR/BLOCKED_DEPENDENCY
```

Não existe service worker de sincronização nem outbox separada. O “worker” é um `setInterval` no processo React, iniciado por `AppShell`.

## Caminho 1 — gesto genérico local → push genérico

1. **Camada:** client offline + Edge + PostgREST — **CONFIRMED**.
2. **Arquivo:** `src/lib/offline/ops.ts`, `src/lib/offline/syncWorker.ts`, `supabase/functions/sync-batch/index.ts`, `supabase/functions/sync-batch/rules.ts`.
3. **Função:** `createGesture`, `applyOpLocal`, `processGesture`, `mapOperationForSync`, handler `Deno.serve`.
4. **Operação:** `INSERT | UPDATE | DELETE` em superfícies mapeadas por `tableMap.ts`.
5. **Entidade/agregado:** animais, lotes, pastos, Agenda legada, Eventos/detalhes, insumos, financeiro, protocolos, sociedades e contrapartes — **CONFIRMED**.
6. **Fonte de verdade:** Dexie é a base operacional local; Postgres é a persistência remota; Evento permanece fato, Agenda intenção e `state_*` read model.
7. **Persistência local:** `queue_gestures`, `queue_ops` e store `state_*`/`event_*` correspondente.
8. **Transaction boundary local:** uma única `db.transaction("rw", queue_gestures, queue_ops, affectedStores)` grava fila e apply otimista — **CONFIRMED**.
9. **Chamada remota:** `fetch(.../sync-batch)` com JWT, `client_id`, `fazenda_id`, `client_tx_id`, `ops`.
10. **Transaction boundary remota:** uma mutação PostgREST por operação; o lote inteiro não é uma transação — **CONFIRMED**.
11. **Idempotency key:** `client_op_id` + `client_tx_id`, com PK do registro para lookup.
12. **Deduplicação:** lookup por PK/fazenda e comparação dos metadados persistidos; mesma identidade retorna `APPLIED`.
13. **Ack local:** após resposta `APPLIED`, `queue_ops` é apagada e o gesto vira `DONE`; no caminho all-applied genérico esses passos não são atômicos entre si — **CONFIRMED**.
14. **Retry:** até 3 novas tentativas no gesto; identidade é preservada.
15. **Backoff:** somente sanitário por operação possui backoff exponencial; o genérico repete no tick de 5 s — **CONFIRMED**.
16. **Resposta ambígua:** mantém fila e reenvia a mesma identidade; não há timeout explícito no `fetch` do cliente.
17. **Partial success:** `planOperationReconciliation` separa applied/rejected/retryable/missing; applied é preservado, rejected sofre rollback e retryable fica na fila.
18. **Replay:** seguro para a mesma PK + `client_op_id` + `client_tx_id`; se a mesma execução for reapresentada com nova identidade de comando, o caminho genérico não possui proveniência suficiente para distingui-la de uma nova execução legítima.
19. **Startup recovery:** recupera somente gestos `ERROR` cujo texto contém markers limitados; não recupera `SYNCING` — **CONFIRMED**.
20. **Política de conflito:** rejeição/rollback por operação; UPDATE genérico não usa versão/ETag e portanto é last-write-wins remoto — **CONFIRMED/INFERENCE**.
21. **Isolamento:** Edge valida `user_fazendas`, força `fazenda_id` do request e usa client JWT/RLS.
22. **Teste:** `sync_rollback_retry.flow.test.ts`, `syncPartialBatch.test.ts`, `animalDeletionFlow.test.ts`, `syncWorkerHttp403.test.ts`, `rules.test.ts`.
23. **Gap:** ack all-applied não atômico; `SYNCING` órfão; retry/recovery incompletos; ausência de concorrência genérica explícita; dedup apenas por identidade.
24. **Severidade:** P0 para possível criação repetida do mesmo fato quando identidade estável de comando/proveniência não é preservada; P1 para ack/recovery/conflito; P2 para backoff/timeout/observabilidade.

## Caminho 2 — compra/venda comercial composta

1. **Camada:** client offline → envelope composto → RPC Postgres — **CONFIRMED**.
2. **Arquivo:** `src/lib/comercial/animalPurchaseSync.ts`, `src/lib/comercial/commercialOperationSync.ts`, `src/lib/offline/ops.ts`, `supabase/functions/sync-batch/commercial-purchase.ts`, `commercial-operation-v2.ts`, migrations `20260808120000_*` e `20260813134853_*`.
3. **Função:** builders comerciais, `executeCommercialPurchaseOperation`, `executeCommercialOperationV2`, RPCs `apply_individual_animal_purchase` e `apply_commercial_operation_v2`.
4. **Operação:** compra individual e operação comercial v2 de compra/venda.
5. **Entidade/agregado:** animal(is) + Evento comercial + detalhe comercial; venda também altera estado dos animais.
6. **Fonte de verdade:** Evento/detalhe comercial factual; estado animal é projeção corrente; simulação não participa.
7. **Persistência local:** stores dos registros originais e uma `queue_op` composta.
8. **Transaction boundary local:** `createGesture` engloba fila e todos os registros otimistas.
9. **Chamada remota:** um comando `commercial_purchase_v1` ou `commercial_operation_v2` dentro do batch.
10. **Transaction boundary remota:** uma função PL/pgSQL por comando; falhas de constraint revertem o bloco da função — **CONFIRMED**.
11. **Idempotency key:** `client_op_id`, `client_tx_id`, IDs congelados do animal/evento/operação.
12. **Deduplicação:** locks/lookup e fingerprints do trio na compra; snapshot/IDs congelados e replay no RPC v2.
13. **Ack local:** usa o caminho all-applied genérico, portanto herda a janela não atômica entre apagar ops e marcar gesto.
14. **Retry:** mesma operação composta e identidades.
15. **Backoff:** tick genérico de 5 s, máximo 3.
16. **Resposta ambígua:** RPC retorna replay `APPLIED` quando conteúdo/identidade coincidem.
17. **Partial success:** dentro do comando comercial é atômico; operações auxiliares do mesmo gesto podem produzir partial success no batch externo.
18. **Replay:** explicitamente coberto para resposta perdida.
19. **Startup recovery:** herda recovery genérico parcial.
20. **Política de conflito:** RPC retorna `CONFLICT` para conteúdo/identidade/composição divergente; histórico local comercial é preservado para resolução.
21. **Isolamento:** membership no Edge e novamente na RPC; `fazenda_id` é argumento confiável.
22. **Teste:** testes de command, migration, worker, pull e atomicidade comercial — **CONFIRMED**.
23. **Gap:** lifecycle de ack/recovery continua genérico; conflito preservado não possui resolução automática — **CONFIRMED**.
24. **Severidade:** P1 lifecycle/resolução; P2 UX/observabilidade.

## Caminho 3 — Sanitário v2 factual/Agenda/estoque

1. **Camada:** writer sanitário → fila canônica → Edge → RPC interna/ledger — **CONFIRMED**.
2. **Arquivo:** `sanitaryAgendaExecutionV2.ts`, `sanitaryCorrectionV2.ts`, `sanitarioV2Cutover.ts`, `syncWorker.ts`, `sync-batch/sanitario-v2.ts`, migration `20260722102038_*`.
3. **Função:** `executeSanitaryAgendaV2`, `createSanitaryCorrectionV2`, `writeSanitarioV2Queue`, `processSanitarioCanonicalResults`, `executeSanitarioSyncV2Operation`.
4. **Operação:** `create_agenda`, `replace_agenda_animals`, `apply_factual_core`, `close_agenda`; baixa de estoque como companion op.
5. **Entidade/agregado:** Agenda Sanitária v2, alvos, Evento + detalhe + relações Evento–Animal, movimento de estoque.
6. **Fonte de verdade:** Agenda=intenção; Evento/detalhe/relações=fato; estoque depende do fato; conformidade é read model derivado.
7. **Persistência local:** `ops_sanitario_*`, `event_*`, estoque e filas.
8. **Transaction boundary local:** writers incluem fatos, projeção, estoque e filas na mesma transação Dexie — **CONFIRMED**.
9. **Chamada remota:** comando sanitário no `sync-batch`; companion de estoque é operação subsequente dependente.
10. **Transaction boundary remota:** cada comando chama uma RPC PL/pgSQL; factual core e ledger são gravados na mesma transação da função.
11. **Idempotency key:** `client_op_id`, `domain_op_id`, `client_tx_id`, `expected_revision` e fingerprint.
12. **Deduplicação:** `sanitario_sync_v2_operations`, uniques por fazenda/client op e fazenda/kind/domain op, advisory lock e fingerprint.
13. **Ack local:** resultado por operação em transação Dexie com gesto/op/rejeição; applied é removido, retryable permanece, conflito/rejeição é auditado.
14. **Retry:** por operação com estado `RETRYABLE`.
15. **Backoff:** exponencial 5 s até 5 min.
16. **Resposta ambígua:** timeout vira `RETRYABLE`; ledger devolve resultado canônico no replay.
17. **Partial success:** explícito por operação; dependência pode virar `BLOCKED_DEPENDENCY`.
18. **Replay:** identidade e fingerprint preservados; divergência vira conflito.
19. **Startup recovery:** reabre blocked dependencies por trigger de startup; rollout permanece fail-closed.
20. **Política de conflito:** `expected_revision`, status `CONFLICT`, pull/reconcile conservador; branch de correção é conflito explícito.
21. **Isolamento:** membership, papéis por comando, gate por fazenda, validações same-farm e funções internas exclusivas do backend.
22. **Teste:** worker, pull ordenado, cursor, cutover, Edge/RPC contract, produto técnico e dependência de estoque.
23. **Gap:** E2E remoto multi-device continua `PLATFORM_BLOCKED`; recovery de gesto/worker ao redor ainda herda lacunas globais.
24. **Severidade:** P1 para gate remoto/recovery; nenhuma violação P0 sanitária comprovada nesta inspeção.

## Caminho 4 — Reprodução

1. **Camada:** builder de domínio → `createGesture` → batch genérico com validações especiais → pull especializado.
2. **Arquivo:** `src/lib/reproduction/register.ts`, `src/lib/reproduction/remoteSync.ts`, `syncWorker.ts`, `sync-batch/reproduction-diagnosis.ts`, `sync-batch/index.ts`.
3. **Função:** registro reprodutivo, `processGesture`, helpers de dependência/replay e `pullReproductionDiagnosisState`.
4. **Operação:** diagnóstico, parto, aborto, correção, cria e Agendas derivadas.
5. **Entidade/agregado:** Evento base + detalhe reprodutivo + cria/Agenda dependentes.
6. **Fonte de verdade:** Eventos são fatos; PRENHA/VAZIA/DPP são projeções; Agenda neonatal é intenção.
7. **Persistência local:** `event_eventos`, `event_eventos_reproducao`, `state_animais`, `state_agenda_itens`, fila.
8. **Transaction boundary local:** criação usa `createGesture`; pull especializado aplica fatos/projeções/cursor em uma transação.
9. **Chamada remota:** operações genéricas ordenadas no batch.
10. **Transaction boundary remota:** uma mutação por op; dependências são checadas por resultados anteriores e estado remoto, sem transação global do batch.
11. **Idempotency key:** IDs de Evento/detalhe/cria/Agenda + `client_op_id`/`client_tx_id`.
12. **Deduplicação:** replay compara conteúdo canônico do registro de reprodução; dependentes preservam vínculos de nascimento.
13. **Ack local:** reconciliação genérica por operação.
14. **Retry:** missing/retryable permanece com identidade; blocked só é terminal quando a dependência concreta rejeitou/conflitou.
15. **Backoff:** usa o agendamento por operação compartilhado; erro de transporte usa retry genérico.
16. **Resposta ambígua:** replay por mesma identidade/registro.
17. **Partial success:** dependentes recebem `BLOCKED_DEPENDENCY`; worker classifica terminalidade pela operação pai.
18. **Replay:** idêntico é APPLIED; divergente é CONFLICT.
19. **Startup recovery:** pull inicial especializado; recovery de transporte permanece parcial.
20. **Política de conflito:** divergência factual e ramificação de correção são conflitos explícitos; updates genéricos de estado fora desse contrato continuam sem versão.
21. **Isolamento:** queries e comparações incluem `fazenda_id`; Edge/RLS validam membership.
22. **Teste:** `reproductionSyncWorker.test.ts`, `remoteSync.test.ts`, `reproduction-diagnosis.test.ts`.
23. **Gap:** não há transação remota do batch inteiro; recovery `SYNCING`/auth é compartilhado e incompleto.
24. **Severidade:** P1 recovery/atomicidade composta; P2 cobertura E2E remota.

## Caminho 5 — pull padrão e bootstrap

1. **Camada:** Supabase select → snapshot → Dexie.
2. **Arquivo:** `src/lib/offline/pull.ts`, `syncWorker.ts`.
3. **Função:** `pullDataForFarm`, `pullInitialData`, `runInitialOfflinePullForActiveFarmOnce`.
4. **Operação:** fetch por tabela/fazenda e replace/merge local.
5. **Entidade/agregado:** stores padrão de estado, Evento e detalhes.
6. **Fonte de verdade:** remoto para hydrate/reconcile; pendência local é protegida contra overwrite.
7. **Persistência local:** stores `state_*` e `event_*`.
8. **Transaction boundary local:** todos os stores do pull solicitado são escritos em uma transação após todos os fetches passarem.
9. **Chamada remota:** `select('*').eq('fazenda_id', fazenda_id)` por tabela.
10. **Transaction boundary remota:** não há snapshot transacional entre tabelas — **CONFIRMED**.
11. **Idempotency key:** PK local/remota.
12. **Deduplicação:** `bulkPut`; relação Evento–Animal usa append com detecção de colisão divergente.
13. **Ack local:** não aplicável; commit Dexie conclui o pull.
14. **Retry:** pull inicial é tentado novamente a cada tick enquanto não tiver sucesso no processo.
15. **Backoff:** intervalo fixo de 5 s.
16. **Resposta ambígua:** erro em qualquer fetch aborta antes da escrita local.
17. **Partial success:** não grava partial local; o conjunto remoto pode ter sido lido em instantes diferentes.
18. **Replay:** idempotente por PK; Eventos base não são limpos em replace.
19. **Startup recovery:** uma vez por fazenda por processo, após sucesso.
20. **Política de conflito:** rows com operação pendente são preservadas; demais rows remotas vencem no replace/merge.
21. **Isolamento:** queries por fazenda; porém stores são compartilhados e replace limpa o store inteiro, inclusive outras fazendas, antes de repopular a ativa — **CONFIRMED**.
22. **Teste:** `pull.test.ts`, `factualDetailsPull.test.ts`, finance/commercial pull, convergence movement.
23. **Gap:** troca de fazenda pode remover projeção local de outra fazenda; não há snapshot remoto multi-table; sem listener de reconnect dedicado.
24. **Severidade:** P1 para inconsistência recuperável em troca de fazenda; P2 para reconnect/performance.

## Caminho 6 — pulls incrementais sanitário/reprodutivo

1. **Camada:** Supabase incremental → merge transacional + cursor.
2. **Arquivo:** `src/lib/offline/pull.ts`, `src/lib/reproduction/remoteSync.ts`.
3. **Função:** `writeMergeResults`, pulls de catálogo/Agenda/cutover e `pullReproductionDiagnosisState`.
4. **Operação:** `gte(updated_at, cursor)`; tabelas sem `updated_at` fazem full fetch.
5. **Entidade/agregado:** catálogos, Agenda Sanitária v2, factual sanitário ordenado e projeções reprodutivas.
6. **Fonte de verdade:** remoto; conformidade/reprodução são reconstruções locais após fatos.
7. **Persistência local:** stores catalog/ops/event/state + `sync_pull_cursors`.
8. **Transaction boundary local:** dados e cursor são commitados na mesma transação; conformidade só recalcula após commit factual completo.
9. **Chamada remota:** selects globais/tenant/fazenda e cursores por tabela.
10. **Transaction boundary remota:** nenhuma entre múltiplos selects.
11. **Idempotency key:** PK e cursor `(updated_at,id)` persistido; query rebusca o timestamp empatado.
12. **Deduplicação:** bulkPut/append; replay idempotente; divergência Evento–Animal lança erro.
13. **Ack local:** avanço do cursor dentro da transação de apply.
14. **Retry:** nova chamada após erro; cursor anterior permanece.
15. **Backoff:** herdado do chamador; não próprio.
16. **Resposta ambígua:** falha antes/durante apply aborta transação e cursor.
17. **Partial success:** não há commit local parcial no conjunto solicitado.
18. **Replay:** seguro por PK e timestamp inclusivo.
19. **Startup recovery:** `pullInitialData` + pull reprodutivo; após sucesso não há pull periódico para mudanças remotas sem novo trigger/restart.
20. **Política de conflito:** pendentes são protegidos e impedem avanço do cursor na tabela; reprodução recusa fato local divergente.
21. **Isolamento:** cursores por fazenda quando tenant-scoped; catálogos globais/unscoped são compartilhados intencionalmente.
22. **Teste:** cursor incremental, cutover pull, reproduction remote sync e pull de catálogos.
23. **Gap:** ausência de feed/poll periódico geral após o bootstrap; consistência remota multi-select é eventual.
24. **Severidade:** P1 para convergência remota durante sessão longa; P2 para observabilidade/performance.

## Caminho 7 — auth, fazenda e lifecycle do worker

1. **Camada:** React auth/context + localStorage + worker.
2. **Arquivo:** `src/hooks/useAuth.tsx`, `src/components/layout/AppShell.tsx`, `src/lib/storage.ts`, `syncWorker.ts`.
3. **Função:** `refreshSettings`, `setActiveFarm`, `signOut`, `startSyncWorker`, `stopSyncWorker`.
4. **Operação:** login/refresh/logout/troca de fazenda/startup.
5. **Entidade/agregado:** sessão, membership, active farm e todas as filas persistidas no browser.
6. **Fonte de verdade:** GoTrue + `user_fazendas`; active farm remoto/local é preferência, não autorização.
7. **Persistência local:** active farm e `client_id` em localStorage; Dexie único por browser.
8. **Transaction boundary local:** não há transação conjunta entre auth/localStorage/Dexie.
9. **Chamada remota:** auth/session/refresh e membership.
10. **Transaction boundary remota:** chamadas independentes.
11. **Idempotency key:** não aplicável ao auth; fila não contém `user_id` proprietário.
12. **Deduplicação:** não aplicável.
13. **Ack local:** logout remove apenas active farm; não limpa nem congela filas/dados.
14. **Retry:** 401 faz um refresh e um reenvio; demais erros seguem policy do gesto.
15. **Backoff:** ausente para gesto genérico.
16. **Resposta ambígua:** sessão ausente pode virar ERROR não classificado como recuperável.
17. **Partial success:** refresh/settings/context podem completar separadamente.
18. **Replay:** após novo login, worker pode processar toda fila PENDING, independentemente da fazenda ativa.
19. **Startup recovery:** worker só existe dentro do `AppShell` autenticado; recupera subset de ERROR e não `SYNCING`.
20. **Política de conflito:** servidor impede fazenda sem membership; não existe ownership local por usuário para a fila.
21. **Isolamento:** servidor/RLS é forte; isolamento local depende de filtros por `fazenda_id` e do active farm.
22. **Teste:** 403 e recovery 503; não há teste dedicado de logout/login outro usuário ou switch farm com pendência.
23. **Gap:** fila e banco local não são user-scoped; novo usuário membro da mesma fazenda pode enviar pendência criada pela sessão anterior; mudança para usuário sem acesso deixa ERROR sem recovery automático.
24. **Severidade:** P1 para autoridade/lifecycle; nenhum cross-tenant remoto P0 foi comprovado.

## Respostas ao critério de aceite

- **Onde nasce/persiste:** nos writers via `createGesture` ou writers sanitários; fila e estado são atômicos em Dexie — **CONFIRMED**.
- **Quando sincroniza:** somente após resultado remoto aplicado e reconciliação local do gesto; há janela de ack genérico não atômica — **CONFIRMED**.
- **Servidor aplicou e resposta sumiu:** mesma identidade é reenviada; generic/specialized RPCs reconhecem replay — **CONFIRMED** para mesma identidade.
- **Dedup de replay:** PK + IDs persistidos no genérico; ledger/fingerprint no sanitário; fingerprint/snapshot nos RPCs comerciais.
- **Partial success:** vetor de resultados por operação e estados locais separados.
- **Pull/restart:** commit local/cursor atômico; startup/reconnect tem cobertura incompleta de estados e códigos.
- **Conflitos:** explícitos nos domínios especializados; UPDATE genérico é last-write-wins — **CONFIRMED/INFERENCE**.
- **Tenant:** queue rows têm `fazenda_id`; Edge valida membership e força fazenda; Dexie não é user-scoped.
- **Perda/duplicação:** não há perda na criação local atômica; existe risco de a mesma execução originar mais de um fato quando reapresentada sem identidade estável/proveniência, além de recovery local incompleto. Execuções distintas com conteúdo igual não são duplicatas por definição.
