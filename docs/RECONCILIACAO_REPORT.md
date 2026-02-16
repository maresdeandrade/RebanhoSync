# Relatório de Reconciliação - Estágio Real do RebanhoSync

> **Data:** 2026-02-16
> **Commits:** 5709923 (status), 4c46c5c (tech_debt), 1795969 (roadmap)
> **Responsável:** Antigravity Agent (Automated Reconciliation)

---

## 1. Objetivo da Reconciliação

Reconstruir a visão do "estágio real" do RebanhoSync a partir do código fonte verificável e reconciliar a documentação derivada (TECH_DEBT e ROADMAP) para refletir apenas o que está **OPEN** (pendente).

---

## 2. Documentos Criados/Atualizados

### 2.1 docs/IMPLEMENTATION_STATUS.md (NOVO)

**Status:** Derivado
**Commit:** 5709923

Matriz única de verdade sobre o que existe efetivamente implementado. Cada claim possui evidência verificável com path de arquivo ou migration.

**Estrutura:**

- 15 seções de domínio (Auth, RBAC, Offline, Sync-Batch, Entidades, Agenda, Eventos por tipo, UI, Performance, Segurança)
- Colunas: Feature | DB | Server | Offline | UI | E2E | Evidência | Notas
- Legenda: ✅ DONE | ⚠️ PARTIAL | ❌ MISSING

**Principais Descobertas:**

- **Reprodução:** Completamente implementado (Component, Dashboard, Linking, Status Computation)
- **Nutrição:** DB/Server/Offline exist, mas sem UI
- **Anti-Teleport:** Server valida, Frontend não bloqueia
- **Queue Cleanup:** Sem rotina de limpeza automática

### 2.2 docs/TECH_DEBT.md (ATUALIZADO)

**Status:** Derivado (Reconciliado)
**Commit:** 4c46c5c

**Mudanças Principais:**

| Item                             | Status Anterior | Status Atual     | Justificativa                                                                                          |
| -------------------------------- | --------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| **TD-007** (UI Reprodução)       | OPEN (P0)       | ✅ **DONE**      | `ReproductionForm.tsx`, `reproduction/*`, `migrations/0035`, `ReproductionDashboard.tsx` implementados |
| **TD-001** (Queue Cleanup)       | OPEN (P0)       | 🔴 **OPEN** (P0) | Confirmado: Grep em `syncWorker.ts` não encontra rotina de limpeza                                     |
| **TD-006** (UI Nutrição)         | OPEN (P0)       | 🔴 **OPEN** (P0) | Confirmado: Schema/Dexie/buildGesture existem, mas sem formulário                                      |
| **TD-008** (Anti-Teleport Local) | OPEN (P0)       | 🔴 **OPEN** (P0) | Confirmado: Server valida, UI não desabilita origem==destino                                           |
| **TD-003** (Delete por Cowboy)   | OPEN (P1)       | 🟠 **OPEN** (P1) | Confirmado: RLS não restringe DELETE                                                                   |
| **TD-011** (Produto TEXT)        | OPEN (P1)       | 🟠 **OPEN** (P1) | Confirmado: `eventos_sanitario.produto` é TEXT                                                         |
| **TD-014** (Validação Peso)      | OPEN (P1)       | 🟠 **OPEN** (P1) | Confirmado: DB tem CHECK, frontend não valida                                                          |
| **TD-019** (FKs Movimentação)    | OPEN (P1)       | 🟠 **OPEN** (P1) | Confirmado: from_lote_id/to_lote_id sem FK                                                             |
| **TD-020** (FK Macho)            | OPEN (P1)       | 🟠 **OPEN** (P1) | Confirmado: macho_id sem FK                                                                            |
| **TD-004** (Índices)             | OPEN (P2)       | 🟡 **OPEN** (P2) | Confirmado: migrations/0018 parcial                                                                    |
| **TD-015** (GMD Memória)         | OPEN (P2)       | 🟡 **OPEN** (P2) | Confirmado: Dashboard client-side calc                                                                 |

**Novas Seções:**

- 🟩 **Recentemente Resolvido** - Para manter histórico de itens DONE
- Todos os itens OPEN agora têm badge de status: 🔴 P0 | 🟠 P1 | 🟡 P2
- Épicos revisados para refletir apenas OPEN tech debt

### 2.3 docs/ROADMAP.md (ATUALIZADO)

**Status:** Derivado (Planejamento)
**Commit:** 1795969

**Mudanças Principais:**

**M0: Estabilização Crítica (Semanas 1-2)**

- **Removido:** TD-007 (Reprodução) - já implementado ✅
- **Removido:** TD-003, TD-014 - movidos para M1 (não-bloqueantes)
- **Mantido:** TD-001, TD-006, TD-008 (P0 OPEN)
- **Adicionado:** Breakdown semanal
  - Semana 1: TD-001 + TD-008
  - Semana 2: TD-006 + testes E2E

**M1: Consistência Operacional (Semanas 3-4)**

- **Adicionado:** TD-003, TD-014 (de M0)
- **Removido:** TD-011 (movido para M2 opcional)
- **Mantido:** TD-019, TD-020 (FKs)
- **Adicionado:** Breakdown semanal
  - Semana 3: TD-014 + TD-003 + testes RBAC
  - Semana 4: TD-019 + TD-020 + testes FK

**M2: Performance (Semanas 5-6)**

- **Mantido:** TD-004, TD-015 (P2)
- **Adicionado:** TD-011 como opcional (nice to have)
- **Adicionado:** Breakdown semanal
  - Semana 5: Índices + medição
  - Semana 6: GMD view + TD-011 opcional

---

## 3. Evidências de Mudanças de Status

### ✅ TD-007: UI de Reprodução (OPEN → DONE)

**Evidência Completa:**

1. **Component Dedicado:**
   - `src/components/events/ReproductionForm.tsx` (9937 bytes)

2. **Integração em Registrar:**
   - `src/pages/Registrar.tsx:L14-16` (import)
   - `src/pages/Registrar.tsx:L1461-1469` (render)
   - `src/pages/Registrar.tsx:L729-782` (event builder)

3. **Módulo Completo:**
   - `src/lib/reproduction/linking.ts` (Episode linking)
   - `src/lib/reproduction/status.ts` (Status computation)
   - `src/lib/reproduction/categorias.ts` (Domain categories)

4. **Validações Server-Side:**
   - `migrations/0035_reproducao_hardening_v1.sql` (6393 bytes)
     - Validate episode linking
     - Enforce macho_id for cobertura/IA
     - Check unlinked parto

5. **Dashboard:**
   - `src/pages/ReproductionDashboard.tsx` (12253 bytes)

6. **Reporting Views:**
   - `migrations/0036_reproducao_views_v1.sql`
     - `prenhez_stats_report`
     - `tx_ia_report`

**Conclusão:** Totalmente implementado. Todos os critérios de aceite satisfeitos.

### 🔴 TD-006: UI de Nutrição (OPEN - Confirmado)

**Evidência de Gap:**

1. **DB Schema Exists:** ✅
   - `migrations/0001_init.sql:L632` - `create table eventos_nutricao`

2. **Dexie Store Exists:** ✅
   - `src/lib/offline/db.ts:event_eventos_nutricao`

3. **Event Builder Exists:** ✅
   - `src/lib/events/buildEventGesture.ts:L674-684` (nutricao domain)

4. **UI Component Missing:** ❌
   - Grep `NutricaoForm src/pages` → Nenhum resultado
   - `Registrar.tsx` não possui bloco `tipoManejo === "nutricao"`

**Conclusão:** Backend completo, UI faltando. Gap confirmado.

### 🔴 TD-001: Queue Cleanup (OPEN - Confirmado)

**Evidência de Gap:**

1. **Queue Rejections Table Exists:** ✅
   - `src/lib/offline/db.ts:queue_rejections`

2. **Cleanup Routine Missing:** ❌
   - Grep `delete.*queue_rejections src/lib/offline/syncWorker.ts` → Nenhum resultado
   - Não existe job automático ou UI de limpeza

**Conclusão:** Sem rotina de expurgo. Risk de crescimento infinito. Gap confirmado.

### 🔴 TD-008: Anti-Teleport Local (OPEN - Confirmado)

**Evidência de Gap:**

1. **Server Validation Exists:** ✅
   - `supabase/functions/sync-batch/rules.ts:prevalidateAntiTeleport` (L149-249)
   - Rejeita UPDATE animais.lote_id sem evento de movimentacao

2. **Frontend Validation Missing:** ❌
   - `Registrar.tsx:MovimentacaoForm` não desabilita lote de origem no Select destino
   - UI permite selecionar origem == destino, servidor rejeita

**Conclusão:** Proteção server-side OK, UX ruim no frontend. Gap confirmado.

---

## 4. Priorização Revisada

### Antes da Reconciliação:

- M0 tinha 6 itens (incluindo TD-007 já feito)
- Sem granularidade semanal
- Épicos incluíam items DONE (E-022: Reprodução)

### Depois da Reconciliação:

- **M0:** 3 itens P0 OPEN (Semanas 1-2)
- **M1:** 4 itens P1 OPEN (Semanas 3-4)
- **M2:** 2 itens P2 OPEN + 1 opcional (Semanas 5-6)
- **Total:** 9 OPEN, 1 DONE removido
- **Épicos:** Todos baseados em OPEN tech debt

---

## 5. Fluxos E2E Impactados

| Fluxo E2E                   | Tech Debt Relacionado  | Milestone | Status                |
| --------------------------- | ---------------------- | --------- | --------------------- |
| Fluxo 2 (Offline→Sync)      | TD-001                 | M0        | ⚠️ Falta cleanup      |
| Fluxo 3 (Anti-Teleporte)    | TD-008, TD-019         | M0, M1    | ⚠️ Falta validação UI |
| Fluxo 6 (Hardening Eventos) | TD-006, TD-014, TD-020 | M0, M1    | ⚠️ Falta UI Nutrição  |
| Fluxo 1 (RBAC)              | TD-003                 | M1        | ⚠️ Delete Cowboy      |
| Fluxo 7 (Operacional)       | TD-004, TD-015         | M2        | ⚠️ Performance        |

---

## 6. Recomendações Finais

1. **Manter docs/IMPLEMENTATION_STATUS.md como fonte de verdade derivada única.**
   - Atualizar após cada sprint/milestone.
   - Sempre anexar evidência verificável (path + símbolo).

2. **TECH_DEBT.md deve refletir apenas OPEN.**
   - Mover itens DONE para seção "Recentemente Resolvido".
   - Remover completamente após 1 release.

3. **ROADMAP.md deve ter granularidade semanal.**
   - Cada semana: 2-3 itens máximo.
   - Cross-reference com E2E flows.

4. **Commitar IMPLEMENTATION_STATUS após cada marco importante.**
   - Exemplo: Após cada merge de feature, atualizar matriz.

---

## 7. Estatísticas da Reconciliação

- **Documentos Criados:** 1 (IMPLEMENTATION_STATUS.md)
- **Documentos Atualizados:** 2 (TECH_DEBT.md, ROADMAP.md)
- **Commits:** 3
- **Itens Reclassificados:** 1 (TD-007: OPEN → DONE)
- **Itens Confirmados OPEN:** 9
- **Épicos Revisados:** 5 (E-020 a E-024)
- **Milestones Revisados:** 3 (M0, M1, M2)
- **Semanas Planejadas:** 6

---

## Assinatura

Este relatório foi gerado automaticamente pelo Antigravity Agent em 2026-02-16 como parte da missão de Reconciliação do Estágio Real do RebanhoSync.

**Próximos Passos:**

1. Revisar IMPLEMENTATION_STATUS.md para garantir precisão das evidências.
2. Iniciar M0 (Semana 1) com foco em TD-001 e TD-008.
3. Atualizar E2E_MVP.md para marcar explicitamente fluxos "Planejado - Mx" quando apropriado (opcional).
