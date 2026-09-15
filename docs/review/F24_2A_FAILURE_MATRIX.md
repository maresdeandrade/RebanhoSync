# F24.2A — Failure matrix offline/reconnect

Baseline: `main@155dab4ddee73aedc83a9a53c6e075de7a5bd3ad`.

Legenda: `C` = CONFIRMED, `I` = INFERENCE, `U` = UNKNOWN. “Perda” considera perda silenciosa do fato/operação; perda temporária de projeção é indicada como recuperável.

| Cenário | Current behavior e evidence | Invariante esperado | Detection / recovery | Idempotent? | Risco perda / duplicação / cross-tenant | Sev. |
|---|---|---|---|---|---|---|
| OFFLINE_BEFORE_LOCAL_WRITE | (C) Rede não participa de `createGesture`; Dexie grava fila+estado em uma transação (`ops.ts`). | Falha local não pode deixar metade do gesto. | Exceção com estágio diagnóstico; transação aborta. | Sim, com IDs reapresentados. | não / não / não | NONE |
| LOCAL_WRITE_OK_QUEUE_WRITE_FAILS | (C) Impossível no caminho canônico: ambas estão na mesma transação Dexie; writers sanitários também incluem fila. | Estado local e outbox são atômicos. | Erro propaga; rollback Dexie. | Sim | não / não / não | NONE |
| QUEUE_PERSISTED_APP_CRASHES | (C) PENDING persiste; reinício do `AppShell` inicia worker. | Fila durable e replayável. | Query por status PENDING; retry. | Sim | não / baixo / não | NONE |
| RESTART_STILL_OFFLINE | (C) pull falha sem commit; push PENDING tenta a cada 5 s, após 3 falhas vira ERROR. | Permanecer retryable sem exigir outro restart. | Logs/ERROR; recovery só roda uma vez no startup e pode ocorrer antes do erro. | Sim | não / baixo / não | P1 |
| RESTART_ONLINE | (C) pull inicial e PENDING são processados; subset de ERROR recuperável volta a PENDING. | Convergir sem intervenção. | worker/pull. | Sim | não / baixo / não | NONE |
| NETWORK_LOST_BEFORE_PUSH | (C) `fetch` falha; fila é mantida; retry genérico limitado. | Nunca apagar op sem resposta aplicada. | `last_error`, retry e metric. | Sim | não / baixo / não | NONE |
| NETWORK_LOST_DURING_PUSH | (C/I) mesma policy; `fetch` não possui timeout/AbortController e pode manter tick travado até o browser encerrar. | Resultado ambíguo deve permanecer replayável e worker deve destravar. | Erro eventual; sem watchdog explícito. | Sim após retorno | não / baixo / não | P1 |
| REMOTE_NOT_APPLIED | (C) erro/rejeição mantém ou rejeita a op; rejeição terminal faz rollback por op. | Não confirmar localmente. | results/queue_rejections. | Sim | não / não / não | NONE |
| REMOTE_APPLIED_RESPONSE_LOST | (C) retry conserva IDs; lookup/ledger/RPC retorna APPLIED para replay idêntico. | Não duplicar efeito. | retry + lookup remoto. | Sim, mesma identidade | não / baixo / não | NONE |
| HTTP_TIMEOUT_AFTER_REMOTE_COMMIT | (C) genérico mantém fila; sanitário classifica timeout como RETRYABLE; replay usa identidade estável. | Resultado desconhecido não é conflito nem novo fato. | retry e ledger/PK. | Sim, mesma identidade | não / baixo / não | NONE |
| BATCH_PARTIAL_SUCCESS | (C) Edge executa op a op; worker separa applied/rejected/retryable/missing e persiste auditoria. | Nunca rollback de op já aplicada. | `operation_results`, queue/rejections e pull. | Sim | não / baixo / não | NONE |
| ONE_OPERATION_REJECTED | (C) rejected é revertida; applied é reaplicada/preservada; rejeição fica auditável. | Resultado por operação. | `queue_rejections`. | Sim | não / não / não | NONE |
| AUTH_EXPIRES_DURING_SYNC | (C) um 401 tenta refresh+reenvio; falha posterior entra no retry do gesto. Mensagem “Nao autenticado” não está nos markers de startup. | Retomar quando sessão voltar. | logs/ERROR; recovery automático incompleto. | Sim | não / baixo / não | P1 |
| 403_DURING_SYNC | (C) marca ERROR sem retry/rollback e mantém queue/op otimista (`syncWorkerHttp403.test.ts`). | Bloquear acesso sem perder evidência e oferecer recovery após membership válido. | ERROR; sem requeue automático. | Sim | não / baixo / servidor bloqueia | P1 |
| 5XX_DURING_SYNC | (C) 502/503/504 são recuperáveis no próximo startup; 500 não é marker; máximo 3 no processo. | Todo 5xx transitório deve ter retry/backoff durável. | ERROR/log/metric; cobertura parcial. | Sim | não / baixo / não | P1 |
| ACK_LOCAL_WRITE_FAILS | (C) no all-applied genérico, `bulkDelete(queue_ops)` ocorre antes da transação que marca gesto DONE; no sanitário canônico é transacional. | Ack local deve ser atômico e recuperável. | Pode restar gesto SYNCING sem ops; health reporta residual, mas não repara. | Remoto sim | não factual / não / não | P1 |
| APP_CRASHES_BEFORE_ACK | (C/I) antes de apagar ops, replay é seguro; depois de apagar e antes de DONE, gesto fica SYNCING sem recovery. | Estado intermediário deve ser retomável. | Não há startup recovery de SYNCING. | Sim se op existe | não factual / baixo / não | P1 |
| REPLAY_ALREADY_APPLIED_OPERATION | (C) genérico compara IDs persistidos; sanitário ledger+fingerprint; comerciais RPC+fingerprints. | Mesmo comando não reaplica efeito. | APPLIED/replayed. | Sim | não / baixo / não | NONE |
| NETWORK_LOST_DURING_PULL | (C) padrão busca tudo antes de escrever; especializados só abrem transação após fetches. | Nenhum commit parcial. | exceção; cursor não avança. | Sim | não / não / não | NONE |
| PULL_RECEIVED_LOCAL_APPLY_FAILS | (C) transação Dexie aborta dados e cursor. | Apply e cursor atômicos. | erro; retry posterior. | Sim | não / não / não | NONE |
| CURSOR_ADVANCED_BEFORE_LOCAL_COMMIT | (C) não ocorre nos pulls com cursor: cursor está na mesma transação. | Nunca saltar dados. | rollback Dexie. | Sim | não / não / não | NONE |
| LOCAL_COMMIT_BEFORE_CURSOR_ADVANCE | (C) mesma transação; ou ambos, ou nenhum. | Replay seguro. | rollback/replay. | Sim | não / não / não | NONE |
| REPLAY_SAME_PULL | (C) bulkPut/append é idempotente; timestamp é inclusivo; colisão divergente Evento–Animal falha. | Não duplicar fatos. | PK/collision check. | Sim | não / baixo / não | NONE |
| MULTIPLE_LOCAL_CHANGES_SAME_AGGREGATE | (C/I) gestos são ordenados por `created_at`; sanitizer usa revision, mas UPDATE genérico não carrega versão. | Detectar concorrência, preservar ordem e não sobrescrever silenciosamente. | Sem detector genérico de versão. | IDs sim; semântica U | recuperável / possível / não | P1 |
| REMOTE_CHANGE_WHILE_DEVICE_OFFLINE | (C/I) pull protege row pendente; push genérico posterior pode sobrescrever remoto sem expected revision. | Conflito explícito ou merge definido. | Especializados têm conflito; genérico não. | Replay sim | recuperável / possível / não | P1 |
| MULTI_DEVICE_SAME_AGGREGATE | (C/I) sanitizer/comercial/reprodução têm policies; UPDATE genérico é last-write-wins. | Política por agregado. | conflito apenas especializado. | Parcial | recuperável / possível / não | P1 |
| SWITCH_FARM_WITH_PENDING_QUEUE | (C/I) fila é por fazenda e push usa fazenda do gesto; pull inicial `replace` limpa stores inteiros e preserva apenas pendências da fazenda puxada. | Troca não deve remover projeção/pending de outra fazenda. | fila sobrevive; projeção pode sumir até novo pull/push. | Sim | projeção recuperável / não / remoto não | P1 |
| LOGOUT_WITH_PENDING_QUEUE | (C) logout para worker e remove active farm, mas mantém Dexie/fila. | Não perder fila; não transferir autoridade silenciosamente. | fila reaparece no próximo login. | Sim | não / baixo / servidor valida | P1 |
| LOGIN_OTHER_USER_WITH_EXISTING_LOCAL_DATA | (C/I) Dexie e queue não têm `user_id`; novo AppShell processa todos os PENDING. Sem membership recebe 403; com membership na mesma fazenda pode enviar pendência anterior. | Fila deve ter ownership/session policy explícita. | Só membership/RLS remoto; sem detector local de troca de usuário. | Sim | não / baixo / cross-tenant remoto bloqueado | P1 |
| DUPLICATE_EVENT | (C/I) replay da mesma identidade é bloqueado; comandos com identidades distintas são tratados como execuções distintas. O caminho genérico não registra proveniência suficiente para reconhecer a mesma execução reapresentada com identidade regenerada. | Mesma execução/replay → um fato; execuções distintas com conteúdo igual → podem gerar fatos distintos. | Proteções existem em fluxos especializados, mas não há contrato genérico de identidade estável/proveniência factual. | Apenas com identidade preservada | não / **sim** / não | **P0** |
| AGENDA_INCORRECTLY_PROMOTED_TO_HISTORY | (C) `state_*` push direto é bloqueado; closure sanitária que alegue execução é bloqueada; execução histórica exige Evento. | Agenda continua intenção. | validações client/Edge e testes. | Sim | não / não / não | NONE |
| STATE_MODEL_TEMPORARILY_INCONSISTENT | (C) optimistic state é esperado; post-sync pull pode falhar após op aplicada. Além disso, falha de `sanitario_recompute_agenda_for_fazenda` é apenas warning e resultados seguem APPLIED. | Read model deve convergir ou manter job/retry durável. | warning/log; restart/pull pode reparar parte local; recompute remoto não é reencaminhado. | U para recompute | recuperável / não / não | P1 |

## P0 comprovado

### P0-01 — Mesma execução pode criar mais de um fato sem identidade estável/proveniência

**CONFIRMED:** o caminho genérico deduplica por PK + `client_op_id` + `client_tx_id`. O Edge trata comandos com identidades distintas como operações distintas. `source_task_id` protege o subconjunto originado de Agenda, e os fluxos sanitário/comercial/reprodutivo especializados possuem identidade/proveniência adicional; isso não cobre todo Evento genérico.

**INFERENCE de falha:** a mesma execução reapresentada por outro dispositivo ou fluxo com identidade regenerada pode persistir outro Evento histórico. Isso satisfaz a definição P0 fornecida (duplicação de fato histórico). Conteúdo igual, isoladamente, não prova replay: execuções distintas com conteúdo igual podem gerar fatos distintos. O cenário precisa de teste E2E específico antes de qualquer decisão de schema.

## P1 comprovados

1. Ack genérico all-applied não é atômico e `SYNCING` não é recuperado no startup.
2. Recovery de rede/auth/5xx é incompleto; reconnect não reabre ERROR criado depois do recovery inicial.
3. Sem timeout do push; um fetch pendurado pode bloquear o worker.
4. UPDATE genérico não possui revisão/política de conflito multi-device.
5. Pull replace compartilhado pode remover projeções de outra fazenda; fila não é user-scoped.
6. Post-sync pull/recompute falho não possui recovery durável completo.

## P2 comprovados

1. Retry genérico não usa backoff/jitter e pode gerar rajadas a cada 5 s.
2. Observabilidade é majoritariamente log/metric local; não há watchdog de gesto SYNCING nem razão estruturada para todos os erros.
3. Cobertura não inclui crash/ack, login cruzado, farm switch pendente ou replay factual genérico sem identidade/proveniência preservada.
