# F24.5C — Failure / Retry Telemetry

Data: 2026-10-06. Status: `READY_FOR_REVIEW` (entrega local, não integrada).

## Decisão e baseline real

Implementar somente G03/G04/G07. Observação não decide retry, replay, ACK,
terminalidade, reconcile, autorização, conflito ou fonte factual.

| Campo | Fato confirmado |
| --- | --- |
| Branch inicial | `codex/f24-5b-structured-diagnostics` |
| HEAD inicial | `8010cdee166c110ce8b10312e5248b039330121d` |
| Rebaseline | `git fetch origin --prune`, `git checkout main`, `git pull --ff-only` |
| main / origin/main | `99c39cbd7b2f64521e59baf0587a8d34cc2ffabe` |
| Integração de B | Merge PR #183 presente no HEAD de main |
| Worktree de entrada | Limpa; staged e untracked vazios |
| Branch própria | `codex/f24-5c-failure-retry-telemetry` |
| HEAD da entrega local | `99c39cbd7b2f64521e59baf0587a8d34cc2ffabe` |

Nenhum trabalho local preexistente foi transportado ou sobrescrito. Não houve
commit, push, PR, merge, deploy ou migration remota. F24.5 permanece em andamento.
Os documentos de continuidade anteriores ainda descrevem B como próxima etapa;
esta evidência registra o baseline observado, sem reescrever o closeout de B.

## G03 — entrega e checkpoint

Antes: `flushTelemetryBatch` retornava `true` no catch de transporte e permitia
avançar `rebanhosync:telemetry-flush:<fazenda_id>` sem ACK. HTTP 2xx era suficiente,
independentemente do corpo. Paginação com timestamps iguais substituía os IDs
confirmados pela última página, tornando páginas anteriores elegíveis novamente.

Depois: apenas HTTP aceito e JSON `{ success: true, inserted: integer }`, com
contagem entre zero e tamanho do batch, confirmam entrega. Rede, abort, timeout
de 15 segundos, HTTP não aceito, JSON inválido e receipt inválido preservam o
checkpoint anterior e os registros locais. O retry imediato existente continua
limitado a duas tentativas; um flush posterior reutiliza os mesmos IDs. Os IDs
confirmados no mesmo timestamp são acumulados para evitar reenvio infinito.

Contrato observado no código de `supabase/functions/telemetry-ingest/index.ts`:
batch limitado a 100; autenticação do usuário e escrita sob RLS; upsert por `id`
com `ignoreDuplicates: true`; erro de escrita retorna HTTP 500; sucesso retorna
`success: true` e contagem de linhas novas. Por isso `inserted: 0` pode confirmar
replay após perda de ACK. Não é exigida igualdade entre inserted e batch.
O endpoint não foi alterado nem chamado remotamente nesta execução; compatibilidade
com a versão publicada não foi certificada.

Evidência: testes de delivery confirmado, preservação de checkpoint existente em
sete classes de falha, retry posterior com os mesmos IDs, replay com zero inserts,
request pendurado abortado e 101 registros com timestamp igual em duas páginas.

## G04 — backlog por fazenda

Antes: `pending.length` global era declarado como backlog da primeira fazenda.
Depois: o mesmo snapshot pendente do ciclo é agrupado por `fazenda_id`; cada
`sync_backlog` recebe somente sua contagem. Não representa medição pós-processamento
nem contagem de operações individuais. A política de seleção da fila não mudou.

Evidência: cinco pendências (A=2, B=3) produzem duas métricas persistidas,
respectivamente A=2 e B=3, usando o agrupador também chamado pelo worker.

## G07 — falhas e retries observáveis

`queue_gestures.diagnostics.last_failure?` é um único snapshot substituível com
`code`, `cause_code`, `observed_at` e `retry_count`. Reutiliza o contexto de B,
`client_tx_id`, `client_op_ids` e a fazenda do gesto. Sem store, índice, schema
Dexie, trace ID, attempt ID ou fonte factual nova.

Cobertura implementada/testada:

- `NETWORK_FAILURE`: rede e suas mensagens técnicas conhecidas;
- `REQUEST_ABORTED`: abort/timeout observável, sem inferir qual disparou o controller;
- `HTTP_401`: observado antes do refresh/retry único, inclusive quando o ACK posterior funciona;
- `HTTP_403`: autorização permanece terminal, sem consumo de retry;
- `HTTP_429`: preservado como rate limit, inclusive acima do limite genérico;
- `HTTP_5xx`: código HTTP específico; teste de classificação com 503 e regressões existentes de 500;
- `RETRY_EXHAUSTED`: somente quando a decisão funcional existente chega à exaustão, mantendo a causa original;
- `SYNC_FAILURE`: fallback técnico controlado para falha não classificada do push.

O diagnóstico observa a saída do algoritmo existente; não alimenta suas decisões.
O catch funcional não foi alterado para preservar nomes de DOMException: apenas
o classificador recebe o erro original. Nenhum conflito CAS factual foi convertido
em falha de transporte; os caminhos de resultado por operação permanecem iguais.

`sync_error` passa a usar reason_code controlado e payload com contagem, IDs,
causa técnica e retry_count. A mensagem bruta de erro/resposta foi removida dessa
métrica. Testes verificam ausência de texto privado no payload e no diagnóstico.
JWT, headers, request/response completos, payload de domínio, record e snapshots
não são adicionados. O sanitizador compartilhado preserva o fallback de reconcile.

## Persistência, retenção e volume

Shape existente: `PilotMetricEvent` tem dez campos de primeiro nível, incluindo
`reason_code?` e `payload`; escrita por UUID em `metrics_events`, sem remoção no
flush. Buffer append-only, batch de 100, cursor localStorage por fazenda.
Não foi encontrado purge por idade de metrics_events nos callers de produção
consultados; reset de ownership não equivale a política de retenção.

O patch substitui o conteúdo da métrica sync_error já existente e acrescenta um
snapshot fixo por gesto, sem histórico de tentativas. Backlog produz uma métrica
por fazenda representada no snapshot, em vez de uma por ciclo global.
O crescimento local preexistente continua sendo risco explícito; não houve
aumento de persistência para histórico ilimitado nem mudança de retenção.

## Arquivos

- `src/lib/telemetry/pilotMetrics.ts`
- `src/lib/telemetry/__tests__/pilotMetrics.test.ts`
- `src/lib/offline/syncWorker.ts`
- `src/lib/offline/syncDiagnostics.ts`
- `src/lib/offline/reconciliationTypes.ts`
- `src/lib/offline/__tests__/syncWorkerGenericRetry.test.ts`
- `src/lib/offline/__tests__/syncWorkerAuth.test.ts`
- `docs/review/F24_5C_FAILURE_RETRY_TELEMETRY.md`

## Validações observadas

Comandos executados a partir da raiz:

| Comando | Resultado observado |
| --- | --- |
| `pnpm exec vitest run src/lib/telemetry/__tests__/pilotMetrics.test.ts src/lib/offline/__tests__/syncWorkerGenericRetry.test.ts src/lib/offline/__tests__/reconciliationObligations.test.ts src/lib/offline/__tests__/syncWorkerAtomicAck.test.ts` | 4 arquivos / 52 testes passaram |
| `pnpm exec vitest run src/lib/telemetry/__tests__/pilotMetrics.test.ts src/lib/offline/__tests__/syncWorkerAuth.test.ts src/lib/offline/__tests__/syncWorkerTimeout.test.ts src/lib/offline/__tests__/syncWorkerHttp500.test.ts src/lib/offline/__tests__/syncWorkerHttp403.test.ts src/lib/offline/__tests__/syncWorkerHttp429.characterization.test.ts` | 6 arquivos / 34 testes passaram; 13 de telemetry sobrepostos; 73 testes distintos ao todo |
| `pnpm exec eslint src/lib/telemetry/pilotMetrics.ts src/lib/telemetry/__tests__/pilotMetrics.test.ts src/lib/offline/reconciliationTypes.ts src/lib/offline/syncDiagnostics.ts src/lib/offline/syncWorker.ts src/lib/offline/__tests__/syncWorkerGenericRetry.test.ts src/lib/offline/__tests__/syncWorkerAuth.test.ts` | Exit 0 |
| `pnpm exec fallow audit --gate new-only` | Exit 0; nenhum finding novo; 10 findings herdados excluídos pelo gate |
| `git diff --check` | Exit 0 |
| `pnpm run gates:docs` | Exit 0; headers, continuidade e contrato documental aprovados |

A primeira execução focada revelou classificação incorreta de DOMException no
diagnóstico e foi corrigida, mantendo o algoritmo funcional. A primeira auditoria
fallow rejeitou a complexidade nova de flushTelemetryForFarm; o cálculo de IDs
confirmados foi extraído para helper puro pequeno, sem supressão nova.
As execuções posteriores acima passaram. Warnings de logs de rede/auth nos testes
são os cenários simulados. Nenhuma suíte global, build ou E2E remoto executado,
conforme validação proporcional solicitada.

## Contratos e riscos residuais

`SYNC_CORRECTNESS = PRESERVED`; `RETRY_POLICY = PRESERVED`;
`NEW_SOURCE_OF_TRUTH = NO`; `MULTI_TENANT = PRESERVED`;
`NEW_SECRETS_PERSISTED = NO`. Writers, CAS, RLS, RPCs, Edge de domínio, movement_v1,
backoff, autorização e decisões de reconcile/rollback permanecem preservados.

1. Contrato de ingest comprovado no código local e simulado nos testes; versão
   publicada e delivery real não certificados. Endpoint indisponível mantém o buffer elegível.
2. Buffer local append-only e ausência de TTL específico permanecem; IDs no cursor
   crescem com a quantidade de métricas no mesmo timestamp. Retenção remota G09 deferida.
3. Checkpoints legados avançados sem ACK não são reconstruídos automaticamente.
   Histórico ilimitado de tentativas, distinção causal timeout/stop, health UI G05,
   physical process kill G10 e F24.5D/E continuam fora desta entrega.

Gate local: `READY`. Diff tracked e arquivo documental untracked inspecionados;
staged vazio; escopo G03/G04/G07 preservado, sem bloqueadores identificados.
Veredito: `F24_5C = READY_FOR_REVIEW`. Revisão técnica externa e integração
permanecem pendentes; esta classificação não certifica operação remota.
