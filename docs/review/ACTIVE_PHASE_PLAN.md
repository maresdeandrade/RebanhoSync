# ACTIVE_PHASE_PLAN - Fase 11

**Status:** 11A concluída documentalmente; 11B preparada, não iniciada
**Foco:** Lotes, Pastos e Desempenho Operacional Ampliado
**Criado:** 2026-06-04
**Atualizado:** 2026-06-05
**Baseline documental preservado: 0f2fd8e
**Commit local analisado na 11A: 0d350b8
**Plano específico:** `docs/review/PLANO_FASE_11.md`

---

## Objetivo em 1 parágrafo

Conduzir a Fase 11 por subfases documentadas em `docs/review/PLANO_FASE_11.md`, preservando o fechamento local da Fase 10. A fase deve ampliar leitura operacional com fonte explícita, período e limitação, sem criar regra crítica nova, sem custo por arroba, sem DRE/ROI/margem, sem motor de decisão e sem venda/abate automático.

---

## Status da Fase 11

- 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado: concluída documentalmente, sem patch funcional.
- 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos: preparada, não iniciada.
- 11C — Ocupação, lotação e movimentações: futura.
- 11D — Desempenho read-only se houver fonte suficiente: futura.
- 11E — Relatórios operacionais ampliados: futura.
- 11F — Fechamento: futura.

Resultado da 11A:

- commit local analisado: `0d350b8`;
- baseline documental encontrado: `0f2fd8e`;
- contexto anterior citava `8a62445`;
- worktree limpo no diagnóstico;
- `git diff --check` passou;
- houve drift entre contexto anterior, baseline documental e commit local;
- fontes reais identificadas para estado atual, ocupação/read model, histórico, pesagens e área de pasto;
- lacunas registradas para GMD por lote/pasto, permanência histórica completa, ocupação histórica e lotação quando faltam peso/área;
- nenhum código funcional, Supabase, migrations, RLS, RPC, schema, sync ou edge functions foi alterado.

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

A Fase 11 começou por diagnóstico na 11A, sem patch funcional.

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
