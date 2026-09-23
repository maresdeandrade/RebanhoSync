# F24.3A — Offline prolongado / farm-switch / recovery characterization

Atualizado em: 2026-09-23

Baseline auditada: `origin/main@2104098d31b0dda20d2a65e6beceed213d034784`

Status: **HISTORICAL_CHARACTERIZATION — RESOLVED_BY_F24.3_CLOSEOUT**

> Status posterior: os gaps caracterizados abaixo foram tratados por F24.3B1, F24.3B2/B2.1,
> F24.3B3 e F24.3C. A matriz vigente está no
> [closeout F24.3](./F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md). Este documento preserva o estado
> observado na baseline auditada; `REAL_PROCESS_KILL = NOT_PROVEN` continua válido.

## Decisão

```ini
F24_3A_FAILURE_MATRIX = COMPLETE

FARM_SWITCH_REPLACE = GAP_CONFIRMED
NON_ACTIVE_FARM_RECONCILIATION = GAP_CONFIRMED
LONG_OFFLINE_RECOVERY = GAP_CONFIRMED
INTERMITTENT_RECONNECT = GAP_CONFIRMED
CRASH_RESTART = NOT_PROVEN
UPGRADE_WITH_PENDING_WORK = GAP_CONFIRMED
HTTP_429_POLICY = GAP_CONFIRMED
GENERIC_BACKOFF_JITTER = GAP_CONFIRMED

F24_2_CLOSED_CAPABILITIES_REOPENED = NO
PRODUCTION_CHANGE = 0
REMOTE_CHANGE = 0
NEXT_PHASE_STARTED = NO
```

`CRASH_RESTART = NOT_PROVEN` não reabre `SYNCING_RECOVERY` nem
`DURABLE_RECONCILIATION`: os mecanismos locais permanecem cobertos e passaram nos testes
existentes. O que falta é a jornada real de encerramento/reabertura do runtime, distinta da
invocação unitária dos recovery handlers.

## FATO CONFIRMADO

### 1. Farm-switch / hydrate replace

`pullDataForFarm` usa `replace` por padrão. Ele busca todas as tabelas antes da escrita e abre
uma única transação Dexie para as stores remotas válidas. Dentro da transação, executa
`store.clear()` para toda store solicitada, exceto quando a tabela remota é `eventos` ou
`eventos_animais` (`pull.ts:432-537`).

No pull inicial padrão, recebem `clear()`:

- `state_pastos`, `state_lotes`, `state_animais`, `state_agenda_itens`;
- `event_eventos_sanitario`, `event_eventos_ecc`, `event_eventos_pesagem`,
  `event_eventos_financeiro`, `event_eventos_movimentacao`, `event_eventos_comercial`,
  `event_eventos_nutricao` e `event_eventos_pasto_avaliacao`;
- `state_protocolos_sanitarios`, `state_protocolos_sanitarios_itens`,
  `state_fazenda_sanidade_config` e `state_sanitario_casos`;
- `state_insumos`, `state_insumo_apresentacoes`, `state_insumo_lotes` e
  `state_insumo_movimentacoes`;
- `state_contrapartes`, `state_sociedades_pecuarias`, `state_sociedade_animais`,
  `state_finance_categories` e `state_finance_transactions`.

`event_eventos` não é limpo. `event_eventos_animais` também é explicitamente protegido se
for solicitado, embora não integre `DEFAULT_REMOTE_TABLES`. A lista é dinâmica: chamadas
com subconjuntos limpam somente as stores válidas desse subconjunto.

O `clear()` é global à store, não filtrado por `fazenda_id`. Portanto, remove rows de outras
fazendas. Para dados já sincronizados isso se comporta como descarte de cache de fazenda não
ativa; a fila continua sendo a evidência durável. Para estado otimista pendente, porém, há
perda indevida da projeção local:

1. antes do clear, o código coleta apenas rows pendentes da fazenda que está sendo puxada;
2. o clear remove rows das demais fazendas;
3. somente o pending da fazenda alvo é reinserido;
4. no retorno à fazenda anterior, o row remoto correspondente ao pending é filtrado, mas o
   snapshot local a reinserir já foi removido.

O teste `farmSwitchReplace.characterization.test.ts` comprovou A → B → A com dados e pending
nas duas fazendas: as duas ops permaneceram em `queue_ops`, mas `animal-a-pending` não voltou
à `state_animais`. O mesmo teste comprovou que os dois cursores, as duas obligations e o
registro de ownership não foram alterados.

`sync_pull_cursors`, `sync_reconcile_obligations`, `queue_*` e `local_ownership` não entram
na transação do replace e não recebem clear. Cursores são chaves por tabela/escopo/fazenda;
obligations são chaves por fazenda/scope.

O farm-switch real altera `active_fazenda_id` em `useAuth.tsx:276-289`; o worker continua
vivo porque `AppShell` reinicia por usuário, não por fazenda. O próximo tick detecta a nova
fazenda e chama `pullInitialData`, que usa replace (`syncWorker.ts:424-448`,
`pull.ts:1011-1016`).

Além disso, o worker processa todas as gestures `PENDING`, sem filtro pela fazenda ativa
(`syncWorker.ts:340-348`). Pulls pós-ACK e drains factuais chamam `pullDataForFarm` sem
`mode`, portanto usam replace. Assim, uma gesture de fazenda não ativa pode limpar stores
compartilhadas enquanto outra fazenda está selecionada. A obligation da fazenda não ativa é
durável e permanece isolada, mas sua execução/convergência não é isolada do cache ativo.

### 2. Offline prolongado / fila acumulada

Fatos preservados da F24.2:

- gesture e ops ficam em stores Dexie distintas e duráveis;
- retry reutiliza `client_tx_id` e `client_op_id` persistidos;
- stale `SYNCING` com ops volta a `PENDING`; sem ops termina fail-closed em `ERROR`, nunca em
  falso `DONE`;
- `ERROR` de transporte recuperável volta a `PENDING` no recovery de startup;
- ownership é verificado antes de pull, drain, recovery e processamento, bloqueando replay
  cross-user;
- obligations sobrevivem ao ACK, falha de pull e restart, com delete protegido por
  `generation_id`.

O worker carrega todas as gestures `PENDING`, ordena por `created_at` e processa uma a uma no
mesmo tick. `isTickRunning` evita ticks concorrentes. Não há limite de backlog, chunk de
gestures nem backpressure genérico. Isso não prova perda para fila grande, mas a correção em
escala e o custo permanecem `NOT_PROVEN`; benchmark pertence à F24.6.

Para erro genérico de transporte, cada tentativa incrementa `gesture.retry_count` sem
`next_attempt_at`. Com `MAX_RETRIES = 3`, a quarta falha deixa a gesture em `ERROR`. O
recovery de `ERROR` roda somente enquanto `startupRecoveryDone` é falso. O listener `online`
chama `runOwnedSyncWork`, mas não reabre o recovery depois disso.

O teste `longOfflineReconnect.characterization.test.ts` iniciou o worker, esgotou quatro
tentativas com `Failed to fetch`, restaurou a rede e disparou `online`: gesture e op
permaneceram duráveis e com as mesmas identidades, porém a gesture continuou `ERROR`. Isso
confirma gap de reconnect único após offline prolongado e, por consequência, de reconnect
intermitente quando as falhas acumuladas atingem o limite.

`retry_count` atual:

- retry genérico: contador da gesture, imediato no próximo processamento, limite 3;
- recovery de `ERROR` recuperável no startup: redefine o contador para `0`;
- stale `SYNCING`: preserva o contador e a identidade;
- Sanitário v2: contador por op, backoff exponencial de 5 s até 5 min, sem jitter;
- HTTP 429: segue o caminho genérico, não o backoff do Sanitário v2.

### 3. Upgrade Dexie até v31

Inventário relevante:

| Versão  | Efeito sobre pending work                                                        |
| ------- | -------------------------------------------------------------------------------- |
| v1      | cria `queue_gestures`, `queue_ops` e `queue_rejections`                          |
| v2-v3   | mantém as stores da fila; altera índices de domínio                              |
| v6      | adiciona índice simples `status` em gestures; não há clear/transform da fila     |
| v7      | transforma somente `queue_rejections.created_at`; gestures e ops são preservadas |
| v8-v15  | repete o mesmo schema da fila, sem upgrade destrutivo                            |
| v16-v25 | adiciona/ajusta stores de domínio; fila não é transformada                       |
| v26     | adiciona `sync_pull_cursors`                                                     |
| v27-v29 | adiciona/ajusta stores de domínio; fila não é transformada                       |
| v30     | adiciona `sync_reconcile_obligations`                                            |
| v31     | adiciona `local_ownership` e grava `owner_user_id = null`                        |

O teste `pendingWork.upgrade.characterization.test.ts` comprovou upgrade v1 → v31 com
gestures `PENDING`, `ERROR` recuperável e `SYNCING`, suas ops e `retry_count` preservados.
Também comprovou v30 → v31 preservando fila e obligation. Não houve regeneração de
identidade nem falso `DONE`.

O gap está no recovery pós-upgrade: v31 marca todo banco legado como owner `UNKNOWN`, e
`establishLocalOwnership` não adota ownership quando já existe row com `owner_user_id =
null` (`db.ts:808-818`, `ownership.ts:51-80`). `useAuth` rejeita a sessão quando o resultado
não é `OWNED`; worker e leitura tenant-sensitive também permanecem fail-closed. Portanto, o
pending work é preservado e isolado, mas não existe caminho automático comprovado para o
mesmo usuário retomá-lo após v30 → v31.

Isso não reabre `LOCAL_USER_OWNERSHIP`: o bloqueio cross-user e a adoção fail-closed continuam
corretos. O gap é de continuidade/recovery do upgrade com trabalho existente.

### 4. HTTP 429 / retry genérico

Não há branch para HTTP 429, leitura de `Retry-After` ou scheduler genérico por tentativa.
Qualquer response não-OK vira `Error("HTTP <status> ...")`. Apenas 403 é não retryable; 429
passa pelo retry genérico da gesture.

O teste `syncWorkerHttp429.characterization.test.ts` comprovou:

- header `Retry-After: 120` não cria `next_attempt_at`;
- duas chamadas consecutivas são aceitas imediatamente;
- após quatro respostas 429, a gesture termina em `ERROR` com `retry_count = 3`;
- `recoverErroredGesturesOnce` não recupera 429, pois 429 não integra os markers;
- op, `client_tx_id` e `client_op_id` permanecem intactos.

Logo:

```ini
HTTP_429_POLICY = GAP_CONFIRMED
RETRY_AFTER_SUPPORT = ABSENT
GENERIC_BACKOFF = ABSENT
JITTER = ABSENT
RETRY_STORM_RISK = HIGH
```

O risco de rajada cresce com fila acumulada porque todas as gestures elegíveis são tentadas
sequencialmente no mesmo tick e voltam a ser elegíveis sem atraso próprio.

## Matriz de cenários

| Cenário                                       | Estado atual   | Evidência                                                                        | Severidade       | Próxima ação                                                      |
| --------------------------------------------- | -------------- | -------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| Replace: stores selecionadas                  | SAFE           | Transação única; lista dinâmica; `eventos` e `eventos_animais` não recebem clear | Baixa            | Manter atomicidade                                                |
| Replace: dados sincronizados de outra fazenda | SAFE           | Clear global descarta cache não ativo; fonte remota permanece                    | Baixa            | Tornar a intenção de cache explícita na F24.3B                    |
| Replace: pending da fazenda alvo              | SAFE           | Snapshot local é coletado antes do clear e reinserido                            | Baixa            | Preservar contrato                                                |
| A → B → A com pending em A                    | GAP_CONFIRMED  | Teste novo: op A permanece, projeção `animal-a-pending` desaparece               | Alta             | Definir isolamento/preservação multi-farm antes do patch          |
| Duas fazendas na mesma store                  | GAP_CONFIRMED  | `store.clear()` não filtra `fazenda_id`                                          | Alta             | Substituir semântica global por estratégia tenant-aware na F24.3B |
| Pending da fazenda não ativa                  | GAP_CONFIRMED  | Coleta de snapshots filtra somente a fazenda puxada                              | Alta             | Proteger pending de todas as fazendas ou separar caches           |
| Cursor A/B durante replace                    | SAFE           | `sync_pull_cursors` não participa do clear; duas chaves preservadas no teste     | Baixa            | Manter chave por fazenda                                          |
| Obligation A/B durante switch                 | SAFE           | Store separada; list/drain por fazenda; duas obligations preservadas             | Baixa            | Preservar generation guard                                        |
| Reconcile/pull de fazenda não ativa           | GAP_CONFIRMED  | Worker processa todas as fazendas; pull pós-ACK usa replace global               | Alta             | Isolar convergência do cache ativo na F24.3B                      |
| Ownership durante farm-switch                 | SAFE           | Ownership é por usuário e não é alterado pelo replace                            | Baixa            | Não converter ownership em chave de fazenda                       |
| Fila pequena                                  | SAFE           | Fluxos focados existentes preservam identidade, ACK e recovery                   | Baixa            | Manter cobertura existente                                        |
| Fila grande — correção semântica              | NOT_PROVEN     | Loop não tem limite, mas não há teste de backlog heterogêneo grande              | Média            | Teste funcional limitado na F24.3B; sem benchmark                 |
| Fila grande — performance                     | DEFER_TO_F24_6 | Benchmark explicitamente fora do escopo                                          | Média            | Medir somente na F24.6                                            |
| Offline prolongado sem esgotar retry          | SAFE           | Gesture/op permanecem PENDING e duráveis                                         | Baixa            | Preservar identidade                                              |
| Offline prolongado até esgotar retry          | GAP_CONFIRMED  | Quarta falha genérica gera ERROR                                                 | Alta             | Política durável de retry na F24.3B                               |
| Reconnect único após ERROR na mesma sessão    | GAP_CONFIRMED  | Teste novo: `online` não reabre recovery consumido                               | Alta             | Reativar work elegível sem depender de restart                    |
| Reconnect intermitente                        | GAP_CONFIRMED  | Retry imediato acumula contador e pode estacionar em ERROR                       | Alta             | Backoff/jitter e wake-up durável na F24.3B                        |
| Restart com PENDING                           | SAFE           | Dexie preserva gesture/op e worker consulta PENDING                              | Baixa            | Preservar                                                         |
| Restart com SYNCING e ops                     | SAFE           | Recovery existente requeuea com identidade persistida                            | Baixa            | Preservar stale-worker protection                                 |
| Restart com ERROR recuperável                 | SAFE           | Recovery de startup volta a PENDING e zera retry_count                           | Baixa            | Preservar markers já fechados na F24.2                            |
| Restart com obligation                        | SAFE           | Teste existente comprova drain após restart                                      | Baixa            | Preservar generation guard                                        |
| Crash/restart real do processo                | NOT_PROVEN     | Apenas recovery local/unitário foi executado; não houve kill/reopen real         | Média            | Jornada controlada futura, sem reabrir F24.2                      |
| Upgrade v1 → v31 com fila heterogênea         | SAFE           | Teste novo preserva PENDING/ERROR/SYNCING, ops, IDs e retry_count                | Baixa            | Manter schema forward-only                                        |
| Upgrade v30 → v31 com obligation              | SAFE           | Teste novo preserva fila e obligation                                            | Baixa            | Manter store e geração                                            |
| Retomada após v31 com owner legado UNKNOWN    | GAP_CONFIRMED  | v31 grava null; auth/worker permanecem fail-closed                               | Alta             | Projetar recovery autenticado sem adoção cross-user               |
| HTTP 429                                      | GAP_CONFIRMED  | Teste novo: retry imediato, ERROR no limite, sem recovery marker                 | Alta             | Política explícita na F24.3B                                      |
| `Retry-After`                                 | GAP_CONFIRMED  | Header não é lido                                                                | Alta             | Suportar delta-seconds/data com limites na F24.3B                 |
| Backoff genérico                              | GAP_CONFIRMED  | Gesture não recebe `next_attempt_at`                                             | Alta             | Scheduler durável na F24.3B                                       |
| Jitter genérico                               | GAP_CONFIRMED  | Não existe cálculo de jitter                                                     | Média            | Jitter limitado/testável na F24.3B                                |
| Duplicação/falso DONE/cross-user              | SAFE           | IDs persistem; zero-op fail-closed; ownership bloqueia mismatch                  | Alta se regredir | Não reabrir capacidades F24.2                                     |

## INFERÊNCIA

- O descarte de dados sincronizados de fazenda não ativa pode ser uma política de cache
  single-farm aceitável. O mesmo não vale automaticamente para projeções otimistas ligadas a
  ops pendentes; a fila sozinha não restaura a visibilidade local no retorno A → B → A.
- Uma fila grande não tem evidência de perda apenas por tamanho, pois o loop é sequencial e
  protegido contra sobreposição. Sem teste heterogêneo em escala, porém, não é possível
  declarar `SAFE` para correção completa; tempo/memória pertencem à F24.6.
- O risco de retry storm é alto por alinhamento no tick de 5 s e ausência de atraso por
  gesture. Esta etapa não quantifica carga ou throughput.

## RECOMENDAÇÃO

Não aplicar correção funcional nesta etapa. Para a futura F24.3B, ordenar a investigação por
risco:

1. definir a política multi-farm do cache e preservar projeções de toda op pendente, inclusive
   em pulls pós-ACK de fazenda não ativa;
2. definir recovery autenticado de bancos v31 `UNKNOWN` sem permitir adoção cross-user;
3. implementar política genérica durável para 429/transporte com `Retry-After`, backoff,
   jitter e wake-up no reconnect, preservando identidades e capacidades fechadas da F24.2.

Fila grande deve receber apenas teste funcional limitado na F24.3; benchmark, throughput,
memória e limites ficam em `DEFER_TO_F24_6`. Concorrência multi-device e conflitos de domínio
ficam em `DEFER_TO_F24_4`.

## Validação executada

- suíte Vitest focada nos quatro testes novos — 4 arquivos, 5 testes, PASS;
- suíte Vitest ampliada com pull, initial pull, recovery, fila legada, obligations, upgrade,
  ownership, timeout, auth, HTTP 500 e os quatro testes novos — 17 arquivos, 84 testes,
  PASS. O runner também encontrou três arquivos correspondentes em um worktree auxiliar já
  existente;
- `pnpm exec eslint` nos quatro testes novos — PASS, sem saída;
- `pnpm exec prettier --check` nos cinco arquivos criados — PASS após formatação mecânica;
- `pnpm exec fallow audit --gate new-only` — PASS, sem issues nos cinco arquivos alterados;
  cinco findings herdados de dependências foram excluídos pelo gate e houve warning de
  resolução de `node_modules` em worktrees auxiliares;
- `pnpm run gates:docs` — PASS nos headers, continuidade e data contract;
- `git diff --check` — PASS, sem saída.

Não executado:

- regressão global, build completo ou E2E: fora da validação proporcional de
  characterization-first;
- benchmark de fila/IndexedDB: `DEFER_TO_F24_6`;
- crash/kill real do runtime: `CRASH_RESTART = NOT_PROVEN`;
- qualquer migration remota, deploy, alteração de ambiente ou produção: não autorizado.

## Capacidades F24.2 preservadas

Permanecem `CLOSED`, sem patch funcional ou replanejamento nesta etapa:

`EVENT_IDENTITY`, `IDEMPOTENT_REPLAY`, `ATOMIC_ACK`, `ATOMIC_CLAIM`,
`SYNCING_RECOVERY`, `STALE_WORKER_PROTECTION`, `DURABLE_RECONCILIATION`,
`GENERATION_GUARD`, `REQUEST_TIMEOUT`, `IN_FLIGHT_ABORT`,
`HTTP_500_502_503_504_RECOVERY`, `AUTH_SESSION_RECOVERY`,
`LEGACY_QUEUE_RECOVERY`, `LOCAL_USER_OWNERSHIP`,
`CROSS_USER_QUEUE_ISOLATION` e `CROSS_USER_LOCAL_VISIBILITY`.
