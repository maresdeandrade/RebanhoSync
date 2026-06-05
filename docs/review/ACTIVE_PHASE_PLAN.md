# ACTIVE_PHASE_PLAN - Fase 11

**Status:** a iniciar
**Foco:** Lotes, Pastos e Desempenho Operacional Ampliado
**Criado:** 2026-06-04
**Atualizado:** 2026-06-04
**Baseline de handoff:** `0f2fd8e`

---

## Objetivo em 1 parágrafo

Iniciar a Fase 11 com diagnóstico de lote, pasto, ocupação e desempenho operacional ampliado, preservando o fechamento local da Fase 10. A fase deve ampliar leitura operacional com fonte explícita, período e limitação, sem criar regra crítica nova, sem custo por arroba, sem DRE/ROI/margem, sem motor de decisão e sem venda/abate automático.

---

## Status recebido

- Fase 10A — Diagnóstico UX e mapa de fricção: concluída.
- Fase 10B — Agenda/Registrar: concluída localmente.
- Fase 10C — Home/Central Operacional: concluída localmente.
- Fase 10D — Animal, Eventos e Histórico: concluída localmente.
- Fase 10E — Integração via Histórico para Lotes/Pastos, Relatórios e Compra/Venda: concluída localmente.
- Fase 10F — Fechamento da Fase 10 e handoff: executada.
- Fase 10 — UX Operacional dos Fluxos Centrais: concluída localmente.

---

## Conduta obrigatória de início

A Fase 11 deve começar por diagnóstico, não por patch direto.

Diagnóstico mínimo:

1. delimitar perguntas operacionais de lote/pasto/desempenho;
2. confirmar fontes atuais em eventos, `state_*`, ocupação e relatórios;
3. separar estado atual, histórico e leitura derivada;
4. identificar lacunas reais de GMD por período, ocupação e movimentações;
5. propor patch pequeno, reversível e testável;
6. definir validação proporcional antes de editar.

---

## Escopo permitido

- Diagnóstico de lote, pasto e desempenho operacional.
- Leitura read-only de movimentações, ocupação e permanência.
- GMD por período somente com fonte explícita e limitação.
- Melhorias de copy, labels, estados vazios e rastreabilidade.
- Testes focados quando houver patch.

---

## Escopo proibido

- Criar custo por arroba.
- Criar DRE, ROI ou margem.
- Criar motor de decisão.
- Criar venda ou abate automático.
- Criar aptidão para venda ou abate.
- Criar carência liberatória.
- Usar sinal, insight ou tag como fonte primária.
- Transformar relatório parcial em conclusão financeira.
- Alterar Supabase, migrations, RLS, RPC, edge functions, schema ou sync sem tarefa explícita.

---

## Validação inicial recomendada

Antes de qualquer patch:

```bash
git status --short --untracked-files=all
git diff --check
```

Se houver patch funcional:

```bash
pnpm test -- <testes focados>
pnpm run lint
pnpm run build
```

Se houver Supabase, migrations, RLS, RPC, edge functions, sync-batch ou baseline:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
