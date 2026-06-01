```md
# Finance Base — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir a base conceitual financeira do RebanhoSync no MVP.

Este documento orienta custos, receitas, snapshots econômicos, indicadores financeiros e limites de interpretação.

---

## Princípio central

O RebanhoSync deve apoiar a gestão econômica da fazenda sem se tornar ERP contábil/fiscal completo no MVP.

A camada financeira deve ser:
- operacional;
- rastreável;
- simples para o produtor;
- baseada em fonte explícita;
- cuidadosa com dados ausentes;
- separada de decisões comerciais automáticas.

---

## Escopo financeiro do MVP

O MVP pode suportar:
- custo de compra;
- valor de venda;
- custo sanitário por evento/produto/animal/lote;
- custo de estoque consumido;
- snapshots econômicos;
- custos operacionais básicos;
- receitas básicas;
- margem parcial;
- indicadores operacionais com limitação declarada.

---

## Fora do escopo financeiro do MVP

Não é foco imediato:
- contabilidade formal;
- DRE completa;
- balanço patrimonial;
- conciliação bancária;
- emissão fiscal;
- NF-e;
- SPED;
- folha de pagamento;
- apuração tributária;
- centro de custo contábil avançado;
- ROI completo;
- lucro final auditável.

---

## Contratos financeiros centrais

```txt
Custo ausente ≠ custo zero
Snapshot econômico ≠ preço atual
Margem parcial ≠ lucro final
Valor de venda ≠ resultado líquido
Último peso ≠ peso atual confiável
Carência sanitária ≠ aptidão comercial

```

### Entidades financeiras conceituais

| Conceito | Papel |
| --- | --- |
| **Custo** | Valor associado a compra, insumo, manejo, operação ou rateio. |
| **Receita** | Valor obtido em venda ou operação econômica. |
| **Snapshot econômico** | Captura do valor/custo no momento do fato. |
| **Margem parcial** | Receita menos custos conhecidos, com limitação. |
| **Custo ausente** | Dado não informado; não deve virar zero real. |
| **Rateio** | Distribuição de custo entre animais/lotes/períodos. |
| **KPI financeiro** | Indicador calculado a partir de fontes explícitas. |

---

## Fontes financeiras

### Fontes possíveis

* evento de compra;
* evento de venda;
* evento sanitário com produto/custo;
* movimentação de estoque;
* lote de estoque;
* snapshot econômico;
* despesa operacional registrada;
* receita registrada;
* rateio explicitamente modelado.

> ⚠️ **Não usar como fonte financeira primária:** tag, sinal visual, insight auxiliar, agenda, protocolo isolado, preço atual de estoque para recompor evento antigo ou ausência de custo como custo zero.

---

## Custo

Custo pode ser: declarado manualmente, herdado de lote de estoque, calculado por $\text{quantidade} \times \text{custo unitário}$, informado como custo total, rateado ou capturado em snapshot.

> ⚠️ **Regra:** Custo precisa declarar fonte e contexto. Se o custo não foi informado, o sistema deve exibir limitação em vez de assumir zero real.

---

## Receita

Receita pode vir de venda de animal, venda de lote ou outra operação econômica futura.

> ⚠️ Receita registrada não equivale automaticamente a lucro. Para o resultado financeiro, é necessário considerar custos conhecidos, descontos, despesas e rateios.

---

## Snapshot econômico

Snapshot econômico preserva o valor no momento do fato. Serve para: auditar histórico, evitar recomputar com preço atual, preservar custo real de entrada, preservar custo aplicado em evento e permitir cálculo parcial posterior.

### Detalhes

* `docs/finance/ECONOMIC_SNAPSHOTS.md`

---

## Margem parcial

Margem parcial é permitida quando houver fonte suficiente para a receita e parte dos custos conhecidos.

### Deve declarar

* quais custos foram incluídos;
* quais custos ficaram fora;
* período e fonte;
* limitação explícita.

> ⚠️ Nunca exibir margem parcial como lucro final.

---

## KPIs financeiros

KPIs devem declarar de forma transparente: fonte, período, escopo, fórmula, limitações e status de confiabilidade.

### Detalhes

* `docs/finance/KPI_INDEX.md`
* `docs/finance/KPI_MATRIX_FULL.md`

---

## Relação com compra/venda

Compra/venda pode gerar: custo de aquisição, receita de venda, status patrimonial, snapshot econômico e margem parcial.

> ⚠️ **Não pode gerar automaticamente:** apto para venda, apto para abate, lucro final ou ROI completo.

---

## Relação com sanitário

Sanitário pode gerar custo quando há produto aplicado, lote de estoque, dose, quantidade, custo unitário/total e snapshot.

> ⚠️ Carência sanitária pode ser sinal sanitário, mas nunca uma autorização comercial direta de venda ou abate.

---

## Relação com peso

Indicadores como custo por kg ou por arroba dependem de peso confiável. No MVP, o peso atual confiável permanece bloqueado sem contrato próprio.

### Permitido

* usar peso registrado em evento específico;
* declarar a data da pesagem;
* mostrar limitação.

### Não permitido

* usar peso projetado como fato;
* calcular custo por arroba atual sem fonte confiável.

---

## Critério de aceite

Uma funcionalidade financeira é aceitável quando:

* [ ] Declara a fonte dos dados.
* [ ] Não transforma ausência de informação em custo zero real.
* [ ] Preserva o snapshot econômico quando necessário.
* [ ] Diferencia explicitamente margem parcial de lucro final.
* [ ] Não usa o preço atual do estoque para reescrever o histórico.
* [ ] Não gera aptidão comercial automática.
* [ ] Respeita os princípios de offline-first, RLS e isolamento por `fazenda_id`.
* [ ] Possui cobertura de testes proporcionais.

```

```