# Resultado funcional mais recente — RebanhoSync

Atualizado em: 2026-07-30
Baseline funcional: `2006286`

## Resultado

O cutover local Dexie do Sync Sanitário v2 foi implementado sob gate desligado:

- Dexie v28;
- store factual `event_eventos_animais`;
- manifesto de cutover com `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- preservação da fila compartilhada;
- pull/reconcile não destrutivo;
- feature flag local fail-closed mantida em `false`.

Incrementos anteriores do mesmo bloco entregaram a fundação expand, RLS, `sync-batch` v19, typecheck Deno limpo e worker/reconcile com resultados canônicos.

## Estado da validação

- validações locais dos incrementos: concluídas;
- agenda e `agenda_animais`: E2E remoto parcial;
- evento e detalhe: E2E remoto pendente;
- conflito multi-dispositivo: código e SQL validados, plataforma bloqueada;
- rollout: não autorizado.

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` ocorre porque o PostgreSQL produz imediatamente `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout. O worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Não há evidência atual de defeito no SQL ou na regra de domínio.

## Ambiente

- staging: `zqloazqzhwauamcejmuz`;
- produção: não alterada;
- gate remoto: desligado;
- feature flag local: `false`;
- fixtures sintéticas residuais: zero.

## Próximo incremento

3.8 — Push/pull de histórico sanitário externo/documental.

Detalhes no [plano ativo](./ACTIVE_PHASE_PLAN.md) e no [handoff atual](./CURRENT_PHASE_HANDOFF.md).
