# Dívida Técnica (Tech Debt)

> **Status:** Derivado (Rev D+)
> **Baseline:** `d0278ce`
> **Última Atualização:** 2026-02-26
> **Derivado por:** Antigravity — capability_id Derivation Rev D+
> **Fonte:** `IMPLEMENTATION_STATUS.md` (Matriz Analítica), Código

Lista consolidada de débitos técnicos do RebanhoSync. Itens OPEN são separados em **Catalog** (com `capability_id` do catálogo, participam do score e derivação) e **Infra/Out-of-catalog** (fora do score, mantidos por compatibilidade).

---

## OPEN (Catalog) — 5 items

> Estes TDs possuem `capability_id` do Capability Catalog e participam da derivação mecânica (gap_set → ROADMAP).

### 🟠 P1 (Importante - 4 items)

#### TD-011: Produtos Sanitários TEXT Livre

- **capability_id:** `sanitario.registro`
- **Domínio:** sanitario
- **Risco:** Consistência (Typos, duplicatas)
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `eventos_sanitario.produto` é TEXT sem normalização.
- **Ação:** (Opcional/Nice-to-Have) Criar catálogo básico `produtos_veterinarios`.
- **Critério de Aceite:**
  - [ ] UI sugere produtos comuns (autocomplete).
  - [ ] Relatórios não quebram por typos.
  - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)

#### TD-014: Validação de Peso no Frontend

- **capability_id:** `pesagem.registro`
- **Domínio:** pesagem
- **Risco:** Usabilidade (UX degradada)
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `Registrar.tsx` (pesagem) permite envio de peso <= 0 (servidor rejeita).
- **Ação:** Adicionar validação `peso > 0` antes do submit.
- **Critério de Aceite:**
  - [ ] Botão Submit desabilitado se peso <= 0.
  - [ ] Mensagem de erro clara no form.
  - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)

#### TD-019: Foreign Keys Faltantes (Movimentação)

- **capability_id:** `movimentacao.registro`
- **Domínio:** movimentacao
- **Risco:** Integridade Referencial
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `eventos_movimentacao` (from/to_lote_id) sem FOREIGN KEY.
- **Ação:** Adicionar FKs `eventos_movimentacao(from_lote_id) → lotes(id)` e `to_lote_id`.
- **Critério de Aceite:**
  - [ ] FK constraints impedem referências inválidas.
  - [ ] Migrations reversíveis (rollback seguro).
  - **Fluxo E2E:** Operacional (Fluxo 7)

#### TD-020: Foreign Key macho_id Faltante (Reprodução)

- **capability_id:** `reproducao.registro`
- **Domínio:** reproducao
- **Risco:** Integridade Referencial
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `eventos_reproducao.macho_id` sem FOREIGN KEY para `animais`.
- **Ação:** Adicionar FK `eventos_reproducao(macho_id) → animais(id)`.
- **Critério de Aceite:**
  - [ ] FK constraint impede referências inválidas.
  - [ ] Migrations reversíveis.
  - **Fluxo E2E:** Operacional (Fluxo 7)

---

### 🟡 P2 (Melhoria - 1 item)

#### TD-015: Cálculo de GMD em Memória

- **capability_id:** `pesagem.historico`
- **Domínio:** pesagem
- **Risco:** Scalability
- **Status:** 🟡 **OPEN** (P2)
- **Evidência:** Dashboard carrega todo histórico para calcular ganho médio.
- **Ação:** Materializar GMD no evento ou criar View agregada.
- **Critério de Aceite:**
  - [ ] Dashboard carrega em < 2s com 5000 animais.
  - **Fluxo E2E:** Operacional (Fluxo 7)

---

## OPEN (Infra/Out-of-catalog) — 2 items

> Estes TDs são infraestruturais, fora do Capability Catalog. Não participam do `capability_score` nem do `gap_set`. Registrados como `NEW (Proposed)` no `RECONCILIACAO_REPORT`. Mantidos por compatibilidade histórica e continuam no ROADMAP por TD-ID.

### 🟠 P1 (Importante - 1 item)

#### TD-003: RLS DELETE sem Restrição de Role

- **capability_id:** `infra.rbac_hardening` _(NEW Proposed — fora do Catalog)_
- **Domínio:** platform
- **Risco:** Integridade de Dados (Cowboy pode deletar animais)
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** Policy `DELETE` em `animais` não filtra por role.
- **Ação:** Adicionar `WHERE role IN ('owner', 'manager')` na policy DELETE.
- **Critério de Aceite:**
  - [ ] Cowboy recebe erro 403 ao tentar DELETE animal.
  - [ ] Owner/Manager conseguem DELETE normalmente.
  - **Fluxo E2E:** RBAC (Fluxo 1)

---

### 🟡 P2 (Melhoria - 1 item)

#### TD-004: Índices de Performance Faltantes

- **capability_id:** `infra.indexes` _(NEW Proposed — fora do Catalog)_
- **Domínio:** platform
- **Risco:** Scalability
- **Status:** 🟡 **OPEN** (P2)
- **Evidência:** Queries de dashboard sem índices compostos.
- **Ação:** Criar índices `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)`.
- **Critério de Aceite:**
  - [ ] Dashboard carrega em < 2s com 5000 animais.
  - **Fluxo E2E:** Operacional (Fluxo 7)

---

## 🟩 CLOSED (Resolvidos - 3 items)

### TD-001: Limpeza de Queue Rejections (Offline) ✅ CLOSED

- **capability_id:** `infra.queue_cleanup` _(Infra — fora do Catalog)_
- **Domínio:** platform
- **Risco:** N/A (resolvido)
- **Status:** ✅ **CLOSED** (2026-02-26)
- **Evidência Original:** `src/lib/offline/syncWorker.ts` não possuía rotina de expurgo.
- **Solução:** Implementado TTL 7d auto-purge, UI de revisão/export, backfill de registros legados.
- **Evidência Real:**
  - `src/lib/offline/db.ts` — Schema v7 com `created_at` + `[fazenda_id+created_at]` + `.upgrade()` backfill
  - `src/lib/offline/rejections.ts` — API DLQ (list/stats/export/purge) index-backed
  - `src/lib/offline/syncWorker.ts` — Auto-purge throttled 6h via localStorage
  - `src/pages/Reconciliacao.tsx` — UI com stats, paginação cursor, dialog, export JSON, bulk purge dryRun
  - `src/lib/offline/__tests__/rejections.test.ts` — 10 testes unitários

**Critério de Aceite (DONE):**

- [x] DLQ não cresce indefinidamente (auto-purge >7d).
- [x] Usuário consegue visualizar/exportar rejeições antes do expurgo.
- [x] Purge index-backed (sem full scan).
- [x] UI paginada com cursor.
- [x] Testes unitários passam.

### TD-008: Validação Anti-Teleport no Frontend ✅ CLOSED

- **capability_id:** `movimentacao.anti_teleport_client`
- **Domínio:** movimentacao
- **Risco:** N/A (resolvido)
- **Status:** ✅ **CLOSED** (2026-02-17)
- **Evidência Original:** `Registrar.tsx` permitia seleção de lote destino igual à origem.
- **Solução:** Implementado `useEffect` em `Registrar.tsx` que monitora `selectedLoteId` e reseta `toLoteId` se houver colisão.
- **Evidência Real:**
  - `src/pages/Registrar.tsx:382+` - useEffect de reset.
  - `src/lib/events/__tests__/validators.test.ts` - Teste de validação.
  - `src/pages/__tests__/Registrar.test.tsx` - Teste de UI.

**Critério de Aceite (DONE):**

- [x] UI impede seleção origem==destino (reset automático).
- [x] Testes unitários cobrem o cenário.
- [x] **Fluxo E2E:** Anti-Teleporte - VALIDADO

### TD-006: UI de Nutrição ✅ CLOSED

- **capability_id:** `nutricao.registro`

**Descoberta:** UI de Nutrição **JÁ ESTAVA IMPLEMENTADA** em `Registrar.tsx`.

- **Domínio:** nutricao
- **Risco:** N/A (resolvido)
- **Status:** ✅ **CLOSED** (2026-02-16)
- **Evidência Original (falsa):** Grep por `NutricaoForm` retornava 0 resultados (buscava component separado).
- **Evidência Real (positiva):**
  - `Registrar.tsx:674-684` - Event builder input para nutrição
  - `Registrar.tsx:1113-1143` - Form inline (alimentoNome, quantidadeKg)
  - `buildEventGesture.ts:87-97` - Builder eventos_nutricao
  - `migrations/0001_init.sql:632` - Tabela eventos_nutricao
  - `db.ts:event_eventos_nutricao` - Dexie store

**Escopo MVP Confirmado:**

- ✅ Registro de alimento fornecido (nome + quantidade_kg)
- ✅ Suporte animal/lote
- ✅ Sync offline→online funcional
- ✅ Histórico de eventos mostra nutrição
- ❌ SEM gestão de estoque/inventário/compras (conforme decisão de produto)

**Critério de Aceite (DONE):**

- [x] Formulário Nutrição renderiza em `/registrar` (tipoManejo === "nutricao").
- [x] Evento criado offline aparece em `state_eventos` e `event_eventos_nutricao`.
- [x] Gesture criado com status `PENDING`.
- [x] Sync aplica evento no servidor (200 OK, status `APPLIED`).
- [x] Histórico mostra evento de nutrição após sync.
- [x] **Fluxo E2E:** Nutrição (Fluxo 8) - VALIDADO

**Lição Aprendida:** UI inline no `Registrar.tsx` (não component separado `NutricaoForm.tsx`). Grep deve buscar por `tipoManejo === "nutricao"` além de components.

---

## Veja Também

- [**IMPLEMENTATION_STATUS.md**](./IMPLEMENTATION_STATUS.md) - Matriz Analítica (fonte de derivação)
- [**ROADMAP.md**](./ROADMAP.md) - Planejamento (derivado de TECH_DEBT OPEN)
- [**E2E_MVP.md**](./E2E_MVP.md) - Fluxos de validação
