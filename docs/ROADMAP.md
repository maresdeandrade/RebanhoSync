# Roadmap do Produto

> **Status:** Derivado (Rev D+)
> **Baseline:** `3664395`
> **Ultima Atualizacao:** 2026-05-28
> **Derivado por:** Auditoria tecnica - estado pos-fechamento dos TDs originais e evolucao funcional de UX operacional
> **Fonte:** `TECH_DEBT.md`, `IMPLEMENTATION_STATUS.md`

---

## Contexto

Todos os milestones do roadmap anterior (M0, M1, M2) foram concluidos via migrations de marco/2026. O capability score analitico permanece em 21/21 = 100%. O projeto segue em fase de **beta interno**.

Atualização de Consolidação Operacional 2026-05-28 (Fase 1 Concluída):
- A robustez da cadeia completa de execução (**Agenda aberta → Registrar manejo → Evento factual → Reconcile/fechamento da agenda**) foi blindada através de uma nova suíte de testes de integração de fluxos e testes de fumaça avulsos.
- Corrigimos as 6 falhas históricas em testes unitários fora dos recortes de hotspots de página, garantindo estabilização absoluta.

Atualização KPIs 2026-05-29 (Fase 5.1 Concluída):
- Invariantes dos KPIs produtivos (GMD, UA/ha, permanência, categoria) blindados via 26 novos testes unitários sem alteração de lógica de produção.
- `src/lib/animals/__tests__/kpiHelpers.test.ts` (15 casos) e `cockpitManejoAdapter.test.ts` expandido (+11 casos).
- Suite global: 231 arquivos / 1.492 testes passando.

O roadmap atual cobre a consolidacao de observabilidade, cobertura E2E dos fluxos mais recentes, refinamentos de UX operacional da agenda e a reestruturacao da biblioteca sanitaria base.
Com o hardening estrutural principal de `Registrar` e `Agenda` concluido, o repositorio entra em fase de consolidacao MVP -> SLC.

Atualizacao estrutural 2026-04-18 (sem mudanca funcional):
- `src/pages/Registrar/**`, `src/pages/Agenda/**` e `src/pages/ProtocolosSanitarios/**` operam com entrypoints folderizados (`index.tsx`) e contexto local (`README.md`/`AGENTS.md`).
- Dispatch local de paginas consolidado em `src/pages/AGENTS.md`.

Atualizacao estrutural 2026-04-19 (sem mudanca funcional de dominio):
- Hardening final do hotspot `src/pages/Registrar/**` concluido em camadas locais de shell/composicao (`useRegistrarShellState`, `useRegistrarActionSectionState`, `buildRegistrarActionSectionSlots`), com reducao do entrypoint para ~916 linhas.
- Hardening final do hotspot `src/pages/Agenda/**` concluido em camadas locais de controller/shell/interacao/composicao macro, com reducao do entrypoint para ~591 linhas.
- O foco de hardening de hotspot de pagina deixa de ser quebra inicial de monolitos e passa a consolidacao residual + acabamento de experiencia para SLC.

Atualizacao estrutural 2026-05-08 (TD-026 Agenda):
- Cortes incrementais locais reduziram o residual de shell em `src/pages/Agenda/**`: live query/normalizacao inicial (`useAgendaPageData`), resumos visuais (`helpers/pageSummaries`) e metadados de linha (`helpers/rowMeta`) sairam do entrypoint.
- TD-026 segue como residual aberto apenas para wiring/orquestracao local remanescente, sem mudanca funcional de dominio.

Atualizacao sanitaria 2026-04-27:
- Saneamento sanitario P0-P3 concluido: golden/parity tests, calendario TS->SQL, dedup canonico, sequenciamento Raiva D1/D2/anual, taxonomia passiva, separacao estrutural de `src/lib/sanitario/**` e boundary Registrar <-> sanitario.

Atualizacao sanitaria 2026-04-28:
- P5 removeu o ultimo import direto de `@/lib/sanitario/engine/*` em `src/pages/Registrar/**`; labels visuais de calendario passam por `src/lib/sanitario/models/calendarDisplay.ts`.
- Proximas frentes sanitarias devem ser pequenas e separadas: carencia/rastreabilidade leve, validacao operacional da ponte assistida com inventario ou automacao de estoque, sem misturar com SISBOV ou fiscal.

Atualizacao inventario/sanitario 2026-05-26:
- Ponte assistida concluida: evento sanitario catalogado pode abrir `/insumos` com fonte pre-selecionada; o consumo continua gesto separado e append-only.
- Relatorios medem pre-requisitos da Fase 3 de consumo automatico: produto sanitario catalogado, mapeamento produto -> exatamente um insumo sanitario ativo, lote ativo, apresentacao compativel e cobertura de consumo assistido real.
- Consumo automatico permanece fora de escopo ate haver evidencia operacional suficiente desses pre-requisitos.

Atualizacao Central Operacional 2026-05-07:
- Primeira integracao read-only concluida: `src/lib/insights/` como core puro, `src/features/operationalInsights/` como adapter/hook/painel e Home como primeira superficie passiva.
- O escopo atual e apenas leitura: cards de pendencias, rebanho por estagio, KPIs mensais e sinais operacionais auxiliares, com estados bloqueado/vazio/parcial/completo.
- Refino inicial de UX/copy concluido: atrasadas e vencendo hoje foram priorizadas, estados ganharam microcopy operacional e limitacoes ficaram compactas sem serem escondidas.
- A Central nao e motor de decisao e nao executa agenda, eventos, tags persistidas, carencia, venda/abate, peso atual confiavel ou IATF amplo.

Atualizacao Pastagens 2026-05-25:
- P0/P1/P2/P3/P4 de pastos foram consolidados como base incremental: movimentacao lote->pasto factual, ocupacoes materializadas, ficha agronomica, infraestrutura local sem curral ativo e avaliacao/ronda de pasto como evento historico.
- Métricas de ocupação (Fase 3 e 4) concluídas: camada de derivadores puros (`src/features/occupancy/`) calcula tempo de permanência, GMD e variação de ECC de forma retroativa.
- UI integrada em `LoteDetalhe` e `PastoDetalhe` com cards de métricas operacionais e tabela de histórico de movimentação detalhada.
- Fora de escopo preservado: dashboard de pastagem, recomendacao agronomica, motor de UA/lotacao ideal, agenda automatica e grafico.

Atualizacao visual SLC 2026-05-20:
- Segunda passagem de refatoracao visual aplicada em paginas centrais e auxiliares: Lotes, Pastos, Reproducao, Relatorios, Reconciliacao, Configuracoes, selecao de fazenda, onboarding/cadastros, importacoes e detalhes.
- O padrao operacional agora prioriza `PageIntro` simples, cards objetivos, badges subordinados, menos sombra, menos tracking visual e grids mais previsiveis.
- Selecao de fazenda passou a exibir metadados cadastrais existentes (municipio/UF, area, tipo de producao e manejo), sem alterar regra de negocio ou solicitar dado fiscal novo.

---

## Milestone 3: Observabilidade e Instrumentacao Remota

**Objetivo:** tornar visiveis os erros de sync e o comportamento do produto em campo.

**Derivado de:** TD-021

**Status:** Concluido em 2026-04-11

### Escopo

- Implementar flush remoto periodico de `metrics_events` por Edge Function, mantendo buffer local em Dexie
- Tornar a ingestao idempotente para suportar retries de rede
- Expor painel de sync health por fazenda a partir da tabela remota `metrics_events`

### Entregaveis

- [x] Definir estrategia de telemetria remota via Edge Function `telemetry-ingest`
- [x] Implementar upload periodico por fazenda com cursor local e retry simples
- [x] Tornar a ingestao remota idempotente via `upsert ... onConflict(id)`
- [x] Dashboard simples para visualizacao de health de sync

---

## Milestone 4: UX do Catalogo de Produtos Veterinarios

**Objetivo:** fechar a lacuna entre o catalogo de `produtos_veterinarios` criado no DB e a experiencia do usuario.

**Derivado de:** TD-022

**Status:** Concluido em 2026-04-09

### Escopo

- Integrar `produtos_veterinarios` como sugestao/autocomplete no formulario sanitario de `Registrar.tsx`
- Garantir que o catalogo e carregavel offline com cache local
- Propagar referencia estruturada do produto por protocolo, agenda e evento

### Entregaveis

- [x] Definir estrategia de acesso via catalogo global + cache Dexie offline
- [x] Implementar sugestao de produto em `Registrar.tsx`
- [x] Propagar metadata estruturada em `ProtocolosSanitarios.tsx`, `Agenda.tsx` e fluxos de evento
- [x] Validar fluxo offline-fallback sem depender de string livre

---

## Milestone 5: Cobertura E2E do Fluxo Reprodutivo Completo

**Objetivo:** garantir cobertura automatica do fluxo parto -> pos-parto -> cria.

**Derivado de:** TD-023

### Escopo

- Criar testes guiados para `AnimalPosParto.tsx` e `AnimalCriaInicial.tsx`
- Cobrir: registro de identificacao final, lote inicial, pesagem neonatal, gesto atomico

### Entregaveis

- [x] `src/pages/__tests__/AnimalPosParto.e2e.test.tsx` cobrindo a navegacao ate `AnimalCriaInicial`
- [x] Atualizar `package.json:test:e2e` com o fluxo guiado parto -> pos-parto -> cria

---

## Milestone 6: Agenda Operacional e Triagem Contextual

**Objetivo:** consolidar a agenda como cockpit de triagem, com leitura resumida no card e aprofundamento progressivo sob demanda.

**Derivado de:** evolucao funcional cross-cutting em `agenda.*`, `sanitario.*` e superficie operacional.

### Interligacoes

- Entrada de dados: `src/pages/Registrar/index.tsx`, `src/pages/ProtocolosSanitarios/index.tsx`, `src/components/sanitario/FarmProtocolManager.tsx`
- Semantica e agrupamento: `src/lib/agenda/groupSummaries.ts`, `src/lib/agenda/groupOrdering.ts`, `src/lib/agenda/grouping.ts`
- Prioridade sanitaria compartilhada: `src/lib/sanitario/engine/protocolRules.ts`, `src/lib/sanitario/compliance/attention.ts`
- Estado local e reconciliacao: `src/lib/offline/db.ts`, `src/lib/offline/pull.ts`, `src/lib/offline/ops.ts`
- Superficies consumidoras da mesma leitura operacional: `src/pages/Agenda/index.tsx`, `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Relatorios.tsx`

### Fases do Desenvolvimento

- [x] Badges de resumo por agrupamento (`animal` e `evento`)
- [x] Assinatura canonica para agrupamento por evento
- [x] Ordenacao dos grupos por urgencia real
- [x] Filtros rapidos clicando nos badges
- [x] Navegacao contextual com rolagem e destaque das linhas relevantes
- [x] Recolhimento dos grupos por padrao com contagem `visiveis/total`
- [x] Autoexpansao do grupo contextual no clique do badge
- [x] Comparacao local via `Ver grupo completo` sem perder o recorte global
- [x] Persistencia de agrupamento, filtros, expansao, reveal e foco contextual por usuario/fazenda
- [x] Testes de interacao da agenda cobrindo rehidratacao e badge -> foco -> expandir -> revelar
- [x] Indicador de proxima acao recomendada no cabecalho do grupo
- [x] Refinamento de densidade e navegacao mobile
- [x] Atalhos para navegar entre grupos atrasados no recorte atual

---

## Milestone 7: Reestruturacao dos Protocolos e Calendario Sanitario Base

**Objetivo:** tirar a definicao dos protocolos padrao da UI, consolidar uma biblioteca canonica e explicitar a semantica do calendario sanitario base no payload.

**Derivado de:** evolucao estrutural em `sanitario.*` para reduzir deriva entre tela, agenda e customizacao por fazenda.

**Status:** Concluido em 2026-04-12

### Interligacoes

- Biblioteca canonica: `src/lib/sanitario/catalog/baseProtocols.ts`
- Semantica do calendario base: `src/lib/sanitario/engine/calendar.ts`
- Propagacao para protocolos da fazenda: `src/pages/ProtocolosSanitarios/index.tsx`, `src/lib/sanitario/customization/customization.ts`
- Leitura operacional da agenda base: `src/pages/Registrar/index.tsx`, `src/components/sanitario/FarmProtocolManager.tsx`
- Superficies animal-centric: `src/pages/Animais.tsx`, `src/pages/AnimalDetalhe.tsx`
- Catalogo global de produtos: `src/lib/sanitario/catalog/products.ts`

### Fases do Desenvolvimento

- [x] Extrair `STANDARD_PROTOCOLS` da UI para uma biblioteca canonica em `src/lib/sanitario/catalog/baseProtocols.ts`
- [x] Introduzir `calendario_base` estruturado por protocolo e por etapa
- [x] Propagar `standard_id`, versao da biblioteca e metadados de calendario ao adicionar protocolos padrao na fazenda
- [x] Passar `Registrar` e editor de protocolos a descrever a agenda a partir do `payload.calendario_base`
- [x] Permitir customizacao explicita do `calendario_base` em etapas da fazenda, com modo, ancora, rotulo e meses da campanha
- [x] Cobrir round-trip do calendario base, invariantes da biblioteca padrao e preservacao do payload estruturado na customizacao
- [x] Conectar o calendario base a um motor declarativo de geracao de agenda por campanha/janela etaria
- [x] Expor `mode` e `anchor` do `calendario_base` como leitura operacional/filtro persistido na agenda e nas exportacoes de relatorio
- [x] Reaproveitar a mesma leitura declarativa em `Home` e `Dashboard`, com atalhos que abrem a agenda ja filtrada por `calendarMode`
- [x] Expor recortes por ancora operacional com `calendarAnchor` na agenda e atalhos analiticos no dashboard
- [x] Propagar a mesma semantica declarativa para superficies animal-centric, com `Animais` / `AnimalDetalhe` exibindo origem do proximo manejo e aceitando recortes por `calendarMode` / `calendarAnchor`

---

## Milestone 8: Catalogo Regulatorio Oficial e Overlay Estadual

**Objetivo:** separar conteudo regulatorio bruto da UI da fazenda, ativando um pack oficial versionado por nucleo federal + overlay estadual + risco local.

**Derivado de:** reestruturacao do sanitario para modelo animal-centric, com obrigacoes legais, recomendacoes tecnicas e boas praticas em camadas distintas.

**Status:** Concluído em 2026-04-12

### Interligacoes

- Conteudo global: `catalogo_protocolos_oficiais`, `catalogo_protocolos_oficiais_itens`, `catalogo_doencas_notificaveis`
- Configuracao tenant-scoped: `fazenda_sanidade_config`
- Cache offline e tipos: `src/lib/offline/db.ts`, `src/lib/offline/types.ts`
- Selecao e ativacao: `src/lib/sanitario/officialCatalog.ts`
- Materializacao operacional: `protocolos_sanitarios`, `protocolos_sanitarios_itens`, `agenda_itens`

### Fases do Desenvolvimento

- [x] Criar tabelas globais do catalogo oficial e tabela tenant-scoped de configuracao sanitaria
- [x] Seed inicial Brasil v1 + overlays de referencia para SP e GO
- [x] Cachear o catalogo oficial offline no Dexie
- [x] Implementar selecao por `modo_calendario`, overlay estadual e risco da fazenda
- [x] Parar de expor aftosa como calendario vacinal padrao na biblioteca UI atual
- [x] Integrar ativacao do pack oficial em superficie de produto para owner/manager
- [x] Criar o primeiro fluxo operacional do overlay para transito externo/GTA no `Registrar`
- [x] Criar fluxo operacional para suspeita/notificacao sanitaria com bloqueio local de movimentacao
- [x] Criar fluxo operacional para overlays de `feed-ban` e checklists de conformidade/boas praticas
- [x] Separar a UX da aba de protocolos em base regulatoria oficial, overlay operacional do pack e protocolos operacionais da fazenda
- [x] Conectar o runtime de conformidade a badges, restricoes e alertas operacionais na agenda
- [x] Evoluir a projeção de conformidade para bloqueios contextuais em `Registrar`, nutricao e fluxos auxiliares de movimentacao
- [x] Levar a mesma leitura regulatoria para superficies derivadas, incluindo `Home`, dashboards de pendencia, relatorios e fluxos transacionais especializados como `Financeiro`
- [x] Espalhar CTAs e sinais regulatorios secundarios para `Eventos` e `LoteDetalhe`, mantendo a mesma leitura compartilhada do overlay oficial
- [x] Expandir a leitura regulatoria compartilhada para recortes analiticos por subarea/impacto e CTAs que abrem o overlay oficial ja filtrado
- [x] Levar esses mesmos recortes analiticos para superficies adicionais, como listagens especializadas e exportacoes operacionais
- [x] Levar os mesmos recortes para listas animal-centric e exportacoes dedicadas por restricao operacional

---

## Milestone 9: Sanitary Regimen & Catch-up Compliance UX

**Objetivo:** Oferecer uma superfície clara para gerenciar animais sem histórico ("unknown base"), resolvendo dependências de milestones e regimes pendentes (catch-up) na UI.

**Derivado de:** Evolução do motor sanitário (Regime Sequencial e Histórico de Entrada).

**Status:** Em execução (TD-025 aberto) — UI em desenvolvimento em `src/components/sanitario/FarmProtocolManager.tsx`

### Escopo

- Alertar sobre amimais recém-adquiridos (ou de histórico desconhecido) que possuem pendências (`catch_up_required`).
- Implementar fluxo de marcação de isenção via "atestado de vacinação" ou outro controle de documentação (`documentation_required`).
- Atualizar a interface da *Ficha do Animal* com um módulo de Compliance mostrando em qual `sequence_order` ou `milestone_code` o animal travou e sugerindo a ação correspondente.

---

## Derivacao

| TD | capability_id | Track | Milestone |
| --- | --- | --- | --- |
| TD-021 | `infra.observabilidade` | Infra | Milestone 3 |
| TD-022 | `sanitario.registro` | Catalog | Milestone 4 |
| TD-023 | `reproducao.registro` | Tests | Milestone 5 |
| N/A | `agenda.triagem_contextual` | UX | Milestone 6 |
| N/A | `sanitario.calendario_base` | Domain | Milestone 7 |
| N/A | `sanitario.catalogo_regulatorio` | Domain | Milestone 8 |
| TD-025 | `sanitario.regime_sequencial` | UX | Milestone 9 |
| TD-026 | `agenda.shell_readmodel_residual` | Structural | Milestone 10 |
| TD-027 | `registrar.shell_composition_residual` | Structural | Milestone 10 |
| TD-028 (CLOSED) | `infra.quality_gate_smoke` | Reliability | Milestone 10 |
| TD-030 (CLOSED) | `infra.test_reliability_act_flaky` | Reliability | Milestone 10 |
| N/A | `sanitario.saneamento_p0_p3` | Domain/Architecture | Milestone 11 |
| N/A | `central_operacional.readonly` | UX/Read Model | Milestone 12 |
| N/A | `pastagem.avaliacao_evento` | Domain/Offline | Milestone 13 |

---

## Milestone 10: Consolidacao MVP -> SLC (Fase 1, 2 e 3 Concluídas)

**Objetivo:** consolidar previsibilidade de fluxo, reduzir friccao operacional e fechar residuos estruturais sem reabrir fronteiras de dominio.

**Status:** Fase 1 (Consolidação de fluxos de agenda/manejo), Fase 2 (ECC individual factual, GMD estrito e tempos de permanência) e Fase 3 (Fechamento do ciclo do ECC factual individual com registro avulso/lote e histórico visual) 100% concluídas. Todos os testes estão 100% verdes, build de produção e linter passando com sucesso.

### Frente A — Estrutural residual

- [ ] Reduzir residual de composicao/JSX no shell de `Registrar`
- [ ] Reduzir wiring/read-model residual do shell de `Agenda` apos cortes `useAgendaPageData`, `pageSummaries` e `rowMeta`
- [ ] Limpar wiring local remanescente de hotspots sem alterar semantica

### Frente B — UX/experiencia

- [ ] Uniformizar feedbacks de sucesso/erro/loading nos fluxos centrais
- [ ] Refinar empty/loading/error states para reduzir ambiguidade
- [x] Reduzir carga cognitiva de fluxo em campo — refatoracao visual SLC aplicada em Home, Registrar, Animais, Lotes, Pastos, Reproducao, Dashboard/Relatorios/Eventos/Financeiro/Reconciliacao, Configuracoes, selecao de fazenda e cadastros de apoio
- [ ] Validar o corte visual com dados reais de beta interno e ajustar excesso remanescente por tela

### Frente C — Produto operacional

- [ ] Alinhar continuidade de fluxo entre agenda -> registrar -> historico/protocolos
- [ ] Garantir completude percebida nas rotinas centrais do recorte-alvo
- [ ] Revisar friccoes recorrentes de uso em beta interno e fechar lacunas priorizadas
- [x] Revisar consistencia visual entre `Agenda`, `Registrar` e `ProtocolosSanitarios` no nivel de classes/superficies, sem reabrir comportamento

### Frente D — Confiabilidade

- [x] Estabilizar suites fora de recortes locais de hotspot (Animais, AnimalSpeciesForms, LoteDetalhe, PastosP2 - Fase 1 Concluída)
- [x] Definir smoke critico minimo por fluxo de producao
- [x] Definir suite de integracao de fluxo em `tests/integration/flows/**`
- [x] Manter suite `tests/smoke/**` com execucao rapida (<= 2 min)
- [x] Instituir gate minimo (`lint` + `test:hotspots` + `test:integration` + `test:smoke`)
- [x] Fortalecer cobertura de regressao para caminhos de maior risco operacional
- [x] Reduzir ruído de logs esperados em testes de cenarios negativos (sync/pull)
- [x] Eliminar filtros de console em testes e corrigir warnings `act(...)` na causa (async/state updates)
- [x] Reduzir warnings `act(...)` em E2E/RTL em pelo menos 70%
- [ ] Tratar warnings de chunks circulares (classificado como monitorar; nao bloqueante)

---

## Milestone 11: Saneamento Sanitario P0-P3

**Objetivo:** estabilizar o motor sanitario antes de novas features ou reestruturacoes maiores.

**Status:** Concluido em 2026-04-27

### Entregaveis

- [x] Golden/parity tests para casos criticos de agenda sanitaria.
- [x] Adapter de calendario TS -> SQL com leitura retrocompativel de valores legados.
- [x] Dedup canonico estruturado em TS e SQL.
- [x] Sequenciamento Raiva D1/D2/anual corrigido.
- [x] Taxonomia sanitaria passiva sem mudanca de comportamento.
- [x] Separacao fisica de `src/lib/sanitario/**` por responsabilidade.
- [x] Boundary Registrar <-> sanitario documentado e imports diretos criticos do engine removidos.

### Fora de escopo mantido

- Motor pleno de withholding/carencia.
- Automacao de estoque sanitario e rastreabilidade fina de produto/lote ainda dependem de validacao real da ponte assistida, mapeamento confiavel produto -> insumo/apresentacao/lote e cobertura de consumo assistido.
- SISBOV/fiscal.

---

## Milestone 12: Central Operacional Read-only

**Objetivo:** criar a primeira superficie passiva de composicao operacional sem transformar insights em acoes de dominio.

**Status:** Concluido em 2026-05-07

### Entregaveis

- [x] Consolidar `src/lib/insights/` como core puro/read-only.
- [x] Criar `src/features/operationalInsights/operationalInsightsAdapter.ts` para normalizar fontes ja carregadas.
- [x] Criar `src/features/operationalInsights/useOperationalInsights.ts` como hook memoizado.
- [x] Criar `src/features/operationalInsights/OperationalInsightsPanel.tsx` como painel somente leitura.
- [x] Conectar `src/pages/Home.tsx` como primeira superficie da Central Operacional passiva.
- [x] Expor cards de pendencias abertas, vencem hoje, atrasadas, pendencias sanitarias, rebanho por estagio, KPIs mensais e sinais operacionais auxiliares.
- [x] Expor estados `Bloqueado`, `Vazio`, `Parcial` e `Completo`, mantendo limitacoes visiveis.
- [x] Refinar hierarquia visual, densidade, copy de estados e priorizacao de atrasadas/vencendo hoje sem adicionar acoes.
- [x] Cobrir no teste do painel a ordem de urgencia, os estados e a ausencia de links/botoes/elementos acionaveis.

### Fora de escopo mantido

- Concluir agenda.
- Gerar agenda.
- Criar evento.
- Persistir tag/marcador.
- Calcular carencia operacional.
- Calcular pronto para venda/abate.
- Calcular peso atual confiavel.
- Calcular IATF amplo.
- Tratar agenda como fato historico.
- Tratar protocolo como execucao.

### Proximas frentes recomendadas

- Ampliar testes de contrato do adapter para novos read models antes de adicionar outra superficie.
- Avaliar uma pagina dedicada da Central somente se a Home ficar densa demais, mantendo a UI read-only.
- Reavaliar densidade visual com dados reais de beta interno, sem adicionar CTAs operacionais.

---

## Milestone 13: Pastagens — Historico e Ronda de Campo

**Objetivo:** consolidar o manejo de pastagens sem misturar cadastro estatico, estado materializado e fatos historicos.

**Status:** Concluido em 2026-05-08

### Entregaveis

- [x] Registrar movimentacao lote -> pasto como evento factual com origem/destino de pasto.
- [x] Materializar `pasto_ocupacoes` como read model operacional de ocupacao atual.
- [x] Evoluir cadastro de pastos com ficha tecnica agronomica e importacao CSV compativel.
- [x] Remover curral/brete/balanca da infraestrutura ativa do pasto, mantendo tolerancia passiva a legado.
- [x] Criar `dominio='pastagem'` e detalhe `eventos_pasto_avaliacao` para ronda/avaliacao.
- [x] Adicionar store Dexie, TABLE_MAP, builder, validator e testes focados.
- [x] Expor registro minimo e ultima avaliacao em `PastoDetalhe`.

### Fora de escopo mantido

- Dashboard de pastagem.
- Graficos de descanso/pressao de pastejo.
- Recomendacao automatica de manejo.
- Calculo automatico de UA ou lotacao ideal.
- Agenda automatica ou alertas automaticos.
- Motor agronomico.

---

## Milestone 14: Cockpits de Manejo de Lotes e Pastos (Fase 5)

**Objetivo:** Evoluir as páginas de detalhes de Lote e Pasto em cockpits operacionais analíticos passivos.

**Status:** Concluido em 2026-05-28

### Entregaveis

- [x] Adaptador de métricas puro (`cockpitManejoAdapter.ts`) que calcula de forma determinística cobertura de dados, recência de pesagem (`weightFreshnessDays`), GMD factual, lotação e pendências.
- [x] Componente de timeline factual unificada visual (`TimelineFactual.tsx`) cronológica decrescente.
- [x] Refatoração incremental de `LoteDetalhe.tsx` integrando grid de cartões e linha do tempo.
- [x] Refatoração incremental de `PastoDetalhe.tsx` agregando lotes vinculados, uso e pendências do pasto.
- [x] CTAs de painel estritamente de navegação, mantendo os cards read-only.
- [x] Cobertura de testes unitários verdes para o adaptador e mocks estruturados nos testes de página.

### Fora de escopo mantido

- Carência sanitária.
- Decisões comerciais/críticas de venda ou abate.
- Estoque de produtos veterinários.
- Marcador crítico persistido.
- Migrações de banco de dados.

---

## Milestone 15: Produtos + Estoque Sanitário + Snapshot de Produto em Eventos (Fase 6 & 6.1)

**Objetivo:** Catálogo e controle de lote/estoque de vacinas, vermífugos, medicamentos e suplementos, e snapshot de consumo do produto diretamente nos fatos operacionais reais com sync-hardening.

**Status:** Concluido em 2026-05-29

### Entregaveis

- [x] Modelagem e stores de estoque tenant-scoped (`insumos`, `insumo_apresentacoes`, `insumo_lotes`, `insumo_movimentacoes`).
- [x] Snapshot imutável de insumo em eventos de consumo sanitário e nutricional.
- [x] Hardening de sync-batch com paridade Dexie e isolamento por fazenda_id.

---

## Milestone 16: Read Model de Carência Sanitária e Paridade (Fase 7 & 7.1)

**Objetivo:** Cálculo assistivo seguro e visual de carência de descarte para abate/carne e leite a partir de eventos factuais e snapshots estruturados.

**Status:** Concluido em 2026-05-29

### Entregaveis

- [x] Engine de cálculo de carência sem I/O ou `Date.now()` no fuso `'America/Sao_Paulo'`.
- [x] Hooks reativos Dexie offline a nível de animal, lote e pasto.
- [x] Badges visuais HSL regulatórios integrados nas fichas de Animal, Lote e Pasto.
- [x] Suite de testes de paridade matemática e data nominal absoluta com a view SQL `vw_animais_carencia_ativa`.

---

## Milestone 17: Ledger Gerencial Administrativo e Lançamentos Financeiros (Fase 8)

**Objetivo:** Modelagem física e lógica da fundação de finanças gerenciais, separando previstos/realizados/cancelados e agrupando análises por categoria, contraparte e centro de custo.

**Status:** Concluido em 2026-05-29

### Entregaveis

- [x] Modelagem de banco de dados tenant-scoped com RLS aditivo (`finance_categories`, `finance_transactions`).
- [x] Trigger de auto-seeding de categorias financeiras para novas fazendas e migration idempotente.
- [x] Camada lógica de validação estrutural rígida em TypeScript (`gerencial.ts`).
- [x] Calculadores puros de fluxo de caixa e acumulados/agrupadores analíticos para o cockpit.
- [x] Suite de testes focados de unidade cobrindo todos os invariantes financeiros gerenciais.

---

## Milestone 18: Sociedade Pecuária e Negócios Patrimoniais (Patch Fase 9)

**Objetivo:** Integrar fluxo comercial patrimonial de forma limpa, consolidando as intenções de compra, venda e sociedade em `Registrar -> Negócios Patrimoniais`. Garantir encerramento automático do inventário de sociedades ativas em eventos de venda subsequentes, usando um modelo de dados determinístico sem ambiguidade.

**Status:** Concluido em 2026-05-29

### Entregaveis

- [x] UI de `Registrar -> Negócios Patrimoniais` consolidando Compra, Venda e Sociedade.
- [x] Tabela canônica de relacionamento `sociedade_animais`.
- [x] Badge discreto em detalhes do animal indicando participação societária ativa.
- [x] Finalizador do Registrar (`comercial`/`nonFinancialFinalize`) configurado para buscar e encerrar vínculo ativo caso ocorra a venda do animal englobado.
- [x] Rastreabilidade transacional rigorosa garantida injetando o `clientOpId` no snapshot histórico `motivo_saida`.
- [x] Testes E2E e unitários de idempotência do fechamento.

---

## Historico de Milestones Concluidos

| Milestone | Escopo | Status |
| --- | --- | --- |
| M0 | DLQ auto-purge (TD-001) | Concluido |
| M1 | RBAC hardening (TD-003), FKs (TD-019, TD-020), catalogo (TD-011), peso (TD-014) | Concluido |
| M2 | Indices (TD-004), GMD view (TD-015) | Concluido |
| M3 | Observabilidade remota com flush de `metrics_events` e painel de sync health | Concluido |
| M4 | Integracao do catalogo `produtos_veterinarios` ao fluxo sanitario | Concluido |
| M5 | Cobertura E2E do fluxo reprodutivo completo | Concluido |
| M6 | Agenda operacional e triagem contextual | Concluido |
| M7 | Reestruturacao de protocolos e calendario base | Concluido |
| M8 | Catalogo regulatorio oficial e overlay estadual | Concluido |
| M11 | Saneamento sanitario P0-P3 | Concluido |
| M12 | Central operacional read-only | Concluido |
| M13 | Pastagens — Historico e Ronda de campo | Concluido |
| M14 | Cockpits de Lotes e Pastos (Fase 5) | Concluido |
| M15 | Insumos, estoque, snapshot e sync hardening (Fase 6 & 6.1) | Concluido |
| M16 | Carência sanitária, paridade TSxSQL e visual badges (Fase 7 & 7.1) | Concluido |
| M17 | Ledger Gerencial e Lançamentos Financeiros (Fase 8) | Concluido |
| M18 | Sociedade Pecuária e Negócios Patrimoniais (Patch Fase 9) | Concluido |

---

## Veja Tambem

- [TECH_DEBT.md](./TECH_DEBT.md)
- [REFERENCE.md](./REFERENCE.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
