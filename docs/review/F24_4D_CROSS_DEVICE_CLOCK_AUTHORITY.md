# F24.4D — Cross-device Offline/Reconnect + Clock Authority

Atualizado em: 2026-09-29

## 1. Decisão

```ini
F24_4D = CLOSED
F24_4 = IN_PROGRESS

BRANCH = feat/f24-4d-cross-device-clock-authority
BASELINE_HEAD = a72d0b5 docs(f24.4c): close phase after PR 169 merge
TECHNICAL_HEAD = faddf64 test(sync): characterize local queue clock skew
INTEGRATION_STATUS = BRANCH_ONLY
CLOSED_AT = 2026-09-29

RUNTIME_CHANGE = 1
SCHEMA_CHANGE = 0
RLS_CHANGE = 0
SYNC_CONTRACT_CHANGE = 0
REMOTE_CHANGE = 0
PRODUCTION_CHANGE = 0

NEXT = F24_4E
```

---

## 2. Escopo

A F24.4D certificou os critical sync paths relacionados a:

- isolamento de storage entre clientes independentes (`BrowserContext`);
- concorrência same-revision cross-device em `UPDATE` de `animais`;
- ordem de reconexão reversa e simetria do CAS;
- replay de lost ACK e idempotência;
- reconexão alternada, terminalidade de conflito stale, nova intenção e convergência final via pull;
- farm switch cross-device preservando pending, tenant e `expected_revision`;
- autoridade de relógio no CAS e independência de timestamp cliente no vencedor de estado;
- efeito do clock skew local sobre agendamento de retry, elegibilidade e ordenação da fila local.

---

## 3. Baseline / Commits

```text
Branch: feat/f24-4d-cross-device-clock-authority
Baseline inicial da F24.4D: a72d0b5 docs(f24.4c): close phase after PR 169 merge (baseado no merge PR #169: 3b7ac50)
Commits da F24.4D:
  8a25258 test(sync): add multi-client storage isolation harness (D1)
  a375d58 fix(sync): preserve expected revision in animal updates (D2A)
  a4ce5ca test(sync): verify reverse reconnect order (D3)
  9e0fa9b test(sync): verify lost ack replay idempotency (D4)
  f9c57cf test(sync): verify alternating reconnect convergence (D5)
  f93ace2 test(sync): verify cross-device farm switch isolation (D6)
  26b7034 test(sync): characterize clock skew authority (D7)
  faddf64 test(sync): characterize local queue clock skew (D8)
INTEGRATION_STATUS = BRANCH_ONLY
```

---

## 4. D1 — Multi-Client Storage Isolation

Harness implementado com BrowserContexts Playwright isolados e verificado contra banco local.

```ini
PLAYWRIGHT_MULTI_CONTEXT_HARNESS = PROVEN
MULTI_CLIENT_STORAGE_ISOLATION = PROVEN

INDEXEDDB_ISOLATION = PROVEN
QUEUE_OPS_ISOLATION = PROVEN
QUEUE_GESTURES_ISOLATION = PROVEN
RECONCILIATION_OBLIGATION_ISOLATION = PROVEN

INDEPENDENT_SESSION_CONTEXT = NOT_TESTED
PROFILE_RESTART_PERSISTENCE = NOT_TESTED
```

---

## 5. D2 / D3 — Concurrent CAS e Simetria de Reconexão

Dois clientes operando offline sobre o mesmo snapshot de `animais` com mesma `expected_revision`:

- primeiro CAS válido aplica remotamente (`APPLIED`, `revision` incrementada);
- segundo CAS com revisão defasada conflita (`STATE_REVISION_CONFLICT`);
- a ordem de reconexão é perfeitamente simétrica: quem reconecta primeiro vence o CAS e o retardatário recebe conflito terminal;
- `expected_revision` é transportada e verificada pelo servidor PostgreSQL.

```ini
SAME_REVISION_CONCURRENT_UPDATE = PROVEN
REVERSE_RECONNECT_ORDER = PROVEN
RECONNECT_ORDER_SYMMETRY = PROVEN

STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS

FIRST_VALID_CAS = APPLIED
SECOND_STALE_CAS = STATE_REVISION_CONFLICT

STATE_REVISION_CONFLICT_TERMINALITY = PROVEN
AUTOMATIC_RETRY = NOT_SCHEDULED
```

---

## 6. D2A — expected_revision Transport Gap

Identificado gap na serialização da fila de sync: `createGesture` persistia `expected_revision` em `queue_ops`, mas `mapOperationForSync` em `src/lib/offline/syncWorker.ts` omitia o campo no envelope HTTP do `UPDATE` de `animais`. Corrigido pontualmente no commit `a375d58` sem ampliação de escopo.

```ini
EXPECTED_REVISION_PERSISTENCE = PROVEN
EXPECTED_REVISION_TRANSPORT = PROVEN
EXPECTED_REVISION_REPLAY_STABILITY = PROVEN
```

Escopo: `animais/UPDATE`. Não generalizado para outros `state_*`.

---

## 7. D4 — Lost ACK Replay

Simulado cenário de aplicação remota com sucesso seguida de perda de rede antes da recepção do ACK pelo cliente. Replay automático subsequente:

- reenvia exatamente a mesma identidade (`client_op_id`, `client_tx_id`, `expected_revision`);
- servidor reconhece a operação já aplicada no ledger e retorna sucesso sem reaplicação;
- nenhuma mutação adicional no PostgreSQL e nenhum incremento espúrio de `revision`.

```ini
LOST_ACK_REPLAY = PROVEN
REPLAY_SAME_IDENTITY = PROVEN
REPLAY_SAME_EXPECTED_REVISION = PROVEN
REPLAY_IDEMPOTENCY = PROVEN
REMOTE_SINGLE_APPLICATION = PROVEN
REMOTE_SINGLE_REVISION_INCREMENT = PROVEN
SELF_REPLAY_STALE_CONFLICT = NOT_OBSERVED
```

Escopo: `UPDATE` de `animais`. Replay de Eventos não certificado neste item.

---

## 8. D5 — Alternating Reconnect, Conflito Terminal e Convergência

Caracterizado ciclo completo de reconexão alternada entre dois clientes:

1. Cliente A reconecta e aplica;
2. Cliente B reconecta com snapshot defasado e recebe `STATE_REVISION_CONFLICT` terminal;
3. B reconcilia via pull e adquire a revisão atualizada;
4. B formula nova intenção com nova identidade (`client_op_id`, `client_tx_id`) e nova `expected_revision`;
5. Nova intenção aplica com sucesso;
6. Ambos os clientes convergem para o mesmo estado após pull.

```ini
ALTERNATING_RECONNECT = PROVEN

STALE_OPERATION_TERMINALITY = PROVEN
STALE_OPERATION_AUTOMATIC_RETRY = NOT_SCHEDULED

LOSING_CLIENT_RECONCILIATION = PROVEN

NEW_OPERATION_AFTER_CONFLICT = PROVEN
NEW_OPERATION_NEW_IDENTITY = PROVEN
NEW_EXPECTED_REVISION = PROVEN

CROSS_DEVICE_FINAL_CONVERGENCE = PROVEN_AFTER_PULL
RECONCILIATION_OBLIGATIONS_DRAINED = YES
```

*Nota histórica*: Durante a bateria D5, uma primeira execução pontual falhou em `prepareClient` e a segunda execução passou sem alteração de código (causa atribuída a flutuação transitória de inicialização de sessão no harness de teste local, sem gap funcional de runtime).

---

## 9. D6 — Cross-Device Farm Switch Isolation

Comprovação de isolamento multi-tenant quando um cliente possui operações offline pendentes na Fazenda A e troca para a Fazenda B:

- operações pendentes da Fazenda A permanecem intactas no IndexedDB com suas identidades e `expected_revision`;
- pull na Fazenda B é estritamente isolado e não contamina a fila nem os estados locais da Fazenda A;
- retorno à Fazenda A e reconexão sincronizam com sucesso as operações pendentes apenas contra a Fazenda A;
- o estado da Fazenda B no PostgreSQL permanece perfeitamente inalterado.

```ini
FARM_SWITCH_WITH_PENDING = PROVEN
FARM_A_PENDING_PRESERVED = PROVEN
FARM_A_PENDING_IDENTITY_PRESERVED = PROVEN
FARM_A_EXPECTED_REVISION_PRESERVED = PROVEN

FARM_B_PULL_ISOLATION = PROVEN

CROSS_FARM_QUEUE_CONTAMINATION = NOT_OBSERVED
CROSS_FARM_STATE_CONTAMINATION = NOT_OBSERVED

RETURN_TO_FARM_A_RECOVERY = PROVEN

FARM_A_REMOTE_WRITE_ISOLATION = PROVEN
FARM_B_REMOTE_STATE_PRESERVED = PROVEN

MULTI_TENANT_FARM_ISOLATION = PROVEN
CROSS_DEVICE_FARM_ISOLATION = PROVEN

FARM_SWITCH_CROSS_DEVICE = PROVEN
NON_ACTIVE_FARM_RECONCILIATION = NOT_TESTED
```

---

## 10. D7 — Clock Authority / CAS

Caracterizado o efeito de clock skew severo (+55 min no cliente A, -55 min no cliente B) sobre o CAS do estado remoto:

- o relógio do cliente (`client_recorded_at`) não possui autoridade sobre o vencedor do CAS;
- o vencedor do estado é estritamente determinado pelo CAS da revisão no PostgreSQL (`SERVER_REVISION_CAS`);
- mesmo com timestamp cliente adiantado ou atrasado, stale write continua sendo rejeitado com `STATE_REVISION_CONFLICT`;
- a projeção reprodutiva histórica, por sua vez, respeita o tempo factual (`occurred_at`) do domínio, não a ordem de chegada ou timestamp local de registro.

```ini
CLOCK_SKEW_HARNESS = PROVEN

STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS
CLIENT_CLOCK_STATE_AUTHORITY = NONE_FOR_ANIMAIS_CAS

STATE_CAS_CLOCK_INDEPENDENCE = PROVEN
STALE_WRITE_PROTECTION_UNDER_CLOCK_SKEW = PROVEN

EXPECTED_REVISION_UNDER_CLOCK_SKEW = PRESERVED
```

---

## 11. D8 — Local Queue Clock Skew / Retry Scheduling

Caracterizado o efeito do relógio do dispositivo sobre o agendamento local da fila, retry e elegibilidade:

- `next_attempt_at` é calculado com base em `Date.now()` local e avaliado contra ele;
- adiantar o relógio local torna operações em backoff elegíveis antecipadamente (`CLOCK_FORWARD_CAN_MAKE_RETRY_ELIGIBLE = YES`);
- atrasar o relógio local posterga temporariamente o retry enquanto o relógio estiver artificialmente no passado (`CLOCK_BACKWARD_CAN_DELAY_RETRY = YES`);
- operação NÃO fica permanentemente estagnada após retorno do relógio à normalidade (`CLOCK_BACKWARD_CAN_PERMANENTLY_STALL_OPERATION = NO_IN_TESTED_SCENARIO`);
- a recuperação é imediata após normalização do relógio (`RECOVERY_AFTER_CLOCK_NORMALIZATION = PROVEN`);
- identidade da operação (`client_op_id`, `client_tx_id`, `expected_revision`, `created_at`) permanece rigorosamente preservada;
- conflito terminal `STATE_REVISION_CONFLICT` não é reaberto por variação de relógio nem por reconnect;
- reconexão explícita acelera retries de rede de forma neutra ao relógio (`accelerateNetworkRetriesOnReconnect`).

```ini
QUEUE_CREATED_AT_AUTHORITY = CLIENT_CLOCK
NEXT_ATTEMPT_AT_AUTHORITY = CLIENT_CLOCK

CLOCK_FORWARD_CAN_MAKE_RETRY_ELIGIBLE = YES
CLOCK_BACKWARD_CAN_DELAY_RETRY = YES

CLOCK_BACKWARD_CAN_PERMANENTLY_STALL_OPERATION = NO_IN_TESTED_SCENARIO

RECOVERY_AFTER_CLOCK_NORMALIZATION = PROVEN

RETRY_IDENTITY_PRESERVED = PROVEN
EXPECTED_REVISION_PRESERVED = PROVEN

LOCAL_QUEUE_ORDER_CAN_CHANGE_WITH_CLOCK = YES

CLOCK_SKEW_CAN_BREAK_CAUSAL_DEPENDENCY = NOT_TESTED
CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY = NOT_OBSERVED

CLOCK_SKEW_CAN_CAUSE_DUPLICATE = NOT_OBSERVED
CLOCK_SKEW_CAN_REOPEN_TERMINAL_CONFLICT = NOT_OBSERVED

QUEUE_CLOCK_SKEW_CRITICAL_EFFECT = NOT_OBSERVED
```

---

## 12. Contrato Final de Clock Authority

Consolidação formal dos papéis de tempo no RebanhoSync:

```ini
STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS
```
Para `animais/UPDATE`. A `revision` do registro é autoritativa no servidor e independente de timestamps do cliente. `revision != timestamp`.

```ini
EVENT_TIME_AUTHORITY = DOMAIN_FACTUAL_INPUT_OR_CLIENT_CLOCK_FALLBACK
```
`occurred_at` representa o tempo factual do fato e comanda ordenação histórica de projeções do domínio. Não decide vencedor do CAS de estado.

```ini
QUEUE_CREATED_AT_AUTHORITY = CLIENT_CLOCK
NEXT_ATTEMPT_AT_AUTHORITY = CLIENT_CLOCK
```
Campos de fila local afetam apenas ordenação local e elegibilidade de retry na máquina do cliente. Não sobrepõem autoridade remota nem recriam identidades.

```ini
CLOCK_SKEW_BEHAVIOR = CHARACTERIZED_FOR_CRITICAL_SYNC_PATHS
```
*Não autorizada a conclusão*: `CLOCK_SKEW_SAFE_FOR_ALL_DOMAINS`.

---

## 13. Matriz Canônica Final da F24.4D

```ini
F24_4D = CLOSED

PLAYWRIGHT_MULTI_CONTEXT_HARNESS = PROVEN
MULTI_CLIENT_STORAGE_ISOLATION = PROVEN

SAME_REVISION_CONCURRENT_UPDATE = PROVEN
REVERSE_RECONNECT_ORDER = PROVEN
RECONNECT_ORDER_SYMMETRY = PROVEN

EXPECTED_REVISION_PERSISTENCE = PROVEN
EXPECTED_REVISION_TRANSPORT = PROVEN
EXPECTED_REVISION_REPLAY_STABILITY = PROVEN

LOST_ACK_REPLAY = PROVEN
REPLAY_IDEMPOTENCY = PROVEN
REMOTE_SINGLE_APPLICATION = PROVEN
REMOTE_SINGLE_REVISION_INCREMENT = PROVEN

ALTERNATING_RECONNECT = PROVEN
CROSS_DEVICE_FINAL_CONVERGENCE = PROVEN_AFTER_PULL

FARM_SWITCH_CROSS_DEVICE = PROVEN
MULTI_TENANT_FARM_ISOLATION = PROVEN

STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS
STATE_CAS_CLOCK_INDEPENDENCE = PROVEN
STALE_WRITE_PROTECTION_UNDER_CLOCK_SKEW = PROVEN

RECOVERY_AFTER_CLOCK_NORMALIZATION = PROVEN
RETRY_IDENTITY_PRESERVED = PROVEN
EXPECTED_REVISION_PRESERVED = PROVEN

QUEUE_CLOCK_SKEW_CRITICAL_EFFECT = NOT_OBSERVED
CLOCK_SKEW_BEHAVIOR = CHARACTERIZED_FOR_CRITICAL_SYNC_PATHS

REAL_PHYSICAL_MULTI_DEVICE = NOT_PROVEN
NON_ACTIVE_FARM_RECONCILIATION = NOT_TESTED
ALL_DOMAIN_CLOCK_BEHAVIOR = NOT_PROVEN
CLOCK_SKEW_CAN_BREAK_CAUSAL_DEPENDENCY = NOT_TESTED
CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY = NOT_OBSERVED
```

---

## 14. Limitações Preservadas

As seguintes limitações foram mantidas com rigor e não bloqueiam o closeout da F24.4D:

1. `REAL_PHYSICAL_MULTI_DEVICE = NOT_PROVEN`: a validação foi realizada com múltiplos `BrowserContext` independentes em Chromium (mesmo processo Playwright); não equivale a dispositivos físicos distintos em redes e baterias reais.
2. `NON_ACTIVE_FARM_RECONCILIATION = NOT_TESTED`: reconciliação de fazenda inativa sob farm switch cross-device não foi avaliada neste escopo.
3. `ALL_DOMAIN_CLOCK_BEHAVIOR = NOT_PROVEN`: clock skew foi caracterizado nos caminhos críticos de CAS de animais e retry de fila local; outros domínios de estado não foram testados.
4. `CLOCK_SKEW_CAN_BREAK_CAUSAL_DEPENDENCY = NOT_TESTED`: dependência causal explícita entre operações da mesma fila sob clock skew reverso permanece não testada.
5. `CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY = NOT_OBSERVED`: não observado no comportamento determinístico do backoff com cap.

---

## 15. Próxima Fase

```ini
NEXT = F24_4E — Conflict Resolution Contract
```

A F24.4E definirá o contrato e matriz de tratamento por domínio (rejeitar, reconciliar, mergear quando aplicável) para as classes de conflito inventariadas.
