# F24.4C — State Conflict Policy

Atualizado em: 2026-09-27

## Decisão

```ini
F24_4C = CLOSED
F24_4 = IN_PROGRESS

MERGE_PR = #169
MERGE_SHA = 3b7ac50ed878d8d8d4b88874ad98c9d98816149b
CLOSED_AT = 2026-09-27

RUNTIME_CHANGE = 1
SCHEMA_CHANGE = 1
REMOTE_CHANGE = 0
PRODUCTION_CHANGE = 0

NEXT = F24_4D_CLOCK_AUTHORITY
```

A F24.4C introduz controle otimista de concorrência somente para `UPDATE` do estado de
`animais`. A revisão é autoritativa no servidor, o cliente persiste a revisão esperada junto
da operação e stale writes terminam em conflito explícito. A fase não generaliza a política
para todos os `state_*`, não implementa merge por campo e não altera Evento, Agenda ou
Protocolo.

## Baseline

```text
main: cc51099c2f6efebb4ccb3e1bbbad01354e145dac
origin/main: cc51099c2f6efebb4ccb3e1bbbad01354e145dac
branch: feat/f24-4c-state-conflict-policy
commit técnico: df5299d8d2d54f6f1ffe13e9a1cada30299cb950
worktree final: commit técnico + ajustes locais de qualidade e documentação
```

O delta técnico conhecido cobre o cliente offline, `sync-batch`, migration aditiva e testes
de characterization, PostgreSQL e E2E local. Nenhuma migration foi aplicada remotamente.

## Problema confirmado

Antes desta fase, dois devices podiam enviar `UPDATE` da mesma row de `animais` a partir da
mesma versão conhecida. O caminho genérico filtrava por chave primária e `fazenda_id`, mas não
comparava uma revisão. A ordem de chegada podia sobrescrever silenciosamente uma intenção já
aceita.

## Política adotada

```text
STATE_CONCURRENCY_POLICY = OPTIMISTIC_CONCURRENCY_CONTROL
STATE_POLICY_SCOPE = ANIMAIS_ONLY
```

O servidor aceita o update somente quando `expected_revision` coincide com a `revision`
persistida. Divergência não vira retry, last-write-wins ou merge implícito: retorna
`STATE_REVISION_CONFLICT` terminal e preserva evidência para reconciliação.

## Modelo de revision

- `animais.revision` é `bigint not null default 1` e positiva;
- trigger `BEFORE UPDATE` define `revision = old.revision + 1`;
- `search_path` da função do trigger é controlado e execução pública foi revogada;
- `revision` enviada no payload do cliente é removida antes do update;
- `expected_revision` é a última versão remota conhecida no momento de criar a operação;
- o device não fabrica revision quando o snapshot legado não contém uma versão válida.

Revision continua sendo versão de estado atual. Ela não transforma `state_*` em histórico,
não é Evento e não redefine fontes de verdade.

## Fluxo local

```text
snapshot remoto de state_animais com revision
→ createGesture persiste queue_gestures + queue_ops
→ applyOpLocal captura revision conhecida como expected_revision
→ mutação otimista local
→ retry/reload reutiliza a mesma operação persistida
```

A captura ocorre antes de alterar o snapshot local. `client_op_id`, `client_tx_id` e
`expected_revision` não são recalculados no retry.

## Fluxo remoto

```text
replay lookup por identidade
→ valida expected_revision para animais/UPDATE
→ lookup da row por PK + fazenda_id
→ compara revision atual
→ UPDATE ... WHERE PK + fazenda_id + revision
→ trigger incrementa revision
```

Row ausente ou não visível retorna `STATE_TARGET_NOT_FOUND_OR_FORBIDDEN`. Mismatch observado
antes do update ou zero rows afetadas após corrida retorna `STATE_REVISION_CONFLICT`, com
`current_revision` quando disponível.

## Replay / retry

Replay da mesma operação é resolvido antes da validação de stale write. Assim, resposta
perdida e reenvio da mesma identidade continuam idempotentes. Um conflito de outra operação
é terminal e não entra em retry automático. Uma correção exige nova operação baseada em
estado remoto reconciliado.

## Conflict terminality

`CONFLICT / STATE_REVISION_CONFLICT` é terminal, `retryable=false`, auditável no cliente e
dispara a convergência prevista sem ser confundido com resultado sanitário especializado.
Não foi autorizada resolução automática, LWW ou merge por campo.

## Cliente legado

```text
UPDATE protegido de animais sem expected_revision
→ REJECTED / STATE_EXPECTED_REVISION_REQUIRED
→ fail-closed
```

Esse comportamento evita compatibilidade silenciosa que reabriria lost update. O rollout deve
considerar clientes antigos ainda ativos antes de aplicar a migration ou publicar a função em
ambiente compartilhado.

## Multi-farm / ownership

O CAS inclui chave primária e `fazenda_id`, permanece sob RLS e não altera membership ou
ownership. Os testes confirmaram isolamento de revision entre fazendas e rejeição de acesso a
fazenda sem vínculo.

## Testes

- characterization local já reconciliada: 46/46;
- bateria relacionada final: 18 arquivos, 134/134;
- teste focado após extração de qualidade: 2/2;
- regras cobertas: captura sem fabricação, replay, retry, partial batch, conflito terminal,
  pending/pull relacionado, cross-farm e regressões do Sanitário v2.

## PostgreSQL real

`supabase/tests/stateConflictConcurrency.test.ts`: 3/3 aprovados em PostgreSQL local real.
Foram observados CAS concorrente, stale offline rejeitado, atualização sequencial aceita,
isolamento por fazenda e revision client-side sem autoridade.

## E2E local

`supabase/tests/stateConflictSyncBatch.e2e.test.ts`: 2/2 aprovados no caminho local
Auth → Edge Function → RLS → PostgreSQL. Uma tentativa executada sob concorrência com build e
outra bateria sofreu contenção do runtime Edge; após reinício do runtime e execução isolada, o
gate passou integralmente. Nenhum segredo foi registrado.

O baseline funcional Supabase também passou 5/5 no ambiente local descartável, incluindo RLS,
FK cross-tenant, `sync-batch` real e sucesso parcial.

## Escopo certificado

Certificado:

- `UPDATE` de `animais` pelo caminho genérico;
- revision autoritativa remota;
- persistência de `expected_revision` na operação;
- replay da mesma identidade;
- conflito stale terminal;
- isolamento por fazenda e ownership/RLS.

Não certificado como política geral:

- `DELETE` concorrente e tombstone completo;
- lotes, pastos, Agenda, configuração ou demais `state_*`;
- relógio como autoridade de ordenação;
- dois browsers ou devices físicos reais.

## Gaps remanescentes

- `CLOCK_AUTHORITY` segue para F24.4D;
- política completa de delete/tombstone permanece deferida;
- `REAL_MULTI_DEVICE = NOT_PROVEN`;
- `deno check` ainda encontra a tipagem preexistente de `normalizeDbError` para o retorno
  financeiro `CONFLICT`; o trecho não foi introduzido nem alterado pela F24.4C.

## Matriz final

```ini
STATE_CONCURRENCY_POLICY = OPTIMISTIC_CONCURRENCY_CONTROL

STATE_REVISION_MODEL = SERVER_AUTHORITATIVE
STATE_EXPECTED_REVISION = PERSISTED_WITH_OPERATION

ANIMAIS_STATE_STALE_WRITE_PROTECTION = SAFE
ANIMAIS_STATE_OUT_OF_ORDER_PROTECTION = SAFE
SILENT_LOST_UPDATE_ANIMAIS = NOT_OBSERVED

RETRY_SAME_OPERATION = SAFE
OFFLINE_STALE_UPDATE = CONFLICT
SEQUENTIAL_UPDATE = SAFE

OLD_CLIENT_STATE_WRITE_POLICY = FAIL_CLOSED

FIELD_LEVEL_MERGE = NOT_AUTHORIZED

STATE_CONFLICT_CODE = STATE_REVISION_CONFLICT
STATE_CONFLICT_TERMINALITY = TERMINAL
STATE_CONFLICT_AUTOMATIC_RETRY = NOT_ALLOWED

CROSS_FARM_REVISION_ISOLATION = SAFE
OWNERSHIP_ISOLATION = SAFE

REAL_POSTGRES_STATE_CONCURRENCY = PROVEN
LOCAL_EDGE_RLS_POSTGRES_E2E = PROVEN

STATE_POLICY_SCOPE = ANIMAIS_ONLY

GENERIC_STATE_STALE_WRITE_PROTECTION = PARTIAL
GENERIC_STATE_POLICY = NOT_YET_GENERALIZED

CLOCK_AUTHORITY = DEFERRED_TO_F24.4D
DELETE_TOMBSTONE_COMPLETE_POLICY = DEFERRED
REAL_MULTI_DEVICE = NOT_PROVEN
```

`ALL_STATE_CONFLICTS = SAFE` não é uma conclusão autorizada por esta fase.

## Próxima fase

A F24.4C foi integrada pelo PR #169 em `3b7ac50ed878d8d8d4b88874ad98c9d98816149b` e
formalmente encerrada em 2026-09-27. As limitações e evidências técnicas acima permanecem
inalteradas. Próxima fase: F24.4D — Clock Authority.
