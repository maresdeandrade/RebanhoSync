# Offline e sync — RebanhoSync

Atualizado em: 2026-10-03

## Responsabilidade documental

Este documento descreve os detalhes internos do mecanismo offline/sync. O [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md) é o contrato canônico de como esse mecanismo participa dos fluxos de domínio; fontes de verdade de domínio não são redefinidas aqui.

Para impacto operacional, consulte no mapa os contratos de resultado por operação (`APPLIED`, `APPLIED_ALTERED`, `RETRYABLE`, `REJECTED` e `BLOCKED_DEPENDENCY`), proteção de pending, pull padrão ou especializado, retry e preservação de identidade.

## Contrato geral

O fluxo é local-first e usa uma única fila compartilhada:

```txt
ação local
→ queue_gestures
→ queue_ops
→ sync-batch
→ resultado por operação
→ worker/reconcile
→ pull/merge não destrutivo
```

Regras:

- retry/replay reutiliza identidades estáveis;
- sucesso parcial é explícito;
- fatos aceitos não sofrem rollback destrutivo;
- dependências bloqueadas não entram em loop agressivo;
- pull respeita `fazenda_id`, cursores e tombstones;
- `catalog_*` permanece pull-only quando definido pelo contrato;
- `state_*` não é superfície direta de push.

## Concorrência de estado e autoridade de relógio — F24.4C / F24.4D

`UPDATE` de `animais` pelo caminho genérico usa controle otimista de concorrência. A
`revision` é a versão remota autoritativa (`STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS`);
`expected_revision` é o snapshot persistido na operação antes da mutação otimista e
transportado no envelope HTTP de sync (`mapOperationForSync`). Retry/reload reutiliza
rigorosamente `client_op_id`, `client_tx_id` e `expected_revision`, sem recalcular a versão esperada.

Contratos certificados na F24.4D:
- **CAS server-authoritative:** O servidor valida `expected_revision` contra a `revision` persistida. Timestamps do cliente (`client_recorded_at`) não decidem o vencedor de estado. Divergência de revisão retorna `CONFLICT / STATE_REVISION_CONFLICT`, terminal e sem retry automático. Cliente legado sem `expected_revision` falha de modo fechado.
- **Replay de lost ACK:** Reenvio da mesma identidade após sucesso remoto não reaplica a mutação nem incrementa a revisão remota (idempotência remota).
- **Distinção entre ACK e convergência:** O ACK remoto apenas terminaliza o resultado da operação na fila local. A convergência da projeção local para o novo snapshot remoto ocorre via reconciliação/pull (`drainReconciliationObligations` + `pullDataForFarm`). Não há convergência automática presumida no mero recebimento do ACK de um conflito.
- **Isolamento de farm switch:** Operações pendentes de uma fazenda permanecem isoladas no IndexedDB e não contaminam nem são contaminadas por pulls/writes de outra fazenda.
- **Clock local no scheduling:** `next_attempt_at` e `created_at` afetam unicamente o agendamento local da fila e elegibilidade de retry (`isGestureReadyForSync`), sem alterar identidades, recalcular `expected_revision`, reabrir conflitos terminais ou causar estagnação permanente após retorno do relógio à normalidade.

O escopo é `ANIMAIS_ONLY`. Demais `state_*`, delete/tombstone completo, field-level merge e multi-device físico não foram generalizados nem certificados (`REAL_PHYSICAL_MULTI_DEVICE = NOT_PROVEN`).

## Animal→Lote — F24.4E2

O [contrato operacional](../architecture/OPERATIONAL_FLOWS.md#9-movimentações) e a
[recertificação F24.4E2, seção 18](../review/F24_4E2_MOVEMENT_EVENT_STATE_CONVERGENCE.md#18-closure-remediation--recertification--b1m1m2m3)
registram o writer único `movement_v1/apply_animal_lot`, ativo na fila compartilhada.
Inserts factuais genéricos Animal→Lote são bloqueados na Edge e no banco. O seletor
original e o digest persistidos são imutáveis em retry/replay; não há dual-write.

`operation_identity` associa a resposta à farm/event/op/tx original, separadamente do
receipt técnico imutável. REJECTED e IDENTITY_DIVERGENCE não exigem receipt factual
completo para consumo seguro; resposta de outra operação não pode ser consumida.
Pending causal é retomado pelo servidor com decisão técnica append-only; sua resolução
não depende de reenviar o filho. O cliente observa o resultado efetivo pelo pull.

ACK remoto não equivale à reconciliação concluída: operações em `RECONCILE` preservam
animal, Evento, detail e intenção otimista até instalação local do resultado remoto. Replace de uma fazenda substitui
somente seus registros não protegidos, sem clear global. O pull captura identidades e
`generation_id` da obrigação antes das leituras e conclui somente as operações capturadas,
com geração ainda igual e resultados necessários observados, na transação de instalação.
ACK posterior permanece protegido para outro ciclo, inclusive após restart/farm-switch.

E2 Animal→Lote está CLOSED e G3 dessa vertical RESOLVED; F24.4E permanece IN_PROGRESS.
Lote→Pasto, occupancy, correção de movimento e paginação global do pull não são certificados
por essa entrega; N1 reentrada de `createGesture` permanece DEFERRED.

## Sync Sanitário v2

### Identidade e revisão

- UUID real para entidades destinadas ao remoto;
- `client_op_id` identifica a tentativa idempotente;
- `client_tx_id` agrupa a transação do cliente;
- `domain_op_id` identifica a operação de domínio;
- `expected_revision` protege transições concorrentes;
- ledger remoto comprova replay.

### Comandos

- `create_agenda`;
- `replace_agenda_animals`;
- `apply_factual_core`;
- `close_agenda`.

### Resultados do worker

- `APPLIED`;
- `APPLIED_ALTERED`;
- `RETRYABLE`;
- `REJECTED`;
- `CONFLICT`;
- `BLOCKED_DEPENDENCY`.

O worker não transforma timeout em conflito confirmado. Resultado desconhecido ou identidade divergente permanece rastreável e elegível para reconcile seguro.

Terminalidade e retry são decididos por operação:

- `APPLIED` e `APPLIED_ALTERED` são confirmações remotas e não sofrem rollback ou reenvio como fato novo;
- `REJECTED` e `CONFLICT` são terminais;
- `RETRYABLE` permanece transitório;
- `BLOCKED_DEPENDENCY` é terminal somente quando a dependência concreta da mesma gesture terminou em `REJECTED` ou `CONFLICT`;
- dependência retryable, ausente, bloqueada ou ainda não resolvida mantém o dependente transitório.

Uma gesture com resultado misto converge por operação. O retry preserva identidade quando representa o mesmo fato, não remove evidência de rejeição e não duplica operações já aplicadas.

### Dexie e cutover

- schema Dexie v28;
- store factual `event_eventos_animais`;
- manifesto `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- cutover idempotente por domínio/versão;
- ativação com contexto de sync faz backfill idempotente dos históricos externos locais elegíveis, inclusive para manifesto já `APPLIED`;
- preservação das filas de outros domínios;
- feature flag local fail-closed.

### Pull/reconcile

O pull sanitário faz merge não destrutivo. Agenda/animais/closure e núcleo factual são reconciliados sem apagar fatos locais pendentes ou remotos aceitos. Uma operação `apply_factual_core` pendente protege conjuntamente evento, detalhe e relação Evento–Animal, inclusive diante de tombstone remoto parcial.

A Conformidade não é sincronizada como fonte primária. O item 3.13 reconstrói esse read model localmente somente depois do commit completo do pull factual; falha anterior ao merge não grava estado parcial nem dispara recálculo.

Snapshots técnicos e de carência fazem round-trip dentro de `eventos_sanitario.produto_snapshot`. Retry reutiliza o snapshot persistido e o remoto não consulta o catálogo atual para reescrever fato histórico. Correções sanitárias são novos Eventos com identidades próprias e projeção append-only; ramificação permanece conflito explícito.

## Estado de validação

- agenda e `agenda_animais`: implementados, com E2E remoto parcial;
- evento e detalhe: implementados, com E2E remoto pendente;
- retry/replay/idempotência: implementados, com validação remota parcial;
- sucesso parcial: validado localmente, remoto pendente;
- conflito multi-dispositivo: código e SQL validados, plataforma bloqueada.
- movimento de estoque 3.9: implementado e validado localmente;
- recálculo após pull 3.13: implementado e validado localmente;
- produto/fonte 4, correção append-only 5 e carência operacional 6: implementados e validados localmente;
- hardening integrado local de 3.9, 3.13, 4, 5 e 6: executado e aprovado.

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` ocorre porque o PostgreSQL produz `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout. O worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Não aumentar timeout nem alterar RPC sem nova evidência.

## Ativação

- staging: `zqloazqzhwauamcejmuz`;
- produção: não alterada;
- gate remoto: desligado;
- feature flag local: `false`;
- rollout: não autorizado;
- fixtures sintéticas residuais: zero.

## Histórico externo/documental 3.8

`external_declared` e `external_documented` usam a fila compartilhada como `standalone_fact`. O registro factual existe em `event_eventos`/`eventos`, mas não é `primary_execution`. Referência e cobertura são validações estruturais; não autenticam o conteúdo documental.

O fingerprint remoto cobre evento, detalhe e relações completos. Alterar referência, cobertura ou snapshot crítico com a mesma identidade gera conflito. O fallback legado de animais só é usado quando não existe relação canônica.

## Lacunas de release F24

A Fase 12 permanece tecnicamente encerrada. O bloqueio externo sanitário não a reabre.

O [closeout F24.3](../review/F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md) certificou localmente
farm-aware replace, reconciliação de fazenda não ativa, recovery `UNKNOWN`, retry genérico,
HTTP 429/`Retry-After`, reconnect, reabertura Dexie e fila heterogênea multi-farm.

Permanecem fora dessa certificação:

- `REAL_PROCESS_KILL = NOT_PROVEN`: kill/restart real com o mesmo perfil persistente;
- stale write de `animais`, CAS server-authoritative, lost ACK replay idempotente e autoridade de relógio caracterizados por F24.4C/F24.4D (`STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS`, `CLOCK_SKEW_BEHAVIOR = CHARACTERIZED_FOR_CRITICAL_SYNC_PATHS`); concorrência transversal dos demais `state_*`, dependências causais sob skew e multi-device físico permanecem na sequência F24.4 (`REAL_PHYSICAL_MULTI_DEVICE = NOT_PROVEN`);
- correlação ponta a ponta entre identidade, tentativa, ACK e reconcile, planejada na F24.5;
- benchmark de fila, IndexedDB, startup, memória e throughput, planejado na F24.6.

O inventário e a classificação por ambiente estão na
[baseline F24.0](../review/F24_RELEASE_READINESS_BASELINE.md). A recertificação remota do
Sanitário v2 continua condicional à estabilidade da plataforma; gates desligados e rollout
não autorizado permanecem obrigatórios.
