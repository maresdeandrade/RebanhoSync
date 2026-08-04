# Project Status — RebanhoSync

Atualizado em: 2026-08-04
Baseline funcional atual: `47c3ebd`

## Objetivo

Registrar o estado vivo do produto em formato curto. Este documento não substitui o [roadmap](../product/ROADMAP.md), o [plano ativo](../review/ACTIVE_PHASE_PLAN.md) nem o [handoff técnico](../review/CURRENT_PHASE_HANDOFF.md).

## Estado atual

RebanhoSync está em beta interno, com arquitetura offline-first e isolamento multi-tenant por `fazenda_id`.

A Fase 12 permanece ativa. A Conformidade Sanitária v2 foi validada localmente e documentada; o Sync Remoto Sanitário v2 está em andamento, com infraestrutura principal implementada e validação E2E remota parcial.

A documentação curta do Sanitário v2 local também está concluída.

Próxima pendência oficial: **reexecutar os E2Es remotos quando a plataforma estiver estável**.

## Estado sanitário consolidado

- Agenda Sanitária v2 representa intenção/tarefa futura.
- Evento sanitário representa fato histórico executado.
- Closure administrativa encerra a intenção e não comprova execução.
- Conformidade Sanitária v2 é read model local derivado, somente leitura.
- Conformidade é recalculada a partir de fatos e não libera venda, abate, leite ou aptidão operacional.
- Execução parcial vale somente para animais vinculados ao Evento.
- `external_declared` não comprova regra crítica.
- `external_documented` exige referência de evidência para comprovação crítica.
- Baixa de estoque depende de Evento factual.
- Carência depende de produto executado e fonte técnica explícita.
- Tags, sinais, insights e status de sync não são fontes críticas.

## Sync Sanitário v2

Implementado:

- migration expand;
- `revision` e `expected_revision`;
- `client_op_id`, `client_tx_id` e `domain_op_id`;
- vínculo Evento → Agenda Sanitária v2;
- relação append-only Evento–Animal;
- ledger de idempotência;
- gate autoritativo fail-closed;
- comandos `create_agenda`, `replace_agenda_animals`, `apply_factual_core` e `close_agenda`;
- `sync-batch` v19 e typecheck Deno limpo;
- worker/reconcile com `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- Dexie v28 e store factual `event_eventos_animais`;
- manifesto de cutover `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- fila compartilhada, pull/reconcile não destrutivo e feature flag local fail-closed.

Estado dos subitens:

| Subitem | Estado |
|---|---|
| 3.1–3.3 Schema, migrations e RLS | Concluídos |
| 3.4–3.5 Agenda e animais | Implementados; E2E remoto parcial |
| 3.6–3.7 Evento e detalhe | Implementados; E2E remoto pendente |
| 3.8 Histórico externo/documental | Implementado e validado localmente; E2E remoto não executado |
| 3.9 Movimento de estoque | Implementado e validado localmente; E2E remoto pendente |
| 3.10 Retry/replay/idempotência | Implementado; remoto parcial |
| 3.11 Sucesso parcial | Local validado; remoto pendente |
| 3.12 Conflito multi-dispositivo | Plataforma bloqueada |
| 3.13 Recalcular Conformidade após pull | Implementado e validado localmente |

## Ambiente e rollout

- Supabase staging: `zqloazqzhwauamcejmuz`.
- Produção: não alterada.
- Gate sanitário remoto: desligado.
- Feature flag local: `false`.
- Rollout para usuários: não autorizado.
- Fixtures sintéticas residuais: zero.

## Bloqueio externo

`SANITARIO_V2_E2E_PLATFORM_BLOCKED`:

- criação de agenda, replay e substituição de animais foram aprovados;
- a revisão chegou corretamente a `1`;
- PostgreSQL produz imediatamente `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`;
- a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout;
- o worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Não há evidência atual de defeito no SQL ou na regra de domínio. Não aumentar timeout nem alterar RPC sem nova evidência. O bloqueio impede rollout, mas não o desenvolvimento sob gate desligado.

## Próximo desenvolvimento

O item 3.13 recalcula localmente a Conformidade após o pull das fontes factuais necessárias. A Conformidade permanece read model derivado, sem tabela/operação primária de sync e sem criar Agenda, Evento, movimento de estoque, carência ou liberação operacional. O item 3 e a Fase 12 permanecem abertos pelas validações remotas pendentes.

## Fontes de detalhe

- [Plano ativo da Fase 12](../review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](../review/CURRENT_PHASE_HANDOFF.md)
- [Roadmap](../product/ROADMAP.md)
- [Sanitário](../domain/SANITARIO.md)
- [Offline Sync](../technical/OFFLINE_SYNC.md)
- [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md)
