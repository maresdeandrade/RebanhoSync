---
paths:
  - "docs/**"
  - "README.md"
  - "AGENTS.md"
---

# RebanhoSync — Documentation Rules

Leia primeiro:
1. `docs/PROCESS.md`
2. `docs/CURRENT_STATE.md`

Taxonomia documental:
- Snapshot operacional:
  - `README.md`
  - `docs/CURRENT_STATE.md`
  - `docs/STACK.md`
  - `docs/ROUTES.md`
  - `docs/REPO_MAP.md`
- Normativo:
  - `ARCHITECTURE`
  - `OFFLINE`
  - `CONTRACTS`
  - `DB`
  - `RLS`
  - `PROCESS`
- Derivado:
  - `IMPLEMENTATION_STATUS`
  - `TECH_DEBT`
  - `ROADMAP`
  - `RECONCILIACAO_REPORT`
- Histórico:
  - `docs/archive/**`

Regras:
- Não atualizar docs derivados sem delta funcional real.
- Não usar histórico como fonte operacional.
- Não reescrever todos os docs por reflexo.
- Atualizar docs normativos quando contrato/arquitetura/regra estrutural mudar.
- Atualizar docs derivados só quando capability, gap, fase ou dívida mudarem de fato.

Ordem dos derivados quando aplicável:
1. `docs/IMPLEMENTATION_STATUS.md`
2. `docs/TECH_DEBT.md`
3. `docs/ROADMAP.md`
4. `docs/review/RECONCILIACAO_REPORT.md`

Abrir ADR quando a mudança alterar:
- contrato do sync
- ordering / deduplicação / status codes
- modelo canônico
- RLS / RBAC / RPC estrutural
- offline-first / Two Rails
- regra normativa que passa a orientar o produto