# F24.4E — Conflict Resolution Contract

Atualizado em: 2026-10-03

## Estado operacional atual

`F24_4E = IN_PROGRESS`; `F24_4E1 = INTEGRATED` pelo PR #173;
`F24_4E2_ANIMAL_TO_LOTE = CLOSED`; `G3_ANIMAL_TO_LOTE = RESOLVED`.
A [seção 18 da F24.4E2](./F24_4E2_MOVEMENT_EVENT_STATE_CONVERGENCE.md#18-closure-remediation--recertification--b1m1m2m3)
é a referência certificada para Animal→Lote: writer especializado ativo, fronteira genérica
bloqueada, identidade de resposta, proteção RECONCILE e barreira de geração no pull.
Lote→Pasto/occupancy e demais contratos fora dessa vertical continuam não certificados.
Próximo passo dessa entrega: review final do diff, push/PR autorizado e merge/rebaseline.

> **HISTORICAL_CORRECT / SUPERSEDED:** as seções 1–13 abaixo preservam a execução de
> characterization/E1 em 01/10/2026, suas matrizes e evidências. READY_FOR_REVIEW da E1,
> G3 DEFERRED e abertura futura de E2 descrevem aquele baseline, não o estado atual.
> Não generalizar o gate Animal→Lote para F24.4E inteira.

## 1. Decisão

```ini
F24_4E = IN_PROGRESS
CHARACTERIZATION = READY_FOR_REVIEW
F24_4E1 = READY_FOR_REVIEW
F24_4 = IN_PROGRESS

RUNTIME_CHANGE = YES
SCHEMA_CHANGE = 0
MIGRATION_CHANGE = 0
RLS_CHANGE = 0
REMOTE_DOMAIN_CHANGE = 0

AUTO_MERGE = NOT_AUTHORIZED
```

A primeira execução da F24.4E estabeleceu a characterization e o contrato. A subfase F24.4E1 implementou exclusivamente o CAS de `DELETE animais`, sem resolução genérica de conflitos.
O objetivo permanece separar replay, conflito de estado, fatos concorrentes, duplicidade humana, tombstone e conflitos cross-domain sem criar uma nova fonte de verdade.

## 2. Baseline e rebaseline

Baseline esperado ao iniciar a tarefa: `main@79d2a8fce0de08583ead1b8a5bee0e1b43865cae` (merge PR #170).

Baseline remoto efetivamente observado antes deste patch:

```text
repository: maresdeandrade/RebanhoSync
branch canônica: main
origin/main: 4bfae54612be67ef5bb2502e4d79862c3517baf9
branch de characterization: feat/f24-4e-conflict-resolution-contract
base da branch: 4bfae54612be67ef5bb2502e4d79862c3517baf9
worktree local: NOT_OBSERVABLE_FROM_GITHUB_CONNECTOR
```

A `main` avançou 12 commits após `79d2a8f...`. O compare remoto mostrou alterações somente em `.fallowrc.json`, evidence/publisher do Sanitário v2, scripts Codex e testes do publisher. Não houve delta em `src/lib/offline/**`, `supabase/functions/sync-batch/**`, migrations/RLS ou contratos F24.4. Portanto a F24.4E foi rebaselineada sobre `4bfae546...` sem reabrir a F24.4D.

## 3. Contratos herdados preservados

- `UPDATE animais`: `STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS`.
- `expected_revision` é capturada antes da mutação otimista, persistida e reutilizada em retry/reload.
- replay da mesma identidade é resolvido antes da validação stale.
- `STATE_REVISION_CONFLICT` é terminal, `retryable=false`, sem retry automático.
- após conflito stale: pull/reconciliation → novo snapshot → nova intenção → nova operação/identidade/revisão esperada.
- `LOST_ACK_REPLAY = PROVEN` e `REPLAY_IDEMPOTENCY = PROVEN` no escopo de `UPDATE animais`.
- `FARM_SWITCH_CROSS_DEVICE = PROVEN` e `MULTI_TENANT_FARM_ISOLATION = PROVEN`.
- `STATE_CAS_CLOCK_INDEPENDENCE = PROVEN`.
- `CLOCK_SKEW_BEHAVIOR = CHARACTERIZED_FOR_CRITICAL_SYNC_PATHS`.

Esses contratos não são generalizados automaticamente para outros `state_*` ou todos os Eventos. A única ampliação certificada nesta fase é `DELETE animais`, coberta pela F24.4E1 com o mesmo `SERVER_REVISION_CAS`.

## 4. Fontes de verdade por domínio

| Domínio | HISTORICAL_SOURCE_OF_TRUTH | CURRENT_STATE_SOURCE_OF_TRUTH | CONFLICT_DETECTION_SOURCE | IDEMPOTENCY_IDENTITY | REVISION_OR_VERSION_AUTHORITY | RECONCILIATION_SOURCE | Evidência |
|---|---|---|---|---|---|---|---|
| animais/state update | Eventos + detalhes quando a alteração representar fato; estado não substitui histórico | `animais` remoto / `state_animais` local | CAS no `sync-batch` por PK + `fazenda_id` + `revision` | `client_op_id` + `client_tx_id` + PK | `animais.revision` no PostgreSQL | obligation durável + `pullDataForFarm` | PROVEN |
| movimentação/eventos | `eventos` + `eventos_movimentacao` | `state_animais.lote_id/pasto_id`, `state_lotes`/`state_pastos` e read models de occupancy | identidade/PK, `source_task_id` quando existe, anti-teleporte no mesmo tx; CAS somente no UPDATE de `animais` | `event_id`, tx/op; `source_task_id` opcional | fato: `occurred_at`; state animal: revision quando UPDATE protegido | pull factual + state/pipeline de occupancy | PARTIAL |
| peso | `eventos` + `eventos_pesagem` | não existe peso atual confiável universal; última pesagem observada é derivação | PK/op/source task quando existe; selector detecta empate factual mais recente | `event_id`, tx/op; `source_task_id` opcional | tempo factual `occurred_at`; sem revision própria do fato | pull de Eventos/detalhes + selector factual | PARTIAL |
| reprodução | `eventos` + `eventos_reproducao` | projeção reprodutiva/read model reconstruído dos fatos | identidade do Evento, dependências de episódio/branch e validação de conteúdo em replay | `event_id`, tx/op, vínculos de episódio/birth/correção | precedência factual por `occurred_at` + regras do domínio; não é CAS genérico | pull reprodutivo especializado + rebuild | PARTIAL |
| sanitário v2 | Evento + detalhe + Evento–Animal; histórico externo mantém sua própria proveniência | Agenda sanitária v2 para intenção; conformidade é derivada | ledger/fingerprint/domain op + `expected_revision` nas mutações de Agenda | `client_op_id`, `client_tx_id`, `domain_op_id`, fingerprint | revision da Agenda no PostgreSQL | cutover pull/reconcile + ledger | PARTIAL |
| comercial | Evento + detalhe comercial | estado corrente de `animais`; simulação não é fato | RPC transacional, advisory lock, snapshot/estado elegível e fingerprint | `operation_id`, tx/op e IDs congelados | estado/locks autoritativos no PostgreSQL; sem revision genérica universal | ACK + pull genérico | PARTIAL |
| financeiro | Evento financeiro + `finance_transactions` e vínculos/reversões | read models financeiros; categorias/config permanecem estado/config | PK/op, FKs, unique de reversão e constraints; update genérico sem CAS | UUID/event ID/tx/op; `source_event_id`; `reverses_transaction_id` quando aplicável | sem revision genérica para updates de configuração | pull factual/genérico | PARTIAL |
| delete/tombstone de `animais` | tombstone é estado atual; não substitui Evento/correção factual quando o domínio exigir histórico | `animais.deleted_at` remoto / `state_animais` local | CAS por PK + `fazenda_id` + `revision` | `client_op_id` + `client_tx_id` + PK | `animais.revision` no PostgreSQL | pull inclui tombstone; stale DELETE reconcilia com snapshot remoto | PROVEN |
| generic `state_*` relevantes | Evento do domínio quando houver; caso contrário não há histórico implícito | tabela remota base + store `state_*` | constraints/PK; revision policy atual protege somente `animais/UPDATE|DELETE` | tx/op + PK | não definida transversalmente | pull genérico | GAP |

## 5. Matriz de conflitos

| Domínio | Operação | Classe | Detectado onde | Fonte de verdade | Comportamento atual | Política recomendada | Auto-merge? | Reconciliation? | Nova operação? | Auditabilidade | Evidência |
|---|---|---|---|---|---|---|---|---|---|---|---|
| animais | UPDATE stale | STALE_STATE_WRITE | Edge/PostgreSQL CAS | `animais.revision` | `CONFLICT / STATE_REVISION_CONFLICT`, terminal | RECONCILE_THEN_NEW_INTENT | não | sim | sim | operation result + rejection + obligation | PROVEN |
| animais | replay de UPDATE | REPLAY_SAME_IDENTITY | lookup de identidade antes do CAS | operação persistida + row remota | retorna aplicado sem segunda mutação | RETRY_SAME_IDENTITY | não | após ACK/pull | não | tx/op + resultado | PROVEN |
| animais | dois UPDATEs same-revision | CONCURRENT_FIELD_CHANGES | CAS | revisão remota | primeiro válido aplica; segundo conflita | RECONCILE_THEN_NEW_INTENT | não | sim | sim | conflito explícito | PARTIAL |
| animais | DELETE stale após UPDATE ou UPDATE stale após DELETE | DELETE_VS_UPDATE | Edge/PostgreSQL CAS | `animais.revision` + tombstone | a primeira mutação válida avança revision; a segunda com snapshot stale retorna `STATE_REVISION_CONFLICT` | RECONCILE_THEN_NEW_INTENT | não | sim | sim | tx/op + expected/current revision + rejection | PROVEN |
| generic state | UPDATE stale | STALE_STATE_WRITE | não detectado transversalmente | state remoto | UPDATE fora de `animais` usa PK + fazenda sem CAS | UNDEFINED_GAP | não | pull converge ao vencedor remoto, não à intenção perdida | indefinido | resultado técnico sem stale reason | GAP |
| generic state | campos concorrentes | CONCURRENT_FIELD_CHANGES | não detectado | state remoto | ordem de aplicação pode perder intenção | UNDEFINED_GAP | não | parcial | indefinido | parcial | GAP |
| generic state | DELETE/UPDATE | DELETE_VS_UPDATE | não detectado | row/tombstone remoto | DELETE soft e UPDATE não têm contrato transversal de revisão | UNDEFINED_GAP | não | parcial | indefinido | parcial | GAP |
| movimentação | replay mesma identidade | REPLAY_SAME_IDENTITY | PK/op/tx | Evento + detalhe | mesma operação persistida não deve criar novo fato | RETRY_SAME_IDENTITY | não | sim se resposta ambígua | não | identidade técnica | PROVEN |
| movimentação | dois fatos distintos | DISTINCT_VALID_EVENTS | IDs factuais distintos | Eventos | ambos são preservados; conteúdo igual não é dedup | PRESERVE_BOTH | não | pull factual | não | Eventos permanentes | PARTIAL |
| movimentação ad hoc | mesmo fato lançado duas vezes | DUPLICATE_HUMAN_ACTION | não há causa compartilhada universal | Eventos | indistinguível de dois fatos legítimos | USER_RESOLUTION_REQUIRED | não | sim | somente após decisão explícita | Eventos preservam evidência | GAP |
| movimentação | Evento aplicado + state rejeitado/conflitante | CROSS_DOMAIN_CONFLICT | partial result/ACK | Evento factual + state atual | infraestrutura preserva resultados por op, mas não há resolvedor canônico transversal da intenção | USER_RESOLUTION_REQUIRED | não | sim | depende da resolução | operation results + fatos | GAP |
| peso | replay mesma identidade | REPLAY_SAME_IDENTITY | PK/op/tx | Evento de pesagem | identidade persistida é reutilizada | RETRY_SAME_IDENTITY | não | sim se necessário | não | Evento/op | PARTIAL |
| peso | pesagens factuais distintas | DISTINCT_VALID_EVENTS | IDs distintos | Eventos de pesagem | ambas permanecem; última observação é derivada por `occurred_at` | PRESERVE_BOTH | não | pull factual | não | Eventos | PARTIAL |
| peso ad hoc | lançamento humano duplicado | DUPLICATE_HUMAN_ACTION | sem detector causal universal | Eventos | não deduplicar por animal+peso+horário | USER_RESOLUTION_REQUIRED | não | sim | somente correção explícita | fatos preservados | GAP |
| reprodução | replay do mesmo Evento | REPLAY_SAME_IDENTITY | identidade + conteúdo | Evento reprodutivo | replay idêntico é idempotente; divergência não é replay | RETRY_SAME_IDENTITY | não | especializado | não | Evento/op | PARTIAL |
| reprodução | fatos válidos distintos | DISTINCT_VALID_EVENTS | identidades/vínculos distintos | Eventos reprodutivos | preserva fatos; read model reconstrói | PRESERVE_BOTH | não | rebuild/pull | não | histórico append-only | PARTIAL |
| reprodução | branch/antecedente incompatível | CROSS_DOMAIN_CONFLICT | validações de dependência/branch | histórico reprodutivo | rejeição especializada quando regra causal é violada | REJECT_TERMINAL | não | sim | somente nova intenção válida | reason + histórico | PARTIAL |
| reprodução | correção factual | CROSS_DOMAIN_CONFLICT | vínculo de correção | Evento original + correção | correção é novo fato, não edição do histórico | COMPENSATE | não | rebuild | sim, como correção | auditável pelo vínculo factual | PARTIAL |
| sanitário v2 | replay mesma identidade | REPLAY_SAME_IDENTITY | ledger/fingerprint | ledger + entidade factual/Agenda | mesma identidade é reconhecida pelo contrato | RETRY_SAME_IDENTITY | não | cutover pull | não | ledger + resultado | PARTIAL |
| sanitário v2 Agenda | revisão stale | STALE_STATE_WRITE | PostgreSQL `expected_revision` | Agenda v2 + revision | banco produz `SANITARIO_AGENDA_REVISION_CONFLICT`; transporte E2E pode expirar e virar `SANITARIO_RPC_TIMEOUT` | RECONCILE_THEN_NEW_INTENT | não | sim | sim após resultado canônico | ledger/result; transporte incompleto | PARTIAL |
| sanitário factual | fatos válidos distintos | DISTINCT_VALID_EVENTS | domain identity/constraints | Evento + detalhe + relações | fatos legítimos permanecem | PRESERVE_BOTH | não | pull | não | histórico factual + ledger | PARTIAL |
| sanitário factual | correção | CROSS_DOMAIN_CONFLICT | `corrige_evento_id`/contrato de correção | Evento original + correção | append-only | COMPENSATE | não | pull/rebuild | sim | vínculo explícito | PARTIAL |
| comercial v2 | replay mesma operação | REPLAY_SAME_IDENTITY | `operation_id` + fingerprint/lock | comando + Evento comercial | replay da identidade congelada é idempotente | RETRY_SAME_IDENTITY | não | pull | não | operação/Evento | PARTIAL |
| comercial v2 | operação independente incompatível com estado atual | CROSS_DOMAIN_CONFLICT | RPC/lock/estado elegível | Evento comercial + estado atual | comando conflitante é rejeitado, não mergeado | USER_RESOLUTION_REQUIRED | não | sim | somente se usuário formular nova operação válida | RPC reason + Evento | PARTIAL |
| financeiro | replay mesma identidade | REPLAY_SAME_IDENTITY | PK/op/tx/constraints | Evento/transaction | reenvio mantém identidade | RETRY_SAME_IDENTITY | não | pull | não | Evento/op | PARTIAL |
| financeiro | fatos independentes | DISTINCT_VALID_EVENTS | IDs distintos | Eventos/transações | preserva fatos distintos | PRESERVE_BOTH | não | pull | não | histórico financeiro | PARTIAL |
| financeiro manual | lançamento humano duplicado | DUPLICATE_HUMAN_ACTION | sem causa universal | histórico financeiro | conteúdo semelhante não prova duplicata | USER_RESOLUTION_REQUIRED | não | sim | correção/reversão explícita quando aplicável | histórico preservado | GAP |
| financeiro | reversão/correção suportada | CROSS_DOMAIN_CONFLICT | `reverses_transaction_id` e unique | transação original + reversão | compensação explícita, não rewrite do fato | COMPENSATE | não | pull | sim | vínculo de reversão | PARTIAL |
| Agenda com mesma causa | INSERT factual a partir do mesmo `source_task_id` | DUPLICATE_HUMAN_ACTION | unique remoto / `agenda_already_completed_by_event` | Agenda + Evento já vinculado | segunda execução causal é rejeitada | REJECT_TERMINAL | não | sim | não para a mesma causa | reason + Evento existente | PARTIAL |

## 6. Comportamento atual

### PROVEN

- `UPDATE animais`: stale write termina em `STATE_REVISION_CONFLICT`, sem retry automático.
- replay de lost ACK do mesmo `UPDATE animais` não reaplica a mutação nem avança revision novamente.
- after-conflict convergence de `animais` exige pull e, para alterar novamente, nova operação/identidade/revision.
- CAS de `animais` é independente de timestamp do cliente.
- farm switch preserva pending e isolamento por fazenda no escopo D6.
- `REVISION_PROTECTED_STATE_TABLES` contém somente `animais` e a proteção é aplicada a `UPDATE` e `DELETE`.
- `DELETE animais` captura e persiste `expected_revision`, transporta a mesma revisão em retry/reload e executa soft-delete com match atômico por PK + `fazenda_id` + `revision`.
- replay do mesmo DELETE é reconhecido antes do CAS e não aplica segundo tombstone nem avança revision novamente.
- DELETE legado/pending sem revision falha fechado com `STATE_EXPECTED_REVISION_REQUIRED`.

### PARTIAL

- identidade causal de Eventos existe quando há `source_task_id`, `domain_op_id`, `operation_id` ou vínculos especializados; fatos ad hoc não compartilham causa automaticamente.
- reprodução possui validações de branch/dependência e rebuild factual, mas não autoriza política genérica para todos os eventos.
- comercial v2 possui RPC transacional/locks/fingerprint, sem transformar esse contrato em regra universal.
- Sanitário v2 possui ledger/fingerprint/revision no banco, mas a entrega E2E do conflito de revision segue bloqueada por timeout de plataforma.
- auditabilidade técnica genérica usa results/rejections/obligations; `queue_rejections` é evidência operacional temporária, não histórico factual permanente.

### GAP

- demais `state_*` mutáveis não possuem revision/CAS transversal.
- não existe contrato genérico de field-level merge; isso é intencionalmente não autorizado.
- movimento factual aplicado com state conflitante não possui resolvedor canônico universal.
- duplicidade humana ad hoc em movimentação, peso e financeiro não possui identidade causal compartilhada.
- conflitos genéricos não têm garantia de auditabilidade de domínio permanente apenas por `queue_rejections`.

### NOT_TESTED

- resolução completa em dispositivos físicos distintos.
- reconciliação de fazenda não ativa no cenário cross-device.
- clock skew para todos os domínios.
- dependência causal da fila sob clock skew reverso.
- corrida simultânea em dispositivos físicos distintos DELETE vs UPDATE; a semântica CAS nas duas ordens já foi comprovada em PostgreSQL e Auth → Edge → RLS → PostgreSQL local.

## 7. Contrato proposto por classe

| Classe | Detect | Classify | Action | Audit | Reconcile | Final convergence |
|---|---|---|---|---|---|---|
| STALE_STATE_WRITE | revision/CAS quando o agregado possuir versão | snapshot conhecido != versão remota | RECONCILE_THEN_NEW_INTENT | reason + current revision + identidade original | pull autoritativo | nova intenção nasce de novo snapshot; stale op nunca é reciclada |
| REPLAY_SAME_IDENTITY | mesma identidade técnica e fingerprint/registro compatível | replay, não conflito | RETRY_SAME_IDENTITY | preservar tx/op/domain/operation IDs | somente para convergir read model | um efeito remoto |
| DISTINCT_VALID_EVENTS | identidades factuais/causais distintas | fatos independentes | PRESERVE_BOTH | Eventos e detalhes permanecem | rebuild/pull | read model deriva dos fatos conforme regra do domínio |
| DUPLICATE_HUMAN_ACTION | ausência de causa compartilhada impede decisão automática | ambíguo | USER_RESOLUTION_REQUIRED | preservar ambos até decisão/correção | sim | não apagar fato por heurística |
| DELETE_VS_UPDATE em state versionado | mesma revision base/tombstone concorrente | stale mutation | RECONCILE_THEN_NEW_INTENT | registrar qual mutação perdeu o CAS | pull com tombstone | estado remoto canônico; nova intenção somente após reconcile |
| DELETE_VS_UPDATE factual | fato já existe e domínio possui correção/reversão | correção histórica | COMPENSATE | novo Evento/reversão vinculado | rebuild | histórico permanece auditável |
| CONCURRENT_FIELD_CHANGES | duas mutações do mesmo agregado/version | stale state, não oportunidade automática de merge | RECONCILE_THEN_NEW_INTENT | conflito explícito | pull | sem field merge implícito |
| CROSS_DOMAIN_CONFLICT | Evento/ledger aplicado e projeção/state rejeitado ou incompatível | avaliar precedência factual do domínio | USER_RESOLUTION_REQUIRED quando não houver projeção determinística; COMPENSATE quando houver correção factual explícita | preservar resultados por op + fato | pull/rebuild | nenhum fato aplicado é apagado apenas para alinhar state |

### Regra de merge

```ini
CONFLICT != MERGE
FIELD_LEVEL_MERGE = NOT_AUTHORIZED
AUTO_MERGE = NOT_AUTHORIZED
```

Qualquer futuro `MERGE_EXPLICIT` precisa definir `MERGE_INPUTS`, `MERGE_AUTHORITY`, `MERGE_RULE`, `MERGE_OUTPUT_IDENTITY`, `MERGE_AUDIT` e `MERGE_REPLAY_POLICY`, com determinismo, idempotência, auditabilidade, isolamento multi-tenant e segurança offline demonstrados.

## 8. Gaps confirmados

| ID | Gap | Impacto | Implementação |
|---|---|---|---|
| F24.4E-G1 | `DELETE animais` não capturava/transportava revision | delete stale podia escapar da política CAS que protegia UPDATE | RESOLVED_ON_BRANCH → F24.4E1 READY_FOR_REVIEW |
| F24.4E-G2 | demais `state_*` sem revision/CAS | lost update/intenção perdida fora de animais | DEFERRED → inventário incremental após E1 |
| F24.4E-G3 | Evento de movimentação + state pode terminar com resultados divergentes | histórico factual pode coexistir com projeção atual incompatível | DEFERRED → F24.4E2 |
| F24.4E-G4 | duplicidade humana ad hoc sem causa compartilhada | impossível diferenciar duplicata de fatos legítimos por conteúdo | DEFERRED; requer decisão de produto/domínio, sem dedup automático |
| F24.4E-G5 | Sanitário v2: conflito PostgreSQL não retorna E2E antes do timeout | worker pode tratar outcome desconhecido como retryable em vez de conflito canônico | DEFERRED_TO_F24.7 / EXTERNAL_BLOCKED |
| F24.4E-G6 | auditabilidade genérica de rejeição é operacional/temporária | conflito técnico não deve virar histórico factual implícito | DEFERRED_TO_F24.5 para observabilidade; domínio mantém Eventos/ledgers quando existirem |
| F24.4E-G7 | physical multi-device, non-active farm reconcile e all-domain clock permanecem incompletos | limita certificação transversal | DEFERRED_TO_F24.4F |

## 9. Plano de implementação

### F24.4E1 — `ANIMAIS_DELETE_TOMBSTONE_CAS`

Status: `READY_FOR_REVIEW` no PR #173. O DELETE/tombstone de `animais` agora captura a revision do snapshot local, persiste `expected_revision`, preserva-a em retry/reload e usa o mesmo CAS server-authoritative do UPDATE. `UPDATE→DELETE` stale e `DELETE→UPDATE` stale terminam em `STATE_REVISION_CONFLICT`; replay da mesma identidade permanece idempotente; cliente legado sem revision falha fechado. Nenhuma migration, alteração de schema ou RLS foi necessária.

### F24.4E2 — `MOVEMENT_EVENT_STATE_CONVERGENCE`

Definir recuperação quando Evento de movimentação é aceito mas a mutação de state correspondente conflita/rejeita. A solução não pode apagar Evento factual válido nem inferir histórico do state; deve escolher rebuild/reconcile determinístico somente se a precedência factual estiver provada, caso contrário exigir resolução explícita.

### Itens sem subfase de implementação agora

- duplicidade humana ad hoc: manter `USER_RESOLUTION_REQUIRED`; qualquer command ID cross-device exige ADR e contrato real por domínio.
- Sanitário v2 E2E: permanece F24.7 `EXTERNAL_BLOCKED`; não alterar timeout/RPC nesta fase.
- observabilidade/retenção de conflito: F24.5.
- certificação física/integrada: F24.4F.

## 10. Patch desta execução

```ini
PATCH_SCOPE = CHARACTERIZATION_PLUS_F24_4E1
RUNTIME_CHANGE = YES
SCHEMA_CHANGE = 0
MIGRATION_CHANGE = 0
RLS_CHANGE = 0
PRODUCTION_CHANGE = 0
```

Arquivos de runtime/teste afetados pela E1 incluem `src/lib/offline/ops.ts`, `src/lib/offline/syncWorker.ts`, `supabase/functions/sync-batch/index.ts`, `supabase/functions/sync-batch/rules.ts` e testes focados/concorrenciais. O harness de CI passou a exportar o anon key local e desabilitar apenas a verificação JWT do gateway local para `sync-batch`; o handler continua executando `auth.getUser(jwt)` e cliente user-scoped/RLS. Nenhuma configuração de produção foi alterada.

## 11. Validação observada

Workflow `antigravity-validate` run `36869086650`, HEAD funcional `05946b63cddf5280d759a95d3386338dbfb4a1a3`:

- Supabase descartável + reset: PASS.
- lint: PASS.
- Fallow new-only: PASS.
- Vitest global: **417/417 arquivos; 3401/3401 testes PASS**.
- `stateConflictSyncBatch.e2e.test.ts`: 3/3 PASS, incluindo lost update/replay, CAS DELETE nas duas ordens e stale/legacy/cross-farm/ownership.
- `stateConflictConcurrency.test.ts`: UPDATE→DELETE e DELETE→UPDATE PASS no PostgreSQL real local.
- `stateExpectedRevision.characterization.test.ts`: captura/persistência/replay/fail-closed de revision PASS.
- build: PASS.
- `git diff --check`: PASS.
- `pnpm run gates:docs`: PASS.
- repository-clean: PASS.

## 12. Riscos residuais

- `REAL_PHYSICAL_MULTI_DEVICE = NOT_PROVEN`.
- `NON_ACTIVE_FARM_RECONCILIATION = NOT_TESTED`.
- `ALL_DOMAIN_CLOCK_BEHAVIOR = NOT_PROVEN`.
- `CLOCK_SKEW_CAN_BREAK_CAUSAL_DEPENDENCY = NOT_TESTED`.
- `CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY = NOT_OBSERVED`.
- `SANITARIO_V2_E2E_PLATFORM_BLOCKED`.
- nenhuma política geral para todos os `state_*`.
- DELETE/tombstone está protegido por CAS somente em `animais`; não generalizar a outras tabelas.

## 13. Próximo passo

Revisar o PR #173 e a F24.4E1. Se integrada, rebaselinear a `main` e então abrir somente a characterization da F24.4E2 — `MOVEMENT_EVENT_STATE_CONVERGENCE`.

Não iniciar F24.4E2 automaticamente antes da revisão/integração da E1.
