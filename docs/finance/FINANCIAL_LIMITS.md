```md
# Financial Limits — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir limites financeiros do RebanhoSync no MVP.

Este documento impede que o app afirme lucro, margem, ROI, custo consolidado ou resultado econômico sem fonte suficiente.

---

## Regra central

O RebanhoSync pode apoiar leitura econômica operacional.

> ⚠️ Não deve afirmar resultado financeiro completo sem contrato, fonte e cálculo explícitos.

---

## Bloqueios principais

Não afirmar automaticamente:

- lucro final;
- margem final;
- ROI;
- custo total consolidado;
- custo por arroba confiável;
- custo por kg confiável;
- resultado líquido;
- DRE;
- fluxo de caixa completo;
- valor patrimonial contábil;
- aptidão comercial;
- pronto para venda;
- apto para abate.

---

## Custo ausente

Custo ausente não é custo zero.

> ⚠️ **Regra:** Quando o custo não estiver disponível, exibir:
> - `Custo não informado.` ou
> - `Cálculo parcial: há custos ausentes.`
> 
> **Não exibir** `R$ 0,00` como se fosse custo real.

---

## Margem parcial

Margem parcial pode ser exibida quando houver receita e custos conhecidos.

### Deve declarar
- fontes incluídas;
- custos ausentes;
- período;
- escopo;
- limitação.

### Copy recomendada
✅ `Margem parcial com base nos custos registrados.`

### Evitar
❌ `Lucro final`
❌ `Resultado real`
❌ `ROI garantido`

---

## Receita não é lucro

Valor de venda representa receita bruta ou valor declarado.

### Não equivale a
- lucro;
- margem;
- resultado líquido;
- ganho real.

> ⚠️ Para o resultado, são necessários custos e despesas associados.

---

## Snapshot não é total consolidado

Snapshot econômico preserva um valor no momento do fato. Não significa que todos os custos do animal/lote estão completos.

> 💡 **Exemplo:** Snapshot sanitário registra custo do produto aplicado; não inclui automaticamente nutrição, mão de obra, transporte, depreciação ou compra.

---

## Peso e indicadores econômicos

Custo por kg ou por arroba depende de peso confiável.

### No MVP
- último peso pode ser exibido;
- pesagem histórica pode ser usada com data;
- peso atual confiável não deve ser inferido automaticamente.

> ⚠️ **Bloqueado:** Custo por arroba atual confiável sem política de peso confiável.

---

## Compra/venda e aptidão comercial

Mesmo com dados financeiros, não afirmar:

- pronto para venda;
- apto para abate;
- vender agora;
- margem ideal;
- melhor momento de venda.

> ⚠️ Essas decisões exigem contrato próprio e fonte composta.

---

## Carência sanitária

Carência sanitária pode ser sinal sanitário se vier de evento estruturado.

### Não equivale a
- liberação comercial;
- aptidão para venda;
- aptidão para abate;
- menor risco financeiro;
- autorização operacional.

---

## Rateios

Rateios devem ser explícitos.

### Não ratear automaticamente sem regra documentada
- custo de lote para animal;
- custo de pasto para lote;
- custo de mão de obra;
- custo de transporte;
- custo de insumo compartilhado;
- custo fixo da fazenda.

> ⚠️ Se rateio for aplicado, declarar fórmula e limitação.

---

## Dados parciais

Quando a fonte for parcial, usar status parcial.

### Exemplos
- `Custo parcial.`
- `Margem parcial.`
- `Fonte financeira incompleta.`
- `Há registros sem valor.`

> ⚠️ Não ocultar limitação.

---

## ERP fiscal/contábil

Fora do MVP:

- NF-e;
- SPED;
- escrituração;
- apuração tributária;
- DRE formal;
- balanço;
- conciliação bancária;
- plano de contas contábil completo.

---

## Critério para desbloquear capacidade financeira

Uma capacidade pode sair do bloqueio quando houver:

- [ ] fonte de dados definida;
- [ ] fórmula documentada;
- [ ] regra de período;
- [ ] regra de inclusão/exclusão;
- [ ] tratamento de custo ausente;
- [ ] testes;
- [ ] UX com limitação;
- [ ] impacto em sync/RLS avaliado;
- [ ] aceite de produto.

---

## Critério de aceite

Uma leitura financeira é aceitável quando:

- [ ] não afirma mais do que a fonte permite;
- [ ] não usa custo ausente como zero;
- [ ] não usa margem parcial como lucro;
- [ ] não recalcula histórico com preço atual;
- [ ] declara período e escopo;
- [ ] mostra limitação;
- [ ] é compreensível para o produtor.

```