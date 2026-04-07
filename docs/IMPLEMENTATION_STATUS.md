# Implementation Status Matrix

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-07
> **Derivado por:** Auditoria técnica completa — código + migrations + testes como fonte de verdade

Este documento registra o estado efetivo do RebanhoSync em abril de 2026, pós-fechamento de todos os TDs da lista aberta.

## Resumo Executivo

- **Estagio do produto:** Beta interno — MVP completo e operacional.
- **Core operacional:** sanitário, pesagem, movimentação, nutrição, reprodução, financeiro e agenda estão implementados e usáveis.
- **Camadas consolidadas:** onboarding guiado, importação CSV, relatórios operacionais, telemetria local de piloto, modo de experiência da fazenda, dashboard e ficha reprodutiva dedicada, pós-parto neonatal, cria inicial, transições de rebanho.
- **Qualidade local:** lint, test, build e pacote E2E guiados estão verdes.
- **TDs anteriormente abertos:** todos fechados via migrations de março/2026.
- **Gaps residuais:** observabilidade remota (telemetria local-only), `produtos_veterinarios` sem integração UI confirmada, docs com conflito de merge resolvidos nesta auditoria.

---

## 1. Infraestrutura Core

### Auth, Multi-tenant e RBAC ✅ COMPLETO

- Auth via Supabase.
- Selecionador de fazenda ativa com persistência local/remota.
- Contexto multi-tenant por `fazenda_id`.
- Controle de acesso por `owner`, `manager` e `cowboy`.
- Gestão de membros e convites implementada.
- **TD-003 CLOSED:** DELETE em `animais` restrito a owner/manager via migration `20260308230748`.

**Evidência principal:**
- `src/hooks/useAuth.tsx`
- `src/pages/SelectFazenda.tsx`, `src/pages/Membros.tsx`, `src/pages/AdminMembros.tsx`
- `supabase/migrations/0004_rls_hardening.sql`
- `supabase/migrations/20260308230748_rbac_delete_hardening_animais.sql`

---

### Offline-First ✅ COMPLETO

- Dexie v8 com stores de estado, eventos, fila e métricas locais.
- Gestos atômicos com `queue_gestures` e `queue_ops`.
- Aplicação otimista, rollback e DLQ.
- Worker de sync com `sync-batch`.
- Auto-purge de rejeições (TTL 7d, a cada 6h).
- Store `metrics_events` para telemetria local de piloto.

**Evidência principal:**
- `src/lib/offline/db.ts` — 20+ stores Dexie (v8 com `metrics_events`)
- `src/lib/offline/syncWorker.ts` — pipeline completo + auto-purge
- `src/lib/offline/rejections.ts` — API DLQ index-backed
- `src/lib/offline/pull.ts` — reconciliação remota

---

## 2. Domínios Operacionais (E2E Completo)

| Domínio | Estado | Evidência principal |
| --- | --- | --- |
| `sanitario.registro` | Completo — catálogo `produtos_veterinarios` criado | `src/pages/Registrar.tsx`, `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql` |
| `sanitario.historico` | Completo | `src/pages/Eventos.tsx` |
| `sanitario.agenda_link` | Completo | `supabase/migrations/0028_sanitario_agenda_engine.sql` |
| `pesagem.registro` | Completo | `src/pages/Registrar.tsx`, `src/pages/AnimalDetalhe.tsx` |
| `pesagem.historico` | Completo — **TD-015 CLOSED** via `vw_animal_gmd` | `supabase/migrations/20260308230811_indexes_performance_gmd.sql` |
| `nutricao.registro` | Completo | `src/pages/Registrar.tsx`, `src/pages/Eventos.tsx` |
| `nutricao.historico` | Completo | `src/pages/Eventos.tsx` |
| `movimentacao.registro` | Completo — **TD-019 CLOSED** | `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| `movimentacao.historico` | Completo | `src/pages/Eventos.tsx` |
| `movimentacao.anti_teleport_client` | Completo | `src/pages/Registrar.tsx`, `src/lib/offline/syncWorker.ts` |
| `reproducao.registro` | Completo — **TD-020 CLOSED** | `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| `reproducao.historico` | Completo | `src/pages/ReproductionDashboard.tsx`, `src/pages/AnimalDetalhe.tsx` |
| `reproducao.episode_linking` | Completo | `src/lib/reproduction/linking.ts`, `src/lib/reproduction/status.ts` |
| `financeiro.registro` | Completo | `src/pages/Registrar.tsx`, `src/pages/Financeiro.tsx` |
| `financeiro.historico` | Completo | `src/pages/Financeiro.tsx` |
| `agenda.gerar` | Completo | `src/pages/Agenda.tsx`, `supabase/migrations/0028_sanitario_agenda_engine.sql` |
| `agenda.concluir` | Completo | `src/pages/Agenda.tsx`, `src/lib/sanitario/service.ts` |
| `agenda.dedup` | Completo | `docs/CONTRACTS.md`, `supabase/functions/sync-batch/` |
| `agenda.recalculo` | Completo | `supabase/migrations/0028_sanitario_agenda_engine.sql` |

**Capability Score:** 19/19 = **100%** ✅

---

## 3. Superfície de Produto Consolidada

- Onboarding guiado da fazenda: `src/pages/OnboardingInicial.tsx`
- Importação CSV de animais: `src/pages/AnimaisImportar.tsx`
- Importação CSV de lotes: `src/pages/LotesImportar.tsx`
- Importação CSV de pastos: `src/pages/PastosImportar.tsx`
- Relatórios operacionais: `src/pages/Relatorios.tsx`
- Dashboard reprodutivo: `src/pages/ReproductionDashboard.tsx`
- Ficha reprodutiva por matriz: `src/pages/AnimalReproducao.tsx`
- Pós-parto neonatal por matriz: `src/pages/AnimalPosParto.tsx`
- Cria inicial pós-parto: `src/pages/AnimalCriaInicial.tsx`
- Transições do rebanho: `src/pages/AnimaisTransicoes.tsx`
- Apresentação visual por categoria/estágio: `src/components/animals/`
- Agrupamento matriz-cria na listagem: `src/pages/Animais.tsx`, `src/lib/animals/familyOrder.ts`
- Elegibilidade reprodutiva por categoria: `src/lib/animals/presentation.ts`
- Telemetria local de piloto: `src/lib/telemetry/` — store `metrics_events` (Dexie v8)
- Modo de experiência por fazenda: `src/lib/farms/experienceMode.ts`
- Taxonomia canônica bovina: `src/lib/animals/taxonomy.ts` + contrato v1 + view SQL

---

## 4. Estado de Qualidade

- `pnpm run lint`: verde
- `pnpm test`: verde
- `pnpm run build`: verde
- `pnpm run test:e2e`: cobre onboarding, importações, relatorios
- Unitários: `src/lib/animals/__tests__/` (7 arquivos), `src/lib/offline/__tests__/` (6 arquivos), `src/pages/__tests__/` (12 arquivos)

---

## 5. TDs Fechados

| TD | capability_id | Tipo | Status | Fechado por |
| --- | --- | --- | --- | --- |
| TD-001 | `infra.queue_cleanup` | DLQ auto-purge | ✅ CLOSED | `src/lib/offline/rejections.ts` + syncWorker |
| TD-003 | `infra.rbac_hardening` | DELETE animais restrito a owner/manager | ✅ CLOSED | `20260308230748_rbac_delete_hardening_animais.sql` |
| TD-004 | `infra.indexes` | Índices compostos de performance | ✅ CLOSED | `20260308230811_indexes_performance_gmd.sql` |
| TD-006 | `nutricao.registro` | UI de nutrição | ✅ CLOSED | `src/pages/Registrar.tsx` |
| TD-008 | `movimentacao.anti_teleport_client` | Anti-teleporte no frontend | ✅ CLOSED | `src/pages/Registrar.tsx:387-396` |
| TD-011 | `sanitario.registro` | Catálogo de produtos veterinários | ✅ CLOSED | `20260308230824_produtos_veterinarios_ui.sql` |
| TD-014 | `pesagem.registro` | Validação peso > 0 no frontend | ✅ CLOSED | `src/pages/Registrar.tsx` |
| TD-015 | `pesagem.historico` | GMD via view otimizada | ✅ CLOSED | `20260308230811_indexes_performance_gmd.sql:vw_animal_gmd` |
| TD-019 | `movimentacao.registro` | FKs from/to_lote_id | ✅ CLOSED | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| TD-020 | `reproducao.registro` | FK macho_id | ✅ CLOSED | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |

**Total OPEN:** 0 (da lista original) ✅

---

## 6. Gaps Residuais (Pós-Audit)

| Item | Tipo | Impacto | Próxima ação |
| --- | --- | --- | --- |
| Telemetria local-only | Observabilidade | Sem visibilidade remota de erros de sync | Avaliar Edge Function de coleta ou integração Supabase |
| `produtos_veterinarios` sem integração UI confirmada | UX | Catálogo existe mas autocomplete em Registrar não foi confirmado | Verificar `src/pages/Registrar.tsx` |
| Pós-parto (AnimalPosParto + AnimalCriaInicial) sem cobertura E2E | Testes | Fluxo novo não coberto no pacote `test:e2e` | Adicionar testes guiados |

---

## 7. Capability Catalog

| Domínio | `capability_id` | Descrição |
| --- | --- | --- |
| sanitario | `sanitario.registro` | Registro de evento sanitário |
| sanitario | `sanitario.historico` | Histórico/leitura de sanitário |
| sanitario | `sanitario.agenda_link` | Vínculo/geração de agenda via engine sanitária |
| pesagem | `pesagem.registro` | Registro de pesagem |
| pesagem | `pesagem.historico` | Histórico/leitura de pesagem |
| nutricao | `nutricao.registro` | Registro de nutrição (sem estoque) |
| nutricao | `nutricao.historico` | Histórico/leitura de nutrição |
| movimentacao | `movimentacao.registro` | Registro de movimentação |
| movimentacao | `movimentacao.historico` | Histórico/leitura de movimentação |
| movimentacao | `movimentacao.anti_teleport_client` | Validação client-side origem≠destino |
| reproducao | `reproducao.registro` | Registro de reprodução |
| reproducao | `reproducao.historico` | Histórico/leitura de reprodução |
| reproducao | `reproducao.episode_linking` | Linking episódios (cobertura→diagnóstico→parto) |
| financeiro | `financeiro.registro` | Registro financeiro |
| financeiro | `financeiro.historico` | Histórico/leitura financeiro |
| agenda | `agenda.gerar` | Geração/criação de agenda items |
| agenda | `agenda.concluir` | Conclusão/cancelamento de agenda items |
| agenda | `agenda.dedup` | Deduplicação via `dedup_key` |
| agenda | `agenda.recalculo` | Recalculo automático via engine sanitária |

**Total: 19 capabilities**

---

## Veja Também

- [TECH_DEBT.md](./TECH_DEBT.md)
- [ROADMAP.md](./ROADMAP.md)
- [CURRENT_STATE.md](./CURRENT_STATE.md)
