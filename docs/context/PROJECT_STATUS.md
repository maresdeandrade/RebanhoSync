# Project Status — RebanhoSync

Atualizado em: 2026-09-09
Baseline documental de abertura da Fase 18: `ada8376b545b2ae3a3706de2f09305e0ad0ca848`; `origin/main@e806443d8d326d9fb5c025e6aa55d5c73582a015`
Baseline de abertura da Fase 19: `main@b07a1252a6436a413f9562a7f9079269cb49d026`
Baseline de abertura da Fase 20: `main@5dc7195e5b0d96eee74a9512317a2b30b9c21a58`
Merge do hardening transversal: `4e208ba090daa652f2735c94403317ed4ecbf045`
Commit integrado da Fase 17: `797f84d3aa49f424bf0b6ca013e416c61f24c41e`
PR do hardening transversal: `#96`
Fase atual: **Fase 22 — Eficiência Produtiva e Econômica (CLOSED)**.
Próxima fase de desenvolvimento: **Fase 22 — encerramento formal e baseline unificada U0 (Trilha C / Convergência Técnica concluída: C5=CLOSED, C6=CLOSED, C7=CLOSED, TECHNICAL_CONVERGENCE=CLOSED; F23 desbloqueada)**.
Próximo incremento: F23 V1 em revisão no PR #134 (motor puro de simulação de cenários, UI dedicada com badges OBSERVADO/PREMISSA/SIMULADO, CTA contextual no detalhe do animal direcionando para rota dedicada /animais/:id/simulacao, sem persistência e sem recomendações automatizadas); TECHNICAL_CONVERGENCE = CLOSED; F23_V1 = PR_READY_FOR_REVIEW; B3 = PLATFORM_BLOCKED / FAIL_CLOSED; F24 = NOT STARTED.

## Objetivo

Registrar o estado vivo do produto em formato curto. Este documento não substitui o [roadmap](../product/ROADMAP.md), o [plano ativo](../review/ACTIVE_PHASE_PLAN.md) nem o [handoff técnico](../review/CURRENT_PHASE_HANDOFF.md).

## Referência arquitetural operacional

O [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md) é a referência arquitetural canônica dos fluxos operacionais. Código e migrations ativas mantêm precedência factual; os resumos deste `PROJECT_STATUS.md` registram estado e contexto, mas não redefinem contratos do mapa.

## Estado atual

RebanhoSync está em beta interno, com arquitetura offline-first e isolamento multi-tenant por `fazenda_id`.

A **Fase 23 — Simulação Produtiva e Comercial (F23 V1)** está implementada sobre o branch `feat/f23-productive-commercial-simulation` aguardando revisão e merge no PR #134 a partir da baseline unificada `origin/main@0ede06b277d256cd03abac6c4c26f23e49b5c2f0`. A entrega introduz o motor de cálculo puro `src/lib/simulation/productiveCommercialSimulation.ts` baseado na fórmula canônica `FATOS OBSERVADOS + PREMISSAS EXPLÍCITAS = CENÁRIO SIMULADO`. O motor reutiliza os contratos de pesagem (`observedWeightEvidence.ts`, `latestObservedWeight.ts`, `gmdCalculation.ts`), o contrato de conversão comercial (`commercialPricing.ts`), assegura distinção estrita entre GMD factual observado e GMD assumido projetado, trata ausência de custos como cobertura parcial/não informada (nunca custo zero), calcula margem parcial simulada e break-even do cenário, e compara Vender Agora × Manter estritamente por deltas numéricos sem emitir qualquer recomendação ou autorização operacional. A UI dedicada `ProductiveCommercialSimulator.tsx` organiza a visualização em blocos rotulados com badges `OBSERVADO`, `PREMISSA` e `SIMULADO`, acessada via CTA contextual no detalhe do animal (`AnimalSimulacaoCta`) direcionando para a rota dedicada `/animais/:id/simulacao`. O ciclo é estritamente efêmero (zero tabelas, zero stores no Dexie, zero operações de fila, zero Eventos/Agendas e zero migrations). Status: `TECHNICAL_CONVERGENCE = CLOSED`, `F23_V1 = PR_READY_FOR_REVIEW`, `B3 = PLATFORM_BLOCKED / FAIL_CLOSED`, `F24 = NOT STARTED`.

A Trilha D (UX/UI Rebaseline 2.0) foi integralmente executada e formalmente encerrada sobre `main@c2300d01d7cd6d71dcf89829a1cb2945146b96bb` (PRs #122, #125, #126, #127 e #128). O ciclo consolidou D0 (auditoria 360°), D1 (tokens semânticos e theme contract), D2 (shell e layout unificado), D3 (componentes estruturais canônicos), D4 (redesign dirigido de 9 páginas), D5 (responsividade, dark mode e acessibilidade) e D6 (regressão visual sistemática com zero regressões e fechamento verification-only). A iniciativa visual está formalmente encerrada e o foco retorna às trilhas funcionais/técnicas do roadmap (Fase 22+). Quaisquer melhorias adicionais de UX devem ser tratadas como demandas novas e independentes.

A Fase 17 foi concluída e integrada em `main@797f84d3aa49f424bf0b6ca013e416c61f24c41e`. A entrega inclui recomendações puras de qualidade/freshness de peso e revisão de Agenda vencida, com proveniência, convergência, cutoff, conflitos, limitações e não-autorização explícitos. Usa `eventos` + `eventos_pesagem` e `state_agenda_itens`, não persiste recomendação e não altera Evento, Agenda, `state_*`, Dexie, sync ou banco. Os testes focados, regressões proporcionais, lint e build registrados no fechamento passaram.

A Fase 18 foi concluída com inventário de 47 rotas ativas, 58 primitives/arquivos compartilhados, auditoria de tokens e CSS, sete documentos do Design System alvo e matriz de migração P0–P3. A inspeção autenticada cobriu Home, Animais, AnimalDetalhe, Registrar e Agenda em desktop/mobile e light/dark. O único P0 confirmado, no seletor de contexto do Registrar, foi corrigido por layout responsivo e revalidado em 390, 768 e 1024 px nos dois temas; **P0 aberto = 0**. Nenhum redesign amplo ou implementação da Fase 19 foi iniciado.

A Fase 19 foi concluída sobre `main@b07a1252a6436a413f9562a7f9079269cb49d026` com tokens reais de tipografia, superfície, elevação, overlay, branding, neutros e famílias semânticas; primitives estruturais compatíveis; `StateBanner`; aliases `PageHeader` e `FilterBar`; correção do drift de `components.json`; e consolidação responsiva do shell/navegação. A matriz autenticada cobriu Home, Animais, AnimalDetalhe, Registrar e Agenda em 390, 768, 1024 e 1440 px, light/dark. **P0 novo = 0** e a migração ampla da F20 não foi iniciada.

A Fase 20 foi concluída sobre `main@5dc7195e5b0d96eee74a9512317a2b30b9c21a58`. Home, Animais, AnimalDetalhe, Registrar e Agenda foram migradas incrementalmente para os padrões da F18/F19, preservando selectors, filtros, bulk, builders, validação, submit, Agenda e writers. A inspeção autenticada cobriu as cinco jornadas em 390×844, 768×1024, 1024×768 e 1440×900, nos temas claro e escuro, sem overflow estrutural; **P0 novo = 0**. Foram aprovados 65 testes focados, lint, build e os gates documentais de fechamento.

A Fase 21 foi encerrada com `operational_history_review` e `herd_flow_review`, ambas derivadas de `MetricResult` existentes e apresentadas como `DecisionRecommendation` não persistidas. A auditoria conjunta confirmou perguntas distintas, ausência de duplicação relevante, fontes/cobertura/limitações explícitas, isolamento por fazenda e CTAs exclusivamente navegacionais. A consolidação foi apenas apresentacional; Evento, Agenda, `state_*`, writers, Dexie, sync e banco permaneceram inalterados.

O [gate de fontes da Fase 22](../review/F22_SOURCE_GATE.md) classificou `22A_PARTIAL` e `22B_PARTIAL`; a integração posterior do PR `#108` satisfez `B4 REMOTE_CONVERGENCE_VERIFIED` e desbloqueou tecnicamente o source gate de 22C, sem iniciar sua implementação. A F22A.1 adiciona `selectLatestObservedWeight`, a F22A.2 seleciona o intervalo factual e a F22A.3 calcula somente `weightDeltaKg` e `gmdKgPerDay` a partir desse contrato. A [política técnica F22A.2B](../review/F22A_GMD_INTERVAL_POLICY.md) permanece contextual: todo resultado calculado expõe `reliability = UNCLASSIFIED` e `operationalUse = NOT_AUTHORIZED`. O [gate de adoção F22A.4](../review/F22A_GMD_ADOPTION_GATE.md) confirmou que nenhum consumidor atual é `MIGRATABLE_NOW`: telas individuais exigem UX qualificadora, KPI executivo está bloqueado por confiabilidade e occupancy deve permanecer separado. Nenhuma UI, migration, RLS, RPC, Dexie, sync ou writer foi alterado.

Atualização posterior: o [contrato F22C](../review/F22C_HISTORICAL_OCCUPANCY_SOURCE_GATE.md) confirmou fontes históricas `READY` para animal→lote e lote→pasto. F22C.1 implementa intervalos factuais de lote, F22C.2 compõe animal→pasto, F22C.3 qualifica duração e agrega, e o fechamento integra pesagens factuais à ocupação qualificada. Delta e GMD representam somente a janela observada, mantêm reliability não classificada e uso operacional não autorizado; ausência ou conflito permanecem `null`. Builders, cards e cockpits compatíveis deixaram de usar o cálculo legado como fonte. UA e lotação permanecem separados.

A [F22B.1 Economic Coverage](../review/F22B_ECONOMIC_COVERAGE.md) adiciona `selectEconomicCoverage`, read model puro por fazenda e período. O contrato separa receitas e custos factuais, ausência e zero observado, categorias desconhecidas, estornos e operações comerciais sem financeiro associado; exige coverage de fonte explícita e não calcula saldo, resultado, lucro, margem, ROI ou custo unitário. Nenhum consumer, banco ou fluxo offline foi alterado.

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
- B4 Movimentação: `eventos_movimentacao` integrado em `STANDARD_EVENT_DETAIL_REMOTE_TABLES`; convergência automatizada e round-trip remoto A → staging → B, incluindo clean install, comprovados (`REMOTE_CONVERGENCE_VERIFIED`); gate técnico da F22C desbloqueado, sem iniciar a F22C.
- Trilha C (Hardening Banco / Advisor / Performance): C0 (Inventário Autoritativo), C1 (Hardening SECURITY DEFINER & EXECUTE), C2 (Search Path & Auth Hardening), C3 (auth_rls_initplan: 8 → 0), C4 (Permissive Policies: 17 operacionais resolvidos, 6 residuais aceitos), C5 (Foreign Keys / Indexes: CLOSED_EVIDENCE_ONLY [148 FKs mapeadas; 92 unindexed advisor info classificados como NO_ACTION após análise de carga]), C6 (Workload Evidence: CLOSED [1.939 queries de pg_stat_statements analisadas em janela de 43 dias sem spills ou gargalos em 17/17 domínios]) e C7 (Unused Indexes: CLOSED [306 índices distintos mapeados; 94 unused advisor info preservados para sync, soft-delete, constraints e FKs; zero drops arriscados]) concluídos. TECHNICAL_CONVERGENCE = CLOSED. Advisor findings informativos (92 unindexed FKs, 94 unused indexes) catalogados como KNOWN_NON_ACTIONABLE; 0 migrations necessárias; 148/148 policies idênticas em LOCAL e STAGING (100% paridade).
- Produção: não alterada (100% preservada).

- B3 Sync Sanitário v2:
  - `B3_IMPLEMENTATION = CLOSED`
  - `B3_REMOTE_MULTI_DEVICE_GATE = PLATFORM_BLOCKED`
  - `B3_FEATURE_FLAG = FAIL_CLOSED`
  - `B3_BLOCKS_CURRENT_MAIN = NO`
  - `B3_BLOCKS_RELEASE = YES`
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

A Fase 22 está formalmente encerrada (**CLOSED**): F22A adotada canonicamente na Home (GMD observado sem ranking, `reliability = UNCLASSIFIED`, `operationalUse = NOT_AUTHORIZED`); F22B adotada via PR #123 com resultado econômico observado qualificado (`profit = NOT_DEMONSTRATED`, `completeAccounting = false`); F22C fechada com ocupação histórica, duração e performance observada factual. O Sync Sanitário v2 permanece bloqueado para release por plataforma externa (`PLATFORM_BLOCKED`), mas não bloqueia desenvolvimento interno. Os ciclos C3, C4, C5, C6 e C7 foram integralmente concluídos (`TECHNICAL_CONVERGENCE = CLOSED`), desbloqueando formalmente o desenvolvimento da Fase 23 (Simulação Produtiva e Comercial) sobre a baseline unificada.

## Fontes de detalhe

- [Plano ativo](../review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](../review/CURRENT_PHASE_HANDOFF.md)
- [Roadmap](../product/ROADMAP.md)
- [Sanitário](../domain/SANITARIO.md)
- [Offline Sync](../technical/OFFLINE_SYNC.md)
- [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md)
