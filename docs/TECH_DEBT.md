# Divida Tecnica

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-07
> **Derivado por:** Auditoria técnica — código + migrations como fonte de verdade
> **Fonte:** `IMPLEMENTATION_STATUS.md`, `src/`, `supabase/`

---

## OPEN (Residual Pós-MVP)

> Itens identificados na auditoria de abril/2026 como próximos passos relevantes.

### TD-021: Telemetria local-only sem observabilidade remota

- **capability_id:** `infra.observabilidade`
- **Domínio:** platform
- **Risco:** invisibilidade de erros de sync em produção
- **Status:** OPEN
- **Evidência:** `src/lib/offline/syncWorker.ts` coleta métricas em `metrics_events` (Dexie v8) mas não há Edge Function de upload nem integração com Supabase Analytics
- **Ação sugerida:** avaliar Edge Function de coleta de métricas ou integração nativa

### TD-022: `produtos_veterinarios` sem integração UI confirmada

- **capability_id:** `sanitario.registro`
- **Domínio:** sanitario
- **Risco:** consistência de dados (catálogo criado mas não consumido pela UI)
- **Status:** OPEN (pendente verificação)
- **Evidência:** migration `20260308230824` criou tabela e seed; `src/pages/Registrar.tsx` ainda não confirmado com autocomplete integrado
- **Ação sugerida:** integrar `produtos_veterinarios` como fonte de autocomplete no formulário sanitário de `Registrar.tsx`

### TD-023: Pós-parto e Cria Inicial sem cobertura E2E no pacote `test:e2e`

- **capability_id:** `reproducao.registro`
- **Domínio:** reproducao
- **Risco:** regressão sem detecção automática
- **Status:** OPEN
- **Evidência:** `src/pages/AnimalPosParto.tsx` e `src/pages/AnimalCriaInicial.tsx` existem mas não aparecem nos testes em `package.json:test:e2e`
- **Ação sugerida:** criar testes guiados para fluxo parto → pós-parto → cria

---

## CLOSED (Histórico Completo)

### TD-001: Limpeza de `queue_rejections`

- **Status:** ✅ CLOSED
- **Fechado por:** `src/lib/offline/rejections.ts` + auto-purge no `syncWorker.ts` (TTL 7d)

### TD-003: DELETE de animais sem restrição por role

- **Status:** ✅ CLOSED
- **Fechado por:** `supabase/migrations/20260308230748_rbac_delete_hardening_animais.sql`
- **Detalhe:** cria `animais_delete_by_role` restringindo DELETE a `owner/manager` via `role_in_fazenda()`

### TD-004: Índices compostos de performance

- **Status:** ✅ CLOSED
- **Fechado por:** `supabase/migrations/20260308230811_indexes_performance_gmd.sql`
- **Detalhe:** índices em `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)` e `(evento_id, peso_kg)`

### TD-006: UI de nutrição

- **Status:** ✅ CLOSED
- **Fechado por:** `src/pages/Registrar.tsx` — formulário inline nutrição

### TD-008: Anti-teleporte no frontend

- **Status:** ✅ CLOSED
- **Fechado por:** `src/pages/Registrar.tsx:387-396` — useEffect reseta `toLoteId` ao colidir com origem

### TD-011: Produtos sanitários em texto livre

- **Status:** ✅ CLOSED (catálogo DB criado)
- **Fechado por:** `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql`
- **Nota:** integração UI pendente como TD-022

### TD-014: Validação de peso no frontend

- **Status:** ✅ CLOSED
- **Fechado por:** `src/pages/Registrar.tsx` — validação peso > 0

### TD-015: GMD e histórico agregados no cliente

- **Status:** ✅ CLOSED
- **Fechado por:** `supabase/migrations/20260308230811_indexes_performance_gmd.sql:vw_animal_gmd`
- **Detalhe:** view otimizada com join pesagens + cálculo GMD server-side

### TD-019: Foreign keys faltantes em movimentação

- **Status:** ✅ CLOSED
- **Fechado por:** `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql`
- **Detalhe:** FKs `from_lote_id → lotes(id)` e `to_lote_id → lotes(id)` com limpeza de órfãos

### TD-020: Foreign key faltante para `macho_id` na reprodução

- **Status:** ✅ CLOSED
- **Fechado por:** `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql`
- **Detalhe:** FK `macho_id → animais(id)` com limpeza de órfãos

---

## Resumo

- OPEN: `TD-021`, `TD-022`, `TD-023`
- CLOSED: `TD-001`, `TD-003`, `TD-004`, `TD-006`, `TD-008`, `TD-011`, `TD-014`, `TD-015`, `TD-019`, `TD-020`
- Total OPEN: `3`

## Veja Também

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [ROADMAP.md](./ROADMAP.md)
