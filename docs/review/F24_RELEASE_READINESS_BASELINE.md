# F24.0 — Release Readiness Baseline & Gap Audit

Atualizado em: 2026-09-23

Baseline auditada: `main@93c3d1dd8401488139454c69c2a6595ae46abaa5`

Status: **CLOSED — READY WITH CAVEATS**

Próxima frente recomendada: **F24.4A — Conflict Inventory / Characterization — NOT_STARTED**

> Status posterior: F24.3 foi encerrada no
> [closeout canônico](./F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md). As lacunas abaixo permanecem o
> snapshot da baseline F24.0; `REAL_PROCESS_KILL = NOT_PROVEN` é a limitação residual vigente.

## Rebaseline de ambiente — 2026-09-14

```ini
REMOTE_ENVIRONMENT = zqloazqzhwauamcejmuz
REMOTE_ENVIRONMENT_CLASS = DISPOSABLE_INTEGRATION
REMOTE_RESET_ALLOWED = true
REMOTE_INTEGRATION_BASELINE = VERIFIED
PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
ENVIRONMENT_ISOLATION = NOT_REQUIRED_PRE_PRODUCTION
F24.1C_STAGING_CREATION = DEFERRED
ACL_REMOTE_REHEARSAL = PASS
F24.1_TECHNICAL = CLOSED
F24.1_REPOSITORY_CLOSEOUT = PR_READY_FOR_REVIEW
F24.2 = CLOSED
F24.2_CLOSEOUT_BASELINE = main@41ffd254251bdcbf7ce440da9431ada2dfeaf993
F24.3 = CLOSED
```

A classificação anterior de backend compartilhado com produção foi uma inferência baseada no
canal Vercel `Production` e está superada, sem remoção do registro histórico. A F24.1D provou
reconstrução e convergência do banco remoto descartável. A F24.1D.1 corrigiu o contrato HTTP
e passou a matriz negativa, o consumidor `service_role`, o E2E 1/1 e o replay; consulte
[F24_1D_REMOTE_ACL_REHEARSAL.md](./F24_1D_REMOTE_ACL_REHEARSAL.md).

## Registro histórico anterior ao rebaseline

As referências subsequentes a staging/produção compartilhados preservam o diagnóstico feito
sob a premissa anterior e não substituem a classificação ambiental acima.

## Decisão

`F24_RELEASE_BASELINE = ESTABLISHED`.

Fato confirmado: a F24.0 possui evidência suficiente para fechar o inventário e ordenar o
backlog de release. Isso não significa que o produto esteja autorizado para produção.

```ini
MIGRATION_PRODUCTION_DELTA = BLOCKED
RLS_RELEASE_GATE = NOT_TESTED
OFFLINE_LONG_DURATION = NOT_TESTED
MULTI_DEVICE_GATE = PARTIAL
RECOVERY_GATE = PARTIAL
OBSERVABILITY_GATE = PARTIAL
PERFORMANCE_GATE = NOT_TESTED

SANITARIO_V2 = EXTERNAL_BLOCKED
PRODUCTION_PROMOTION = NOT_AUTHORIZED
```

### Resultado da F24.1

A reentrada da [F24.1 — Production Migration Delta & Provenance](F24_1_PRODUCTION_MIGRATION_DELTA.md)
fechou a engenharia local de ACL, mas preservou o bloqueio produtivo:

```ini
PRODUCTION_MIGRATION_HISTORY = BLOCKED
STAGING_ACL_DRIFT = EXPLAINED
ACL_MISSING_SERVICE_ROLE_EXECUTE = FIXED
SERVICE_ROLE_RECONCILE_TEST = PASS
ACL_CANONICAL_CONTRACT = VERIFIED
ACL_FORWARD_ONLY_MIGRATION = READY_FOR_REVIEW
ACL_REHEARSAL_A = PASS
ACL_REHEARSAL_B = PASS
ACL_REHEARSAL_CONVERGENCE = PASS
PRODUCTION_REPO_DELTA = NOT_TESTED
STAGING_REPAIR_PROVENANCE = VERIFIED
MIGRATION_PRODUCTION_DELTA = BLOCKED
STAGING_PROJECT_REF = zqloazqzhwauamcejmuz
PRODUCTION_PROJECT_REF = zqloazqzhwauamcejmuz
STAGING_PRODUCTION_BACKEND = SHARED
ENVIRONMENT_ISOLATION = BLOCKED
REMOTE_ACL_PROMOTION = NOT_AUTHORIZED
PRODUCTION_PROMOTION = NOT_AUTHORIZED
F24.1 = READY_WITH_CAVEAT
F24.2 = NOT_STARTED
```

Os dois repairs de staging têm conteúdo e origem verificados. O repair `20260901192731` foi
absorvido pela C3; `20260901192728` permanece histórico exclusivo de staging, mas seu efeito
é agora convergido pela migration canônica forward-only `20260913232253`. Os cenários repo
puro e staging-equivalente produziram fingerprints ACL idênticos após a correção F24.1A.1.
O fluxo Edge local com `service_role` passou. A migration não foi aplicada remotamente:
staging e produção usam o mesmo project ref, portanto o backend é compartilhado e a
promoção permanece não autorizada até existir isolamento de ambiente.

## Baseline real

| Item | Estado confirmado |
|---|---|
| Branch | `main` |
| HEAD | `93c3d1dd8401488139454c69c2a6595ae46abaa5` |
| `origin/main` após `git fetch origin main --prune` | `93c3d1dd8401488139454c69c2a6595ae46abaa5` |
| Divergência HEAD × `origin/main` | `0 atrás / 0 à frente` |
| Worktree de entrada | alteração preexistente em `supabase/.temp/cli-latest`; sem staged ou untracked |
| F23 / F23 V1 | `CLOSED` / `CLOSED` |
| Technical Convergence | `CLOSED` |
| F24 antes desta auditoria | `NOT STARTED` |

A alteração em `supabase/.temp/cli-latest` não pertence à F24.0 e não foi modificada nem
incluída no patch documental.

## Classificação

`READY`, `PARTIAL`, `BLOCKED`, `NOT_TESTED`, `EXTERNAL_BLOCKED` e `NOT_APPLICABLE` têm o
sentido definido no pedido da F24.0. `READY` é usado somente quando a evidência pertence ao
ambiente indicado; teste local não certifica staging ou produção.

## Matriz repo × staging × produção

| Área | Repo | Staging | Produção | Status | Evidência | Risco |
|---|---|---|---|---|---|---|
| Migrations / upgrade | `READY_FOR_REVIEW` | `BLOCKED` | `BLOCKED` | `BLOCKED` | 49 migrations canônicas + F24.1 + F24.1A.1 ensaiadas; repairs explicados; fingerprints A/B idênticos | backend staging/produção compartilhado; promoção remota não autorizada |
| RLS / Auth / tenant | `READY` | `PARTIAL` | `NOT_TESTED` | `NOT_TESTED` | baseline local 5/5; 62/62 tabelas locais com RLS; 148 policies; gate de 35 `SECURITY DEFINER` aprovado | gate final não executado no backend compartilhado |
| Offline-first / Dexie / sync | `PARTIAL` | `NOT_TESTED` | `NOT_TESTED` | `NOT_TESTED` | Dexie v29, fila compartilhada, retry/replay, sucesso parcial, pending protection, pull/reconcile e rollback têm implementação e testes locais | sem certificação de longa duração e reconnect acumulado |
| Multi-device | `PARTIAL` | `PARTIAL` | `NOT_TESTED` | `PARTIAL` | movimento A → staging → B e clean install foram certificados; demais fluxos não têm matriz remota final | cobertura remota não é transversal; sanitário bloqueado |
| Recovery | `PARTIAL` | `NOT_TESTED` | `NOT_TESTED` | `PARTIAL` | testes locais cobrem 503 transitório, timeout após aplicação, restart Dexie, fila pendente, replay e rollback seletivo | crash no push, ACK perdido e upgrade com fila pendente não estão certificados como jornada completa |
| Observabilidade | `PARTIAL` | `PARTIAL` | `NOT_TESTED` | `PARTIAL` | `client_tx_id`, `client_op_id`, `domain_op_id`, `fazenda_id`, tabela/ação, retry, status, erro e auditoria de reconcile existem em superfícies distintas; `telemetry-ingest` está ativo no staging | não há correlação única com `device_id`, ACK remoto e resultado de reconcile |
| Performance / escala | `PARTIAL` | `PARTIAL` | `NOT_TESTED` | `NOT_TESTED` | fixtures chegam a 5.000 animais; import usa chunks de 100; C6 analisou 1.939 queries/43 dias em staging | fixture parseada e workload histórico não certificam fila, bootstrap, pull, memória ou payload em escala de release |
| Sync Sanitário v2 | `READY` | `EXTERNAL_BLOCKED` | `NOT_TESTED` | `EXTERNAL_BLOCKED` | implementação e testes locais; staging retorna 40001 no PostgreSQL, mas gateway expira e worker recebe `SANITARIO_RPC_TIMEOUT` | rollout bloqueado; resultado remoto não chega ao cliente |
| Production readiness | `PARTIAL` | `PARTIAL` | `NOT_TESTED` | `BLOCKED` | backlog e baseline definidos; sem canary, rehearsal, delta produtivo ou rollback certificado | promoção prematura sem evidência de produção |

## Inventário Supabase e segurança

### Fatos confirmados

- existem 49 migrations SQL ativas, de `00000000000000` a `20260908070000`;
- `supabase migration list --linked` mostrou as 49 versões canônicas no staging e duas
  versões adicionais remotas de reparo (`20260901192728`, `20260901192731`);
- o schema local reconstruído após F24.1A.1 possui 61 funções públicas, 35 `SECURITY DEFINER`, 76 triggers,
  62 tabelas públicas com RLS em 62/62 e 148 policies;
- o gate local confirmou `search_path` fixo nas 35 funções `SECURITY DEFINER`, `PUBLIC EXECUTE`
  revogado, `anon EXECUTE` restrito a `get_invite_preview` e `reject_invite`, e bloqueio de
  execução direta das funções internas para `authenticated`;
- o baseline local confirmou owner, manager, cowboy e outsider, FKs cross-tenant, grants
  operacionais de `authenticated` e ausência de `SELECT/INSERT/UPDATE/DELETE` operacional
  para `anon` na matriz validada;
- grants locais não operacionais ainda incluem `REFERENCES`, `TRIGGER` e `TRUNCATE` para
  `anon` em 58 tabelas; a exposição prática e a necessidade de revogação exigem decisão
  explícita na F24.2, pois o gate atual não os classifica;
- Edge Functions versionadas: `sync-batch`, `sanitario-reconcile`, `telemetry-ingest` e
  `test-auth`; as quatro estão ativas no staging, com `sync-batch` v25 e JWT habilitado;
  `test-auth` está com `verify_jwt=false` e deve ser classificada/removida do plano de
  produção na F24.1/F24.2.

### Evidência posterior da F24.1

O conteúdo e a proveniência das duas versões remotas foram reconstruídos na F24.1.
`20260901192728` é um `STAGING_ONLY_HOTFIX` de grants sem substituto canônico;
`20260901192731` foi `SUPERSEDED` pela migration canônica C3. Nenhuma das duas deve ser
copiada para produção nem convertida em migration canônica por inferência. Consulte o
[relatório F24.1](F24_1_PRODUCTION_MIGRATION_DELTA.md).

### Lacuna

O project ref produtivo identificado é o mesmo de staging: `zqloazqzhwauamcejmuz`. RPCs,
funções, triggers, policies, grants, Edge Functions e migration history não foram testados
por escrita nem alterados remotamente, porque o backend compartilhado bloqueia isolamento e
promoção segura.

## Offline, multi-device e recovery

### Implementado e testado localmente

- local-first write via `createGesture`, `queue_gestures` e `queue_ops`;
- push/pull, retry/replay com identidade estável, backoff e sucesso parcial por operação;
- proteção de pending e tombstones, reconcile e rollback seletivo;
- restart do Dexie com exclusão/fila pendente;
- timeout após aplicação remota simulada com replay da mesma identidade;
- convergência simulada multi-device e clean install para movimentação;
- upgrade Dexie até v29 e testes localizados de migrations de estoque.

### Testado remotamente

- movimentação: Device A → staging → Device B, replay, isolamento cross-farm e clean install;
- sanitário: cobertura remota parcial, interrompida pelo bloqueio externo do conflito 40001;
- não há evidência equivalente para todos os fluxos críticos.

### Não certificado para release

- offline prolongado com grande acúmulo e reconnect intermitente;
- crash real durante push e retomada por processo novo;
- servidor aplicou e cliente perdeu ACK em matriz transversal de domínios;
- token expirado durante lote grande;
- upgrade do app/Dexie com operações pendentes heterogêneas;
- concorrência multi-device transversal, stale writes e pull concorrente.

## Observabilidade

| Campo necessário | Estado | Evidência / lacuna |
|---|---|---|
| `operation_id` | `PARTIAL` | `client_op_id`, `client_tx_id` e `domain_op_id` existem, sem visão correlacionada única |
| `device_id` | `BLOCKED` | não há campo canônico de dispositivo na fila/telemetria auditada |
| `farm_id` | `READY` | `fazenda_id` em fila, rejeições, métricas e envelopes |
| `entity_id` | `PARTIAL` | presente dentro de records/payloads, não normalizado na trilha de sync |
| operation type | `READY` | tabela/ação ou domínio/comando |
| attempt | `PARTIAL` | `retry_count`/backoff locais; não há tentativa correlacionada ponta a ponta |
| status / erro | `PARTIAL` | status, `last_error`, reason codes e rejeições existem em stores distintos |
| remote acknowledgement | `PARTIAL` | resultado por operação existe; retenção/correlação não é uniforme após sucesso |
| reconcile result | `PARTIAL` | auditoria sanitária existe; não há visão transversal única |

Recomendação: F24.5 deve consolidar correlação e diagnóstico sem criar uma segunda fonte de
verdade nem transformar telemetria em evidência de domínio.

## Performance e escala

Fatos confirmados:

- fixtures de integração: 5.000 animais, 100 lotes e 50 pastos no nível alto;
- os testes atuais validam parsing e integridade referencial das fixtures, não latência,
  throughput, memória, IndexedDB, bootstrap ou pull;
- Import V2 limita chunks a 100 operações;
- telemetria envia batches de 100 eventos;
- a evidência C6 registrou 1.939 queries em 43 dias sem gargalo nas 17 áreas analisadas;
- o build historicamente alerta para chunks grandes.

Conclusão: `PERFORMANCE_GATE = NOT_TESTED`. A evidência existente ajuda a desenhar F24.6,
mas não define volume máximo certificado.

## Sync Sanitário v2

```ini
SANITARIO_V2_E2E_PLATFORM_BLOCKED = TRUE
B3_FEATURE_FLAG = FALSE
B3_REMOTE_GATE = OFF
B3_ROLLOUT = NOT_AUTHORIZED
```

Fatos confirmados preservados:

- PostgreSQL produz `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`;
- Edge Function/PostgREST/gateway atinge timeout antes de devolver a resposta;
- worker classifica `RETRYABLE / SANITARIO_RPC_TIMEOUT`;
- o código limita habilitação local ao project ref de staging e mantém o estado padrão
  fail-closed.

Não aumentar timeout, alterar RPC/SQL, habilitar flag/gate ou promover rollout na F24.0.

## Release blockers reais

1. delta, rehearsal, canary e rollback de produção não testados;
2. gate final de RLS/Auth/tenant e inventário efetivo de produção não testados;
3. offline prolongado, recovery completo e multi-device transversal sem certificação;
4. observabilidade sem correlação ponta a ponta suficiente para diagnosticar release;
5. performance/escala sem benchmark de jornada;
6. Sync Sanitário v2 bloqueado externamente e mantido fail-closed.

Warnings de testes, Browserslist e chunks não são, isoladamente, release blockers; entram
como dívida/insumo de F24.5/F24.6.

## Rebaseline documental

| Documento / item | Classificação | Ação |
|---|---|---|
| `OPEN_REVIEW_ITEMS.md` — C2–C7 pendentes | `STALE` / `RESOLVED` | substituído pelo backlog F24; Technical Convergence permanece fechada |
| `OPEN_REVIEW_ITEMS.md` — promoção para produção | `STILL_OPEN` / `RELEASE_BLOCKER` | absorvido por F24.1, F24.2 e F24.8 |
| `KNOWN_GAPS.md` — E2E remoto de movimentação pendente | `STALE` / `RESOLVED` | corrigido para `REMOTE_CONVERGENCE_VERIFIED` |
| `OFFLINE_SYNC.md` — “Fase 12 aberta” | `STALE` / `SUPERSEDED` | corrigido; Fase 12 permanece tecnicamente encerrada |
| `PROJECT_STATUS.md` / handoff — `42 local == 42 staging` | `STALE` | substituído pelo inventário 49 canônicas + 2 reparos remotos |
| ruído residual de testes | `STILL_OPEN` / não bloqueante | mantido em P2 |
| warnings de build | `STILL_OPEN` / não bloqueante | mantido em P2 e relacionado à F24.6 |
| bloqueio sanitário | `EXTERNAL_BLOCKED` / `RELEASE_BLOCKER` | preservado sem workaround |

## Backlog F24 priorizado

### P0 — F24.1 Migration / Upgrade Rehearsal + Production Delta

- status: `CLOSED — BLOCKED`, com reentrada necessária;
- evidência: 49 migrations repo/staging classificadas, proveniência dos dois repairs
  verificada, produção `NOT_TESTED` e drift de ACL no staging;
- risco: promover ordem ou artefato incorreto, inclusive reparos exclusivos de staging;
- dependências: acesso read-only a produção, snapshot/backup, owner de mudança e janela;
- áreas: `supabase/migrations`, funções, triggers, Edge Functions e configuração;
- testes: clean install, upgrade desde baseline suportada, dry-run/diff e rollback rehearsal;
- entrada: esta baseline fechada;
- saída pendente: histórico produtivo conhecido, ACLs reconciliadas por caminho forward-only
  e rehearsal reproduzível aprovado;
- release blocker: **SIM**.

### Encerrada — F24.2 Offline/Sync/Auth/Ownership Hardening

- status: `CLOSED`;
- baseline: `main@41ffd254251bdcbf7ce440da9431ada2dfeaf993`;
- evidência e rebaseline: [F24_2_CLOSEOUT_AND_REBASELINE.md](F24_2_CLOSEOUT_AND_REBASELINE.md);
- capacidades encerradas não retornam como implementação em F24.3–F24.8;
- produção permanece não provisionada e não autorizada.

### P0 — F24.3 Offline Prolongado + Reconnect + Recovery

- status: `READY_NOT_STARTED`;
- evidência: hardening base encerrado na F24.2, sem certificação da jornada prolongada;
- risco: perda, duplicação, loop ou bloqueio de fila após longa desconexão;
- dependências: harness e dataset controlado;
- áreas: jornada long offline, fila grande, reconnect intermitente, crash/restart real,
  upgrade pending heterogêneo, HTTP 429/`Retry-After`, backoff/jitter, farm-switch/hydrate,
  reconciliação não ativa e eventual purge/retention;
- gap explícito: `pullDataForFarm(..., mode="replace")` ainda usa `store.clear()` em diversas stores;
- entrada: volumes e matriz de falhas definidos;
- saída: retomada determinística sem perda/duplicação e com diagnóstico;
- release blocker: **SIM**.

### P0 — F24.4 Multi-device + Conflitos

- status: `NOT_STARTED`;
- evidência: movimentação certificada; cobertura transversal parcial;
- risco: stale write, conflito cross-device, pull concorrente ou interação incorreta de sucesso parcial;
- dependências: F24.3 e ambientes controlados;
- áreas: writes no mesmo agregado, stale-write genérico, conflitos cross-device e pull concorrente;
- testes: concorrência, partial success e multi-tab/multi-context em browser real;
- entrada: recovery base aprovado;
- saída: matriz crítica multi-device aprovada por operação/domínio;
- release blocker: **SIM**.

### P1 — F24.5 Observabilidade + Reconcile + Diagnóstico

- status: `NOT_STARTED`;
- evidência: campos distribuídos e telemetria parcial;
- risco: incidente sem correlação de operação, dispositivo, ACK e reconcile;
- dependências: eventos/estados definidos em F24.3/F24.4;
- áreas: correlação de operação/dispositivo/tentativa/status/erro, ACK remoto, resultado de
  reconcile, saúde de fila/reconcile, retenção e redaction;
- testes: correlação de falhas, retries, ACK perdido e reconcile, com isolamento por fazenda;
- entrada: cenários críticos enumerados;
- saída: diagnóstico ponta a ponta, retenção e redaction documentados;
- release blocker: **SIM** para produção ampla.

### P1 — F24.6 Performance / Escala

- status: `NOT_STARTED`;
- evidência: fixtures e workload parcial, sem benchmark de jornada;
- risco: fila/bootstrap/pull/UI degradarem sob volume real;
- dependências: F24.5 para medição confiável;
- áreas: IndexedDB, fila grande, startup/bootstrap, pull, payload/batches, memória,
  queries/índices, bundle/chunks e limites declarados;
- testes: benchmarks com volumes declarados e orçamento de latência/memória;
- entrada: cenários, hardware e budgets definidos;
- saída: limites certificados ou gargalos comprovados com ação focal;
- release blocker: **SIM** para escala declarada.

### P1 condicional — F24.7 Recertificação Sync Sanitário v2

- status: `EXTERNAL_BLOCKED`;
- evidência: 40001 correto não retorna pelo gateway antes do timeout;
- risco: conflito fica retryable sem confirmação e rollout não é seguro;
- dependências: plataforma estável e nova evidência externa;
- áreas: E2E remoto sanitário e caminho de resposta; sem alteração preventiva de RPC/SQL;
- testes: matriz remota já definida, com replay, conflito e cleanup;
- entrada: bloqueio de plataforma removido/comprovadamente mitigado;
- saída: E2E remoto completo e gate explicitamente reavaliado;
- release blocker: **SIM** para Sanitário v2; **NÃO** autoriza ativação automática.

### P0 final — F24.8 Production Readiness / Canary / Rollback / Release Gate

- status: `BLOCKED_BY_PREREQUISITES`;
- evidência: nenhuma promoção autorizada;
- risco: release sem rollback, observabilidade ou critérios de aborto;
- dependências: blockers anteriores resolvidos ou escopo explicitamente fail-closed;
- áreas: runbook, canary, backup/restore, monitoramento e decisão go/no-go;
- testes: rehearsal final, canary e rollback controlado;
- entrada: gates anteriores com evidência vigente;
- saída: decisão formal de produção, ainda dependente de autorização humana;
- release blocker: **SIM**.

## Validações desta auditoria

| Comando | Exit code | Resultado | Observação |
|---|---:|---|---|
| `git status --short --untracked-files=all` | 0 | PASS | detectou alteração preexistente em `supabase/.temp/cli-latest` |
| `git status -sb` | 0 | PASS | `main...origin/main` |
| `git rev-parse HEAD` | 0 | PASS | baseline esperada confirmada |
| `git log --oneline -5` | 0 | PASS | F23 V1 fechada no histórico recente |
| `git diff --check` (entrada) | 0 | PASS | sem erro de whitespace tracked |
| `git fetch origin main --prune` + comparação | 0 | PASS | HEAD e `origin/main` idênticos |
| `supabase migration list --linked` | 0 | PASS COM DRIFT | 49 canônicas presentes + 2 reparos remotos |
| `supabase functions list --project-ref zqloazqzhwauamcejmuz` | 0 | PASS | 4 funções ativas inventariadas |
| `node scripts/codex/validate-supabase-baseline-functional.mjs` | 0 | PASS | local descartável; fatos de teste persistidos no ambiente local |
| `node scripts/codex/validate-security-definer-exposure.mjs` | 0 | PASS | 35/35 funções e isolamento testados localmente após F24.1A.1 |
| `pnpm test -- <10 arquivos focados>` | 0 | PASS | 10 arquivos e 54 testes de recovery, replay, multi-device, pending, telemetria e fixtures |
| `pnpm run gates:headers` | 0 | PASS | headers e baselines ativos válidos |
| `pnpm run gates:derivation` | 0 | PASS | documentos ativos convergem para Fase 24 |
| `pnpm run gates:docs` | 0 | PASS | headers, continuidade e contrato de governança coerentes |
| `pnpm run gates:scope` | 1 | FAIL DE GOVERNANÇA | allowlist estreita não inclui `KNOWN_GAPS.md`, `OFFLINE_SYNC.md` nem este relatório e também detecta o arquivo temporário preexistente |
| `pnpm run lint` | 0 | PASS | sem erro reportado |
| `pnpm run build` | 0 | PASS COM WARNINGS | `caniuse-lite`, import misto do Dexie e chunk principal acima de 500 kB já conhecidos |

O gate de escopo não foi alterado para acomodar a auditoria. Nenhuma validação remota de
produção foi executada.

## Próxima frente recomendada

```txt
NEXT_RECOMMENDED = F24.3 — OFFLINE PROLONGADO + RECONNECT + RECOVERY
NEXT_STATUS = READY_NOT_STARTED
```

Não iniciar F24.3 automaticamente. Não há autorização para merge, deploy, DDL remoto,
reparo de histórico ou promoção de ambiente.
