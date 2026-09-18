# F24.2C3A — Durable Post-ACK Reconciliation Audit

Fase: F24.2C3A (diagnóstica — nenhuma fila, store, marker, migration ou mecanismo de retry foi implementado).

Baseline:

```text
branch = main
HEAD == origin/main == def7976df3b61d5160972b0152fe722c907f47f8
ahead = 0, behind = 0
git diff --check = limpo
WORKTREE = AGENTS.md modified only (PREEXISTING_OUT_OF_SCOPE_CHANGE, preservado, não staged)
```

Contratos herdados e não reabertos (F24.2C0/C1/C2/C2.1):

```text
DUPLICATE_EVENT_P0 = NOT_CONFIRMED_AS_SYNC_FAILURE
ACK_ATOMICITY = CONFIRMED_SAFE
SYNCING_RECOVERY_WITH_NON_TERMINAL_OPS = CONFIRMED_SAFE
MULTI_TAB_CONCURRENCY = MITIGATED
ATOMIC_CLAIM = IMPLEMENTED
STALE_WRITE_PROTECTION = IMPLEMENTED
ACTIVE_CLAIM_RECOVERY = PROTECTED
DONE = write acknowledgement local/remoto concluído
DONE != garantia de read model totalmente reconciliado
```

Evidência usada: leitura de `src/lib/offline/syncWorker.ts` (1781 linhas), `src/lib/offline/pull.ts` (1017 linhas), `src/lib/offline/db.ts`, `src/lib/reproduction/remoteSync.ts`, `src/lib/sanitario/compliance/sanitaryComplianceV2.ts`, `src/lib/sanitario/infrastructure/executionBoundary.ts`, `src/hooks/useAuth.tsx`, `src/components/layout/AppShell.tsx`, superfícies de página (`Dashboard.tsx`, `Insumos.tsx`, `Agenda/index.tsx`, `ProtocolosSanitarios/helpers/useProtocolosData.ts`, `Agenda/createAgendaActionController.ts`), `docs/technical/OFFLINE_SYNC.md` e suites de teste focadas executadas.

Convenção de evidência: **FATO CONFIRMADO** = observado no código/teste; **INFERÊNCIA** = dedução de código observado; **RECOMENDAÇÃO** = proposta para C3B.

---

## 1. POST-ACK FLOW INVENTORY

Todo caminho listado ocorre após o commit do ACK (`queue_gestures.status = DONE` ou equivalente terminal) ou é parte do fluxo de reconciliação pós-resposta do `sync-batch`.

### 1.1 Caminhos dentro do worker (pós-ACK imediato)

| # | Caminho | Arquivo / função | Disparador | Antes/depois de DONE | Rede | Retry durável | Cursor | Startup recupera | Reconnect recupera | Fazenda | Usuário | Idempotente | Falha | Teste |
|---|---------|------------------|-----------|----------------------|------|---------------|--------|------------------|--------------------|---------|---------|-------------|-------|-------|
| P1 | Post-sync refresh pull (tabelas afetadas) | `syncWorker.ts` `processGesture` → `pullDataForFarm(refreshTables)` (linhas ~1337–1445) | resultado `allApplied` do `sync-batch` | DONE é commitado primeiro; pull depois | sim | NÃO — `catch` → `console.warn` | NÃO (pull full por tabela) | sim (via `pullInitialData`, fazenda ativa) | NÃO (nenhum listener dispara pull) | `gesture.fazenda_id` | indireto (RLS) | sim (bulkPut) | engolida | `syncWorkerAtomicAck.test.ts`, `pull.test.ts` |
| P2 | Reproduction diagnosis pull pós-ACK | `syncWorker.ts` → `pullReproductionDiagnosisState` (`reproduction/remoteSync.ts`) | op de `eventos_reproducao` (diagnóstico/parto/aborto) aplicada | depois de DONE | sim | NÃO — `catch` → warn | SIM (`reproduction_diagnosis:...`, persistido em `sync_pull_cursors`) | sim (chamado em `pullInitialData`) | NÃO | `fazenda_id` | indireto | sim (bulkPut + append-only + transação) | engolida | `reproductionSyncWorker.test.ts` |
| P3 | Agenda v2 pull pós-ACK | `syncWorker.ts` → `pullSanitarioAgendaV2` | tabelas sanitario agenda v2 tocadas | depois de DONE | sim | NÃO — warn | SIM (cursor por fazenda) | sim (via cutover pull) | NÃO | `fazenda_id` | indireto | sim (merge + cursor bloqueado se pending) | engolida | `sanitarioIncrementalPullCursor.test.ts` |
| P4 | Sanitário v2 ordered reconcile pós-canonical results | `processSanitarioCanonicalResults` → `reconcileSanitarioV2Results` → `pullSanitarioV2CutoverState` + `recoverBlockedSanitarioV2Operations` | resultados APPLIED/CONFLICT sanitário v2 | ACK terminal dentro da transação; pull fora dela | sim | NÃO — warn | SIM (cursor por tabela/fazenda) | sim (cutover no initial pull) | NÃO | `fazenda_id` | indireto | sim (ordem fixa, merge append-only) | engolida | `sanitarioV2PullCutover.test.ts` |
| P5 | Mixed-result reconcile (rollback/reapply + pulls) | `reconcileGenericOperationResults` | rejeições/parcial no batch | DONE/REJECTED commitado antes dos pulls | sim | NÃO — warn | NÃO (pullDataForFarm full) | sim (replace no startup) | NÃO | `gesture.fazenda_id` | indireto | sim | engolida | `sync_rollback_retry.flow.test.ts` |
| P6 | Agenda reconciliation pull (`agenda_already_completed`) | `reconcileGenericOperationResults` / branch de rejeição | rejeição `agenda_already_completed_by_event` | depois de terminal | sim | NÃO — warn | NÃO | sim | NÃO | `fazenda_id` | indireto | sim | engolida | `agenda_registrar_estado.flow.test.ts` |
| P7 | Closure partial-success pull | branch `isAgendaClosureOnlyGesture` | parcial em closures v2 | depois de terminal | sim | NÃO — warn | SIM (agenda v2) | sim | NÃO | `fazenda_id` | indireto | sim | engolida | `sanitarioAgendaV2Sync.test.ts` |

### 1.2 Caminhos fora do worker (fronteira de execução e UX)

| # | Caminho | Arquivo | Disparador | Antes/depois de DONE | Rede | Retry durável | Falha | Categoria |
|---|---------|---------|-----------|----------------------|------|---------------|-------|-----------|
| F1 | Refresh pós-conclusão sanitária direta | `executionBoundary.ts` (`executeSanitaryCompletion`) | conclusão de pendência com evento | após write local + enqueue (ANTES do ACK); pull de estado depois | sim | NÃO — mas falha é **propagada** como status `handled_refresh_failed` (melhor da classe) | propagada ao caller | B |
| F2 | Pull pós-criação de agenda com evento | `createAgendaActionController.ts` (linha ~107) | conclusão direta na agenda | após enqueue (ANTES do ACK) | sim | NÃO — try/catch local | engolida com mensagem de UI parcial | B |
| F3 | Bootstrap do Registrar | `Registrar/effects/bootstrap.ts` | montagem da tela | independente de ACK | sim | NÃO | engolido pelo caller | C |
| F4 | Dashboard agenda_itens pull | `Dashboard.tsx` (linha ~113, mode=merge) | troca de fazenda ativa | independente de ACK | sim | NÃO — warn | engolido | C |
| F5 | Insumos event pull | `Insumos.tsx` (linha ~569, mode=merge) | montagem/fazenda | independente de ACK | sim | NÃO | engolido | C |
| F6 | Agenda / Protocolos refresh manual | `Agenda/index.tsx` (~119, ~359), `useProtocolosData.ts` | ação do usuário / refresh | independente de ACK | sim | NÃO — estado de erro exposto na UI | propagado ao estado de UI | C |

### 1.3 Startup

**FATO CONFIRMADO** — `runInitialOfflinePullForActiveFarmOnce` (`syncWorker.ts` linhas 266–287):

- Executa em `startSyncWorker()` (AppShell mount) e a cada tick (5s) enquanto `initialPullFarmId !== activeFarmId`.
- `pullInitialData(fazenda)` = `pullDataForFarm(DEFAULT_REMOTE_TABLES, replace)` + `pullSanitarioProductClassV2Catalog` + `pullSanitarioTechnicalCatalogV2` + `pullSanitarioProtocolCatalogV2` + `pullSanitarioV2CutoverState` + `pullReproductionDiagnosisState`.
- **Somente a fazenda ativa** (`getActiveFarmId()`).
- Memoização **em memória** (`initialPullFarmId`): após o primeiro sucesso por fazenda por sessão do worker, não roda de novo.
- Falha é engolida (`console.warn`), mas `initialPullFarmId` permanece unset → o próximo tick retenta (FATO CONFIRMADO pela lógica de guarda).
- Cobertura de tabelas: `DEFAULT_REMOTE_TABLES` inclui núcleo factual (`eventos`, `eventos_sanitario`, detalhes padrão, `eventos_comercial`, `eventos_nutricao`, `eventos_pasto_avaliacao`, `insumo_*`, `animais`, `lotes`, `pastos`, `agenda_itens`, `contrapartes`, `sociedades_pecuarias`, `sociedade_animais`, `finance_categories`, `finance_transactions`) + catálogos sanitários v2 + estado cutover + reprodução.

---

## 2. CATEGORIZAÇÃO A/B/C

### A — necessário para correção factual

Sem estes, o local pode ficar objetivamente incorreto em relação ao fato remoto:

- **P1** (post-sync refresh): triggers remotos alteram eventos/agenda server-side após APPLIED; o `refreshTables` reflete isso no núcleo factual local.
- **P4** (sanitário v2 ordered reconcile): estado canônico de agenda v2/closures/eventos sanitários após APPLIED/CONFLICT.
- **P5/P6/P7**: reconciliação pós-conflito — fato remoto divergente do otimismo local (rollback/reapply + pulls de agenda/eventos).
- **F1**: refresh pós-conclusão sanitária direta (evento + agenda mudam no servidor).

**FATO CONFIRMADO**: em todos esses casos a falha é tratada como não-fatal (warn ou status `handled_refresh_failed`) e **nenhuma obrigação durável é registrada**.

### B — necessário apenas para read model derivado

O fato já está correto (local otimista + remoto APPLIED); a projeção pode ficar stale:

- **P2** (reprodução): reconstrói projeção reprodutiva e payload de `state_animais`.
- **P3** (agenda v2 read models).
- **F2** (UI feedback pós-enqueue).

### C — refresh oportunista

- **F3–F6**: pulls de página (Dashboard, Insumos, Agenda, Protocolos, bootstrap do Registrar).
- Recompute de compliance (`recomputeSanitaryComplianceAfterPullV2`): **FATO CONFIRMADO** que o read model de conformidade NÃO é persistido — `buildSanitaryComplianceV2` é recomputado on-demand nos painéis (`SanitaryCompliancePanelV2`, `SanitaryLotSummaryPanelV2`, `SanitaryAnimalSummaryPanelV2`). Logo, recalcular "após pull" é um refino; a ausência não persiste estado falso.

**Não tratar P1–P4 como equivalentes a F4–F6**: a diferença é entre "fato local divergente do remoto" e "leitura desatualizada mas reconvergente por recompute/refresh".

---

## 3. STARTUP RECOVERY ANALYSIS

Pergunta do enunciado: startup pull cobre o dado — sempre? somente fazenda ativa? somente algumas tabelas?

**FATO CONFIRMADO**:

1. Startup cobre **somente a fazenda ativa** (`getActiveFarmId()`).
2. Para a fazenda ativa, a cobertura de tabelas é ampla (núcleo factual completo + catálogos + cutover + reprodução).
3. `pullDataForFarm` (tabelas DEFAULT) **não usa cursor** — é full fetch + replace a cada execução; portanto, sempre reconverge a fazenda ativa no startup, sem depender de cursor.
4. Pulls cursor-based (`pullSanitarioV2CutoverState`, `pullReproductionDiagnosisState`) sobrevivem a restart (cursor em `sync_pull_cursors`, Dexie) e usam `gte(updated_at, cursor)` com refetch de empates — sem perda de janela.
5. A memoização `initialPullFarmId` é **volátil**: ela impede reexecução dentro da sessão, mas não persiste nada entre sessões.
6. **Reconnect**: não existe listener `online` que dispare pull ou tick imediato. Os listeners existentes (`OfflineIndicator`, `TopBar`, `Admin`) são apenas de UI. A retomada pós-reconnect depende do intervalo de 5s do worker continuar rodando (página aberta).

**Diferença central (seção 7 do enunciado)**:

```text
"eventualmente, ao abrir aquela fazenda, talvez atualize"
= COMPORTAMENTO ATUAL para fazenda não ativa e para falha pós-ACK dentro da sessão

"existe uma obrigação persistida que será necessariamente retomada"
= NÃO EXISTE para nenhum caminho pós-ACK
```

---

## 4. FARM/USER ISOLATION

**FATO CONFIRMADO**:

- Todo pull filtra por `fazenda_id` (`.eq("fazenda_id", ...)` ou cursor com `fazenda_id` na chave); RLS server-side como barreira primária.
- Cursor `sync_pull_cursors` tem chave `remote_table:scope:fazenda_id` e índice `[remote_table+fazenda_id]`.
- `pullDataForFarm` replace-mode limpa e reescreve as stores da fazenda ativa; proteção de pending (`protectPendingFactualRows` / `protectPendingRecordRows`) impede sobrescrever fatos locais não sincronizados.
- Teste `factualDetailsPull.test.ts` "keeps another farm's factual details out of the active Dexie projection" prova isolamento entre fazendas no pull replace.
- Troca de fazenda (`useAuth.setActiveFarm`): atualiza estado + localStorage; o worker reexecuta o initial pull para a nova fazenda no próximo tick (guarda `initialPullFarmId !== activeFarmId`). Nenhuma obrigação da fazenda anterior é persistida.
- Logout (`useAuth.signOut`): `removeActiveFarmId()`; **FATO CONFIRMADO que não há `db.delete()`/limpeza de Dexie no logout**. Os dados locais persistem no device; ao logar novamente, o initial pull da fazenda resolvida em replace-mode sobrescreve as stores padrão da fazenda ativa. INFERÊNCIA: resíduo de dados de outra fazenda/usuário permanece em IndexedDB até o replace (cache local, protegido por RLS no acesso remoto) — observação fora do escopo desta fase, registrada como risco P2/informativo.

**Veredito de isolamento**: SAFE para o mecanismo de reconciliation em si (escopo por fazenda correto e testado); resíduo local pós-logout é cache, não nova fonte de verdade.

---

## 5. EXISTING DURABLE PRIMITIVES

Inventário de mecanismos equivalentes a dirty/stale/needs_pull/cursor/checkpoint:

| Primitive | Persistência | Escopo | Uso atual | Serve como obrigação de pull? |
|-----------|--------------|--------|-----------|-------------------------------|
| `sync_pull_cursors` (Dexie v26) | durável | tabela + scope + fazenda | pulls sanitários v2, cutover, reprodução | NÃO — registra "puxado até X", não "precisa puxar" |
| `sync_sanitario_v2_cutovers` (Dexie v28) | durável | fazenda + contract_version | cutover sanitário v2 resumível | parcial — resumo de cutover, não obrigação genérica |
| `queue_gestures` / `queue_ops` / `queue_rejections` | durável | gesture/op | fila de SAÍDA (push) | não cobrem pull |
| `initialPullFarmId` (memória) | volátil | fazenda ativa | memo do initial pull | NÃO — morre no crash |
| `PURGE_LS_KEY` (localStorage) | durável | global | throttle de purge | não aplicável |
| Listeners `online` | — | UI | indicador visual | não dispara sync |

```text
EXISTING_DURABLE_RECONCILIATION_PRIMITIVE = PARTIAL
```

Justificativa: existe infraestrutura durável de cursor e de cutover resumível (que já dá retenção de posição de leitura por fazenda/tabela através de restart), mas **não existe nenhuma primitive que registre obrigação de reconciliation pendente** (needs_pull/dirty marker). A memoização do initial pull é volátil.

---

## 6. CLASSIFICATION

```text
POST_ACK_RECONCILIATION_DURABILITY = PARTIAL
STARTUP_RECOVERY_COVERAGE = PARTIAL
RECONCILIATION_SCOPE_ISOLATION = SAFE
```

- `POST_ACK_RECONCILIATION_DURABILITY = PARTIAL`: todos os pulls pós-ACK são fire-and-forget; a convergência é garantida apenas por reconstrução (startup replace para a fazenda ativa) e não por obrigação persistida. Nenhum caminho pós-ACK registra e retoma obrigação.
- `STARTUP_RECOVERY_COVERAGE = PARTIAL`: cobre a fazenda ativa de forma ampla (replace full + cursor-based), mas não cobre fazendas não ativas e não existe gatilho de reconnect; a memoização volátil impede re-cobertura dentro da sessão após um pull pós-ACK falho.
- `RECONCILIATION_SCOPE_ISOLATION = SAFE`: escopo por fazenda consistente em todos os caminhos (query, cursor, replace), RLS como barreira primária, testes de isolamento presentes.

---

## 7. CONFIRMED GAPS

1. **GAP-1 (P1)** — Obrigação de pull pós-ACK não é persistida: falha de pull após DONE é engolida (warn) e não há retry dentro da sessão; convergência depende de restart/reload ou reentrada na fazenda (R1, R5, R6).
2. **GAP-2 (P1)** — Fazenda não ativa não converge sem ação: a obrigação de reconcile da fazenda A é abandonada in-session quando o usuário troca para B; só há recuperação quando A volta a ser ativa (R7).
3. **GAP-3 (P2)** — Nenhum gatilho de reconnect: `online` não dispara pull/tick; retomada pós-reconnect depende do intervalo de 5s com página aberta (R5).
4. **GAP-4 (P2)** — Memoização volátil do initial pull: dentro de uma sessão longa, um initial pull bem-sucedido antigo + pull pós-ACK falho = staleness até restart (interação com R1/R2).

Nenhum gap qualifica como P0: o fato histórico não é derivado de estado local (remoto é a fonte), `pullInitialData` replace reconstrói o núcleo factual da fazenda ativa no restart, e a proteção de pending impede perda de fatos locais não sincronizados. Os gaps afetam janela de stale e convergência, não correção factual permanente.

---

## 8. SEVERITY

```text
P1: GAP-1, GAP-2 (obrigação perdida após restart/crash; farm não converge sem ação manual)
P2: GAP-3, GAP-4 (latência de convergência, refresh oportunista, resíduo local pós-logout — informativo)
P0: nenhum confirmado
```

---

## 9. PATCH OPTIONS (para C3B — nada implementado nesta fase)

### Opção A — Reutilizar primitivas existentes (farm-level)

Tornar durável o marcador de sucesso do initial pull (linha em `sync_pull_cursors` ou chave localStorage por fazenda) e: (i) falha de pull pós-ACK limpa/marca o marcador da fazenda, fazendo o tick existente reexecutar `pullInitialData` da fazenda ativa; (ii) listener `online` chama o mesmo caminho de retomada.

- persistência: linha em store Dexie existente ou localStorage;
- granularidade: fazenda inteira (coarse);
- recovery: startup + reconnect + tick (já existentes);
- idempotência: replace pull é idempotente;
- farm/user scope: por fazenda;
- impacto Dexie: nenhum schema novo (se localStorage) ou nova linha em store existente;
- mobile: compatível (sem dependência de background);
- complexidade: baixa;
- risco de nova fonte de verdade: baixo (metadata de sync, não dado de domínio);
- custo: re-pull replace completo mais frequente (banda/CPU).

### Opção B — Marker durável por fazenda/superfície

Nova store Dexie pequena (`sync_reconcile_obligations`: fazenda + superfície, ex. `agenda_v2`, `reproduction`, `factual:<tabelas>`), escrita quando o pull pós-ACK falha (ou antes dele), limpa no sucesso; tick drena marcadores da fazenda ativa.

- persistência: Dexie (nova store → bump de versão);
- granularidade: fazenda + superfície;
- recovery: startup + tick; requer hook de reconnect para retomada imediata;
- idempotência: marcador é upsert; pull idempotente;
- farm/user scope: por fazenda;
- impacto Dexie: migration local v30;
- mobile: compatível;
- complexidade: média;
- risco de nova fonte de verdade: baixo se restrito a metadata de sync.

### Opção C — Fila dedicada de reconciliation

Fila de obrigações por linha (fazenda, tabelas, motivo, tentativas, backoff), drenada por tick/startup/reconnect com telemetria.

- persistência: Dexie;
- granularidade: por obrigação;
- recovery: completa, observável;
- idempotência: dedup por chave de obrigação;
- farm/user scope: por fazenda;
- impacto Dexie: migration + lógica de retry/backoff nova;
- mobile: compatível;
- complexidade: alta;
- risco de nova fonte de verdade: maior superfície de estado a manter.

### RECOMMENDED C3B PATCH

```text
RECOMENDAÇÃO = Opção A (reutilizar primitivas), com upgrade local para Opção B somente se a auditoria de custo do replace full rejeitá-la.
```

Restrição contratual registrada para C3B (decisão arquitetural desta auditoria):

```text
C3B must persist reconciliation obligation before
the post-ACK process can be lost.
```

O nome final da store/schema não é definido nesta execução.

Justificativa: é o menor mecanismo durável que satisfaz o contrato da seção 16 (obrigação persistida + retomada em startup/reconnect), reutiliza o tick e o initial pull já validados, não cria fonte de verdade de domínio (metadata de sync apenas) e funciona sem background contínuo (seção 11). A convergência por replace full já é o caminho testado do startup; torná-la a resposta a falha pós-ACK remove GAP-1/GAP-2 para a fazenda ativa e reduz GAP-2 ao custo de reentrada (ou exige o upgrade B para fazendas não ativas).

---

## 10. TEST COVERAGE

Suites focadas executadas (FATO CONFIRMADO — resultado observado):

```text
pnpm exec vitest run <10 arquivos de teste>
Test Files 20 passed (20)   [execução duplicada src + .kilo worktree pelo glob do runner]
Tests 104 passed (104)
```

Arquivos: `syncWorkerInitialPull`, `syncWorkerRecovery`, `pull`, `sanitarioIncrementalPullCursor`, `syncWorkerAtomicAck`, `reproductionSyncWorker`, `factualDetailsPull`, `financePull`, `commercialPurchasePull`, `sanitarioV2PullCutover`.

PROVES / DOES_NOT_PROVE:

| Suite | PROVES | DOES_NOT_PROVE |
|-------|--------|----------------|
| `syncWorkerInitialPull` | initial pull executa para fazenda ativa, não executa sem fazenda, idempotente por fazenda no processo | recuperação de fazenda não ativa; retry após falha de pull pós-ACK |
| `syncWorkerRecovery` | requeue de erro transitório (503), não-requeue de validação/403, recuperação de SYNCING com trabalho não-terminal, fail-closed com ops terminais | retry de pull pós-ACK (não existe) |
| `pull` | abort fail-fast em erro de fetch; escrita atômica em transação única | retomada de pull falho |
| `sanitarioIncrementalPullCursor` | cursor full→incremental por tabela/escopo, separação global/tenant, tombstones | cursor para tabelas DEFAULT (não usam cursor) |
| `syncWorkerAtomicAck` | ACK atômico (ops + audit + DONE), recuperação de SYNCING sem novo evento, rollback do ACK | reconciliação pós-ACK durável |
| `reproductionSyncWorker` | pull/reconcile de diagnóstico após APPLIED, rollback de fato bloqueado | retry durável do pull de diagnóstico |
| `factualDetailsPull` | reconstrução de detalhes factuais no replace, proteção de pending, isolamento entre fazendas | merge incremental para tabelas DEFAULT |
| `financePull` / `commercialPurchasePull` | proteção de pending financeiro/comercial, sem escrita parcial | — |
| `sanitarioV2PullCutover` | merge append-only idempotente, sem estado parcial nem recompute quando fonte falha | — |

Cobertura ausente (gap de teste, não de produto): nenhum teste provoca falha de pull pós-ACK e verifica retomada posterior — coerente com GAP-1 (o mecanismo não existe, logo não é testado).

---

## 11. RESPOSTAS AOS CRITÉRIOS DE ACEITE

1. **Quais reconciliações realmente são necessárias pós-ACK?** P1–P4 (refresh factual pós-trigger remoto, cutover sanitário v2, reconciliação de conflitos/agenda) e F1 — categoria A.
2. **Quais são apenas refresh oportunista?** F3–F6 e o recompute de compliance (read model não persistido) — categoria C.
3. **Quais sobrevivem a crash/restart?** Nenhuma por obrigação própria; o initial pull da fazenda ativa reconstrói (replace full) e os cursores sanitário v2/reprodução preservam posição de leitura.
4. **Quais dependem apenas do processo continuar vivo?** Todos os pulls pós-ACK (P1–P7, F1–F6) e a memoização `initialPullFarmId`.
5. **Startup pull cobre todos os casos?** Não — cobre a fazenda ativa (amplamente); não cobre fazendas não ativas, não cobre retomada in-session de pull falho, e não há gatilho de reconnect.
6. **Existe primitive durável reutilizável?** PARTIAL — `sync_pull_cursors` e `sync_sanitario_v2_cutovers` são duráveis, mas registram posição/cutover, não obrigação; não existe needs_pull/dirty marker.
7. **Existe gap por fazenda/usuário?** Sim — GAP-2 (fazenda não ativa). Por usuário: isolamento correto nos mecanismos; resíduo local pós-logout é cache informativo (P2).
8. **A reconciliation é idempotente?** Sim — bulkPut/merge append-only, cursor com refetch de empates, recompute puro; provado por testes (sanitarioV2PullCutover, sanitarioIncrementalPullCursor, pull).
9. **Qual é o menor mecanismo durável necessário?** Marcador durável de "initial pull pendente por fazenda" reutilizando tick + initial pull (Opção A).
10. **É possível resolver sem criar nova fonte de verdade?** Sim — todas as opções usam apenas metadata de sync; o fato continua vindo de Eventos remotos e o núcleo factual local é reconstruído por pull.

---

## 12. VALIDATION EXECUTED

```text
git fetch origin / git status -sb / rev-parse / diff --check  = OK (baseline confirmado)
pnpm exec vitest run <10 suites focadas>                       = 20 files / 104 tests PASSED (observado)

GATE DOCUMENTAL LOCAL (closeout):

LOCAL_DOC_GATE = FAILED_BY_PREEXISTING_OUT_OF_SCOPE_CHANGE

pnpm run gates:docs                                            = FAILED (FATO CONFIRMADO)
Causa atribuída                                                = AGENTS.md preexisting/out-of-scope dispatcher
                                                                 contract change (3 falhas, todas em AGENTS.md)
validate_docs_headers.sh                                       = PASS
validate_docs_continuity.sh                                    = PASS
Falha NÃO registrada como PASS; gate definitivo = CI do PR sobre o estado commitado.
git diff --check                                               = executado após escrita (ver entrega final)
```

Não executado (não aplicável — nenhum runtime alterado): lint/build/E2E e qualquer operação Supabase.
