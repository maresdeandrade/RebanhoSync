# F24.2 — Closeout e rebaseline F24.3–F24.8

Atualizado em: 2026-09-21

Baseline de fechamento: `main@41ffd254251bdcbf7ce440da9431ada2dfeaf993`

PR de fechamento: `#151` — merged

## Decisão

```ini
F24.2 = CLOSED
F24.2A = CLOSED
F24.2B = CLOSED
F24.2C = CLOSED
F24.2D = CLOSED
F24.2E = CLOSED
F24.2_CLOSEOUT_BASELINE = main@41ffd254251bdcbf7ce440da9431ada2dfeaf993

F24.3 = READY_NOT_STARTED
F24.4 = NOT_STARTED
F24.5 = NOT_STARTED
F24.6 = NOT_STARTED
F24.7 = EXTERNAL_BLOCKED
F24.8 = BLOCKED_BY_PREREQUISITES

PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
PRODUCTION_PROMOTION = NOT_AUTHORIZED
```

F24.2 está formalmente encerrada. Este closeout atualiza o backlog posterior sem autorizar o
início automático de F24.3, rollout, deploy, migration remota ou promoção de ambiente.

## Capacidades encerradas

As capacidades abaixo pertencem ao fechamento F24.2 e não devem reaparecer como
implementação nova em F24.3–F24.8:

- identidade causal estável e replay idempotente;
- claim atômico de fila e ACK atômico;
- recovery recuperável de `SYNCING` interrompido e tratamento fail-closed de fila legada;
- reconciliação durável pós-ACK e generation guard de reconciliação;
- timeout/abort de request e abort no encerramento do worker;
- recovery de HTTP 500/502/503/504;
- recovery de auth/sessão, segundo 401 terminal e 403 de autorização terminal;
- ownership local explícita por `Supabase session.user.id`;
- bloqueio de replay e visibilidade local entre usuários;
- retomada pelo mesmo usuário;
- adoção fail-closed de owner legado;
- preservação de pending work no logout.

O fechamento preserva `UNKNOWN` e `MISMATCH` como estados fail-closed. Token, e-mail,
`fazenda_id` e caches auxiliares não provam ownership.

## Rebaseline F24.3 — Offline Prolongado + Reconnect + Recovery

Status: `READY_NOT_STARTED`.

Escopo residual:

- jornada offline de longa duração;
- fila acumulada grande;
- reconnect intermitente;
- jornada real de crash/restart;
- upgrade com pending work heterogêneo;
- política genérica de HTTP 429 / `Retry-After`;
- decisão genérica de retry backoff/jitter;
- segurança de farm-switch / hydrate replace;
- reconciliação de fazenda não ativa;
- política de purge/retention do cache local, se necessária ao release.

`pullDataForFarm(..., mode="replace")` ainda executa `store.clear()` em diversas stores.
Farm-switch/hydrate multi-farm e reconciliação de fazenda não ativa permanecem gaps reais.

## Rebaseline F24.4 — Multi-device + Conflitos

Status: `NOT_STARTED`.

Escopo residual:

- writes concorrentes no mesmo agregado;
- política genérica de stale write;
- conflitos cross-device;
- pull concorrente;
- interações de sucesso parcial;
- validação multi-tab/multi-context em browser real.

Identidade estável e replay idempotente não fazem parte deste novo trabalho.

## Rebaseline F24.5 — Observabilidade

Status: `NOT_STARTED`.

Escopo residual:

- correlação de operação;
- identidade de dispositivo, se adotada;
- correlação de tentativa, status e erro;
- visibilidade de ACK remoto e resultado de reconciliação;
- saúde de fila/reconcile;
- retenção e redaction.

Telemetria permanece auxiliar: não é fonte factual nem regra de domínio.

## Rebaseline F24.6 — Performance / Escala

Status: `NOT_STARTED`.

Preservar benchmarks de IndexedDB, fila grande, startup/bootstrap, pull, payload/batches,
memória, queries/índices, bundle/chunks e limites de escala declarados.

## Rebaseline F24.7 — Sanitário v2

Status: `EXTERNAL_BLOCKED`.

```ini
SANITARIO_V2 = EXTERNAL_BLOCKED
SANITARIO_V2_FEATURE_FLAG = FAIL_CLOSED
SANITARIO_V2_ROLLOUT = NOT_AUTHORIZED
```

Não alterar RPC/SQL nem aumentar timeout sem nova evidência externa.

## Rebaseline F24.8 — Production Readiness

Status: `BLOCKED_BY_PREREQUISITES`.

Permanecem como gate final: provisionamento de produção, isolamento de ambientes, delta de
migrations produtivas, recertificação RLS/ACL, canary, rollback, backup/restore, critérios de
aborto e decisão go/no-go.

Produção não está certificada enquanto `PRODUCTION_BACKEND = NOT_PROVISIONED` e
`PRODUCTION_DATA = NONE`.

## Limites deste closeout

- patch exclusivamente documental;
- nenhum delta de runtime, teste, schema, Dexie, Supabase, RLS, RPC, migration ou Edge Function;
- nenhum merge, deploy, rollout ou operação remota autorizado por este documento.
