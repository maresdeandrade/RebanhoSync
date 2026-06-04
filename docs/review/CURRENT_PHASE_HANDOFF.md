# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-02
**Baseline Commit:** `3fe7a81`

## 1. Fase atual

Fase 9 — Gate Pós-MVP Comercial/Patrimonial/Classificação/Custo / Subfase 9A — Inventário Operacional.

---

## 2. Estado consolidado

Fases 1-8 foram concluídas e consolidadas em baseline `3fe7a81` (2026-06-02).

**Fase 6 (Sanitário):** Carência, protocolo, evento separados, append-only validada, replay corretivo com idempotência.

**Fase 7 (Preparação de PR + Auditoria de Regressão):** Validação de diff, lint, build, reconciliação de documentação, confirmação de que nenhuma feature nova entrou no patch.

**Fase 8 (Formalização do Fallback Legado Sanitário):** Normalização de payload legado como `partial`, validação de reversão/rollback, limpeza de warnings não bloqueantes, suite de 1744 testes passando.

**Consolidado em 3fe7a81:**

- Sanitário: append-only, payload mínimo corretivo, evento original preservado
- Sociedade: vínculo patrimonial, sem autorização automática
- Estoque/Inventário: básico, pronto para Fase 9 expansão
- Testes: 1744 testes passando, RLS baseline validada
- Sync: offline-first, Dexie + RPCs, idempotência confirmada

Referência completa: Ler `docs/review/ACTIVE_PHASE_PLAN.md` e `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md`.

---

## 3. Objetivo de transição

Levar a linha de desenvolvimento à Subfase 9A com:

- foco em inventário operacional;
- unidade de compra/apresentação claramente convertida para base;
- custo operacional registrado como valor conhecido ou ausência;
- snapshot econômico preservado;
- baixa idempotente;
- sociedade patrimonial isolada por RLS;
- classificação operacional apresentada como leitura apenas.

---

## 4. Pendências abertas

Fases 6-8 estão fechadas sem pendências bloqueantes.

Itens residuais não bloqueantes (já documentados):

```txt
docs/review/OPEN_REVIEW_ITEMS.md
```

P2 items (não bloqueiam Fase 9):

1. Ruído residual em `stderr/stdout` de testes
2. Warnings conhecidos de build
3. Dialog/act avisos em testes

---

## 5. Próximo objetivo

Implementar Subfase 9A — Inventário Operacional.

Referências obrigatórias:

- `docs/review/ACTIVE_PHASE_PLAN.md` — diagnóstico rápido e checklist
- `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md` — especificação completa

Antes de iniciar Subfase 9A:

- Confirmar baseline `3fe7a81` está estável (testes, lint, build passam)
- Ler `ACTIVE_PHASE_PLAN.md` para confirmações obrigatórias
- Ler `PLANO_FASE_9_*.md` para contratos completos
- Confirmar escopo (9A: unidade, custo, snapshot, baixa idempotente, isolamento sociedade, classificação read-only)

---

## 6. Escopo permitido em Fase 9A

Permitido em Subfase 9A:

- Leitura de `docs/review/ACTIVE_PHASE_PLAN.md` e `PLANO_FASE_9_*.md`
- Implementação de conversão de unidade (apresentação -> base)
- Implementação de custo operacional (ausência != zero)
- Implementação de snapshot econômico (imutável)
- Implementação de baixa idempotente (retry-safe)
- Testes e validação de idempotência
- Isolamento de sociedade patrimonial por RLS
- Leitura de classificação operacional (read-only snapshot)

Obrigatório:

- Respeitar contrato de domínio (6 regras em `PLANO_FASE_9_*.md`)
- Não alterar migrations/RLS/RPCs sem tarefa explícita
- Executar validação completa antes de aceitar

---

## 7. Escopo proibido em Fase 9A

Não fazer em Subfase 9A:

- Feature nova fora de 9A (venda, abate, relatórios completos, KPIs avançados)
- Alteração de contrato Sanitário, Agenda, Evento, Protocolo
- Automação sem fonte técnica explícita
- Edição destrutiva de histórico
- Alteração de RLS/migrations/RPCs sem tarefa explícita
- Transformações não permitidas (snapshot retroativo, custo ambíguo, duplicação de baixa)
- Refatoração não solicitada

---

## 8. Áreas candidatas para trabalho em Fase 9A

Áreas a trabalhar em Subfase 9A:

```txt
src/lib/inventory (conversão de unidade, custo, snapshot, baixa)
src/lib/comercial (isolamento de sociedade patrimonial)
src/features/inventario (UI para registros, leitura de classificação)
src/pages/Registrar (fluxo de compra/inventário)
tests/ (testes de idempotência, isolamento, snapshot)
docs/domain/COMPRA_VENDA.md (atualizar com contratos 9A)
```

Áreas protegidas (não tocar sem tarefa explícita):

```txt
supabase/migrations (RLS existente é fonte de verdade)
supabase/functions (sync, RPCs offline)
src/lib/sanitario (Fase 6 consolidada)
src/lib/eventos (Fase 6-8 consolidada)
```

---

## 9. Validação baseline (Fases 6-8)

Fases 6-8 foram validadas e aprovadas em baseline `3fe7a81`:

```bash
pnpm test -- --run     # 259 files, 1744 tests passed
pnpm run lint          # passed
pnpm run build         # passed (known warnings)
git diff --check       # passed
```

Baseline estável confirmado. Fase 9A começa a partir deste ponto.

---

## 10. Validação obrigatória para Subfase 9A

Antes de aceitar Subfase 9A, executar:

```bash
pnpm test -- --run 2>&1 | tail -10        # Testes devem passar (1744+N)
pnpm run lint 2>&1                        # Lint deve passar
pnpm run build 2>&1                       # Build deve passar
git diff --check                          # Sem trailing whitespace

# Validação Supabase RLS (se disponível)
node scripts/codex/validate-supabase-baseline-functional.mjs

# Auditoria de contratos (commands de PLANO_FASE_9_*.md)
git grep -n "multiplicador\|idempotent\|society" -- src/
```

Checklist de aceite (ver `docs/review/ACTIVE_PHASE_PLAN.md`):

- [ ] 7 confirmações de diagnóstico passam
- [ ] 10 critérios de aceite de ACTIVE_PHASE_PLAN marcados
- [ ] 6 contratos obrigatórios implementados
- [ ] Todos os 11 critérios de PLANO_FASE_9_*.md marcados
- [ ] Sem regressões em testes existentes
