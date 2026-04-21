# Divida Tecnica

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-19
> **Derivado por:** Auditoria tecnica - codigo + migrations como fonte de verdade
> **Fonte:** `IMPLEMENTATION_STATUS.md`, `src/`, `supabase/`

---

## OPEN (Residual Pos-MVP)

> Itens identificados na auditoria de abril/2026 como proximos passos relevantes.

### TD-026: Residual estrutural de shell em `Agenda`

- **Status:** OPEN
- **Origem:** Hardening estrutural principal de `src/pages/Agenda/**` concluido
- **Impacto:** apesar da extracao de controller/shell state/interaction state e blocos macro de composicao, o shell ainda concentra leitura/preparacao de dados acima do ideal para a fase de consolidacao SLC.

### TD-027: Residual de composicao no shell de `Registrar`

- **Status:** OPEN
- **Origem:** Hardening estrutural principal de `src/pages/Registrar/**` concluido
- **Impacto:** o hotspot deixou de concentrar orquestracao densa, mas ainda possui volume alto de composicao/JSX no entrypoint, mantendo custo de manutencao.

### TD-025: Superficie de produto para Catch-Up e History Confidence

- **Status:** OPEN
- **Origem:** Feat `sanitario_regime_sequencial_e_historico_entrada`
- **Impacto:** O backend agora calcula bloqueios ou agenda pendente para animais com `history_confidence = unknown` e `compliance_state = catch_up_required`, exigindo uma documentação (ex: atestado de vacinação na compra) ou execução de um catch-up (protocolo de entrada). A UI atual carece de uma tela específica ou card contextual no AnimalDetalhe que permita resolver este status fechando o ciclo do regime.

### TD-029: Warnings de chunks circulares no build

- **Status:** OPEN
- **Origem:** `vite build` com `manualChunks` atual
- **Impacto:** warning recorrente (`vendor <-> react-vendor <-> ui-vendor/charts-vendor`) adiciona ruído técnico e reduz previsibilidade de empacotamento.
- **Classificacao:** monitorar (nao bloqueante para gate atual); adiar refino de chunk strategy para ciclo de performance dedicado.

## CLOSED (Historico Completo)

### Hardening estrutural do hotspot `Registrar` (entrypoint shell)

- **Status:** CLOSED
- **Fechado por:** `src/pages/Registrar/index.tsx`, `src/pages/Registrar/useRegistrarShellState.ts`, `src/pages/Registrar/useRegistrarActionSectionState.tsx`, `src/pages/Registrar/buildRegistrarActionSectionSlots.tsx`
- **Detalhe:** o shell deixou de concentrar decisoes operacionais densas e volume de estado bruto; wiring local de selecao/toggles/derives simples foi extraido para hook local explicito, mantendo fronteiras de dominio e sync intactas.

### Hardening estrutural do hotspot `Agenda` (entrypoint shell)

- **Status:** CLOSED
- **Fechado por:** `src/pages/Agenda/index.tsx`, `src/pages/Agenda/createAgendaActionController.ts`, `src/pages/Agenda/useAgendaShellState.ts`, `src/pages/Agenda/useAgendaInteractionState.ts`, `src/pages/Agenda/components/*`
- **Detalhe:** controller de acoes, estado de shell, estado de interacao e composicao macro de resumo/compliance/lifecycle sairam do shell; `AgendaGroupedContent` foi fatiado e o entrypoint ficou majoritariamente em papel de composicao/wiring.

### TD-021: Telemetria local-only sem observabilidade remota

- **Status:** CLOSED
- **Fechado por:** `src/lib/telemetry/pilotMetrics.ts`, `supabase/functions/telemetry-ingest/index.ts`, `src/components/settings/SyncHealthPanel.tsx`
- **Detalhe:** `metrics_events` continua como buffer local append-only em Dexie, mas agora faz flush remoto periodico por fazenda, com cursor local de envio e ingestao idempotente por `id`

### TD-001: Limpeza de `queue_rejections`

- **Status:** CLOSED
- **Fechado por:** `src/lib/offline/rejections.ts` + auto-purge no `syncWorker.ts` (TTL 7d)

### TD-003: DELETE de animais sem restricao por role

- **Status:** CLOSED
- **Fechado por:** `supabase/migrations/20260308230748_rbac_delete_hardening_animais.sql`
- **Detalhe:** cria `animais_delete_by_role` restringindo DELETE a `owner/manager` via `role_in_fazenda()`

### TD-004: Indices compostos de performance

- **Status:** CLOSED
- **Fechado por:** `supabase/migrations/20260308230811_indexes_performance_gmd.sql`
- **Detalhe:** indices em `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)` e `(evento_id, peso_kg)`

### TD-006: UI de nutricao

- **Status:** CLOSED
- **Fechado por:** `src/pages/Registrar/index.tsx` - formulario inline nutricao

### TD-008: Anti-teleporte no frontend

- **Status:** CLOSED
- **Fechado por:** `src/pages/Registrar/index.tsx` - useEffect reseta `toLoteId` ao colidir com origem

### TD-011: Produtos sanitarios em texto livre

- **Status:** CLOSED (catalogo DB criado)
- **Fechado por:** `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql`

### TD-014: Validacao de peso no frontend

- **Status:** CLOSED
- **Fechado por:** `src/pages/Registrar/index.tsx` - validacao peso > 0

### TD-015: GMD e historico agregados no cliente

- **Status:** CLOSED
- **Fechado por:** `supabase/migrations/20260308230811_indexes_performance_gmd.sql:vw_animal_gmd`
- **Detalhe:** view otimizada com join pesagens + calculo GMD server-side

### TD-019: Foreign keys faltantes em movimentacao

- **Status:** CLOSED
- **Fechado por:** `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql`
- **Detalhe:** FKs `from_lote_id -> lotes(id)` e `to_lote_id -> lotes(id)` com limpeza de orfaos

### TD-020: Foreign key faltante para `macho_id` na reproducao

- **Status:** CLOSED
- **Fechado por:** `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql`
- **Detalhe:** FK `macho_id -> animais(id)` com limpeza de orfaos

### TD-022: `produtos_veterinarios` integrado ao fluxo sanitario

- **Status:** CLOSED
- **Fechado por:** `src/lib/sanitario/products.ts`, `src/pages/Registrar/index.tsx`, `src/pages/ProtocolosSanitarios/index.tsx`, `src/pages/Agenda/index.tsx`, `src/lib/offline/db.ts`
- **Detalhe:** o catalogo agora fica em cache local, gera sugestoes no `Registrar` e propaga referencia estruturada para protocolos e eventos sanitarios

### TD-023: Pos-parto e Cria Inicial sem cobertura E2E no pacote `test:e2e`

- **Status:** CLOSED
- **Fechado por:** `src/pages/__tests__/AnimalPosParto.e2e.test.tsx`, `package.json`
- **Detalhe:** o pacote `test:e2e` agora cobre o fluxo guiado parto -> pos-parto -> cria inicial com `fake-indexeddb`, gestos reais e navegacao entre rotas

### TD-024: Overlay regulatorio oficial virou malha operacional compartilhada

- **Status:** CLOSED
- **Fechado por:** `src/lib/sanitario/regulatoryReadModel.ts`, `src/pages/Registrar/index.tsx`, `src/pages/Agenda/index.tsx`, `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Financeiro.tsx`, `src/pages/Eventos.tsx`, `src/pages/LoteDetalhe.tsx`, `src/components/sanitario/RegulatoryOverlayManager.tsx`
- **Detalhe:** o overlay oficial agora cobre runtime guiado, bloqueios contextuais, leitura compartilhada nas principais superficies e recortes analiticos com CTA direto para o overlay filtrado

### TD-028: Gate minimo de qualidade e smoke critico

- **Status:** CLOSED
- **Fechado por:** `tests/smoke/**`, `package.json` (`test:hotspots`, `test:smoke`, `quality:gate`), `docs/PROCESS.md`
- **Detalhe:** suite de smoke critico minima definida e automatizada com gate padrao de qualidade para evolucao de fluxo.

### TD-030: Warnings `act(...)` e instabilidade E2E fora do gate minimo

- **Status:** CLOSED
- **Fechado por:** `src/pages/__tests__/AnimalPosParto.e2e.test.tsx`, `src/pages/Agenda/__tests__/Agenda.test.tsx`, `src/lib/offline/__tests__/pull.test.ts`, `tests/integration/flows/sync_rollback_retry.flow.test.ts`
- **Detalhe:** warnings `act(...)` foram tratados na causa (sincronizacao de updates async), sem mascaramento por `console.spy/filter`; baseline local da rodada com `ACT_WARN_COUNT=0` nos fluxos criticos e `pnpm test` verde.

---

## Resumo

- OPEN: `TD-025`, `TD-026`, `TD-027`, `TD-029`
- CLOSED: `TD-001`, `TD-003`, `TD-004`, `TD-006`, `TD-008`, `TD-011`, `TD-014`, `TD-015`, `TD-019`, `TD-020`, `TD-021`, `TD-022`, `TD-023`, `TD-024`, `TD-028`, `TD-030`
- Total OPEN: `4`

## Veja Tambem

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [ROADMAP.md](./ROADMAP.md)
