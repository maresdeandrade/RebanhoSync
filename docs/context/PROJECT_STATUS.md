# Project Status — RebanhoSync

Atualizado em: 2026-08-20
Baseline integrado da Fase 15: `main@0d425d1e8786d7cd50ea3d96594f836da99a2ecb`
Baseline efetivo de abertura da Fase 16.0: `2f3aaa449d39c39e5841461e0450e50b0b2e981a`
Merge commit da Fase 15: `0d425d1e8786d7cd50ea3d96594f836da99a2ecb`
Fase 16 concluída e validada localmente.
Próxima fase de desenvolvimento: **Fase 17 — a definir**.

## Objetivo

Registrar o estado vivo do produto em formato curto. Este documento não substitui o [roadmap](../product/ROADMAP.md), o [plano ativo](../review/ACTIVE_PHASE_PLAN.md) nem o [handoff técnico](../review/CURRENT_PHASE_HANDOFF.md).

## Estado atual

RebanhoSync está em beta interno, com arquitetura offline-first e isolamento multi-tenant por `fazenda_id`.

A Fase 13 está funcionalmente encerrada. A Reprodução Operacional v1 cobre cobertura/IA, diagnóstico, PRENHA/VAZIA e DPP reconstruíveis, parto, aborto/perda, cria, correção append-only e seis Agendas neonatais na Agenda Sanitária v2.

A Fase 14 — Compra/Venda Operacional permanece encerrada. As operações comerciais individual e em lote foram integradas; o contrato kg/@ foi preservado; precificação e simulação comercial foram incorporadas; a simulação permanece não factual; e a Importação V2 foi integrada com preview, versionamento, chunks, idempotência e offline-first.

A Fase 15 — KPIs/Relatórios está tecnicamente concluída e integrada em `main@0d425d1e8786d7cd50ea3d96594f836da99a2ecb`. O contrato inclui `MetricResult<T>` com `complete`/`partial`/`unavailable`, cobertura histórica conservadora, período e timezone da fazenda com fallback runtime declarado, isolamento por `fazendaId`, reprodução canônica, comercial factual v2, histórico factual de entradas/saídas/categorias do rebanho, Agenda Sanitária v2 preferencial e exportações com cobertura/escopo/período/timezone. Nenhuma nova fonte de verdade foi criada.

A validação da Fase 15 confirmou 16 testes focados, `quality:gate`, build, typecheck compatível, Prettier nos arquivos afetados, `git diff --check` e Validate repository remoto. A integração ocorreu sem migration, RLS, schema, RPC, Edge Function, grant ou sync remoto; produção não foi alterada.

A auditoria documental 16.0 do Financeiro Gerencial está concluída. Foram fechadas as fontes de verdade, a matriz canônica, a separação Evento versus ledger, caixa versus competência, zero versus ausência, comercial versus financeiro, rateios MVP e riscos de offline/sync/RLS.

A Fase 16 foi integralmente concluída no escopo local. O hardening offline (16.1A) protegeu operações financeiras pendentes no sync. O hardening semântico (16.1B) proibiu conversões silenciosas para zero e garantiu valores positivos no ledger. O núcleo gerencial (16.1C) introduziu deduplicação de vínculos explícitos cross-tenant, isolou simulações comerciais v2 do caixa, implementou sumário temporal (caixa, competência, previsão, vencido), adicionou estorno auditável append-only e identidades determinísticas para categorias, além de expandir a UI financeira e os KPIs operacionais com as novas restrições. A validação técnica completa, o build de produção e os gates documentais via WSL passaram com sucesso. Nenhuma migration, alteração de RLS, schema ou sync remoto foi necessária.

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

A próxima etapa formal é a revisão da PR #93. A Fase 16 não deve ser iniciada nesta transição. O Sync Sanitário v2 permanece sem habilitação; rollout e produção continuam inalterados.

## Fontes de detalhe

- [Plano ativo e transição para a Fase 13](../review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](../review/CURRENT_PHASE_HANDOFF.md)
- [Roadmap](../product/ROADMAP.md)
- [Sanitário](../domain/SANITARIO.md)
- [Offline Sync](../technical/OFFLINE_SYNC.md)
- [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md)
