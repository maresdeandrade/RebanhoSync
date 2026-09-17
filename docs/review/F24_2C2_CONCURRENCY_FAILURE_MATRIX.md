# F24.2C2 — Matriz de falhas de concorrência e ambiguidade

Baseline: `origin/main@9014c1d41ca4d6c6b23c0da34b156953aef33f71`.

## Orphan/ambiguity matrix

| Estado | Origem possível | Reproduzível? | Novo ou legado? | Estado derivável? | Recovery seguro atual? | Ação recomendada | Severidade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SYNCING + 0 ops` | worker stale grava `SYNCING` depois de outro worker concluir ACK; crash pré-C1 | **sim**, interleaving automatizado | novo concorrente e legado | não; zero ops não prova ACK | não; stale recovery retorna `0` | claim/CAS antes do push; manter fail-closed | P1 |
| `SYNCING + only REJECTED` | fixture/legado; late write após reconciliação rejeitada é possível pelo mesmo boundary | estado e fail-closed reproduzidos; origem concorrente é inferência | indeterminado | `processGesture` escolheria `REJECTED`, mas audit/rollback completo é desconhecido | não automaticamente | exigir evidência de rejection/audit antes de recomputar | P1 |
| `SYNCING + only BLOCKED` | resposta `BLOCKED_DEPENDENCY` seguida de interrupção/late write | recovery reproduzido | ativo possível | transitoriamente recuperável | sim: recovery blocked roda antes e volta op/gesture a `PENDING` | manter ordem e adicionar cobertura/telemetria | NONE |
| `SYNCING + mixed terminal ops` | partial result + interrupção ou late write | não reproduzido ponta a ponta | ativo possível, não confirmado | parcial; `REJECTED` prevalece no ramo direto, mas blocked pode reabrir | parcial: blocked volta a `PENDING`; rejected fica retida | não promover terminalmente sem audit completo | P1 |
| `DONE + ops` | append concorrente/legado/corrupção; nenhum caminho normal confirmado | não | `UNKNOWN` | não automaticamente | detector acusa ops residuais; sem correção automática | investigar identidade e servidor antes de remover/reabrir | P1 |
| `PENDING + 0 ops` | `createGesture([])`; catch concorrente depois de ACK de outro worker | **sim** | ativo | sim, ramo sem ready ops deriva `DONE` | sim no próximo processamento | rejeitar enqueue vazio e proteger writes stale em patch futuro | P1 |
| `ERROR + 0 ops` | erro stale após ACK concorrente; legado/corrupção | não reproduzido diretamente | ativo possível, não confirmado | depende de `last_error`; não prova ACK | somente erros com marcador recuperável | claim + conditional terminal write; diagnóstico explícito | P1 |
| op sem gesture | dados legados/corrupção/manual; writers atuais normais são transacionais | fixture reproduzida por inserção direta | legado/manual | não | remoção somente após verificação externa | manter detector e cleanup verificado | P1 |

## Failure matrix de concorrência

| Cenário | Comportamento atual | Detecção | Recovery | Idempotência/safety | Risco | Severidade |
| --- | --- | --- | --- | --- | --- | --- |
| duas abas leem `PENDING` | ambas podem prosseguir; não há claim compartilhado | duas requests com mesmos IDs no teste | depende do resultado de ambas | identidade remota preservada nos caminhos certificados | write local stale | P1 |
| A recebe `APPLIED`, B ainda não marcou | A grava `DONE`; B pode sobrescrever com `SYNCING` e zero ops | teste late-write | nenhum no restart se B for encerrado | backend recebeu mesma identidade | gesture preso | P1 |
| A e B recebem `APPLIED` | duas requests; resultado observado `PENDING+0` por erro concorrente capturado | teste de dois processadores | próximo `processGesture` deriva `DONE` sem rede | não cria nova identidade | inconsistência recuperável | P1 |
| A conclui ACK, pull falha | permanece `DONE`, ops ausentes | estado local + warning | não há job durável de pull | ACK seguro; convergência aberta | read model pode ficar stale | P1, fora da C2 |
| fetch do primeiro gesture não resolve | primeiro fica `SYNCING`; posteriores não iniciam; próximos ticks são suprimidos | duração/tick; sem telemetria dedicada | restart se op não terminal ainda existe | nenhuma nova identidade | worker inteiro sem liveness | P1 |
| restart com `SYNCING` + op executável | volta a `PENDING` | recovery C1 | replay com mesmos IDs | confirmado seguro | baixo | NONE |
| falha dentro do ACK C1 | transaction aborta; ops preservadas | fault injection | catch retorna `PENDING` | confirmado seguro | baixo | NONE |
| ACK completo, crash antes do pull | `DONE`, ops removidas | audit do gesture | pull não durável | ACK confirmado | convergência local pendente | P1 / C3 |
| only `BLOCKED_DEPENDENCY` no startup | recovery blocked reabre op e gesture | estado da op | `PENDING` | identidade preservada | retry posterior | NONE |
| only `REJECTED` no startup | stale recovery não altera | inspeção manual | fail-closed | evita falso `DONE` | gesture preso | P1 |

## Ausências confirmadas

Busca dirigida no runtime não localizou:

```text
mutex
compare-and-set de claim
leader election
lease/owner/heartbeat
BroadcastChannel
Web Lock API
AbortController no sync-batch fetch
timeout do fetch
```

## Fronteiras mantidas abertas

```text
DURABLE_POST_ACK_RECONCILIATION = OPEN
destino provável = F24.2C3

HTTP_500_RECOVERY = OPEN
destino = F24.2D_DURABLE_RETRY_RECONNECT_AUTH_RECOVERY
```

Nenhum mecanismo novo é prescrito sem patch específico e novos testes de interleaving.
