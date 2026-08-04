# Offline e sync — RebanhoSync

Atualizado em: 2026-07-30

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
- `RETRYABLE`;
- `REJECTED`;
- `CONFLICT`;
- `BLOCKED_DEPENDENCY`.

O worker não transforma timeout em conflito confirmado. Resultado desconhecido ou identidade divergente permanece rastreável e elegível para reconcile seguro.

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

## Próxima pendência

Certificação remota acumulada quando o ambiente estiver estável e os gates forem liberados para teste. E2Es remotos permanecem pendentes, feature gates desligados, rollout não autorizado e Fase 12 aberta.

Detalhes: [plano ativo](../review/ACTIVE_PHASE_PLAN.md) e [handoff](../review/CURRENT_PHASE_HANDOFF.md).
