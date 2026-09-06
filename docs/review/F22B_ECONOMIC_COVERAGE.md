# F22B.1 — Economic Coverage

Atualizado em: 2026-09-05
Baseline: `main@4e476536647a113d7515a0ea7687f7632b4e1b99`
Branch: `feat/f22b-economic-coverage`
Status: **IMPLEMENTED**

```ini
F22B_ECONOMIC_COVERAGE = IMPLEMENTED
F22B_OBSERVED_RESULT = IMPLEMENTED_QUALIFIED
F22B_ADOPTION_PRESENTATION_GATE = CLOSED
F22B_COMPLETE_PROFIT = BLOCKED
```

## Escopo

`selectEconomicCoverage` é um read model puro que responde qual evidência econômica factual está disponível para uma fazenda e período antes de qualquer cálculo de resultado. Não implementa lucro, margem, ROI, custo por animal, UI, writer, migration, RPC/RLS, Dexie ou sync.

## Fontes e separação factual

| Conceito                 | Fonte/campo                                                                                                              | Uso no contrato                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| fazenda                  | `finance_transactions.fazenda_id`, `finance_categories.fazenda_id`, `eventos.fazenda_id`, `eventos_comercial.fazenda_id` | filtro obrigatório em todas as fontes locais                                  |
| valor                    | `finance_transactions.valor_total`                                                                                       | somente positivo e finito                                                     |
| data econômica observada | `finance_transactions.paid_at`                                                                                           | período inclusivo no timezone declarado                                       |
| direção                  | `finance_transactions.direction`                                                                                         | valida coerência; não classifica isoladamente                                 |
| categoria                | `finance_transactions.category_id` → `finance_categories.tipo`                                                           | `receita`, `custo_variavel` e `custo_fixo`; investimento permanece separado   |
| estorno                  | `finance_transactions.reverses_transaction_id` + `origem=estorno`                                                        | efeito negativo no bucket factual do original, nunca fato oposto independente |
| referência comercial     | `eventos_comercial.finance_transaction_id`                                                                               | ausência ou referência não resolvida vira lacuna de coverage                  |
| idempotência             | `finance_transactions.id` e `client_op_id`                                                                               | duplicata idêntica converge; divergência de identidade vira conflito          |

As fontes permanecem semanticamente separadas:

```text
Evento comercial = fato operacional/comercial
Finance transaction = fato financeiro
Finance category = classificação/configuração
```

Evento comercial sem transação financeira associada não entra no caixa observado e nenhum lançamento ausente é criado.

## Contrato

Arquivo: `src/lib/finance/economicCoverage.ts`.

Entrada obrigatória:

- `fazendaId`;
- período `from`/`to`, inclusivo, com timezone IANA explícito;
- estados de coverage de transações, categorias e operações comerciais;
- snapshots existentes de transações, categorias, Eventos e details comerciais.

Saída:

- `observedRevenue` e `observedCosts` separados, com total anulável, valor bruto, estornos e fatos usados;
- `unclassifiedTransactions` com causa explícita;
- `reversals` com vínculo e bucket aplicado;
- `commercialEventsWithoutFinance` como lacuna, não caixa;
- contagens de coverage, limitações e conflitos;
- status `AVAILABLE`, `PARTIAL`, `INSUFFICIENT_COVERAGE` ou `CONFLICT`.

O resultado não possui campo de saldo, resultado observado ou lucro.

## Regras conservadoras

- coleção vazia retorna coverage insuficiente e totais `null`;
- bucket sem fato classificado permanece `null`, mesmo quando o outro bucket possui fatos;
- zero só é retornado quando fatos matematicamente observados produzem zero, por exemplo original integralmente estornado;
- valor inválido não é normalizado nem descartado silenciosamente;
- categoria ausente, não carregada, inativa, deletada ou de tipo não suportado permanece fora dos totais com causa explícita;
- direção precisa ser compatível com o tipo da categoria;
- `investimento` não é inferido como custo;
- duplicidade divergente, vínculo cross-farm e estorno inconsistente produzem conflito;
- operação comercial v2 sem financeiro associado permanece lacuna de coverage.

## Limitações

1. `AVAILABLE` significa apenas que as fontes fornecidas possuem coverage declarada e fatos classificáveis; não comprova contabilidade completa.
2. O ledger não declara moeda e não garante conciliação bancária, fiscal ou exaustividade de custos e receitas.
3. Resultado observado, lucro completo e rateios econômicos permanecem fora deste incremento.

## Evidência focada

Os testes de `economicCoverage.test.ts` cobrem ausência versus zero, receita, custo, ambos separados, estorno, classificação ausente, lacuna comercial, tenant, período/timezone, ordem física, retry, valor inválido e coverage parcial.

## F22B.2 — Observed Economic Result

Baseline: `main@a9d7f4e3fea98dd064bbbdcd40de370814216d13`, merge commit do PR #114; `56c1186d` integrado como ancestral.

`calculateObservedEconomicResult` em `src/lib/finance/observedEconomicResult.ts` recebe exclusivamente `EconomicCoverageResult` produzido por `selectEconomicCoverage`. Não consulta fontes, reclassifica lançamentos nem altera o contrato F22B.1.

```text
observedResult = observedRevenue.amount - observedCosts.amount
Observed Economic Result is not complete profit.
```

A saída discriminada usa `CALCULATED` ou `NOT_CALCULATED`. Ambas preservam o objeto canônico completo em `coverage` (fazenda, período, fontes, fatos, estornos, categorias não classificadas, conflitos e gaps), além de `limitations`, `interpretation = OBSERVED_SCOPE_ONLY`, `completeAccounting = false` e `profit = NOT_DEMONSTRATED`. O objeto recebido não é alterado; a evidência é compartilhada por referência, não uma cópia isolada.

| Coverage F22B.1 | Comportamento F22B.2 |
|---|---|
| `AVAILABLE` | Calcula se ambos os totais estiverem disponíveis e finitos |
| `PARTIAL` | Mesma regra; conserva a coverage parcial e todos os gaps/limitações |
| `INSUFFICIENT_COVERAGE` | Não calcula, mesmo se receber totais inconsistentes com esse status |
| `CONFLICT` | Não calcula; presença de conflitos também bloqueia independentemente do status |

Motivos de `NOT_CALCULATED`, em ordem de precedência: `CONFLICT`, `INSUFFICIENT_COVERAGE`, `REVENUE_UNAVAILABLE`, `COST_UNAVAILABLE`, `INVALID_NUMERIC_INPUT`, `NON_FINITE_RESULT` (overflow da subtração). Ausência nunca vira zero. Zero factual fornecido pela F22B.1 continua calculável; resultados positivos, zero e negativos são válidos. Não há arredondamento de domínio.

Os testes focados da F22B.2 cobrem sinal, zero factual via estorno integral canônico, ausência de cada lado, coverage parcial com gap, conflitos, insuficiência, NaN/Infinity, overflow, precisão e imutabilidade. Não há UI, lucro, margem, ROI, rateio nem alteração de writer/schema/sync.

O [gate de adoção/apresentação F22B.3](./F22B_ADOPTION_PRESENTATION_GATE.md) foi fechado com `MIGRATABLE_NOW = 0`. Próximo passo recomendado, não iniciado: **F22C historical occupancy source gate**.
