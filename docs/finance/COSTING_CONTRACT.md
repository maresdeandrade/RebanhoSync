```md
# Costing Contract — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir o contrato de custos do RebanhoSync.

Este documento orienta custo unitário, custo total, custo ausente, consumo de estoque, rateio e snapshots econômicos.

---

## Princípio central

Todo custo deve ter fonte, contexto e limitação.

> ⚠️ Custo ausente não deve ser interpretado como custo zero.

---

## Tipos de custo

| Tipo | Descrição |
|---|---|
| **Custo unitário** | Valor por unidade. |
| **Custo total** | Valor total da operação ou lote. |
| **Custo de aquisição** | Valor de compra do animal/lote. |
| **Custo sanitário** | Valor associado a produto/aplicação sanitária. |
| **Custo de estoque** | Valor associado a lote de insumo. |
| **Custo operacional** | Valor associado a manejo, transporte, serviço ou outro item. |
| **Custo rateado** | Valor distribuído por regra explícita. |
| **Custo parcial** | Custo calculado com fonte incompleta. |

---

## Custo unitário e custo total

Quando houver custo unitário e quantidade:
`custo_total = quantidade * custo_unitario`

Quando houver custo total e quantidade:
`custo_unitario = custo_total / quantidade`

> ⚠️ **Regra:** Se ambos forem informados, validar a coerência matemática. Se divergirem acima da tolerância definida, exigir revisão.

---

## Custo ausente

Custo ausente deve permanecer ausente. Não preencher automaticamente com zero.

### Representação recomendada
- `cost_status = "missing"` ou equivalente.

### Copy recomendada
✅ `Custo não informado.`
✅ `Cálculo parcial: há custo ausente.`

---

## Zero real

Zero só deve ser aceito como custo real quando explicitamente informado.

### Exemplo
- **Custo informado:** `R$ 0,00`
- **Motivo:** bonificação / doação / sem custo declarado

> ⚠️ **Regra:** Zero real precisa ser distinguível de custo ausente.

---

## Custo sanitário

Custo sanitário pode vir de: lote de estoque, custo unitário declarado, custo total declarado, snapshot do produto ou baixa vinculada ao evento.

Deve preservar, quando aplicável:
- produto;
- lote de estoque;
- quantidade e unidade;
- custo unitário e custo total;
- animal/lote;
- evento sanitário;
- data.

---

## Consumo de estoque

Consumo de estoque deve ser idempotente.

### Riscos
- baixa duplicada por retry;
- evento salvo sem baixa;
- baixa salva sem evento;
- custo herdado errado;
- custo atualizado depois alterando histórico.

> ⚠️ **Regra:** Evento histórico deve preservar snapshot suficiente para não depender apenas do estoque atual.

---

## Custo de compra

Compra pode registrar: valor unitário, valor total, quantidade de animais, custos adicionais, contraparte, data e snapshot.

> ⚠️ **Regra:** Valor de compra deve ser histórico. Não recalcular compra antiga por preço atual.

---

## Custo de venda

Venda pode registrar: valor unitário, valor total, quantidade, descontos, custos de venda (se modelados), contraparte e data.

> ⚠️ **Regra:** Valor de venda é receita/valor declarado, não lucro.

---

## Rateio

Rateio só deve ocorrer com regra explícita.

### Exemplos de critérios possíveis
- por animal;
- por peso registrado;
- por cabeça;
- por lote;
- por período;
- por quantidade consumida.

> ⚠️ **Regra:** Quando houver rateio, declarar explicitamente: base, fórmula, período, itens incluídos e limitações.

---

## Custo por animal

Custo por animal pode ser calculado quando houver:
- custo individual; **ou**
- custo de lote com regra de rateio;
- vínculo animal/lote;
- período;
- fonte.

> 💡 Sem isso, exibir como parcial ou bloqueado.

---

## Custo por lote

Custo por lote pode incluir: compra de animais, sanitário, nutrição, manejo, movimentação e outros custos registrados.

> ⚠️ **Regra:** Só chamar de "custo total do lote" se todas as categorias necessárias estiverem modeladas e incluídas. Caso contrário, utilizar: `Custo parcial do lote.`

---

## Custo histórico

Custo histórico deve ser preservado por snapshot.

> ⚠️ Não usar o estado atual de preço/estoque para reescrever o passado.

---

## Arredondamento

Definir arredondamento de exibição sem alterar a fonte.

### Recomendação
- armazenar com precisão adequada;
- arredondar apenas na UI;
- manter a fórmula auditável.

---

## Edge cases

Verificar:

- quantidade zero;
- quantidade negativa;
- custo unitário ausente;
- custo total ausente;
- custo unitário e total divergentes;
- lote de estoque sem custo;
- produto aplicado sem quantidade;
- evento duplicado;
- rollback parcial;
- animal vendido com custo incompleto;
- custo informado como zero real;
- moeda ausente;
- unidade incompatível.

---

## Critério de aceite

Um cálculo de custo é aceitável quando:

- [ ] distingue custo ausente de zero;
- [ ] declara a fonte;
- [ ] preserva o snapshot;
- [ ] valida coerência entre unitário/total;
- [ ] trata rateio explicitamente;
- [ ] não recalcula histórico com estado atual;
- [ ] mostra limitação quando parcial;
- [ ] é testável.

```