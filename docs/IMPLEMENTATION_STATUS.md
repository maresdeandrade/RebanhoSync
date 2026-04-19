# Implementation Status Matrix

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-19
> **Derivado por:** Auditoria técnica completa — código + migrations + testes como fonte de verdade

Este documento registra o estado efetivo do RebanhoSync em abril de 2026, pós-fechamento de todos os TDs da lista aberta.

## Resumo Executivo

- **Estagio do produto:** Beta interno — MVP completo e operacional.
- **Fase de engenharia/produto:** transicao de MVP funcional para SLC (Simple, Lovable, Complete) em consolidacao.
- **Core operacional:** sanitário, pesagem, movimentação, nutrição, reprodução, financeiro e agenda estão implementados e usáveis.
- **Camadas consolidadas:** onboarding guiado, importação CSV, relatórios operacionais, telemetria de piloto com flush remoto, modo de experiência da fazenda, dashboard e ficha reprodutiva dedicada, pós-parto neonatal, cria inicial, transições de rebanho.
- **Motor sanitário endurecido:** adoção de regime sequencial, dependência de milestones, logica de catch-up para entrada de rebanho (history_confidence) e motor de regras de repetição declarativas.
- **Qualidade local:** `lint`, `test:unit`, `test:integration`, `test:smoke`, `quality:gate` e `build` verdes.
- **TDs originalmente abertos (M0-M2):** fechados via migrations de março/2026.
- **Gaps residuais:** sem gap funcional critico aberto; permanecem residuos estruturais locais e consolidacao de experiencia/confiabilidade.

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

- Dexie v11 com stores de estado, eventos, fila, métricas locais, cache do catálogo veterinário e cache do catálogo regulatório oficial.
- Gestos atômicos com `queue_gestures` e `queue_ops`.
- Aplicação otimista, rollback e DLQ.
- Worker de sync com `sync-batch`.
- Auto-purge de rejeições (TTL 7d, a cada 6h).
- Store `metrics_events` como buffer local append-only para telemetria de piloto, com flush remoto periódico.

**Evidência principal:**
- `src/lib/offline/db.ts` — 20+ stores Dexie (v11 com `metrics_events`, `catalog_produtos_veterinarios`, `catalogo_protocolos_oficiais*` e `state_fazenda_sanidade_config`)
- `src/lib/offline/syncWorker.ts` — pipeline completo + auto-purge
- `src/lib/offline/rejections.ts` — API DLQ index-backed
- `src/lib/offline/pull.ts` — reconciliação remota

---

## 2. Domínios Operacionais (E2E Completo)

| Domínio | Estado | Evidência principal |
| --- | --- | --- |
| `sanitario.registro` | Completo — catálogo `produtos_veterinarios` e biblioteca canônica de protocolos com `calendario_base` estruturado em registro, protocolo e agenda | `src/pages/Registrar/index.tsx`, `src/pages/ProtocolosSanitarios/index.tsx`, `src/lib/sanitario/baseProtocols.ts` |
| `sanitario.historico` | Completo | `src/pages/Eventos.tsx` |
| `sanitario.agenda_link` | Completo — motor declarativo por `calendario_base`, campanha, janela etaria e ancora operacional | `supabase/migrations/20260411103000_sanitario_calendario_base_declarative_engine.sql` |
| `pesagem.registro` | Completo | `src/pages/Registrar/index.tsx`, `src/pages/AnimalDetalhe.tsx` |
| `pesagem.historico` | Completo — **TD-015 CLOSED** via `vw_animal_gmd` | `supabase/migrations/20260308230811_indexes_performance_gmd.sql` |
| `nutricao.registro` | Completo | `src/pages/Registrar/index.tsx`, `src/pages/Eventos.tsx` |
| `nutricao.historico` | Completo | `src/pages/Eventos.tsx` |
| `movimentacao.registro` | Completo — **TD-019 CLOSED** | `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| `movimentacao.historico` | Completo | `src/pages/Eventos.tsx` |
| `movimentacao.anti_teleport_client` | Completo | `src/pages/Registrar/index.tsx`, `src/lib/offline/syncWorker.ts` |
| `reproducao.registro` | Completo — **TD-020 CLOSED** | `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| `reproducao.historico` | Completo | `src/pages/ReproductionDashboard.tsx`, `src/pages/AnimalDetalhe.tsx` |
| `reproducao.episode_linking` | Completo | `src/lib/reproduction/linking.ts`, `src/lib/reproduction/status.ts` |
| `financeiro.registro` | Completo | `src/pages/Registrar/index.tsx`, `src/pages/Financeiro.tsx` |
| `financeiro.historico` | Completo | `src/pages/Financeiro.tsx` |
| `agenda.gerar` | Completo | `src/pages/Agenda/index.tsx`, `supabase/migrations/0028_sanitario_agenda_engine.sql` |
| `agenda.concluir` | Completo | `src/pages/Agenda/index.tsx`, `src/lib/sanitario/service.ts` |
| `agenda.dedup` | Completo | `docs/SYSTEM.md`, `supabase/functions/sync-batch/` |
| `agenda.recalculo` | Completo — recompute limpa e reconstrui pendencias automaticas do escopo antes de reaplicar o motor | `supabase/migrations/20260411103000_sanitario_calendario_base_declarative_engine.sql` |

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
- Telemetria de piloto com buffer local + flush remoto: `src/lib/telemetry/`, `supabase/functions/telemetry-ingest/`, `src/components/settings/SyncHealthPanel.tsx`
- Overlay regulatorio operacional guiado: `src/components/sanitario/RegulatoryOverlayManager.tsx`, `src/lib/sanitario/compliance.ts`
- Catálogo veterinário com cache local e vínculo estruturado no payload sanitário: `src/lib/sanitario/products.ts`
- Modo de experiência por fazenda: `src/lib/farms/experienceMode.ts`
- Taxonomia canônica bovina: `src/lib/animals/taxonomy.ts` + contrato v1 + view SQL

---

## 4. Estado de Qualidade

- `pnpm run lint`: verde
- `pnpm test`: instavel fora do gate minimo (flaky E2E residual)
- `pnpm run test:unit`: verde
- `pnpm run test:integration`: verde (suite de fluxo em `tests/integration/**`)
- `pnpm run test:hotspots`: verde
- `pnpm run test:smoke`: verde (suite minima em `tests/smoke/**`)
- `pnpm run quality:gate`: verde (`lint` + `test:hotspots` + `test:integration` + `test:smoke`)
- `pnpm run build`: verde
- `pnpm run test:e2e`: cobre onboarding, importações, relatorios e fluxo parto -> pos-parto -> cria inicial
- Unitários: `src/lib/animals/__tests__/` (7 arquivos), `src/lib/offline/__tests__/` (6 arquivos), `src/pages/__tests__/` (12 arquivos)

---

## 5. TDs Fechados

| TD | capability_id | Tipo | Status | Fechado por |
| --- | --- | --- | --- | --- |
| TD-001 | `infra.queue_cleanup` | DLQ auto-purge | ✅ CLOSED | `src/lib/offline/rejections.ts` + syncWorker |
| TD-003 | `infra.rbac_hardening` | DELETE animais restrito a owner/manager | ✅ CLOSED | `20260308230748_rbac_delete_hardening_animais.sql` |
| TD-004 | `infra.indexes` | Índices compostos de performance | ✅ CLOSED | `20260308230811_indexes_performance_gmd.sql` |
| TD-006 | `nutricao.registro` | UI de nutrição | ✅ CLOSED | `src/pages/Registrar/index.tsx` |
| TD-008 | `movimentacao.anti_teleport_client` | Anti-teleporte no frontend | ✅ CLOSED | `src/pages/Registrar/index.tsx` |
| TD-011 | `sanitario.registro` | Catálogo de produtos veterinários | ✅ CLOSED | `20260308230824_produtos_veterinarios_ui.sql` |
| TD-014 | `pesagem.registro` | Validação peso > 0 no frontend | ✅ CLOSED | `src/pages/Registrar/index.tsx` |
| TD-015 | `pesagem.historico` | GMD via view otimizada | ✅ CLOSED | `20260308230811_indexes_performance_gmd.sql:vw_animal_gmd` |
| TD-019 | `movimentacao.registro` | FKs from/to_lote_id | ✅ CLOSED | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| TD-020 | `reproducao.registro` | FK macho_id | ✅ CLOSED | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |

**Total OPEN da lista original (M0-M2):** 0 ✅
**Total OPEN residual atual em `TECH_DEBT.md`:** 5 (`TD-025`, `TD-026`, `TD-027`, `TD-029`, `TD-030`)
**Residual adicional nao-TD (fase MVP -> SLC):** acabamento de experiencia cross-flow

---

## 6. Gaps Residuais (Pos-Audit)

| Item | Tipo | Impacto | Próxima ação |
| --- | --- | --- | --- |
| Residual `Registrar`: volume de composicao/JSX no shell | Estrutural local UI | Mantem custo de leitura/manutencao acima do ideal para evolucao de UX | Fatiar blocos de composicao restantes por recortes pequenos |
| Residual `Agenda`: leitura/preparacao de dados ainda no shell | Estrutural local UI | Shell ainda acumula montagem de read-model local | Extrair montagem de dados para artefatos locais sem mover dominio |
| Warnings `act(...)` e flakiness E2E fora do gate minimo | Confiabilidade | Reduz confianca da suite ampla e pode ocultar regressao silenciosa | Corrigir causa de updates assincronos, estabilizar cenarios E2E criticos e reduzir warnings >= 70% |
| Acabamento de experiencia cross-flow | UX/produto | Fluxos centrais funcionam, mas com friccao e inconsistencia de feedback | Consolidar backlog MVP -> SLC por frentes de UX operacional |

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
| agenda | `agenda.dedup` | Deduplicação via `dedup_key` e assinatura semântica de família |
| agenda | `agenda.recalculo` | Recalculo automático via engine sanitária |
| sanitario| `sanitario.regime_sequencial`| Motor de sequência de doses, dependência de milestone e catch-up |

**Total: 19 capabilities**

---

## 7.1 Update 2026-04-18 (Hardening Estrutural de Páginas)

- Concluída a folderização dos hotspots de página:
  - `src/pages/Registrar/index.tsx`
  - `src/pages/Agenda/index.tsx`
  - `src/pages/ProtocolosSanitarios/index.tsx`
- Contexto local consolidado por hotspot (`README.md` + `AGENTS.md`) e dispatcher local de telas em `src/pages/AGENTS.md`.
- Esta atualização é estrutural/documental e não altera capability score nem comportamento funcional.

## 7.2 Update 2026-04-19 (Hardening Final do Hotspot Registrar)

- `src/pages/Registrar/index.tsx` foi reduzido de ~1304 -> ~1220 -> ~1019 -> ~948 -> **916** linhas ao longo das sprints de hardening.
- O entrypoint agora atua como shell quase final: IO, quick action policy, step-flow, query parsing e finalize controller estão fora do shell.
- A camada de composição de sections foi particionada em artefatos locais:
  - `useRegistrarActionSectionState.tsx` (builder de props/callbacks de section)
  - `buildRegistrarActionSectionSlots.tsx` (slots/blocos visuais de compliance e checklist de trânsito)
  - `useRegistrarShellState.ts` (estado local bruto, toggles, derives simples e wiring local de seleção/reset)
- A validação de corte final permaneceu verde em escopo local de hotspot (`lint`, `test -- Registrar`, `build`) sem reabrir fronteiras de domínio/offline/sync.

## 7.3 Update 2026-04-19 (Hardening Final do Hotspot Agenda)

- `src/pages/Agenda/index.tsx` foi reduzido de ~2076 para ~591 linhas ao longo dos cortes de hardening.
- O shell deixou de concentrar controller de acoes, shell state, interaction state e blocos macro de composicao (overview/compliance/lifecycle).
- `AgendaGroupedContent` foi fatiado em subcomponentes locais de composicao.
- Residual principal: leitura/preparacao de dados no shell, sem acoplamento macro de composicao.

## 7.4 Reposicionamento de Fase (MVP -> SLC em consolidacao)

- Encerrada a frente principal de quebra de monolitos de UI em `Registrar` e `Agenda`.
- A proxima etapa prioriza consolidacao operacional:
  - previsibilidade de fluxo (Simple),
  - reducao de friccao e consistencia de feedback (Lovable),
  - completude percebida dos fluxos centrais com confiabilidade de regressao (Complete).
- Esta classificacao nao indica produto finalizado; indica transicao controlada de fase.

---

## Veja Também

- [TECH_DEBT.md](./TECH_DEBT.md)
- [ROADMAP.md](./ROADMAP.md)
- [CURRENT_STATE.md](./CURRENT_STATE.md)

## 8. Update 2026-04-09

- Home now surfaces prioritized sanitary attention based on due date, mandatory flags and veterinary/compliance requirements.
- Dashboard administrativo now tracks `sanitario critico` separately from generic agenda backlog.
- Agenda now exposes group-level badges, with type + due buckets when grouped by animal and animal composition when grouped by event.
- Agenda event grouping now uses a hardened signature, prioritizing protocol version, protocol item and milestone metadata before generic product fallback.
- Agenda groups are now ordered by urgency, pushing overdue and due-today cards ahead of future-only or closed-only groups.
- Agenda summary badges now act as quick filters, allowing drill-down by type, due bucket and animal composition directly from group cards.
- Agenda summary badges now also drive contextual navigation, keeping the selected quick filter active while scrolling and highlighting the matching rows of the clicked group.
- Agenda groups are now collapsed by default, auto-expand on contextual badge navigation, and show `visible/total` counts to reduce card noise without losing situational awareness.
- Expanded agenda groups can now temporarily reveal their full row set without clearing the active quick filters, making local comparison easier during triage.
- Agenda group headers now surface the recommended next action and offer a direct CTA into the registration flow, even while the group remains collapsed.
- Agenda now persists group mode, filters, expanded groups, reveal state and contextual focus per user/farm, so triage resumes from the same operational point.
- Agenda interaction coverage now validates persisted rehydration and the badge -> focus -> expand -> reveal flow at page level.
- Agenda mobile density is now reduced with compact badge overflow (`+N`) and condensed secondary group actions under a small-screen menu.
- Agenda now exposes a critical shortcut bar that jumps between overdue groups in the current recorte, keeping contextual focus and auto-expansion aligned with urgency ordering.
- Relatorios operacionais now carry sanitary priority context, keeping the same rule set used by agenda and home.
- Perfil + AppShell now drive local sanitary reminders with quiet hours, urgency filters and `experience_mode` awareness.
- `produtos_veterinarios` remains the canonical product catalog reference inside protocol, agenda and event flows.
- ProtocolosSanitarios now includes a farm-level editor for custom protocols and steps, with `experience_mode` gating, explicit `calendario_base` editing and structured product metadata updates.
- The standard sanitary protocol library is now canonicalized in `src/lib/sanitario/baseProtocols.ts`, removing protocol base definitions from the UI layer.
- Standard protocols and farm protocol items now carry structured `calendario_base` metadata, and `Registrar` / `FarmProtocolManager` describe schedule semantics from that payload instead of raw `intervalo_dias` alone.
- `supabase/migrations/20260411103000_sanitario_calendario_base_declarative_engine.sql` now makes `payload.calendario_base` the effective source of truth for sanitary agenda generation, supporting campaign months, age windows, rolling intervals and operational anchors such as birth, weaning and dry-off.
- The sanitary recompute wrappers now rebuild automatic pending tasks inside the recalculated scope before reapplying the declarative engine, preventing stale sanitary agenda rows from surviving protocol, risk or animal-payload changes.
- `src/pages/Agenda/index.tsx`, `src/lib/reports/operationalSummary.ts` and `src/pages/Relatorios.tsx` now reuse the same calendar-base semantics in read-only surfaces, projecting the declarative schedule label instead of collapsing sanitary periodicity to raw day intervals.
- `src/pages/Agenda/index.tsx` now also turns the declarative `calendario_base` mode into a persisted quick filter and row-level operational badge, while `src/lib/reports/operationalSummary.ts` / `src/pages/Relatorios.tsx` project mode and anchor into summary/export surfaces.
- `src/lib/sanitario/attention.ts` now carries declarative calendar mode/anchor semantics into the shared sanitary-attention read model, and `src/pages/Home.tsx` / `src/pages/Dashboard.tsx` expose analytical cuts that deep-link into `/agenda?calendarMode=...`.
- `src/pages/Agenda/index.tsx` now also accepts `calendarAnchor` as persisted filter/query param, and `src/pages/Dashboard.tsx` exposes deep links by operational anchor so birth-, weaning-, calendar- and dry-off-driven schedules open directly in the right sanitary recorte.
- `src/pages/Animais.tsx` and `src/pages/AnimalDetalhe.tsx` now reuse the same declarative sanitary schedule semantics, exposing `mode`, `anchor` and `label` in the animal-centric next-step view; `Dashboard` also links these cuts directly into `/animais?calendarMode=...` and `/animais?calendarAnchor=...`.
- The sanitary domain now has a global regulatory foundation: `catalogo_protocolos_oficiais`, `catalogo_protocolos_oficiais_itens`, `catalogo_doencas_notificaveis` and tenant-scoped `fazenda_sanidade_config`.
- `src/lib/sanitario/officialCatalog.ts` now selects the official pack by `modo_calendario`, state overlay and farm risk, and materializes only the portions compatible with the current `protocolos_sanitarios` execution model.
- `src/pages/ProtocolosSanitarios/index.tsx` now exposes a farm-level official pack activation surface, and `src/components/sanitario/OfficialSanitaryPackManager.tsx` lets owner/manager configure UF, mode, aptitude, system and risk before materializing the selected regulatory base.
- Reapplying the official pack now deactivates official protocols that leave the current selection, preventing stale recommended content from surviving after a downgrade to `minimo_legal`.
- `src/components/sanitario/FarmProtocolManager.tsx` now absorbs the canonical farm templates, so the previous complementary library no longer appears as a fourth semantic layer in the protocols screen.
- `src/pages/Registrar/index.tsx` now distinguishes internal lote movement from external transit, persists GTA/e-GTA checklist metadata on the base event, and blocks interstate reproduction transit without the PNCEBT documentary pre-check.
- `src/lib/sanitario/transit.ts` centralizes transit checklist validation/payload logic, and `src/lib/finance/transactions.ts` now accepts extra structured payload so sale events can keep transit compliance context.
- `src/lib/sanitario/alerts.ts` now centralizes sanitary suspicion state, event payload description and local movement blocking semantics for animal-centric sanitary alerts.
- `src/pages/AnimalDetalhe.tsx` now exposes guided open/close suspicion dialogs backed by the official disease catalog, writes append-only `alerta_sanitario` events and keeps the mutable block state in `animais.payload.sanidade_alerta`.
- `src/pages/Registrar/index.tsx`, `src/components/manejo/MoverAnimalLote.tsx`, `src/components/manejo/AdicionarAnimaisLote.tsx` and `src/pages/AnimaisTransicoes.tsx` now enforce local movement blocking whenever the selected animal already has an open sanitary suspicion.
- `src/components/sanitario/OfficialSanitaryPackManager.tsx`, `src/components/sanitario/RegulatoryOverlayManager.tsx` and `src/components/sanitario/FarmProtocolManager.tsx` now separate the protocols tab into three layers: official regulatory base, a single operational overlay surface shared by the official pack and farm custom complements, and farm operational protocols.
- `src/lib/sanitario/compliance.ts` now derives the active procedural overlays from the selected official pack, persists mutable compliance runtime state in `fazenda_sanidade_config.payload.overlay_runtime` and builds append-only event payloads for the new `conformidade` domain.
- `src/components/sanitario/RegulatoryOverlayManager.tsx` now lets owner/manager execute guided runtime checks for ruminant `feed-ban` and operational compliance checklists, instead of leaving those overlays as documentation-only.
- `src/lib/events/types.ts`, `src/lib/events/buildEventGesture.ts` and `src/lib/events/validators/conformidade.ts` now support farm-level append-only `conformidade` events without forcing an `animalId` or `loteId`.
- `src/pages/Eventos.tsx`, `src/pages/Home.tsx`, `src/pages/Animais.tsx`, `src/pages/Agenda/index.tsx` and `src/lib/reports/operationalSummary.ts` now recognize the new `conformidade` domain in operational history and summary surfaces.
- `src/lib/sanitario/complianceAttention.ts` now summarizes procedural overlay urgency for the agenda, distinguishing `feed-ban`, critical checklists and generic pending compliance.
- `src/pages/Agenda/index.tsx` now pulls `fazenda_sanidade_config` together with the local official catalog cache, surfaces compliance badges in the page intro, shows a dedicated operational alert card for `overlay_runtime`, and propagates a compact restriction badge into open group headers.
- Agenda empty-state handling now keeps the compliance alert visible even when there are no `agenda_itens`, preventing the regulatory overlay from disappearing behind an empty schedule.
- `src/lib/sanitario/complianceGuards.ts` now derives contextual blockers and warnings from the active `overlay_runtime`, separating nutrition and movement semantics before they reach the UI.
- `src/pages/Registrar/index.tsx` now blocks nutrition when `feed-ban` or critical water/hygiene checks remain open, and also blocks movement/sale flows when quarantine or documentary overlays required by the current context are still pending.
- `src/components/manejo/MoverAnimalLote.tsx`, `src/components/manejo/AdicionarAnimaisLote.tsx` and `src/pages/AnimaisTransicoes.tsx` now enforce the same movement-side compliance blockers, so auxiliary lote flows cannot bypass the official overlay runtime.
- `src/lib/sanitario/regulatoryReadModel.ts` now materializes a shared regulatory read model, combining active overlay entries, compliance-attention summary and contextual flow guards for nutrition, internal movement and external transit/sale.
- `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Financeiro.tsx` and `src/lib/reports/operationalSummary.ts` now reuse that same read model, so derived surfaces expose the identical regulatory state instead of reinterpreting the official overlay independently.
- `src/pages/Relatorios.tsx` now includes regulatory compliance in the operational summary itself, and the CSV/print export path also carries those pending items and blocker counts.
- `src/pages/Eventos.tsx` now reuses that same read model to surface open compliance, movement/nutrition impact badges and contextual CTA/filtering inside operational history, instead of treating `conformidade` as an isolated append-only domain.
- `src/pages/LoteDetalhe.tsx` now anticipates internal-movement restrictions from the shared read model, surfaces `Movimentacao restrita` or `sob revisao` in the page intro and disables the primary `Adicionar animais` action when the official overlay is blocking lote changes.
- `src/lib/sanitario/regulatoryReadModel.ts` now also derives analytical cuts by subarea and operational impact, keeping `feed-ban`, quarantine, documentary and water/hygiene summaries tied to the same guard semantics already used in runtime blockers.
- `src/pages/Dashboard.tsx` now exposes those analytical cuts as a dedicated regulatory panel, and each card opens `/protocolos-sanitarios` with `overlaySubarea` or `overlayImpact` preselected instead of forcing a manual search through the full overlay.
- `src/components/sanitario/RegulatoryOverlayManager.tsx` now reads those analytical query params, applies the corresponding filtered recorte to runtime checklist cards and lets the user clear the analytical focus back to the full official overlay.
- `src/lib/reports/operationalSummary.ts` and `src/pages/Relatorios.tsx` now project those same analytical cuts into the operational summary, CSV/print payloads and CTA links that open either the official overlay or the historical surface already filtered.
- `src/pages/Eventos.tsx` now honors `dominio`, `overlaySubarea` and `overlayImpact` query params, so regulatory CTAs can land directly on a specialized compliance history cut instead of only toggling the generic domain filter.
- `src/lib/sanitario/regulatoryAnimals.ts` now projects the same shared regulatory read model into an animal-centric profile, including row-level restriction badges, impact/subarea matching and dedicated CSV export for the affected animal cut.
- `src/pages/Animais.tsx` now supports `overlaySubarea` and `overlayImpact`, exposes animal-centric regulatory filters, highlights restricted animals in the list and exports the current impacted cut without inventing a new rule layer outside the shared read model.
- `src/pages/Dashboard.tsx` and `src/pages/Relatorios.tsx` now also link into `/animais` with the same analytical query params, completing the navigation path between dashboard, reports, official overlay, history and animal list.
- Focused sanitary/event coverage now validates sanitary alert payload round-trip, validator/build behavior for the new `alerta_sanitario` domain and block reasoning helpers.
- The legacy standard sanitary UI library no longer exposes aftosa as a default vaccination calendar.
- Focused sanitary coverage now validates calendar-base round-trip, standard protocol invariants and preservation of structured payload metadata during farm-level customization.
- Focused sanitary coverage now also validates official catalog selection by legal status, state overlay and farm-risk gates.
- Focused sanitary coverage now validates official pack reapplication and the deactivation of stale official protocols.
- Focused sanitary/finance coverage now validates transit checklist rules and structured transit payload propagation in sale events.
- Focused sanitary/event coverage now also validates farm-level `conformidade` event construction and the runtime state round-trip for procedural overlays.
- Focused agenda/sanitary coverage now validates compliance-attention severity rules, the agenda projection of official overlay restrictions and the blocker derivation used by nutrition/movement flows.
- Focused sanitary/reporting coverage now also validates the shared regulatory read model and the projection of regulatory compliance into the operational summary.
- Focused page/reporting coverage now also validates lote-level anticipation of regulatory movement restrictions in `src/pages/__tests__/LoteDetalhe.test.tsx`, the regulatory overlay projection and query-driven analytical recorte inside `src/pages/__tests__/Eventos.test.tsx`, dashboard analytical cuts in `src/pages/__tests__/Dashboard.test.tsx`, query-driven overlay filtering in `src/components/sanitario/__tests__/RegulatoryOverlayManager.test.tsx` and analytical export rows in `src/lib/reports/__tests__/operationalSummary.test.ts`.
- Focused animal/regulatory coverage now also validates animal-centric restriction projection and dedicated export in `src/lib/sanitario/__tests__/regulatoryAnimals.test.ts` plus the query-driven restricted list in `src/pages/__tests__/Animais.test.tsx`.
- Local validation for this update: `pnpm exec eslint` (changed files), `pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm run lint`, and focused `vitest` suites for agenda/sanitario/relatorios.

## 9. Update 2026-04-12 (Sanitary Regimen & Compliance Engine)

- Implementado motor de **regime sequencial e histórico de entrada** no escopo sanitário via `20260412173000_sanitario_regime_sequencial_e_historico_entrada.sql`.
- Deduplicação semântica refinada por **família protocolar** (`family_code`), `milestone_code` e `sequence_order`.
- A engine sanitária (`sanitario_recompute_agenda_core`) agora processa declarativamente regras de agendamento por encadeamento (`after_previous_completion`, `rolling_from_last_completion`), mitigando drift cronológico de múltiplas doses.
- Introdução de **`history_confidence`** no processamento de animais para identificar rebanho recém-adquirido ou sem histórico rastreado (`known`, `partial`, `unknown`).
- Adição de **`compliance_state`** (`catch_up_required`, `documentation_required`, `evaluation_required`, `scheduled`) para sinalizar pendências de equalização sanitária.
- Frontend estendido com framework híbrido de layers sanitários (oficial, overlay, farm) com lógica rica de parsing do `history_confidence` e `schedule_rule`.
- Cobertura de testes focado no motor de sequência (`regimen.test.ts`, `customization.test.ts`), garantindo idempotência e re-hidratação estruturada.

### Agenda UX Delivery Map

This update turned `agenda.*` from a flat list into an operational triage surface with progressive disclosure.

**Delivered phases**

1. Group summaries: badges by type + due bucket when grouped by animal, and animal composition when grouped by event.
2. Event grouping hardening: canonical signature prioritizing protocol version, protocol item and milestone metadata before generic fallback.
3. Urgency ordering: overdue groups first, then due-today, future-only and closed-only groups.
4. Quick filters: summary badges now act as drill-down controls.
5. Contextual navigation: clicking a badge keeps the filter active, scrolls to the matching row set and highlights the selected group.
6. Progressive disclosure: groups are collapsed by default, expose `visible/total` counts, and can reveal the full group locally without clearing global filters.
7. Group-level action guidance: headers now surface the recommended next action and provide a direct CTA into the execution flow.
8. Persisted triage state: group mode, active filters, expanded groups, reveal state and contextual focus are restored per user/farm.
9. Page interaction coverage: agenda tests now validate persisted rehydration and the main triage drill-down path.
10. Mobile density refinement: small screens now cap visible summary badges, emit a `+N` overflow marker and collapse secondary group actions into a compact menu.
11. Critical shortcut navigation: overdue groups in the current recorte can now be traversed directly from a top-level shortcut bar.

**Interconnections**

- Data ingress into agenda: `src/pages/Registrar/index.tsx`, `src/pages/ProtocolosSanitarios/index.tsx`, `src/components/sanitario/FarmProtocolManager.tsx`
- Shared agenda semantics: `src/lib/agenda/groupSummaries.ts`, `src/lib/agenda/groupOrdering.ts`, `src/lib/agenda/grouping.ts`, `src/lib/agenda/storage.ts`
- Shared sanitary priority semantics: `src/lib/sanitario/protocolRules.ts`, `src/lib/sanitario/attention.ts`
- Offline and sync substrate: `src/lib/offline/db.ts`, `src/lib/offline/pull.ts`, `src/lib/offline/ops.ts`
- Reused operational surfaces: `src/pages/Agenda/index.tsx`, `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Relatorios.tsx`
- Interaction coverage: `src/pages/Agenda/__tests__/Agenda.test.tsx`, `src/lib/agenda/__tests__/storage.test.ts`

**Recommended next increments**

- Add keyboard shortcuts for the critical shortcut bar.
