# Roadmap do Produto

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-19
> **Derivado por:** Auditoria tecnica - estado pos-fechamento dos TDs originais e evolucao funcional de UX operacional
> **Fonte:** `TECH_DEBT.md`, `IMPLEMENTATION_STATUS.md`

---

## Contexto

Todos os milestones do roadmap anterior (M0, M1, M2) foram concluidos via migrations de marco/2026. O capability score analitico permanece em 19/19 = 100%. O projeto segue em fase de **beta interno**.

O roadmap atual cobre a consolidacao de observabilidade, cobertura E2E dos fluxos mais recentes, refinamentos de UX operacional da agenda e a reestruturacao da biblioteca sanitaria base.
Com o hardening estrutural principal de `Registrar` e `Agenda` concluido, o repositorio entra em fase de consolidacao MVP -> SLC.

Atualizacao estrutural 2026-04-18 (sem mudanca funcional):
- `src/pages/Registrar/**`, `src/pages/Agenda/**` e `src/pages/ProtocolosSanitarios/**` operam com entrypoints folderizados (`index.tsx`) e contexto local (`README.md`/`AGENTS.md`).
- Dispatch local de paginas consolidado em `src/pages/AGENTS.md`.

Atualizacao estrutural 2026-04-19 (sem mudanca funcional de dominio):
- Hardening final do hotspot `src/pages/Registrar/**` concluido em camadas locais de shell/composicao (`useRegistrarShellState`, `useRegistrarActionSectionState`, `buildRegistrarActionSectionSlots`), com reducao do entrypoint para ~916 linhas.
- Hardening final do hotspot `src/pages/Agenda/**` concluido em camadas locais de controller/shell/interacao/composicao macro, com reducao do entrypoint para ~591 linhas.
- O foco de hardening de hotspot de pagina deixa de ser quebra inicial de monolitos e passa a consolidacao residual + acabamento de experiencia para SLC.

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


**Objetivo:** garantir cobertura automatica do fluxo parto -> pos-parto -> cria.
## Milestone 5: Cobertura E2E do Fluxo Reprodutivo Completo

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
- Prioridade sanitaria compartilhada: `src/lib/sanitario/protocolRules.ts`, `src/lib/sanitario/attention.ts`
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

- Biblioteca canonica: `src/lib/sanitario/baseProtocols.ts`
- Semantica do calendario base: `src/lib/sanitario/calendar.ts`
- Propagacao para protocolos da fazenda: `src/pages/ProtocolosSanitarios/index.tsx`, `src/lib/sanitario/customization.ts`
- Leitura operacional da agenda base: `src/pages/Registrar/index.tsx`, `src/components/sanitario/FarmProtocolManager.tsx`
- Superficies animal-centric: `src/pages/Animais.tsx`, `src/pages/AnimalDetalhe.tsx`
- Catalogo global de produtos: `src/lib/sanitario/products.ts`

### Fases do Desenvolvimento

- [x] Extrair `STANDARD_PROTOCOLS` da UI para uma biblioteca canonica em `src/lib/sanitario/baseProtocols.ts`
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

---

## Milestone 10: Consolidacao MVP -> SLC (em execucao)

**Objetivo:** consolidar previsibilidade de fluxo, reduzir friccao operacional e fechar residuos estruturais sem reabrir fronteiras de dominio.

**Status:** Em execucao

### Frente A — Estrutural residual

- [ ] Reduzir residual de composicao/JSX no shell de `Registrar`
- [ ] Extrair leitura/preparacao de dados residual do shell de `Agenda`
- [ ] Limpar wiring local remanescente de hotspots sem alterar semantica

### Frente B — UX/experiencia

- [ ] Uniformizar feedbacks de sucesso/erro/loading nos fluxos centrais
- [ ] Refinar empty/loading/error states para reduzir ambiguidade
- [ ] Revisar consistencia visual entre `Agenda`, `Registrar` e `ProtocolosSanitarios`
- [ ] Reduzir carga cognitiva de fluxo em campo (menos passos ambiguos)

### Frente C — Produto operacional

- [ ] Alinhar continuidade de fluxo entre agenda -> registrar -> historico/protocolos
- [ ] Garantir completude percebida nas rotinas centrais do recorte-alvo
- [ ] Revisar friccoes recorrentes de uso em beta interno e fechar lacunas priorizadas

### Frente D — Confiabilidade

- [ ] Estabilizar suites fora de recortes locais de hotspot
- [ ] Definir smoke critico minimo por fluxo de producao
- [ ] Fortalecer cobertura de regressao para caminhos de maior risco operacional

---

## Historico de Milestones Concluidos

| Milestone | Escopo | Status |
| --- | --- | --- |
| M0 | DLQ auto-purge (TD-001) | Concluido |
| M1 | RBAC hardening (TD-003), FKs (TD-019, TD-020), catalogo (TD-011), peso (TD-014) | Concluido |
| M2 | Indices (TD-004), GMD view (TD-015) | Concluido |
| M3 | Observabilidade remota com flush de `metrics_events` e painel de sync health | Concluido |
| M4 | Integracao do catalogo `produtos_veterinarios` ao fluxo sanitario | Concluido |

---

## Veja Tambem

- [TECH_DEBT.md](./TECH_DEBT.md)
- [REFERENCE.md](./REFERENCE.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
