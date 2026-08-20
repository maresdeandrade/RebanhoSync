# Resultado funcional mais recente — Fase 15 / KPIs e Relatórios

Atualizado em: 2026-08-19
Baseline de entrada: `main@209913b3d6061f2dc5b2bf0cbfc1b83a012169f6`
Commit da implementação: `7bebe60e8c866ba36aca512996044701c354ceab`
PR de revisão: [#93](https://github.com/maresdeandrade/RebanhoSync/pull/93)
Decisão: **Fase 15 encerrada tecnicamente e publicada para revisão; sem merge**

## Resultado

A Fase 15 implementa um contrato comum de KPIs por meio de `MetricResult<T>`, com estados `complete`, `partial` e `unavailable`, fontes, limitações, período e cobertura. `MetricCoverage` diferencia histórico, snapshot atual e planejamento. Histórico sem evidência verificada não é apresentado como completo; zero local sem cobertura torna-se indisponível; e pendências locais tornam o resultado parcial.

O período registra fronteiras inclusivas, campo factual e timezone. O timezone válido da fazenda é preferido; ausência ou valor inválido usa o timezone de runtime com limitação explícita. O escopo do agregador é filtrado por `fazendaId`, sem misturar dados de outra fazenda.

A reprodução usa `rebuildReproductiveProjection`. O histórico factual do rebanho calcula entradas, saídas e categorias a partir de Eventos e detalhes factuais, sem transformar `state_animais` em histórico. A demanda futura prefere Agenda Sanitária v2 e declara o fallback legado. O comercial exige seleção positiva por `payload.kind = "commercial_operation_v2"`, detalhe `eventos_comercial` vinculado para valores e exclusão de simulações explícitas. Peso comercial não é tratado como pesagem zootécnica.

CSV e impressão exportam `metric_coverage`, `metric_scope`, `metric_period` e `metric_timezone` por KPI. Agenda continua sendo intenção, Evento continua sendo fato histórico executado, `state_*` permanece estado atual/read model e Protocolo permanece configuração.

## Gate semântico final

O gate de cobertura confirmou que nenhum código produtivo injeta `state: "verified"`; essa evidência pode ser fornecida apenas pelo chamador com comprovação real. O gate de timezone confirmou o uso de `fazendas.timezone` e o fallback runtime limitado. O gate comercial encontrou e corrigiu a ausência de seleção positiva: agora eventos comerciais sem `payload.kind = "commercial_operation_v2"` não entram, mesmo com detalhe legado correspondente; simulações explicitamente marcadas continuam excluídas.

## Patch e banco

O patch contém `src/lib/reports/metricContract.ts`, `src/lib/reports/operationalSummary.ts`, `src/lib/reports/__tests__/operationalSummary.test.ts`, `src/pages/Home.tsx` e `src/pages/Relatorios.tsx`. Não houve migration, alteração de RLS, schema, RPC, Edge Function, grant ou sincronização remota. Produção não foi acessada ou modificada.

## Validação

- 16 testes focados de `operationalSummary` passaram, incluindo cobertura, zero/ausência, pendências locais, isolamento, timezone, Agenda Sanitária v2, entradas/saídas e simulação comercial.
- `quality:gate` passou, incluindo lint, hotspots, integração e smoke.
- `pnpm run build` passou, com warnings preexistentes de Browserslist, chunks e import misto do Dexie.
- `pnpm exec tsc --noEmit --ignoreDeprecations 5.0` passou sem erros de código. A execução sem override permanece incompatível com o baseline `ignoreDeprecations: "6.0"` usando TypeScript 5.8.3.
- Prettier passou nos cinco arquivos afetados e `git diff --check` passou.
- `audit:agents` e `gates:docs` não foram executados com sucesso porque Bash não está disponível no ambiente Windows; `gates:docs` retornou explicitamente `bash not found on Windows`.
- A formatação global do baseline, envolvendo 532 arquivos fora do escopo, não foi alterada.

## Próxima fase

A próxima etapa é a revisão da PR #93 contra `main`. A Fase 16 não foi iniciada, nenhum merge foi realizado e nenhuma ação remota irreversível foi executada.

Detalhes no [plano ativo](./ACTIVE_PHASE_PLAN.md), no [handoff atual](./CURRENT_PHASE_HANDOFF.md) e no [estado macro do projeto](../context/PROJECT_STATUS.md).
