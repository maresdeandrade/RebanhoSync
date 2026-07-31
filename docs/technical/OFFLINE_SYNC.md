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
- preservação das filas de outros domínios;
- feature flag local fail-closed.

### Pull/reconcile

O pull sanitário faz merge não destrutivo. Agenda/animais/closure e núcleo factual são reconciliados sem apagar fatos locais pendentes ou remotos aceitos.

A Conformidade não é sincronizada como fonte primária. Seu recálculo explícito após pull é o item 3.13 e permanece pendente; o item 3.8 deve recalculá-la conservadoramente no recorte do histórico externo/documental.

## Estado de validação

- agenda e `agenda_animais`: implementados, com E2E remoto parcial;
- evento e detalhe: implementados, com E2E remoto pendente;
- retry/replay/idempotência: implementados, com validação remota parcial;
- sucesso parcial: validado localmente, remoto pendente;
- conflito multi-dispositivo: código e SQL validados, plataforma bloqueada.

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` ocorre porque o PostgreSQL produz `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout. O worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Não aumentar timeout nem alterar RPC sem nova evidência.

## Ativação

- staging: `zqloazqzhwauamcejmuz`;
- produção: não alterada;
- gate remoto: desligado;
- feature flag local: `false`;
- rollout: não autorizado;
- fixtures sintéticas residuais: zero.

## Próximo incremento

3.8 — sincronizar `external_declared` e `external_documented` pela fila compartilhada, com origem/evidência, idempotência, tenant/`fazenda_id`, pull não destrutivo, replay, conflito e sucesso parcial.

O incremento não cria Agenda, Evento executado, estoque, carência ou liberação operacional.

Detalhes: [plano ativo](../review/ACTIVE_PHASE_PLAN.md) e [handoff](../review/CURRENT_PHASE_HANDOFF.md).
