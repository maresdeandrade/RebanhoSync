# F24.5A — Inventory / Observability Baseline

Atualizado em: 2026-10-06
Tipo: diagnóstico estático e inventário documental; sem implementação funcional.
Status: `F24_5A = READY_FOR_REVIEW`; `OBSERVABILITY_BASELINE = ESTABLISHED`.

## Decisão e baseline real

FATO CONFIRMADO: existem registros duráveis suficientes para inspecionar trabalho
pendente, último erro, rejeições e resultados por operação. A observabilidade da
sequência tentativa → ACK → instalação do reconcile é parcial. Recovery e
observabilidade são capacidades distintas; este inventário não recertifica recovery.

Após `git fetch origin --prune`:

| Campo | Valor observado |
| --- | --- |
| Branch | `feat/f24-4f-integrated-certification` |
| HEAD | `e7fc3b56e2c0051a84f0d54ba2364b3168d0f0b4` |
| CURRENT_MAIN_SHA / origin/main | `3da8c89a5dd8c2d793d8d34af749a68c9c81f59a` |
| F24_4F_MERGE_SHA | `3da8c89a5dd8c2d793d8d34af749a68c9c81f59a`, PR #181 |
| Pais do merge | `7760741c26de915cf185b033e3ffd6c29908fee7` e HEAD acima |
| Árvore HEAD e origin/main | Ambas `fff9863f2ce2bb8d7de04fd5179c7d8e2cead5dc` |
| WORKTREE_STATE inicial | Tracked, staged e untracked limpos |
| Baseline operacional | Árvore de origin/main pós-merge, idêntica ao checkout examinado |

`git diff HEAD origin/main` não tem delta. Não houve checkout, stash, limpeza ou
alteração de branch. O antigo `main@7760741` não foi usado como baseline operacional.
`git show --stat e7fc3b5` confirma oito arquivos no pacote integrado, incluindo
runtime, testes, documento, CI, configuração E2E, package e lockfile. A inspeção do
ramo `allApplied` em `syncWorker.ts` confirma `animais` no refresh/obrigação após
UPDATE aplicado; a regressão correspondente está em
`reconciliationObligations.test.ts` e no E2E de farm-switch. Esses testes não foram
reexecutados aqui. Evidência anterior: [F24.4F](./F24_4F_INTEGRATED_CERTIFICATION.md).

FATO CONFIRMADO NA ABERTURA (histórico): `ACTIVE_PHASE_PLAN.md`, `CURRENT_PHASE_HANDOFF.md` e a transição de
`PROJECT_STATUS.md` ainda apontam F24.4F READY_TO_START em baseline anterior. O merge
Git prevalece para este inventário. Essa defasagem documental fica registrada, sem
reescrever status global nem declarar F24.4/F24.5 CLOSED.

## Escopo e método

Modo principal: `DIAGNOSIS`, seguido de registro documental autorizado. Inventário
de sync, fila, retry/replay, ACK, obligations, pull/reconcile, conflitos, farm-switch,
ownership/session, rede/HTTP, erros terminais e `movement_v1`.

Buscas dirigidas e leitura de símbolos reais; sem leitura de arquivos de ambiente,
credenciais, registros de usuários reais ou consulta a backend remoto. Não houve
runtime, schema, migration, RLS, RPC, Edge, dependência, dashboard, ID ou telemetria
nova. Sem commit, push, PR, merge, deploy ou migration remota.

`YES` significa capacidade diretamente demonstrada pelo código/shape examinado,
no escopo indicado; não significa execução certificada nesta fase. `PARTIAL` indica
cobertura incompleta; `NO`, ausência demonstrada no mecanismo; `NOT_PROVEN`, falta
de evidência suficiente. Sobrevivência a restart refere-se ao mesmo IndexedDB e
localStorage preservados. Kill real, eviction, remoção do perfil e durabilidade
remota implantada não foram comprovados.

## Fontes examinadas e arquitetura observada

Os caminhos abaixo são relativos à raiz do repositório. Símbolos e trechos delimitam
as leituras; não houve auditoria integral de cada domínio citado.

| Ref | Fonte / ponto de evidência |
| --- | --- |
| E1 | `src/lib/offline/types.ts`: Operation, Gesture, Rejection, PilotMetricEvent, SyncOperationAuditResult; `db.ts`: stores e versões 30–32 |
| E2 | `src/lib/offline/ops.ts`: createGesture, identidades, persistência e retry de rejeição |
| E3 | `src/lib/offline/syncWorker.ts`: startSyncWorker, processGesture, sendBatchRequest, recovery, ACK, drain e purge |
| E4 | `src/lib/offline/genericRetry.ts`: parseRetryAfter e calculateGenericRetryAt |
| E5 | `src/lib/offline/syncReconciliation.ts`: planOperationReconciliation e mergeOperationAudit |
| E6 | `src/lib/offline/reconciliationTypes.ts`, `reconciliationObligations.ts`: key, generation, union de tables, conditional delete |
| E7 | `src/lib/offline/pull.ts`: pullDataForFarm, writeMergeResults, savePullCursor; cursor por tabela/escopo/fazenda |
| E8 | `src/lib/offline/movement.ts`, `movementReconciliation.ts`, `supabase/functions/sync-batch/movement-v1.ts`: digest, identity, receipt e resultado efetivo |
| E9 | `src/lib/offline/ownership.ts`, `localReadBoundary.ts`, `src/hooks/useAuth.tsx`, `src/lib/storage.ts`: owner local, sessão e fazenda ativa |
| E10 | `src/lib/telemetry/pilotMetrics.ts`: trackPilotMetric, flushTelemetryBatch, cursor e summary |
| E11 | `supabase/functions/telemetry-ingest/index.ts`; migration base `00000000000000_rebuild_base_schema_sanitario.sql`: metrics_events e policies metrics_select_member/metrics_insert_member |
| E12 | `supabase/functions/sync-batch/index.ts`: console, auth/membership, envelope, replay, resultados e resposta final |
| E13 | `src/lib/offline/rejections.ts`: list/stats/export/purge; `queueLifecycle.ts`: inspeção global de órfãos; `reset.ts`, `unknownOwnershipRecovery.ts`: limites de retenção local |
| E14 | `src/lib/offline/syncQueries.ts`, `syncPresentation.ts`, `src/components/offline/SyncStatusPanel.tsx`, `src/components/settings/SyncHealthPanel.tsx`, `src/pages/Reconciliacao.tsx` |
| E15 | `src/pages/Dashboard.tsx`: pilotEventsQuery e resumo de sete dias; callers em Home, TopBar e Configuracoes; `src/components/auth/LocalOwnershipBoundary.tsx` |
| E16 | `supabase/migrations/20261001200402_f24_4e21a_animal_lot_movement_foundation.sql` e `20261002005751_f24_4e211a_server_completion_gate.sql`: receipts, decisions, rejections, effective_results |
| E17 | `src/lib/events/buildEventGesture.ts`: eventId e source_task_id; AGENTS local de events |
| E18 | Testes existentes inspecionados: syncWorkerAuth, syncWorkerHttp403, syncWorkerHttp500, syncWorkerTimeout, syncWorkerHttp429.characterization, reconciliationObligations e pilotMetrics; `e2e/f24-4d4-lost-ack-replay.spec.ts` e delta de `e2e/f24-4d6-cross-device-farm-switch.spec.ts` |

Busca de arquivos também localizou `supabase/tests/animalLotMovementFoundation.test.ts`,
`animalLotMovementCompletion.test.ts`, `animalLotMovementTransport.e2e.test.ts`,
`stateConflictConcurrency.test.ts`, `stateConflictSyncBatch.e2e.test.ts` e runners
`scripts/codex/validate-movement-{server-foundation,transport,finalization}.mjs`.
Somente localização, sem alegar revisão integral ou execução desses arquivos.

Contratos consultados: `docs/technical/OFFLINE_SYNC.md`,
`EVENTS_AGENDA_CONTRACT.md`, `SUPABASE_RLS.md`,
`docs/context/SOURCE_OF_TRUTH.md`, `PROJECT_STATUS.md` e
`docs/architecture/OPERATIONAL_FLOWS.md`; continuidade e F24.4F acima.
O padrão canônico de relatórios de fase em `docs/review/F24_*` foi confirmado.

Arquitetura: gesto/op local → queue → Edge/RPC → resultado por op → auditoria e
obrigação duráveis → pull/instalação local. Em paralelo, métricas piloto em Dexie
→ flush com cursor localStorage → telemetry-ingest → metrics_events remoto.
Console cliente/Edge complementa esses dados, com formato livre e sem contrato
de retenção/correlação de logs comprovado. Não foi encontrado um logger central
nos caminhos operacionais examinados.

## Inventário e persistência

| Componente | Mecanismo existente / formato | Persistência e duração | Evidência |
| --- | --- | --- | --- |
| Queue | Gesture por tx/farm/client/status; Operation por op/tx, record, before_snapshot, expected_revision | IndexedDB; pendentes preservadas; ops aplicadas consumidas no ACK; gesto/audit permanece, sem TTL observado nesse caminho | E1–E3 |
| Retry | retry_count, next_attempt_at, last_error no gesto; estado/contagem/prazo por op em caminhos específicos | Snapshot durável, mutável; startup pode zerar contador e substituir erro; não é série de tentativas | E1, E3–E4 |
| ACK | completed_at, sync_result, operation_results com op_id/status/reason/revision/matched/recorded_at | IndexedDB; ACK e obligation na mesma transação; audit mesclado por op substitui resultado anterior | E3, E5 |
| Reconcile | key=farm:scope, generation_id, tables, created_at/updated_at; cursores de pull | IndexedDB até conditional delete; cursor conserva último avanço, não cada tentativa; erro de drain só console | E3, E6–E7 |
| Conflict / rejection | Rejection com farm/op/tx/reason/message/revision e payload mínimo; audit do gesto | IndexedDB; DLQ >7 dias purgada no máximo a cada 6h de worker elegível; purge manual também existe | E1, E3, E5, E13 |
| Ownership/session | local_ownership com owner_user_id/updated_at; decisão OWNED/MISMATCH/UNKNOWN calculada pela sessão | Owner durável; decisão/contexto em memória; sem histórico de transições por op | E9 |
| Farm-switch | ID ativo em localStorage; filas e obligations por farm | Atual ID sobrevive reload; não há registro de origem/destino/pendências por troca | E3, E6, E9 |
| Movement v1 | digest/selector imutável, operation_identity, receipt original e decisão efetiva | Fila/audit local; tabelas técnicas remotas append-only; implantação atual NOT_PROVEN nesta fase | E8, E16 |
| Métricas | sync_success, sync_rejected, sync_error, sync_backlog; id/farm/status/quantity/reason/payload/time | metrics_events local sem TTL observado; flush por farm em lotes de 100; cursor localStorage; schema remoto existente | E3, E10–E11 |
| Rede/HTTP | HTTP status+body no Error/last_error; timeout por AbortController; console livre | Último erro persistido e métricas parciais; classe estruturada/status/header não formam histórico persistido | E3–E4, E10 |
| Saúde da fila | Contagens e grupos órfãos em inspectQueueLifecycleHealth/inspectOrphanedQueueOperations | Calculados sobre stores, globais, sem snapshot histórico/filtro farm na API | E13 |

Retenção local depende de perfil/storage preservado. Reset explícito remove evidência
local; purge da DLQ não equivale a apagar todo o audit do gesto. Não se presume
retenção infinita, entrega remota garantida ou recuperação após eviction.

### Matriz de observabilidade

“Diagnóstico suficiente” exige investigação posterior da sequência e da causa,
não apenas consulta do estado atual. Farm-aware inclui o mecanismo agregado.

| Área | Evidência existente | Persistente? | Correlacionável? | Farm-aware? | Sobrevive restart? | Diagnóstico suficiente? |
| --- | --- | --- | --- | --- | --- | --- |
| Queue | IDs, status, snapshots e audit; lifecycle global | YES | YES | PARTIAL | YES | PARTIAL |
| Retry | Contagem/prazo/último erro; métricas sem op/tx | PARTIAL | PARTIAL | YES | PARTIAL | PARTIAL |
| ACK | Audit op/status/reason, completed_at; ops consumidas | YES | YES | YES | YES | PARTIAL |
| Reconcile | Obligation farm/scope/generation; erro em console | PARTIAL | PARTIAL | YES | PARTIAL | NO |
| Conflict | Rejection farm/op/tx/reason/revision + audit | YES | YES | YES | YES | PARTIAL |
| Auth/session | Owner durável; gating/erro condicionado ao ponto da falha | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Farm-switch | ID ativo e pending isolado; sem histórico de troca | PARTIAL | PARTIAL | YES | PARTIAL | PARTIAL |
| Movement v1 | Identidade + receipt + decisão efetiva | YES | YES | YES | YES | PARTIAL |
| Network/HTTP | last_error e métricas; console/prazos | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |

Para cada YES de restart local, o shape IndexedDB é a evidência, não kill físico.
Para Movement, persistência remota é contrato de migrations/callers, sem probe do
ambiente implantado. Não há YES de diagnóstico completo ponta a ponta.

## Correlation inventory

As identidades de negócio/transporte já existem; nenhum ID novo foi introduzido.

| Identificador | Origem / criação | Persistência | Transporte / retorno | Retry / replay / restart | Reconstrução ponta a ponta |
| --- | --- | --- | --- | --- | --- |
| client_op_id | createGesture em ops.ts; UUID ou clientOpIds fornecido; movement prepara o mesmo ID | queue_ops, record quando pertinente, rejection/audit; remoto conforme writer | mapOperationForSync; retorno op_id e client_op_id nos contratos específicos | YES enquanto fila/audit existe; reutilizado, não regenerado | PARTIAL: liga resultado à op; não liga métricas/tentativas genéricas ou drain |
| client_tx_id | createGesture; UUID ou clientTxId fornecido | queue_gestures/ops, rejections e provenance remota conforme writer | Envelope de request/response; Movement operation_identity | YES para a intenção persistida | PARTIAL: logs Edge possuem tx/farm, métricas piloto não |
| movement_command_id | Busca exata sem ocorrência em offline/events, sync-batch, migrations, testes Supabase/E2E e scripts/codex | NO nesse escopo | NO nesse escopo | NOT_PROVEN como contrato independente | Não inventar esse campo: identidade real usa farm/event/op/tx + digest |
| source_task_id | Fornecido pelo caller como sourceTaskId; buildEventGesture/movement preservam ou null | Evento e command_input/record conforme fluxo | Movement inclui no comando; não é campo obrigatório do envelope de audit genérico | YES quando presente no record persistido; ausência legítima | PARTIAL: causa de domínio, não identidade de tentativa; ad hoc pode ser null |
| fazenda_id | Contexto da intenção; gesture e record/command | Fila, rejection, obligation, metrics, fatos/remoto | Envelope; Edge impõe farm autorizada e membership; Movement retorna identity | YES, preservado na intenção | PARTIAL: backlog associa quantidade global à primeira farm |
| owner_user_id | establishLocalOwnership a partir de session.user.id; upgrade legado usa null | local_ownership, uma decisão de ownership da base | Não enviado como provenance da op; servidor deriva user_id da autenticação | Owner sobrevive storage; decisão recalculada pela sessão; não há owner por tentativa | PARTIAL: confirma proprietário atual, não reconstrói sessão histórica de cada op |
| Obligation identity | reconciliationObligationKey(farm,scope); generation nova em cada upsert | sync_reconcile_obligations | Local; não é ID do request Edge nem retorno remoto | YES enquanto pendente; generation muda para proteger ACK novo | PARTIAL: agrega várias ops/tables, sem ligação op/tx ou histórico após delete |
| Event identity | input.eventId ou UUID em buildEventGesture; repassado ao movement | event_eventos/detail; comando; Evento/receipt remoto | event_id/record.id; Movement identity/receipt; generic audit por op | YES para fato persistido, inclusive replay | PARTIAL: Movement permite join técnico sólido; métricas genéricas não carregam Evento |
| command_digest | movementCommandDigest sobre seletor original preparado | Operation.command_digest, receipt/command_input remoto | movement-v1 valida/transmite e compara | YES, imutável em retry/replay | PARTIAL: prova comando idêntico, não sequência de transporte |
| domain_op_id | UUID em comandos específicos, incluindo criação em ops.ts | Operation/record, resultados/rejeições e ledger específico | Retornado nos contratos canônicos específicos | YES no fluxo persistido específico | PARTIAL; não é campo universal do pipeline |
| server_tx_id | Edge retorna srv- + primeiros 8 caracteres de client_tx_id | Não observado como campo persistido de Gesture/audit | Response de sync-batch | Mesmo prefixo derivado; não identifica tentativa | NO para reconstrução exclusiva; não tratar como trace/request ID |

Evidência: E1–E3, E5–E12, E16–E17. `server_tx_id` aparece na resposta final da Edge;
a interface interna do worker consome results. Um prefixo de oito caracteres não
substitui a identidade completa.

## Failure visibility matrix

FATO CONFIRMADO abaixo é comportamento do código; testes relacionados foram
inspecionados, não executados. “Posterior” considera o perfil preservado e as
ressalvas de TTL/substituição do erro. Códigos do resultado por op não são
confundidos com status HTTP do batch.

| Falha | Estado local produzido | Informação / erro persistido | Recovery / retry / terminalidade | Restart e diagnóstico posterior | Evidência |
| --- | --- | --- | --- | --- | --- |
| Offline prolongado | Trabalho pendente; erro de rede pode gerar retry e ERROR no limite | created_at, retry_count, next_attempt_at, último erro | Reconnect acelera prazo de erro de rede e reabre ERROR recuperável com ops; não há limite de duração offline monitorado | Fila YES; duração/exata sequência offline NO | E1, E3–E4 |
| Timeout | Abort após 5s; PENDING com backoff, ERROR no limite genérico | last_error com mensagem de abort, contador/prazo; sync_error parcial | Retry mesma identidade; timeout não confirma conflito nem rejeição factual | Estado YES; causa timeout versus interrupção intencional PARTIAL | E3, E18 |
| HTTP 401 | Primeiro 401 tenta refresh + único reenvio; erro após isso vira ERROR | Último erro e sync_error se entrar no catch | Bloqueado até sessão válida; sem apagar ops; recovery posterior mantém IDs | Estado YES; primeiro 401 recuperado pode ficar só no console | E3, E18 |
| HTTP 403 | ERROR, completed_at; ops e apply local preservados | last_error HTTP/body; metric de erro | Não retryável por recovery auth/transiente; requer resolução autorizada | YES para erro atual, histórico PARTIAL | E3, E18 |
| HTTP 409/412 do batch | Tratados como outros HTTP não transitórios: retry limitado, depois ERROR | last_error textual, contador; sem categoria específica | Não presumir terminalidade CAS só pelo HTTP; ocorrência desse transporte no sync-batch NOT_PROVEN | Persistência do ramo YES; ocorrência real NOT_PROVEN | E3 |
| HTTP 429 | PENDING mesmo além de MAX_RETRIES, com backoff e Retry-After | Contagem/prazo e texto HTTP; header original não conservado como campo | Retry contínuo agendado, sem exhaustion por teto genérico | Prazo YES; histórico/explicação do prazo PARTIAL | E3–E4, E18 |
| HTTP 5xx | 500/502/503/504 transitórios até limite; demais 5xx seguem fallback limitado | last_error, contador/prazo quando transitório, sync_error | ERROR no limite; recovery específico pelos markers existentes, não generalizado a todo 5xx | Estado YES; tentativa/causa estruturada PARTIAL | E3, E18 |
| Failed to fetch | PENDING/backoff até limite; ERROR depois | Última mensagem e métricas sem op/tx | Reconnect/startup recupera com ops; mesma identidade | Estado YES; histórico PARTIAL | E3 |
| Retry exhaustion | ERROR / Max retries no caminho genérico limitado | completed_at, last_error, retry_count | Não necessariamente terminal factual: recovery transiente pode reabrir; 429 e retries por op têm política própria | Persistido; startup zera contador/substitui erro, sequência PARTIAL | E1, E3, E8 |
| Stale CAS conflict | Resultado CONFLICT / STATE_REVISION_CONFLICT; rejection/audit terminal | op/tx/reason/current_revision quando retornado | Sem retry automático do conflito; reconcile e nova intenção humana conforme contrato | YES para resultado; tentativas anteriores PARTIAL | E1, E3, E5, E12 |
| Lost ACK | SYNCING interrompido ou retry/ERROR de transporte; sucesso remoto não conhecido localmente | IDs e erro local; não há marcador inequívoco lost_ack | Replay mesma identidade; receipt/estado remoto permite distinguir aplicação factual | Fila YES; lost ACK versus falha pré-commit NOT_PROVEN só pela evidência local | E3, E8, E12, E18 |
| Reconciliation pendente | Obligation presente; gesto genérico pode já estar DONE; movement mantém RECONCILE/proteção | key/generation/tables/created_at; receipt/audit Movement | Drain idempotente; execução ativa ou chamada explícita por farm; DONE não prova instalação | Pending YES; causa/ops de obligation genérica PARTIAL | E3, E6–E8 |
| Reconciliation falha | Obligation preservada, sem last_error/attempt nela | Apenas console do drain; pull cursor só progresso anterior | Próximo drain pode recuperar; erro não terminaliza fato aceito | Pending YES; mensagem após restart NO | E3, E6–E7 |
| Ownership mismatch / UNKNOWN | Worker/pull bloqueados antes do claim; fila permanece | Owner local, atualizado na criação; decisão calculada; sem evento de bloqueio por op | Não envia; exige sessão compatível ou recovery UNKNOWN já existente, sem atribuir owner por heurística | Owner YES; histórico do motivo/transição PARTIAL | E9, E15 |
| Sessão expirada/ausente | Ausente no gate: trabalho não processado; falha após gate: ERROR auth | No gate não cria erro de gesture; catch preserva mensagem; expiry DEV apenas console | Retoma com sessão utilizável; preserva pending; sem reabrir conflito | Fila YES; duração e transições de sessão PARTIAL | E3, E9, E18 |
| Farm-switch com pending | Pending A permanece; ID ativo vira B; obligations isoladas | Farm nos registros; apenas ID ativo atual em localStorage | Merge em reconcile explícito de A não ativa; scheduler não é prova de despacho automático de toda farm | Pending YES; histórico A→B e causa de espera NO | E3, E6–E9, E18 |

Recovery não implica diagnosticabilidade: recuperar uma gesture substitui
`last_error` e pode zerar contagens; drenar com sucesso remove a obligation. Um
incidente pode ter evidência transitória disponível e perder sua sequência histórica.

## Visibilidade existente

- Usuário: Home/TopBar e painel local exibem status/contagens por fazenda; Dashboard
  agrega métricas locais dos últimos sete dias; Reconciliacao mostra detalhes de
  rejeição, tx/op e exportação JSON por farm. Não é exportação integral do pipeline.
- Suporte: pode receber exportação existente da DLQ. APIs lifecycle identificam
  órfãos e resíduos; não foi comprovada uma interface de suporte que reúna retry,
  owner, ACK e obligations. Export usa baseline default fixo `d0278ce` quando caller
  não fornece override; Reconciliacao chama sem override.
- Desenvolvedor: IndexedDB, cursor localStorage, console cliente e logs Edge com
  tx/farm e user validado; consulta às tabelas técnicas de Movement sob permissões
  existentes. Retenção/plano de logs Edge no ambiente real NOT_PROVEN.
- Configuracoes monta SyncHealthPanel: últimas dez métricas remotas, filtradas por
  farm, sem payload/IDs operacionais, carregadas no efeito de farm-switch. Erro de
  consulta pode resultar em painel vazio; vazio não comprova ausência de incidente.

FATO CONFIRMADO: SyncStatusPanel não considera `summary.errorCount` no headline e
não consulta obligations. Gesto DONE com drain falho pode aparecer “Em dia”; ERROR
sem rejeição/pending também pode cair nesse headline. Isso é limite observado de
apresentação, sem alteração de UI nesta fase.

## Gaps e classificação

P0 impede diagnóstico/recovery seguro de falha crítica; P1 degrada investigação de
incidente relevante; P2 reduz eficiência; P3 é melhoria operacional. Não foi
demonstrado P0 nem blocker de runtime que justifique patch nesta execução.

| ID | Classificação | Severidade | Evidência | Impacto e limite |
| --- | --- | --- | --- | --- |
| G01 | PARTIAL_COVERAGE | P1 | E3, E5, E10: metrics sem op/tx/event, audit substituído por op | Não reconstrói sequência tentativa/ACK/reconcile; IDs funcionais existentes devem ser reutilizados |
| G02 | GAP_CONFIRMED | P1 | E3, E6: drain catch só console; obligation sem erro/attempt/op | Após restart sabe-se que há trabalho, não a última causa de falha; delete elimina evidência de conclusão |
| G03 | GAP_CONFIRMED | P1 | E10: catch de flushTelemetryBatch retorna true e cursor avança | Erro de rede pode retirar lote do envio futuro pelo cursor sem confirmação remota; local não é apagado; defeito estático, não incidente remoto reproduzido |
| G04 | GAP_CONFIRMED | P2 | E3: pending.length de todas as farms com pending[0].fazenda_id | Quantidade do backlog não representa backlog exclusivo daquela farm e inclui snapshot pré-processamento |
| G05 | GAP_CONFIRMED | P1 | E14: headline ignora errorCount e obligations; E15 remote view limitada | Saúde visual pode omitir ERROR/reconcile pendente; ACK/sucesso de envio não significa convergência |
| G06 | PARTIAL_COVERAGE | P2 | E3, E9: gates silenciosos; activeFarm atual substituído | Não reconstrói bloqueio por owner/sessão ou cadeia farm-switch; segurança/recovery existentes não são gaps de autorização |
| G07 | PARTIAL_COVERAGE | P2 | E3–E5: último erro, auditoria por op, contagens resetadas | Falta série de tentativas/classes e distinção de exhaustion versus pausa auth/429; não exige tracing novo por si só |
| G08 | PARTIAL_COVERAGE | P2 | E13: TTL 7d, export só DLQ e baseline default fixo | Investigação tardia/export pode perder detalhes e rotular baseline antigo; não comprova perda de fato ou de todo audit |
| G09 | NOT_PROVEN | P2 | E11/E12 + ausência de probes remotos nesta fase | Implantação/retenção e entrega remota de metrics/logs não certificadas; código do endpoint existe, comentário TD-021 não prova ausência de deploy |
| G10 | NOT_PROVEN | P1 | Limites do método e E18 | Diagnóstico após kill real/eviction não certificado; persistência lógica existente não prova durabilidade física |

Inferência: G01/G02/G05 combinados aumentam o esforço para distinguir “aplicado
remotamente, aguardando instalação” de “convergido”. Não demonstram corrupção nova.
Recomendação: validar requisitos de cada gap antes de autorizar solução; nenhum gap
automaticamente exige tabela, SDK, framework, endpoint ou ID novo.

## No-gap findings

| Capacidade delimitada | Classificação | Evidência e limite |
| --- | --- | --- |
| Inspecionar identidade/estado atual de operação pendente por tx/farm | NO_GAP_OBSERVED | E1–E3; registros IndexedDB existentes; não cobre histórico de todas as tentativas |
| Inspecionar/exportar rejeição ainda retida por farm/op/tx | NO_GAP_OBSERVED | E1, E13–E14; reason/message/revision conforme retorno; janela TTL explícita |
| Identificar obligation pendente por farm/scope/generation | NO_GAP_OBSERVED | E6; lista e conditional delete existentes; não cobre causa de falha |
| Correlacionar Movement identity/receipt/decisão efetiva | NO_GAP_OBSERVED | E8, E16; join farm/event e op/digest; não é trace de rede |
| Classificar resultado por op e divergência de identidade | NO_GAP_OBSERVED | E5; matched/local_reason_code/recorded_at; audit não é append-only de tentativas |
| Consultar último progresso de pull por tabela/escopo/farm | NO_GAP_OBSERVED | E7; cursor existente; não prova última tentativa nem reconciliação completa |

Contratos F24.4 preservados: `RETRY_SAME_IDENTITY`, `PRESERVE_BOTH`,
`USER_RESOLUTION_REQUIRED`; `AUTO_MERGE` e `FIELD_LEVEL_MERGE` não autorizados.
Animal→Lote mantém Eventos/detail como história, `animais.lote_id` como estado,
writer `movement_v1 / apply_animal_lot_movement_v1`, writer genérico bloqueado e
nenhuma autoridade de estado pelo relógio cliente. Nenhum contrato foi reaberto.

## Proposta F24.5B–F24.5E

RECOMMENDATION: manter a decomposição, ajustando a execução às capacidades existentes.
Cada subfase depende de autorização própria de implementação; não foi iniciada aqui.

| Subfase | Objetivo | Gaps que resolve | Dependências | Critério de aceite recomendado |
| --- | --- | --- | --- | --- |
| F24.5B — Structured Diagnostics | Definir diagnóstico mínimo e correlação com IDs existentes; distinguir ACK/instalação e estado/histórico | G01, G02, G06, G08 | Revisão deste baseline; política de minimização/retenção e superfícies existentes | Caso por op/farm recuperável após restart lógico, sem segredo/payload desnecessário; registrar causa e resultado de reconcile, baseline exportado correto; design sem nova fonte factual |
| F24.5C — Failure / Retry Telemetry | Registrar classes/tentativas e entrega verificável; tratar skip silencioso e backlog multi-farm | G03, G04, G07; contribuir G01/G09 | B e definição explícita de entrega/retenção | Probes focados 401/403/429/5xx/timeout/rede com IDs estáveis; falha de ingestão não contada como entregue; backlog por farm correto; métricas não alteram recovery |
| F24.5D — Sync / Reconcile Health Views | Integrar saúde nos consumidores existentes, diferenciando pending, ERROR, auth bloqueada e reconcile | G05, visibilidade G02/G06 | B/C e semântica de saúde revisada | ACK com obligation pendente não apresentado como convergência; ERROR visível; estados verificáveis offline e por farm; vazio remoto distinguido de erro de leitura |
| F24.5E — Integrated Observability Certification | Certificar cadeia local/Edge/diagnóstico, export e restart no escopo autorizado | G09, G10 e integração G01–G08 | B–D; ambiente/fixtures isolados autorizados | Evidência ponta a ponta dos cenários críticos, multi-farm e restart; retenção/entrega observadas; testes limitados ao escopo; limitações físicas/remotas ainda não provadas declaradas |

Dashboards novos, telemetry tables/stores, IDs, OpenTelemetry, Sentry ou framework
não são requisitos aprovados. Se uma mudança de persistência for necessária em B/C,
exigirá proposta explícita de compatibilidade offline, segurança e autorização.

## Arquivos alterados e validações

Apenas `docs/review/F24_5A_OBSERVABILITY_BASELINE.md` foi criado. Runtime/test/banco
inalterados; status global preservado. Não houve commit.

Validações executadas antes do registro: fetch/rebaseline, log/merge, status inicial,
comparação de árvore e inspeção estática das fontes acima. Node/packageManager,
pnpm `11.23.0` e corepack `0.32.0` confirmados.

Validações executadas após a criação:

| Comando / inspeção | Resultado observado |
| --- | --- |
| `pnpm run gates:docs` | PASS: headers/baselines, continuidade ativa e data contract; exit 0 |
| `git diff --check` | PASS, sem whitespace errors; tracked sem delta |
| `git diff --no-index --check -- NUL docs/review/F24_5A_OBSERVABILITY_BASELINE.md` | PASS, exit 0; inclui integridade do arquivo untracked |
| `git diff --cached --stat` | Vazio: nenhuma alteração staged |
| `git status --short --untracked-files=all` | Somente o novo documento untracked |
| Inspeção manual do documento | Matrizes, IDs, classes de falha, gaps, no-gap findings, proposta e limites registrados; fontes conferidas por caminho/símbolo |

Os gates examinam documentos ativos globais e não a exatidão de todas as matrizes
deste relatório. Eles passaram apesar da defasagem temporal da transição global
registrada acima. Não substituem checagem manual nem certificam runtime.

Não executados: Playwright, Vitest, build, lint, runners de movimento e probes
Supabase. Motivo: entrega exclusivamente diagnóstica/documental e restrição de
validação proporcional do pedido. Teste encontrado não equivale a teste aprovado.

## Riscos residuais e veredito

1. Observação estática: entrega/retenção remota e kill/restart físico permanecem
   NOT_PROVEN; não há prova de incidente real ou de ausência de outros gaps fora do escopo.
2. Evidência local parcial: TTL, reset, sobrescrita de erro/audit e delete de obligation
   limitam reconstrução tardia; storage preservado é condição de leitura após restart.
3. A abertura usou checkout da F24.4F com árvore idêntica a origin/main; a continuidade
   global foi reconciliada no closeout abaixo. Futura implementação exige novo rebaseline.

`F24_5A = READY_FOR_REVIEW`. Inventário concluído no escopo estático/documental;
não declara CLOSED, prontidão de release nem autorização para executar F24.5B–E.

## Review documental e closeout preparatório — 06/10/2026

`REVIEW_F24_5A = APPROVED`; `OBSERVABILITY_BASELINE = ESTABLISHED`.
O status da fase permanece `F24_5A = READY_FOR_REVIEW`, sem CLOSED ou integração.
O pacote documental revisado está `F24_5A = READY_FOR_COMMIT` no lifecycle de entrega;
esse veredito não afirma que exista commit pós-A nem autoriza commit/publicação.

### Rebaseline e preservação

- Fetch confirmou `origin/main@3da8c89a5dd8c2d793d8d34af749a68c9c81f59a`.
- Único trabalho local inicial: este relatório untracked; tracked/staged limpos.
- Branch `codex/f24-5a-doc-closeout` criada sobre origin/main; HEAD agora é o merge
  acima. Não houve colisão, stash, reset, limpeza ou perda do arquivo: hash SHA-256
  do documento antes/depois do switch idêntico.
- Base Git pós-F24.4F limpa e identificável. O pacote documental pós-F24.5A ainda
  não está commitado; não existe novo SHA integrado pós-F24.5A. Worktree final contém
  apenas as alterações documentais deste closeout, não é uma worktree limpa.

### Review dos gaps

| Alvo | Fonte reconferida / conclusão |
| --- | --- |
| G01 | mergeOperationAudit em syncReconciliation.ts substitui por op; sync_success em syncWorker.ts não carrega op/tx no payload. PARTIAL_COVERAGE mantido |
| G02 | drainReconciliationObligations catch só console.warn; ReconciliationObligation sem last_error/attempt/op. GAP_CONFIRMED mantido |
| G03 | flushTelemetryBatch retorna true em exceção de fetch; flushTelemetryForFarm avança cursor. GAP_CONFIRMED mantido para exceção, sem confundir HTTP não-ok com esse ramo |
| G04 | pending.length global com pending[0].fazenda_id no worker. GAP_CONFIRMED mantido |
| G05 | getHeadline em SyncStatusPanel não trata errorCount/obligations. GAP_CONFIRMED mantido para esse consumidor, sem afirmar ausência de erro em toda UI |
| G06/G07 | Gates de ownership retornam sem evento por op; recovery zera retry_count/substitui last_error. PARTIAL_COVERAGE mantido |
| G08 | rejections.ts exporta DLQ com baseline default d0278ce, permite purge por idade. PARTIAL_COVERAGE mantido; não implica perda de fatos |
| G09/G10 | Nenhum probe remoto ou kill físico novo. NOT_PROVEN mantido, sem promoção a GAP_CONFIRMED |

Review APPROVED no escopo documental/estático, sem finding bloqueante remanescente
nesse relatório. Não significa aprovação de uma solução de persistência nem nova
certificação do pipeline. Não houve mudança nas classificações/severidades.

### Continuidade e abertura B

Atualizados snapshots ACTIVE_PHASE_PLAN, CURRENT_PHASE_HANDOFF, PROJECT_STATUS,
OPEN_REVIEW_ITEMS e roadmap; integração acrescida à evidência F24.4F, preservando
a execução original. F24.4/F24.4F CLOSED / INTEGRATED; F24.5 IN_PROGRESS;
F24.5A READY_FOR_REVIEW; F24.5B NEXT / READY_TO_START lógico.
O [plano F24.5B](./F24_5B_STRUCTURED_DIAGNOSTICS_PLAN.md) detalha apenas G02/G01
(P1), G06/G08 (P2); G03/G04 e G05 ficam em C/D respectivamente. Sem implementação.

As tabelas de validação anteriores pertencem à criação do inventário. Neste
closeout, gates documentais e diff tracked passaram (exit 0); staged vazio,
seis docs tracked e dois novos, sem delta de runtime. Checagem dos arquivos novos
e 120 links locais dos oito documentos passou, sem destinos ausentes.
Detalhes e limite do no-index estão no plano B. Vitest, Playwright, build e runners
não foram executados. `F24_5A = READY_FOR_COMMIT`, sem autorização de commit.
