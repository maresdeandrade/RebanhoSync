# Divida Tecnica

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-11
> **Derivado por:** Auditoria tecnica - codigo + migrations como fonte de verdade
> **Fonte:** `IMPLEMENTATION_STATUS.md`, `src/`, `supabase/`

---

## OPEN (Residual Pos-MVP)

> Itens identificados na auditoria de abril/2026 como proximos passos relevantes.

Nenhum item OPEN nesta revisao.

## CLOSED (Historico Completo)

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
- **Fechado por:** `src/pages/Registrar.tsx` - formulario inline nutricao

### TD-008: Anti-teleporte no frontend

- **Status:** CLOSED
- **Fechado por:** `src/pages/Registrar.tsx:387-396` - useEffect reseta `toLoteId` ao colidir com origem

### TD-011: Produtos sanitarios em texto livre

- **Status:** CLOSED (catalogo DB criado)
- **Fechado por:** `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql`

### TD-014: Validacao de peso no frontend

- **Status:** CLOSED
- **Fechado por:** `src/pages/Registrar.tsx` - validacao peso > 0

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
- **Fechado por:** `src/lib/sanitario/products.ts`, `src/pages/Registrar.tsx`, `src/pages/ProtocolosSanitarios.tsx`, `src/pages/Agenda.tsx`, `src/lib/offline/db.ts`
- **Detalhe:** o catalogo agora fica em cache local, gera sugestoes no `Registrar` e propaga referencia estruturada para protocolos e eventos sanitarios

### TD-023: Pos-parto e Cria Inicial sem cobertura E2E no pacote `test:e2e`

- **Status:** CLOSED
- **Fechado por:** `src/pages/__tests__/AnimalPosParto.e2e.test.tsx`, `package.json`
- **Detalhe:** o pacote `test:e2e` agora cobre o fluxo guiado parto -> pos-parto -> cria inicial com `fake-indexeddb`, gestos reais e navegacao entre rotas

### TD-024: Overlay regulatorio oficial virou malha operacional compartilhada

- **Status:** CLOSED
- **Fechado por:** `src/lib/sanitario/regulatoryReadModel.ts`, `src/pages/Registrar.tsx`, `src/pages/Agenda.tsx`, `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Financeiro.tsx`, `src/pages/Eventos.tsx`, `src/pages/LoteDetalhe.tsx`, `src/components/sanitario/RegulatoryOverlayManager.tsx`
- **Detalhe:** o overlay oficial agora cobre runtime guiado, bloqueios contextuais, leitura compartilhada nas principais superficies e recortes analiticos com CTA direto para o overlay filtrado

---

## Resumo

- OPEN: nenhum
- CLOSED: `TD-001`, `TD-003`, `TD-004`, `TD-006`, `TD-008`, `TD-011`, `TD-014`, `TD-015`, `TD-019`, `TD-020`, `TD-021`, `TD-022`, `TD-023`, `TD-024`
- Total OPEN: `0`

## Veja Tambem

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [ROADMAP.md](./ROADMAP.md)
