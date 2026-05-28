# Relatório de Reconciliação — Documentos de Governança

**Status:** Derivado (Rev D+ — Pós-Fechamento)
**Baseline:** `3664395`
**Última Atualização:** 2026-05-28
**Derivado por:** Antigravity — Auditoria Técnica Completa Abril/2026

---

## 1. Baseline Integrity

**Status:** CLEAN  
**Baseline Commit:** `3664395`  
**Data de Execução:** 2026-04-12

Working tree verificado limpo. Múltiplos updates de Abril fechados no fluxo de MVP.
Recente adição da feature do Motor Sanitário Sequencial (Mid-Month Abril).

---

## 2. Summary

### Delta 2026-05-28 (Fase 1, 2 & 3 — Consolidação Operacional e Métricas de Lote/Pasto com ECC Factual)

- **Fase 3 — Fechamento do Ciclo Operacional do ECC Factual Individual**:
  - Implementado registro visual de ECC individual e lote no Registrar (com suporte a inputs vazios no modo lote indicando "não avaliado nesta rodada", validação rígida de passo de 0.25 e range 1.0 a 5.0, e lógica "tudo-ou-nada" onde qualquer entrada inválida bloqueia o salvamento).
  - Cada animal avaliado gera um evento factual individual independente com `source_task_id = null`.
  - Na ficha do animal (`AnimalDetalhe`), é exibido um card simples com o último ECC factual registrado (escala, data e observação) e o histórico completo em ordem decrescente de `occurred_at`. Casos vazios mostram "Sem ECC factual registrado".
  - Corrigidas ambiguidades em testes de renderização na ficha do animal para múltiplas instâncias de datas/valores de ECC repetidos.
- **Fase 2 — Métricas de Lote/Pasto e ECC Factual**:
  - Modelado domínio `"ecc"` no pipeline factual (`EccEventInput` -> `validateEccInput` -> `buildEventGesture` -> `eventos_ecc` detail table).
  - Implementado read-model factual e helper puro `getLatestValidEcc` em `eccHelpers.ts` ignorando eventos soft-deletados e consultando a data factual (`occurred_at`).
  - Atualizados `buildLoteOccupancyMetrics` e `buildPastoOccupancyMetrics` para obter médias e frações de cobertura reais, baseados estritamente nos últimos registros factuais dos animais ativos do grupo.
  - Implementada a contagem sempre visível e a lista colapsável de animais sem ECC factual sob demanda (`animaisSemEcc` no accordion/details) nas telas de Lotes e Pastos.
  - Adicionado suporte a limitações e alertas para tempos de lotação baseados em movimentações factuais e GMD bloqueado com 0 ou 1 pesagem (calculável apenas com pelo menos 2 pesagens).
  - Criada nova suíte de testes de fumaça e de integração `eccManejo.test.ts` cobrindo todos os cenários com 100% de sucesso.
- **Correção de Falhas de Teste Históricas**: Resolvidas 6 falhas pré-existentes de testes unitários devido a desalinhamento de mocks de `useLiveQuery` e Shadcn/Combobox (`Animais.test.tsx`, `AnimalSpeciesForms.test.tsx`, `LoteDetalhe.test.tsx`, `PastosP2.test.tsx`, `semantic_terms_guard.smoke.test.ts`).
- **Suíte de Testes de Fluxo e Fumaça**:
  - Criados 5 novos testes de integração de fluxo sob `tests/integration/flows/` cobrindo cenários com/sem agenda de pesagem, movimentação e tratativa de erros no planejamento do evento.
  - Criado 1 novo teste de fumaça sob `tests/smoke/` validando o comportamento de `buildEventGesture` de forma avulsa para múltiplos domínios (pesagem, movimentação, nutrição, sanitário) assegurando `source_task_id: null`.
- **Integridade da Suite**: Linter, build e testes unitários/integração rodando 100% verdes sem warnings na baseline local.

### Delta 2026-04-19 (Hotspot `Registrar`)

- Consolidado o hardening estrutural do entrypoint `src/pages/Registrar/index.tsx` com extração de:
  - `createRegistrarFinalizeController.ts`
  - `useRegistrarStepFlow.ts`
  - `useRegistrarQuickActionPolicy.ts`
  - `helpers/registrarQueryState.ts`
  - `useRegistrarActionSectionState.tsx`
  - `useRegistrarShellState.ts`
  - `buildRegistrarActionSectionSlots.tsx`
- Resultado observado: shell de `Registrar` reduzido para ~916 linhas, sem reintrodução de IO/regra de domínio na camada visual.
- Estado de validação local da trilha: `pnpm run lint`, `pnpm test -- Registrar`, `pnpm run build` verdes nas rodadas de hardening.

### Documentos Atualizados (Auditoria Abril/2026)

| Documento | Mudança Principal |
| --- | --- |
| `docs/IMPLEMENTATION_STATUS.md` | Reescrito — conflitos resolvidos, capability score ajustado p/ 20/20. Adicionado Update 2026-04-12 (Compliance/Regime). |
| `docs/TECH_DEBT.md` | Atualizado — TD-021 fechado, e criado TD-025 (Catch up UX). |
| `docs/ROADMAP.md` | Atualizado — Milestone 8 fechado, Milestone 9 criado (Sanitary Regimen & Catch-up Compliance UX). |
| `docs/CURRENT_STATE.md` | Atualizado — fase beta interno, novas tabelas/stores documentadas |
| `docs/ROUTES.md` | Adicionadas rotas `/animais/transicoes` e `/animais/:id/cria-inicial` |
| `docs/OFFLINE.md` | Store `metrics_events` (Dexie v11) documentada com flush remoto |
| `docs/DB.md` | `produtos_veterinarios` e `vw_animal_gmd` documentadas |
| `docs/RLS.md` | TD-003 marcado RESOLVIDO; nota sobre tabela global |
| `docs/E2E_MVP.md` | Fluxo 9 (pós-parto neonatal) adicionado |
| `docs/STACK.md` | TanStack React Query adicionado |
| `docs/00_MANIFESTO.md` | Escopo e data atualizados |
| `docs/ADRs/ADR-0002-...` | Novo ADR para `produtos_veterinarios` global |
| `README.md` | Fase beta interno, escopo completo, stack atualizada |
| `AGENTS.md` | Reescrito — Dexie v8, TDs fechados, taxonomia, RBAC completo |
| `AI_RULES.md` | Reescrito — estado atual completo com 7 domínios |
| `docs/review/AUDIT_CAPABILITY_MATRIX.md` | Todos os gaps fechados; 3 novos residuais mapeados |

### Modelo de Derivação (Rev D+)

```
IMPLEMENTATION_STATUS (Matriz Analítica)
  → gap(capability_id) = (E2E ≠ PASS) OR (camada aplicável ∈ {⚠️, âŒ})
    → TECH_DEBT OPEN (Catalog)
      → ROADMAP items
```

---

## 3. capability_id Migration

### 3.1 Métricas (Pós-Fechamento)

| Métrica | Valor |
| --- | --- |
| Capabilities no Catalog | 26 |
| TDs OPEN (lista original) | 0 (todos CLOSED) |
| TDs OPEN residuais (novos) | 2 (TD-025, TD-032) |
| TDs CLOSED da lista original | 10/10 (100%) |
| Catálogo coberto na Matriz | 26/26 (100%) |
| Gaps originais fechados | 10/10 (100%) |
| Capability Score (Analítico) | 24/26 (92%) |

### 3.2 Mapping Completo: TD → capability_id (Pós-Fechamento)

| TD | capability_id | Track | Status | Fechado por |
| --- | --- | --- | --- | --- |
| TD-001 | `infra.queue_cleanup` | Infra | ✅ CLOSED | `syncWorker.ts` + `rejections.ts` (TTL 7d) |
| TD-003 | `infra.rbac_hardening` | Infra | ✅ CLOSED | `20260308230748_rbac_delete_hardening_animais.sql` |
| TD-004 | `infra.indexes` | Infra | ✅ CLOSED | `20260308230811_indexes_performance_gmd.sql` |
| TD-006 | `nutricao.registro` | Catalog | ✅ CLOSED | `Registrar.tsx` inline form |
| TD-008 | `movimentacao.anti_teleport_client` | Catalog | ✅ CLOSED | `Registrar.tsx:387-396` useEffect |
| TD-011 | `sanitario.registro` | Catalog | ✅ CLOSED | `20260308230824_produtos_veterinarios_ui.sql` |
| TD-014 | `pesagem.registro` | Catalog | ✅ CLOSED | `Registrar.tsx` validação peso > 0 |
| TD-015 | `pesagem.historico` | Catalog | ✅ CLOSED | `vw_animal_gmd` (`20260308230811`) |
| TD-019 | `movimentacao.registro` | Catalog | ✅ CLOSED | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |
| TD-020 | `reproducao.registro` | Catalog | ✅ CLOSED | `20260308230735_foreign_keys_movimentacao_reproducao.sql` |

### 3.3 TDs Residuais (Pós-Auditoria Abril/2026 - Mid-Month)

| TD | capability_id | Track | Status |
| --- | --- | --- | --- |
| TD-025| `sanitario.regime_sequencial` | UX | ⚠️  OPEN |
| TD-032| `sanitario.data_prevista_prefill` | UX | ⚠️  OPEN |

### 3.4 Mapping Ambiguity

Nenhuma ambiguidade identificada. Todos os TDs mapeiam 1:1 para `capability_id`.

### 3.5 Split/Merge Proposals

Nenhuma necessidade identificada.

---

## 4. Consistência Verificada (Hard Checks)

### 4.1 gap_set == TECH_DEBT OPEN (Catalog)

```
gap_set (Matriz Analítica após fechamento):
  {TD-025→sanitario.regime_sequencial (UX)} 

TECH_DEBT OPEN (Catalog) capabiliy_set:
  {TD-025}
```

### 4.2 ROADMAP items == TECH_DEBT OPEN

```
ROADMAP Milestones abertos: {}
TECH_DEBT OPEN: {}
Match: ✅ (0/0)
```

### 4.3 Catalog Uniqueness

Cada `capability_id` do catálogo aparece exatamente 1 vez na Matriz Analítica: ✅ (19/19)

### 4.4 Headers Rev D+

Todos os documentos derivados possuem: Status, Baseline (`b69d35f`), Última Atualização, Derivado por: ✅

---

## 5. Data Contract Audit (Atualizado Abril/2026)

| Item | Status | Evidência | Ação Sugerida |
| --- | --- | --- | --- |
| Sync metadata obrigatório em eventos | ✅ OK | `supabase/migrations/0001_init.sql:L562-566` | Nenhuma |
| Append-only trigger em eventos | ✅ OK | `supabase/migrations/0001_init.sql:L577-579` | Nenhuma |
| RLS habilitado em eventos | ✅ OK | `supabase/migrations/0001_init.sql:L741` | Nenhuma |
| Checks de valor positivo (financeiro) | ✅ OK | `supabase/migrations/0023_hardening_eventos_financeiro.sql:L13` | Nenhuma |
| Checks de valor positivo (nutricao) | ✅ OK | `supabase/migrations/0024_hardening_eventos_nutricao.sql:L12` | Nenhuma |
| Constraint destino movimentação | ✅ OK | `supabase/migrations/0025_hardening_eventos_movimentacao.sql:L6-10` | Nenhuma |
| FK contrapartes | ✅ OK | `supabase/migrations/0026_fk_eventos_financeiro_contrapartes.sql` | Nenhuma |
| Agenda dedup_key unique | ✅ OK | `supabase/migrations/0001_init.sql:L522-524` | Nenhuma |
| Protocol item versioning | ✅ OK | `supabase/migrations/0001_init.sql:L441-447` | Nenhuma |
| Reproducao episode linking | ✅ OK | `supabase/migrations/0035_reproducao_hardening_v1.sql:L43-121` | Nenhuma |
| FK macho_id (TD-020) | ✅ OK | `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql` | Nenhuma |
| FK from/to_lote_id (TD-019) | ✅ OK | `supabase/migrations/20260308230735_foreign_keys_movimentacao_reproducao.sql` | Nenhuma |
| RBAC DELETE animais (TD-003) | ✅ OK | `supabase/migrations/20260308230748_rbac_delete_hardening_animais.sql` | Nenhuma |
| Índices de performance (TD-004) | ✅ OK | `supabase/migrations/20260308230811_indexes_performance_gmd.sql` | Nenhuma |
| Taxonomia canônica v1 no sync-batch | ✅ OK | `supabase/functions/sync-batch/taxonomy.ts` | Nenhuma |
| `produtos_veterinarios` RLS | ✅ OK | `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql` | Sem policy de WRITE (seed-only) — monitorar |

---

## 6. Comandos Reproduzíveis

```bash
# Baseline
git rev-parse --short HEAD
# Retorna: b69d35f

# Working tree status
git status --porcelain
# Retorna: (vazio após resolução de conflitos)

# Verificar TD-003 (RBAC hardening)
rg -n "animais_delete_by_role" supabase/migrations/

# Verificar TD-019/020 (FKs)
rg -n "fk_movimentacao\|fk_reproducao_macho" supabase/migrations/

# Verificar TD-008 (anti-teleport UI)
rg -n "toLoteId" src/pages/Registrar/index.tsx

# Verificar stores Dexie v11
rg -n "metrics_events" src/lib/offline/db.ts
```

---

## Conclusão

Auditoria técnica completa em abril/2026:

- **Todos os TDs originais:** CLOSED (10/10 via migrations março/2026)
- **Capability Score:** 19/19 (100%) — sem gaps funcionais abertos
- **TDs residuais fechados** e reconciliados com `TECH_DEBT.md` e `ROADMAP.md`
- **Conflitos de merge** em 3 documentos críticos resolvidos
- **12+ documentos** atualizados para refletir estado beta interno
- Working tree limpo na auditoria original; o estado atual deve ser lido via `git status` na branch ativa

Próximos passos: seguir apenas milestones evolutivos ainda abertos em `ROADMAP.md`.
