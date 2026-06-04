# ACTIVE_PHASE_PLAN — Fase 9 Subfase 9A

**Status:** Próxima a iniciar
**Commit Baseline:** `3fe7a81`
**Criado:** 2026-06-02

---

## Objetivo em 1 parágrafo

Consolidar a base comercial e patrimonial da fazenda após Fase 8, validar custo operacional por inventário,
garantir idempotência de baixa, isolamento de sociedade patrimonial, e preparar sistema para leitura de
classificação operacional (sem alterar estado).

---

## Diagnóstico obrigatório — 7 confirmações

```bash
# 1. Fases anteriores OK?
git log --oneline -20 | head -1

# 2. Migrations atualizadas?
git status supabase/migrations | grep nothing

# 3. RLS policies ativas?
git grep "CREATE POLICY" -- supabase/migrations | grep -c "fazenda_id"

# 4. Testes passando?
pnpm run test 2>&1 | tail -3

# 5. Lint limpo?
pnpm run lint 2>&1 | grep -E "error|warning" | wc -l

# 6. Build compila?
pnpm run build 2>&1 | tail -2

# 7. Diff clean?
git diff --check && echo "OK"
```

---

## Escopo permitido

- Leitura de documentação de Fase 9 (PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md)
- Implementação de Subfase 9A conforme especificação
- Testes unitários para conversão de unidade, custo, snapshot
- Validação de idempotência de baixa
- Isolamento de sociedade patrimonial
- Leitura de classificação (sem alteração de estado)

---

## Escopo proibido

- Refatoração de testes existentes sem tarefa explícita
- Alteração de RLS/migrations/seed
- Mudança de contrato de Agenda/Eventos/Protocolo
- Feature nova fora de Subfase 9A
- Automação sem fonte técnica explícita

---

## Validação obrigatória

1. `pnpm run test` — Todos os testes passam
2. `pnpm run lint` — Sem erros novos
3. `pnpm run build` — Compila sem warnings críticos
4. `git diff --check` — Sem trailing whitespace
5. Testes de idempotência passam (retry de baixa não duplica)
6. Isolamento de sociedade validado em RLS
7. Classificação é leitura apenas (read-only snapshot)

---

## Critério de aceite — 10 itens

1. Conversão de unidade (compra/apresentação -> base) funciona e é testada
2. Entrada de custo segue modelo operacional (ausência != zero)
3. Snapshot econômico preservado (sem recálculo retroativo)
4. Baixa de inventário é idempotente (retry não duplica)
5. Sociedade patrimonial isolada por RLS e visão
6. Classificação operacional é leitura apenas (não altera estado)
7. Testes cobrem fluxo completo (compra, custo, snapshot, classificação)
8. Documentação interna reflete contrato (comentários de código)
9. Não há warn do TypeScript ou ESLint em código novo
10. git diff --check passa sem erros

---

## Resultado esperado — Estado final

Ao fim de Subfase 9A:

- Unidade de compra/apresentação convertida corretamente para base
- Custo registrado sem ambiguidade (ausência != zero, valor explícito)
- Snapshot econômico preservado (histórico imutável)
- Baixa de inventário retry-safe (idempotência confirmada em testes)
- Sociedade patrimonial isolada (RLS, sem visibilidade cruzada)
- Classificação lida como snapshot (sem alteração de estado animal)
- Testes + lint + build limpas
- git diff --check clean
- Documentação referencia PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md

---

Próximo: Ler `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md` para detalhes completos.
