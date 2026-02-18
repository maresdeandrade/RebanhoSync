# Processo de Desenvolvimento (DevOS) — Capability-Centric

> **Status:** Normativo
> **Fonte de Verdade (Execução):** GitHub (PRs, Issues, Projects)
> **Fonte de Verdade (Análise):** docs/IMPLEMENTATION_STATUS.md → docs/TECH_DEBT.md → docs/ROADMAP.md → docs/review/RECONCILIACAO_REPORT.md
> **Última Atualização:** <YYYY-MM-DD>

Este documento define o sistema operacional de desenvolvimento do RebanhoSync, com governança capability-centric usando `capability_id` como join key determinístico.

## 0) Princípio central

**Toda mudança de código deve mapear para um `capability_id` (Catalog) ou `infra.*` (Out-of-catalog).**  
O conjunto de gaps é definido mecanicamente na Matriz Analítica e deriva TECH_DEBT e ROADMAP. 

---

## 1) Taxonomia de documentos

### 1.1 Normativo (decide)
- Define contrato/arquitetura/planos.
- Mudança exige decisão explícita (ADR quando alterar contrato/arquitetura).

### 1.2 Derivado (mede)
- Atualizado via processo governado (regen).
- Deve conter header com Baseline consistente.
- Exemplos do projeto (Rev D+):
  - `docs/IMPLEMENTATION_STATUS.md` :contentReference[oaicite:2]{index=2}
  - `docs/TECH_DEBT.md` :contentReference[oaicite:3]{index=3}
  - `docs/ROADMAP.md` :contentReference[oaicite:4]{index=4}
  - `docs/review/RECONCILIACAO_REPORT.md` :contentReference[oaicite:5]{index=5}

---

## 2) Fonte de verdade analítica (derivação mecânica)

### 2.1 Regra única de gap
`gap(capability_id) = (E2E ≠ PASS) OR (qualquer camada aplicável ∈ {⚠️, ❌})`

- Camadas `—` (N/A) não contam como gap e não geram Tech Debt. :contentReference[oaicite:6]{index=6}

### 2.2 Pipeline de derivação
IMPLEMENTATION_STATUS (Matriz Analítica)
→ gap_set(capability_id)
→ TECH_DEBT OPEN (Catalog)
→ ROADMAP (6 semanas)

Consistência é verificada no RECONCILIACAO_REPORT (hard checks). :contentReference[oaicite:7]{index=7}

---

## 3) GitHub Projects como “espelho operacional”

### 3.1 Fonte de verdade vs execução
- **Docs** são a verdade do que está OPEN/CLOSED e do porquê (evidência).
- **GitHub Projects** organiza trabalho diário (status, prioridade, sequência).

### 3.2 Convenção de títulos (obrigatória)
**Issues/PRs devem incluir `capability_id` no título:**
- Formato: `[<capability_id>] <resumo curto>`
- Ex.: `[movimentacao.anti_teleport_client] bloquear origem==destino no UI`

---

## 4) Fluxo padrão (solo)

### 4.1 Selecionar trabalho
1) Escolha um item em `TECH_DEBT OPEN` (Catalog ou Infra). :contentReference[oaicite:8]{index=8}
2) Crie/atualize a Issue correspondente no GitHub (com `capability_id` e severidade).

### 4.2 Implementar
- Faça mudanças em `src/**`, `supabase/migrations/**`, `supabase/functions/**` conforme necessário.
- Garanta que toda mudança se conecta ao `capability_id` alvo.

### 4.3 Quality Gates (antes do PR)
- **Gate A: Baseline/Tree**
  - working tree clean para regen de docs derivadas.
- **Gate B: Derivação**
  - `gap_set == TECH_DEBT OPEN (Catalog)`
  - `ROADMAP == TECH_DEBT OPEN (Catalog + Infra)`
- **Gate C: Contratos/Segurança**
  - se tocar em migrations/functions/sync, atualizar evidências e reconciliação.

### 4.4 Regen de derivados (quando tocar em código)
- Atualize derivados na ordem:
  1) IMPLEMENTATION_STATUS
  2) TECH_DEBT
  3) ROADMAP
  4) RECONCILIACAO_REPORT
- Confirme hard checks na reconciliação. :contentReference[oaicite:9]{index=9}

### 4.5 Definition of Done (DoD)
Um item (Issue/Project card) só pode ir para **Done** quando:
- o `capability_id` deixa de estar no `gap_set` (ou item Infra é resolvido e marcado CLOSED), e
- o regen move o item para CLOSED/resolve o gap na matriz, e
- a reconciliação confirma consistência. 

---

## 5) Regras para Infra/Out-of-catalog

- `infra.*` não entra no `capability_score` nem no `gap_set`.
- Continua sendo trabalho válido (impacta estabilidade), aparece em TECH_DEBT e ROADMAP como trilha Infra. 

---

## 6) ADRs (quando usar)
Crie ADR quando:
- mudar contrato de sync/ordering/dedup/reason codes,
- mudar modelo de dados canônico,
- mudar invariants de RLS/RPC,
- alterar baseline normativo (ex.: matriz canônica/plano unificação).

Template em `docs/ADRs/ADR-0000-template.md`.

---
