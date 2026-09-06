# F22B.3 — Adoption / Presentation Gate

Atualizado em: 2026-09-05
Baseline: `main@829fabc90f85eb05b4ee89cacfaec6c751578092`
Branch: `feat/f22b-adoption-presentation-gate`
Status: **CLOSED**

```ini
F22B_ECONOMIC_COVERAGE = IMPLEMENTED
F22B_OBSERVED_RESULT = IMPLEMENTED_QUALIFIED
F22B_ADOPTION_PRESENTATION_GATE = CLOSED
F22B_COMPLETE_PROFIT = BLOCKED
```

## Decisão

Nenhum consumidor atual é `MIGRATABLE_NOW`. As superfícies financeiras existentes não transportam juntas coverage, limitações, gaps, período e distinção entre ausência e zero. A adoção direta converteria cobertura parcial em aparência de completude ou manteria agregações paralelas ao contrato canônico.

A cadeia futura obrigatória é:

```text
finance_transactions + finance_categories + eventos_comercial
  -> selectEconomicCoverage
  -> calculateObservedEconomicResult
  -> adaptador de apresentação futuro
```

UI, relatório e exportação não podem reler, reclassificar ou recalcular as fontes.

## Inventário de consumidores

| Arquivo | Componente/função | Fonte atual e uso | Fallback/coverage | Classificação | Risco |
|---|---|---|---|---|---|
| `src/pages/Financeiro.tsx` | cards `Caixa realizado` | `calculateGerencialTemporalSummary(state_finance_transactions)`; entradas, saídas e saldo realizados | objeto vazio e acumuladores começam em zero; coverage ausente | `MIGRATABLE_WITH_PRESENTATION_CHANGE` | alto |
| `src/pages/Financeiro.tsx` | cards de competência e previsões | ledger por `competence_date`/`due_date`; não é caixa observado por `paid_at` | zero inicial; coverage ausente | `KEEP_SEPARATE` | médio se confundido com resultado observado |
| `src/pages/Financeiro.tsx` | `buildCommercialFinanceRows` | Evento/detail comercial, inclusive vínculo financeiro visível | ausência do vínculo é texto, não caixa | `KEEP_SEPARATE` | baixo enquanto permanecer operação comercial |
| `src/pages/Relatorios.tsx` | card `Saldo no periodo` | `report.financeiro.saldo` de `buildOperationalSummary` | valor bruto sempre numérico; warning textual, sem coverage junto ao valor | `MIGRATABLE_WITH_PRESENTATION_CHANGE` | alto |
| `src/pages/Relatorios.tsx` | bloco `Financeiro e pesagem` | `report.financeiro.entradas/saidas` | zero estrutural; não usa os `MetricResult` financeiros na apresentação | `MIGRATABLE_WITH_PRESENTATION_CHANGE` | alto |
| `src/lib/reports/operationalSummary.ts` | agregados `financeiro` | soma própria de ledger e fallback de Evento financeiro legado | estrutura inicializada em zero; regras duplicam período/classificação | `LEGACY_NOT_CANONICAL` | alto |
| `src/lib/reports/operationalSummary.ts` | `metrics.financeiro_*` | adapta os agregados paralelos para `MetricResult` | `unavailable` vira `value=null`, mas o bloco bruto continua zero | `REMOVE_LATER` | alto enquanto houver duas saídas divergentes |
| `src/lib/reports/operationalSummary.ts` | CSV e print HTML | exporta `report.financeiro` bruto | sempre serializa entradas, saídas e saldo numéricos; sem coverage/gaps | `MIGRATABLE_WITH_PRESENTATION_CHANGE` | alto |
| `src/pages/Relatorios.tsx` | `Custo operacional parcial` | read model e snapshots próprios de inventário | faltas são contadas explicitamente | `KEEP_SEPARATE` | médio se somado ao resultado F22B |
| `src/pages/Home.tsx` | `buildOperationalSummary` | constrói resumo para recomendações operacionais; não apresenta métricas financeiras | nenhuma apresentação econômica atual | `KEEP_SEPARATE` | baixo |
| `src/pages/Dashboard.tsx` | painel administrativo | apenas saúde/rejeições e link para Financeiro; nenhum valor econômico | não aplicável | `KEEP_SEPARATE` | baixo |

Não foi localizado consumidor de produção de `selectEconomicCoverage` ou `calculateObservedEconomicResult`; além dos testes, os contratos ainda não possuem adoção.

## Fallbacks perigosos

1. `Financeiro.tsx`: quando os dados ainda não existem, o sumário retorna entradas, saídas e saldo `0`; `calculateGerencialTemporalSummary` também inicia todos os buckets em zero. Isso não distingue ausência de zero factual.
2. `operationalSummary.ts`: o objeto `financeiro` inicia entradas, saídas e saldo em zero. Embora `metrics.financeiro_*` possa ficar `unavailable`, `Relatorios.tsx`, CSV e impressão consomem o objeto bruto e exibem `R$ 0`.
3. `operationalSummary.ts`: o agregado comercial usa `valor_liquido_derivado ?? valor_bruto ?? 0`. Essa métrica comercial deve permanecer separada e não pode alimentar EconomicCoverage nem ObservedEconomicResult.

Os fallbacks são inventariados, não corrigidos nesta branch.

## Contrato mínimo de apresentação futura

As seguintes evidências devem viajar e ser renderizadas como uma unidade:

- status `CALCULATED` ou `NOT_CALCULATED` e motivo;
- receita observada, custo observado e resultado observado;
- status e fontes de coverage;
- limitações, gaps comerciais, não classificados e conflitos relevantes;
- fazenda, período inclusivo e timezone;
- `OBSERVED_SCOPE_ONLY`, `completeAccounting=false` e `profit=NOT_DEMONSTRATED`.

Regras:

- `AVAILABLE`: pode mostrar **Resultado observado**, período e coverage; não implica contabilidade completa.
- `PARTIAL`: pode mostrar o resultado do recorte conhecido somente com indicador `PARTIAL` e limitações/gaps visíveis junto ao valor.
- `NOT_CALCULATED`: mostrar “Não calculado” e o motivo; nunca `R$ 0`.
- `CONFLICT`: bloquear o valor e expor conflito; não usar fallback.
- zero só pode ser formatado quando `observedResult` calculado for zero factual.
- não usar “Lucro”, “Resultado da fazenda”, margem, ROI, rentabilidade ou equivalentes.

## Plano de adoção

### WAVE 1 — nenhuma migração autorizada

Não há superfície que hoje cumpra todos os critérios de apresentação segura sem alteração de UX.

### WAVE 2 — exige contrato de apresentação e mudança de UX

1. `src/pages/Financeiro.tsx`: substituir apenas os cards de caixa realizado pelo pipeline canônico e por estado explícito de loading/ausência; manter competência e previsões separadas.
2. `src/pages/Relatorios.tsx`: adotar o mesmo resultado qualificado no card financeiro e no bloco de entradas/saídas, sem misturar custo de inventário.
3. `src/lib/reports/operationalSummary.ts`: depois dos consumidores visuais, migrar CSV/print e remover os agregados financeiros paralelos, preservando schemas de exportação de forma deliberada.

### BLOCKED

- lucro real/bruto/líquido, margem, ROI, EBITDA e rentabilidade;
- resultado ou custo completo por animal, lote, pasto, arroba ou hectare;
- KPI executivo ou decisão operacional que exija conciliação, rateio ou cobertura contábil completa.

### KEEP_SEPARATE

- competência, contas previstas e vencimentos em `Financeiro.tsx`;
- lista de operações comerciais e vínculo financeiro;
- custo parcial de inventário em `Relatorios.tsx`;
- recomendações operacionais da Home e saúde administrativa do Dashboard.

## Próximo passo

Como `MIGRATABLE_NOW = 0`, não iniciar adoção F22B. Próximo incremento recomendado: **F22C historical occupancy source gate**.
