# Project Status — RebanhoSync

Atualizado em: 2026-08-24
Baseline documental de abertura da Fase 18: `ada8376b545b2ae3a3706de2f09305e0ad0ca848`; `origin/main@e806443d8d326d9fb5c025e6aa55d5c73582a015`
Baseline de abertura da Fase 19: `main@b07a1252a6436a413f9562a7f9079269cb49d026`
Baseline de abertura da Fase 20: `main@5dc7195e5b0d96eee74a9512317a2b30b9c21a58`
Merge do hardening transversal: `4e208ba090daa652f2735c94403317ed4ecbf045`
Commit integrado da Fase 17: `797f84d3aa49f424bf0b6ca013e416c61f24c41e`
PR do hardening transversal: `#96`
Fase atual: **Fase 21 — Inteligência Operacional v2** — marcador avançado; implementação não iniciada.
Próxima fase de desenvolvimento: **Fase 21 — Inteligência Operacional v2**.

## Objetivo

Registrar o estado vivo do produto em formato curto. Este documento não substitui o [roadmap](../product/ROADMAP.md), o [plano ativo](../review/ACTIVE_PHASE_PLAN.md) nem o [handoff técnico](../review/CURRENT_PHASE_HANDOFF.md).

## Referência arquitetural operacional

O [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md) é a referência arquitetural canônica dos fluxos operacionais. Código e migrations ativas mantêm precedência factual; os resumos deste `PROJECT_STATUS.md` registram estado e contexto, mas não redefinem contratos do mapa.

## Estado atual

RebanhoSync está em beta interno, com arquitetura offline-first e isolamento multi-tenant por `fazenda_id`.

A Fase 17 foi concluída e integrada em `main@797f84d3aa49f424bf0b6ca013e416c61f24c41e`. A entrega inclui recomendações puras de qualidade/freshness de peso e revisão de Agenda vencida, com proveniência, convergência, cutoff, conflitos, limitações e não-autorização explícitos. Usa `eventos` + `eventos_pesagem` e `state_agenda_itens`, não persiste recomendação e não altera Evento, Agenda, `state_*`, Dexie, sync ou banco. Os testes focados, regressões proporcionais, lint e build registrados no fechamento passaram.

A Fase 18 foi concluída com inventário de 47 rotas ativas, 58 primitives/arquivos compartilhados, auditoria de tokens e CSS, sete documentos do Design System alvo e matriz de migração P0–P3. A inspeção autenticada cobriu Home, Animais, AnimalDetalhe, Registrar e Agenda em desktop/mobile e light/dark. O único P0 confirmado, no seletor de contexto do Registrar, foi corrigido por layout responsivo e revalidado em 390, 768 e 1024 px nos dois temas; **P0 aberto = 0**. Nenhum redesign amplo ou implementação da Fase 19 foi iniciado.

A Fase 19 foi concluída sobre `main@b07a1252a6436a413f9562a7f9079269cb49d026` com tokens reais de tipografia, superfície, elevação, overlay, branding, neutros e famílias semânticas; primitives estruturais compatíveis; `StateBanner`; aliases `PageHeader` e `FilterBar`; correção do drift de `components.json`; e consolidação responsiva do shell/navegação. A matriz autenticada cobriu Home, Animais, AnimalDetalhe, Registrar e Agenda em 390, 768, 1024 e 1440 px, light/dark. **P0 novo = 0** e a migração ampla da F20 não foi iniciada.

A Fase 20 foi concluída sobre `main@5dc7195e5b0d96eee74a9512317a2b30b9c21a58`. Home, Animais, AnimalDetalhe, Registrar e Agenda foram migradas incrementalmente para os padrões da F18/F19, preservando selectors, filtros, bulk, builders, validação, submit, Agenda e writers. A inspeção autenticada cobriu as cinco jornadas em 390×844, 768×1024, 1024×768 e 1440×900, nos temas claro e escuro, sem overflow estrutural; **P0 novo = 0**. Foram aprovados 65 testes focados, lint, build e os gates documentais de fechamento.

A Fase 13 está funcionalmente encerrada. A Reprodução Operacional v1 cobre cobertura/IA, diagnóstico, PRENHA/VAZIA e DPP reconstruíveis, parto, aborto/perda, cria, correção append-only e seis Agendas neonatais na Agenda Sanitária v2.

A Fase 14 — Compra/Venda Operacional permanece encerrada. As operações comerciais individual e em lote foram integradas; o contrato kg/@ foi preservado; precificação e simulação comercial foram incorporadas; a simulação permanece não factual; e a Importação V2 foi integrada com preview, versionamento, chunks, idempotência e offline-first.

A Fase 15 — KPIs/Relatórios está tecnicamente concluída e integrada em `main@0d425d1e8786d7cd50ea3d96594f836da99a2ecb`. O contrato inclui `MetricResult<T>` com `complete`/`partial`/`unavailable`, cobertura histórica conservadora, período e timezone da fazenda com fallback runtime declarado, isolamento por `fazendaId`, reprodução canônica, comercial factual v2, histórico factual de entradas/saídas/categorias do rebanho, Agenda Sanitária v2 preferencial e exportações com cobertura/escopo/período/timezone. Nenhuma nova fonte de verdade foi criada.

A validação da Fase 15 confirmou 16 testes focados, `quality:gate`, build, typecheck compatível, Prettier nos arquivos afetados, `git diff --check` e Validate repository remoto. A integração ocorreu sem migration, RLS, schema, RPC, Edge Function, grant ou sync remoto; produção não foi alterada.

A Fase 16 — Financeiro Gerencial — foi integralmente concluída e integrada via PR #94. A implementação incluiu hardening offline de `finance_transactions` e `finance_categories`, hardening semântico de valores e status do ledger, classificação canônica cruzada (Evento × ledger × comercial) para prevenir dupla contagem, e separação clara entre caixa, competência, previsão e vencidos. Os KPIs ganharam cobertura conservadora (ausência de dados não é zero factual). As categorias default passaram a usar UUID determinístico customizado baseado em SHA-256 com identidade convergente cliente/Postgres e resolução de colisão estrita. A Fase 16 também introduziu o estorno append-only (com a coluna `reverses_transaction_id`) e atualizou a Edge Function `sync-batch` e o Dexie para a v29. O RLS permaneceu preservado. A validação de upgrade legado isolado, 43 testes focados, gates de qualidade e build de produção passaram com sucesso.

**Importante:** A migration `20260601000000_financeiro_estorno_categorias.sql` foi aplicada com sucesso em staging durante a Trilha B (alinhamento `42 local == 42 staging`). A promoção para produção permanece pendente.

## Hardening transversal integrado — PR #96

O ciclo de auditoria operacional foi integrado em `main` via PR #96. O pacote consolidou isolamento local por fazenda nas telas de detalhe, occupancy pelo read model canônico, cadastro e leitura societária pelo contrato vigente, reconciliação mista por operação, retry idempotente, sucesso parcial sanitário, locks locais de submit, acessibilidade dos dialogs e consistência dos gates de importação/lint.

No sync, o pacote preservou o contrato canônico de resultado por operação, rollback e retry descrito no [mapa operacional](../architecture/OPERATIONAL_FLOWS.md); este documento registra apenas o estado integrado.

O merge também versionou a configuração local descartável do Supabase, o ajuste de `search_path` de `pgcrypto` e alterações do `sync-batch` já contidas na branch acumulada. O baseline funcional foi executado apenas contra Supabase local descartável; esta integração não executou deploy de migration, RLS, RPC ou Edge Function em staging/produção.

Validação final: 2.668 testes em 354 arquivos, lint, build, gates documentais, cleanup Supabase e `Repository must remain clean` passaram no CI de `main` ([run 32619923698](https://github.com/maresdeandrade/RebanhoSync/actions/runs/32619923698)). O teste focado de reprodução/sync passou com 5/5 casos após o merge.

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

- Supabase staging: `zqloazqzhwauamcejmuz` (42 migrations alinhadas: `42 local == 42 staging`).
- Auth / Grants: privilégios de tabelas autenticadas reconciliados (`20260826230107`), validado localmente, aplicado em staging; produção pendente.
- Admin Track: A1.1 + A2 + A2.1 + A4 operacionais em staging; provisionamento e smoke de SuperAdmin validados; produção pendente.
- F16 Financeiro: migration aplicada em staging; produção pendente.
- B4 Movimentação: `eventos_movimentacao` integrado em `STANDARD_EVENT_DETAIL_REMOTE_TABLES`; convergência comprovada em testes automatizados (`AUTOMATED_CONVERGENCE_VERIFIED`); E2E remoto pendente antes da F22C.
- Produção: não alterada (100% preservada).
- Gate sanitário remoto: desligado (`fail-closed`).
- Feature flag local Sanitário v2: `false`.
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

O próximo desenvolvimento é a Fase 21 — Inteligência Operacional v2, reutilizando `MetricResult` e `DecisionRecommendation` sem antecipação nesta entrega. O Sync Sanitário v2 permanece sem habilitação; rollout e produção continuam inalterados.

## Fontes de detalhe

- [Plano ativo](../review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](../review/CURRENT_PHASE_HANDOFF.md)
- [Roadmap](../product/ROADMAP.md)
- [Sanitário](../domain/SANITARIO.md)
- [Offline Sync](../technical/OFFLINE_SYNC.md)
- [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md)
