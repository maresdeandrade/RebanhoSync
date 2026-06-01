```md
# KPI Index — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Listar os KPIs financeiros e operacionais prioritários para o RebanhoSync.

Este documento é o índice curto.  
A matriz completa fica em `docs/finance/KPI_MATRIX_FULL.md`.

---

## Regra central

Todo KPI deve declarar:

- fonte;
- período;
- escopo;
- fórmula;
- limitações;
- status de confiabilidade.

---

## Status

| Status | Significado |
|---|---|
| MVP | Indicador prioritário e compatível com o MVP. |
| Parcial | Pode existir com limitação declarada. |
| Futuro | Requer mais modelagem. |
| Bloqueado | Não calcular sem fonte técnica explícita. |

---

## KPIs prioritários do MVP

| KPI | Status | Fonte principal |
|---|---|---|
| Animais ativos | MVP | `state_animais` |
| Animais por lote | MVP | `state_animais` / lote atual |
| Animais por pasto | MVP/Parcial | `state_animais` / pasto atual |
| Pendências abertas | MVP | agenda aberta |
| Pendências atrasadas | MVP | agenda aberta + data |
| Eventos no período | MVP | `eventos` |
| Eventos sanitários no período | MVP | `eventos` + detalhe sanitário |
| Custo sanitário por evento | MVP/Parcial | evento sanitário + snapshot |
| Custo sanitário por produto | MVP/Parcial | evento sanitário + produto/snapshot |
| Compras no período | MVP/Parcial | evento/operação de compra |
| Vendas no período | MVP/Parcial | evento/operação de venda |
| Receita de venda | MVP/Parcial | venda/snapshot |
| Custo de aquisição | MVP/Parcial | compra/snapshot |
| Margem parcial | Parcial | receita - custos conhecidos |
| Estoque consumido | Parcial | baixa de estoque |
| Ganho de peso entre pesagens | Parcial | eventos de pesagem |
| Tempo de permanência em pasto | Parcial | eventos de movimentação |
| Lotação atual | Parcial | estado atual + área |
| Lotação histórica | Parcial/Futuro | eventos + área + período |
| ECC médio do lote | Parcial | ECC individual ou registro estruturado |
| Nascimentos no período | MVP/Parcial | evento de parto/cria |
| Mortalidade no período | Parcial | evento de óbito |
| Carência sanitária ativa como sinal | MVP/Parcial | evento sanitário estruturado |

---

## KPIs bloqueados no MVP

| KPI | Motivo |
|---|---|
| Peso atual confiável | Exige política técnica própria. |
| Pronto para venda | Exige fonte comercial/técnica composta. |
| Apto para abate | Exige fonte técnica/sanitária/documental composta. |
| Lucro final | Exige custos completos e regra contábil/financeira. |
| ROI | Exige investimento, período, custos, receitas e rateios. |
| Custo por arroba atual confiável | Exige peso atual confiável. |
| DRE completa | Fora do MVP. |
| Conformidade regulatória universal | Exige fonte normativa e contrato próprio. |
| Liberação sanitária final | Carência sanitária isolada não basta. |

---

## KPIs financeiros básicos

### Receita de venda

Fonte:

- venda registrada;
- snapshot de venda.

Limitação:

- não é lucro.

---

### Custo de aquisição

Fonte:

- compra registrada;
- snapshot de compra.

Limitação:

- pode não incluir custos posteriores.

---

### Custo sanitário

Fonte:

- evento sanitário;
- produto;
- lote de estoque;
- snapshot econômico.

Limitação:

- pode ser parcial se produto/custo/lote estiver ausente.

---

### Margem parcial

Fonte:

- receita conhecida;
- custos conhecidos.

Limitação:

- não é lucro final;
- deve declarar custos ausentes.

---

## KPIs operacionais com impacto financeiro

### Ganho de peso

Fonte:

- pesagens válidas;
- datas.

Limitação:

- não usar como peso atual confiável.

---

### Lotação

Fonte:

- animais/lote/pasto;
- área;
- período, se histórico.

Limitação:

- lotação histórica exige movimentações consistentes.

---

### Permanência

Fonte:

- eventos de movimentação;
- datas de entrada/saída.

Limitação:

- estado atual não substitui histórico.

---

## Critério de aceite

Um KPI pode entrar no painel quando:

- a fonte está definida;
- o período está definido;
- a fórmula está documentada;
- a limitação é visível;
- não depende de inferência crítica;
- tem teste ou validação manual clara;
- não promete decisão comercial automática.