# Project Status — RebanhoSync

Atualizado em: 2026-08-07
Baseline de entrada do fechamento da Fase 13: `e7b69fc`

## Objetivo

Registrar o estado vivo do produto em formato curto. Este documento não substitui o [roadmap](../product/ROADMAP.md), o [plano ativo](../review/ACTIVE_PHASE_PLAN.md) nem o [handoff técnico](../review/CURRENT_PHASE_HANDOFF.md).

## Estado atual

RebanhoSync está em beta interno, com arquitetura offline-first e isolamento multi-tenant por `fazenda_id`.

A Fase 13 está funcionalmente encerrada. A Reprodução Operacional v1 cobre cobertura/IA, diagnóstico, PRENHA/VAZIA e DPP reconstruíveis, parto, aborto/perda, cria, correção append-only e seis Agendas neonatais na Agenda Sanitária v2.

O patch final eliminou a precedência residual do cache `taxonomy_facts` nas leituras reprodutivas das telas quando o contexto factual canônico está carregado. Nenhum contrato de banco ou sync foi alterado.

Próxima fase de desenvolvimento: **Fase 14 — Compra/Venda Operacional**.

## Estado reprodutivo consolidado

- cobertura/IA, diagnóstico, parto e aborto são Eventos factuais;
- PRENHA, VAZIA, DPP, último parto e perda vigente vêm da projeção histórica;
- parto cria vínculo determinístico mãe–parto–cria e seis Agendas sanitárias v2;
- Agenda neonatal representa intenção futura e não prova execução;
- aborto não cria cria ou Agenda e remove a DPP do episódio encerrado;
- correção é novo Evento append-only;
- `taxonomy_facts` é cache derivado e não é fonte concorrente nas telas com contexto factual;
- retry/replay, rollback, atomicidade e isolamento por `fazenda_id` permanecem preservados.

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
- Correção sanitária é novo Evento factual vinculado; cadeia ramificada é conflito explícito.
- Carência vigente é projeção reconstruível da cadeia factual e dos snapshots congelados.
- Estados calculado, ausência explícita, desconhecido, ambíguo e não permitido permanecem distintos.
- Carne e leite são finalidades independentes; carência encerrada não autoriza operação comercial.
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
- `sync-batch` v20 e typecheck Deno limpo;
- worker/reconcile com `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- Dexie v28 e store factual `event_eventos_animais`;
- manifesto de cutover `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- fila compartilhada, pull/reconcile não destrutivo e feature flag local fail-closed.

Estado dos subitens:

| Subitem | Estado |
|---|---|
| 3.1–3.3 Schema, migrations e RLS | Concluídos |
| 3.4–3.11 e 3.13 Sync funcional | Concluído e certificado no escopo da Fase 12 |
| 3.12 Conflito multi-dispositivo | Desenvolvimento concluído; rollout bloqueado pela plataforma |
| 4 Produto técnico e fonte por campo | Concluído |
| 5 Correção sanitária append-only | Concluído |
| 6 Carência sanitária operacional | Concluído |
| Hardening integrado local | Concluído |

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

Não há evidência atual de defeito no SQL ou na regra de domínio. Não aumentar timeout, criar workaround ou reescrever preventivamente a RPC. O bloqueio impede rollout, mas não o desenvolvimento das próximas fases.

## Próximo desenvolvimento

A próxima etapa de desenvolvimento é a Fase 13 — Reprodução Operacional v1. O ciclo Dexie completo permanece coberto pela certificação local existente. A transição não habilita o Sync Sanitário v2; rollout e produção continuam inalterados.

## Fontes de detalhe

- [Plano ativo e transição para a Fase 13](../review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](../review/CURRENT_PHASE_HANDOFF.md)
- [Roadmap](../product/ROADMAP.md)
- [Sanitário](../domain/SANITARIO.md)
- [Offline Sync](../technical/OFFLINE_SYNC.md)
- [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md)
