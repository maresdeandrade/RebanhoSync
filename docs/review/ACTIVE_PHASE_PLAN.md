# ACTIVE_PHASE_PLAN - Fase 11

**Status:** 11A concluída documentalmente; 11B concluída localmente; 11C concluída localmente; 11D concluída localmente; 11E concluída localmente; 11F preparada, não iniciada
**Foco:** Lotes, Pastos e Desempenho Operacional Ampliado
**Criado:** 2026-06-04
**Atualizado:** 2026-06-05
**Baseline documental preservado:** `0f2fd8e`
**Commit local analisado na 11A:** `0d350b8`
**Plano específico:** `docs/review/PLANO_FASE_11.md`

---

## Objetivo em 1 parágrafo

Conduzir a Fase 11 por subfases documentadas em `docs/review/PLANO_FASE_11.md`, preservando o fechamento local da Fase 10. A fase deve ampliar leitura operacional com fonte explícita, período e limitação, sem criar regra crítica nova, sem custo por arroba, sem DRE/ROI/margem, sem motor de decisão e sem venda/abate automático.

---

## Status da Fase 11

- 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado: concluída documentalmente, sem patch funcional.
- 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos: concluída localmente.
- 11C — Ocupação, lotação e movimentações: concluída localmente.
- 11D — Desempenho read-only se houver fonte suficiente: concluída localmente.
- 11E — Relatórios operacionais ampliados: concluída localmente.
- 11F — Fechamento: preparada, não iniciada.

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

Resultado da 11B:

- patch pequeno/read-only aplicado no cockpit de Lotes/Pastos;
- `GMD` passou a ser descrito como leitura baseada nos animais atuais com pesagens válidas, sem comprovar desempenho histórico completo do lote/pasto;
- `state_pasto_ocupacoes` passou a ser comunicado como read model parcial de ocupação atual, não histórico completo;
- permanência por movimentações passou a declarar limitação histórica;
- taxa UA/ha passou a explicitar dependência de `area_ha` válida e peso explícito;
- labels de permanência em Lote/Pasto foram ajustados para leitura atual;
- testes focados de `cockpitManejoAdapter` passaram;
- `git diff --check`, `pnpm run lint` e `pnpm run build` passaram, com warnings conhecidos de Browserslist/chunks no build;
- nenhuma alteração em Supabase, migrations, RLS, RPC, schema, sync ou edge functions.

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

### Recorte executado — 11C

- Diferenciar ocupação atual de histórico de movimentação.
- Deixar claro quando lotação é calculável, parcial ou bloqueada.
- Impedir afirmação de permanência histórica quando movimentações completas estiverem ausentes.
- Explicitar limitações quando `area_ha`, peso ou eventos de movimentação estiverem ausentes.
- Manter patch pequeno, read-only e testável.

Resultado da 11C:

- movimentações apenas de entrada passaram a produzir leitura atual parcial, não permanência histórica completa;
- limitações de permanência por eventos agora declaram que eventos completos de entrada e saída são necessários para histórico completo;
- UA total do lote passou a explicitar dependência de peso explícito dos animais atuais;
- testes focados passaram a cobrir entrada sem histórico completo para lote/pasto e dependência de peso explícito;
- nenhuma alteração em Supabase, migrations, RLS, RPC, schema, sync ou edge functions.

Recorte executado — 11D:

- avaliar desempenho read-only somente se houver fonte suficiente;
- manter GMD vinculado a pesagens explícitas e período;
- não afirmar desempenho de lote/pasto sem permanência comprovada no período.

Resultado da 11D:

- GMD de lote/pasto com pesagens individuais suficientes passou a permanecer como leitura parcial quando a permanência no período não estiver comprovada;
- o cálculo numérico de GMD foi preservado, mas o status deixou de comunicar desempenho completo do lote/pasto;
- limitações seguem declarando que a leitura usa animais atuais com pesagens válidas e não comprova desempenho histórico completo nem permanência no período;
- teste focado passou a cobrir lote e pasto com GMD calculável, mas desempenho agregado parcial;
- nenhuma alteração em Supabase, migrations, RLS, RPC, schema, sync ou edge functions.

Próximo recorte — 11E:

- avaliar relatórios operacionais ampliados apenas como leitura read-only;
- preservar fonte, período e limitação nas leituras derivadas;
- não criar DRE, ROI, margem, custo por arroba, motor de decisão, venda ou abate automático.

Resultado da 11E:

- relatórios operacionais passaram a declarar fontes e limitações em tela, CSV e impressão;
- `state_*` é comunicado como estado atual/read model, sem histórico completo;
- agenda é comunicada como pendência/intenção futura, não fato executado;
- pesagens deixaram de ser apresentadas como GMD/desempenho de lote/pasto sem permanência comprovada;
- custo operacional parcial segue limitado como leitura parcial, não DRE, ROI, margem ou custo por arroba;
- testes focados de relatório e tela passaram;
- nenhuma alteração em Supabase, migrations, RLS, RPC, schema, sync ou edge functions.

Próximo recorte — 11F:

- fechar documentalmente a Fase 11;
- consolidar validações e riscos residuais reais;
- preparar próxima fase sem reabrir 11A-11E.

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
