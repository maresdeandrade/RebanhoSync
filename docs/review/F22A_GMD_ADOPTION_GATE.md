# F22A.4 — Gate de adoção e migração do GMD canônico

Atualizado em: 2026-08-31
Baseline: `main@40dae211c72fa4788c75872641782c35ca06a9cb`
Branch: `feat/f22a-gmd-adoption-gate`
Decisão: **READY — F22A GMD ADOPTION GATE CLOSED**

```ini
F22A_GMD_CALCULATION = IMPLEMENTED_QUALIFIED
F22A_GMD_ADOPTION_GATE = CLOSED
F22A_GMD_LEGACY_MIGRATION = NOT_STARTED
```

## Escopo e referência autorizada

Este gate inventaria os consumidores atuais de peso e GMD e decide sua disposição arquitetural. Nenhum consumidor foi migrado, nenhum helper foi removido e nenhuma UI, migration, RPC/RLS, Dexie, sync ou writer foi alterado.

A única cadeia canônica F22A para GMD individual é:

```text
eventos + eventos_pesagem
        ↓
selectObservedWeightEvidence
        ↓
selectFactualGmdInterval
        ↓
calculateQualifiedGmd
```

Todo resultado calculado preserva obrigatoriamente:

```ini
reliability = UNCLASSIFIED
operationalUse = NOT_AUTHORIZED
```

Não há consumidor produtivo atual dessa cadeia. Portanto, este gate não autoriza migração direta nem permite reinterpretar o cálculo como desempenho confiável, recomendação operacional ou peso atual.

## Critério de classificação

| Classificação | Significado neste gate |
|---|---|
| `MIGRATABLE_NOW` | Aceita o cálculo puramente matemático e preserva todas as qualificações, sem fallback silencioso nem dependência de occupancy. |
| `MIGRATABLE_WITH_UX_CHANGE` | Pode consumir a cadeia canônica, mas o texto ou a apresentação atual induz confiança/atualidade que o contrato não concede. |
| `BLOCKED_BY_RELIABILITY` | Alimenta KPI, agregado executivo ou decisão que requer política de confiabilidade/apresentação ainda inexistente. |
| `KEEP_SEPARATE` | Possui semântica própria de período, occupancy, relatório histórico ou qualidade de dados e não deve ser substituído automaticamente. |
| `LEGACY_NOT_CANONICAL` | Helper/read model não satisfaz os guardrails da F22A e não pode ser promovido a fonte autorizada. |
| `REMOVE_LATER` | Caminho legado sem consumidor confirmado; só pode ser removido após validação específica fora deste gate. |

## Inventário de consumidores

| Arquivo | Função/componente | Fonte atual | Finalidade e semântica exibida | Fallback | Tenant/fazenda | Offline | Risco | Classificação |
|---|---|---|---|---|---|---|---|---|
| `src/pages/AnimalDetalhe.tsx` | resumo de peso/GMD | Eventos e details Dexie; cálculo local entre primeiro e último registro | visual individual: `Peso atual` e `GMD`, sem qualificação | força ao menos 1 dia; prefere `server_received_at` a `occurred_at` | filtro explícito por animal e fazenda | sim | alto: observação vira atualidade e intervalo curto vira valor | `MIGRATABLE_WITH_UX_CHANGE` |
| `src/pages/AnimalCriaInicial.tsx` | resumo de GMD | Eventos e details Dexie; cálculo local entre primeiro e último registro | visual individual: `GMD`, sem confiabilidade/uso | força ao menos 1 dia; prefere `server_received_at` | filtro por animal, sem filtro explícito de fazenda nessa consulta | sim | alto: cálculo permissivo e isolamento dependente do conjunto recebido | `MIGRATABLE_WITH_UX_CHANGE` |
| `src/pages/Animais.tsx` | cards/lista de animais | Eventos e details Dexie; cálculo local entre primeiro e último registro | visual: `Peso atual` e `Ganho/dia` | força ao menos 1 dia; prefere `server_received_at` | filtro explícito por fazenda ativa | sim | alto: número nu induz desempenho confiável | `MIGRATABLE_WITH_UX_CHANGE` |
| `src/features/operationalInsights/operationalHomeIndicatorsAdapter.ts` + `OperationalInsightsPanel.tsx` + `src/pages/Home.tsx` | `computeGmd` e card executivo | `calculateIndividualGmd`, agregado por lote atual | KPI: `Desempenho de Ganho (GMD)` e `GMD por lote` | arredonda agregado; helper legado devolve zero em insuficiência | Home carrega coleções filtradas pela fazenda ativa | sim | alto: agregado executivo sem confiabilidade ou uso autorizado | `BLOCKED_BY_RELIABILITY` |
| `src/lib/animals/kpiHelpers.ts` | `calculateIndividualGmd` | coleção de pesos recebida | helper matemático legado | devolve valores zero para dados insuficientes/inválidos | não recebe nem valida fazenda | pura; depende do caller | alto: primeiro/último, sem conflito, coverage ou qualificações | `LEGACY_NOT_CANONICAL` |
| `src/features/occupancy/cockpitManejoAdapter.ts` + `src/pages/LoteDetalhe.tsx` + `src/pages/PastoDetalhe.tsx` | métricas de lote/pasto e cards `GMD Médio` | helper legado sobre animais vinculados ao lote/pasto corrente | cockpit agregado de manejo | helper devolve zero; pesos auxiliares também usam zero | páginas carregam Dexie por fazenda; adapter depende do conjunto recebido | sim | alto: membership atual/occupancy não equivale a GMD individual factual | `KEEP_SEPARATE` |
| `src/features/occupancy/buildWeightGainForOccupancy.ts` + `useOccupancyData.ts` | ganho no período de ocupação | pesagens mais próximas da entrada/saída | histórico de permanência; semântica própria de occupancy | peso ausente e intervalo não positivo podem virar zero; ocupação aberta usa relógio atual | hook filtra fontes por fazenda | sim | alto: pode usar pesagem fora do período e não trata conflito | `KEEP_SEPARATE` |
| `src/features/occupancy/buildLoteOccupancyMetrics.ts` + `buildPastoOccupancyMetrics.ts` | agregação de occupancy | períodos enriquecidos por occupancy | indicadores estimados por lote/pasto | campos ausentes viram zero e divisor vazio vira 1 | depende dos períodos já escopados | pura | alto: ausência é convertida em valor numérico | `KEEP_SEPARATE` |
| `src/features/occupancy/OccupancyMetricCards.tsx` | cards de occupancy | métricas agregadas de occupancy | `GMD Estimado` | apenas apresenta os zeros recebidos | depende do caller | não carrega dados | médio: nenhum consumidor produtivo foi localizado | `REMOVE_LATER` |
| `src/features/occupancy/AnimalMovementHistoryTable.tsx` | tabela de histórico | períodos de occupancy enriquecidos | pesos inicial/final e ganho por permanência; não exibe GMD | apresenta ausência separadamente | depende do caller | não carrega dados | médio: peso próximo não é observação dentro do período garantida | `KEEP_SEPARATE` |
| `src/lib/insights/pesoAtual.ts` + card de `AnimalDetalhe.tsx` | `resolveCurrentWeight` | última linha de peso recebida | read model legado chamado `CurrentWeight`/`Peso atual` | relógio runtime e stale fixo de 90 dias | não valida escopo dentro do helper | pura; caller usa Dexie | alto: último observado é promovido semanticamente a atual | `LEGACY_NOT_CANONICAL` |
| `operationalHomeIndicatorsAdapter.ts` + `OperationalInsightsPanel.tsx` | `computePesoConfiavel` | última pesagem por animal e configuração de freshness | KPI executivo `Peso atual confiável` | média/contagens podem resultar em zero quando não avaliáveis | Home filtra pela fazenda ativa | sim | alto: conflito e coverage canônica não são preservados | `MIGRATABLE_WITH_UX_CHANGE` |
| `src/lib/insights/decisionRecommendations.ts` | `buildWeightDataQualityRecommendation` | Eventos + details com cutoff, coverage e conflitos | recomendação de qualidade/freshness; proíbe peso atual garantido | ausência/configuração faltante vira estado explícito, não zero | filtra novamente fazenda e animal | pura; caller fornece snapshot | baixo | `KEEP_SEPARATE` |
| `src/lib/reports/operationalSummary.ts` + `src/pages/Relatorios.tsx` | métricas históricas de pesagem | Eventos/details no período, com `MetricResult` | média e última pesagem no período; declara que GMD por lote/pasto exige permanência | detail numérico usa zero internamente, mas cobertura reduz e ausência final é `null` | escopo de relatório por fazenda | depende do snapshot local | médio | `KEEP_SEPARATE` |
| `src/pages/Dashboard.tsx` | gráfico histórico de pesagens | últimos Eventos/details da fazenda | série histórica, não GMD | detail ausente vira peso zero no gráfico | filtro explícito por fazenda ativa | sim | médio: zero artificial distorce série | `KEEP_SEPARATE` |

## Fallbacks perigosos confirmados

| Arquivo | Comportamento | Risco |
|---|---|---|
| `src/pages/AnimalDetalhe.tsx` | `Math.max(1, Math.round(days))` no denominador | intervalo inferior/igual a zero ainda produz GMD visual |
| `src/pages/AnimalCriaInicial.tsx` | `Math.max(1, Math.round(days))` no denominador | ausência de intervalo válido não bloqueia cálculo |
| `src/pages/Animais.tsx` | `Math.max(1, Math.round(days))` no denominador | GMD visual pode esconder intervalo inválido |
| `src/lib/animals/kpiHelpers.ts` | dados insuficientes ou inválidos retornam zeros | desconhecido/insuficiente é convertido em desempenho zero |
| `src/features/occupancy/buildWeightGainForOccupancy.ts` | detail ausente usa `0`; intervalo não positivo gera `gmd = 0` | occupancy incompleta aparenta métrica calculada |
| `src/features/occupancy/buildLoteOccupancyMetrics.ts` | campos usam `|| 0`; coleção vazia usa divisor `|| 1` | ausência vira agregado numérico |
| `src/features/occupancy/buildPastoOccupancyMetrics.ts` | campos usam `|| 0`; coleção vazia usa divisor `|| 1` | ausência vira agregado numérico |
| `src/features/occupancy/cockpitManejoAdapter.ts` | pesos auxiliares ausentes usam `|| 0` | UA/peso agregado pode incorporar zero artificial |
| `src/pages/Dashboard.tsx` | detail ausente usa `peso_kg || 0` | gráfico histórico inclui pesagem artificial de 0 kg |
| `src/lib/reports/operationalSummary.ts` | detail usa `peso_kg || 0` na soma | cobertura protege a saída, mas o fallback não pode ser reutilizado como fato |

Esses fallbacks foram somente registrados. Corrigi-los exigiria escopo funcional próprio, testes e decisão de UX/semântica.

## Ordem incremental recomendada

### Wave 1 — UI individual, condicionada a mudança de UX

- `src/pages/AnimalDetalhe.tsx`;
- `src/pages/AnimalCriaInicial.tsx`;
- `src/pages/Animais.tsx`.

Pré-condição: exibir `UNCLASSIFIED`, `NOT_AUTHORIZED`, coverage, conflitos e ausência sem zero; substituir `Peso atual` por `Última pesagem observada` onde aplicável. Como essa mudança é necessária, a Wave 1 não está autorizada por este gate.

### Wave 2 — qualidade de peso, condicionada a UX e contrato de apresentação

- `operationalHomeIndicatorsAdapter.ts::computePesoConfiavel`;
- card correspondente em `OperationalInsightsPanel.tsx`;
- `resolveCurrentWeight`/card de peso em `AnimalDetalhe.tsx`.

Esta onda deve adotar o selector canônico de última observação sem transformar observação em peso atual. Ela é separada da migração de GMD.

### Blocked — política de confiabilidade/apresentação necessária

- `operationalHomeIndicatorsAdapter.ts::computeGmd`;
- cards de GMD em `OperationalInsightsPanel.tsx`;
- qualquer ranking, agregado executivo, recomendação ou decisão baseada em GMD.

O cálculo individual `UNCLASSIFIED` não pode ser agregado e apresentado como desempenho confiável sem política contextual e coverage de medição.

### Keep separate — semântica não intercambiável

- toda a cadeia `src/features/occupancy/**`, inclusive lote/pasto;
- `cockpitManejoAdapter.ts`, `LoteDetalhe.tsx` e `PastoDetalhe.tsx`;
- `operationalSummary.ts`, `Relatorios.tsx` e `Dashboard.tsx`;
- `buildWeightDataQualityRecommendation`.

Occupancy precisa de contrato próprio de permanência e pesagens relacionadas ao período. Relatórios históricos e qualidade de dados respondem perguntas diferentes do GMD canônico.

### Legado e remoção posterior

- `calculateIndividualGmd` permanece `LEGACY_NOT_CANONICAL` enquanto houver callers;
- `resolveCurrentWeight` permanece `LEGACY_NOT_CANONICAL` até a UX adotar última observação;
- `OccupancyMetricCards` é `REMOVE_LATER`, sujeito a confirmação de ausência de consumo antes de qualquer exclusão.

## Decisão arquitetural

O inventário é suficiente para fechar o gate de adoção, mas não para iniciar migração direta. Não existe consumidor `MIGRATABLE_NOW`: todos os candidatos exigem mudança de UX, política adicional ou preservação de semântica própria.

Consequentemente:

- a F22A não está encerrada como um todo;
- a migração legada permanece não iniciada;
- nenhuma cadeia de occupancy pode ser substituída automaticamente;
- o próximo incremento recomendado é **F22B economic coverage**, independente deste bloqueio de adoção.

## Riscos remanescentes

1. Telas individuais ainda exibem GMD nu e podem induzir confiabilidade inexistente.
2. Home e cockpits agregam cálculos legados sem preservar conflitos, coverage ou qualificações canônicas.
3. Fallbacks numéricos em occupancy, relatório e dashboard continuam convertendo ausência em zero em pontos legados.
