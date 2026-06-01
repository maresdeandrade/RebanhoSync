```md
# Economic Snapshots — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir o contrato de snapshots econômicos no RebanhoSync.

Snapshot econômico é a captura de valores/custos no momento de uma operação ou evento, para preservar histórico e rastreabilidade.

---

## Princípio central

Valor histórico deve ser preservado no momento do fato.

> ⚠️ Não recompor histórico financeiro a partir de preço atual, estoque atual ou regra alterada depois.

---

## O que é snapshot econômico

Snapshot econômico é um registro dos dados financeiros relevantes no momento da execução.

Pode incluir:
- custo unitário;
- custo total;
- moeda;
- quantidade;
- unidade;
- origem do custo;
- data;
- produto;
- lote de estoque;
- animal/lote;
- contraparte;
- regra aplicada;
- observações.

---

## Onde usar

Snapshots podem ser necessários em:
- compra;
- venda;
- evento sanitário;
- baixa de estoque;
- consumo de insumo;
- movimentação econômica;
- sociedade pecuária;
- rateio aplicado;
- custo operacional.

---

## Compra

Snapshot de compra pode preservar:
- valor unitário;
- valor total;
- quantidade;
- contraparte;
- data;
- animal/lote;
- custos adicionais;
- origem declarada.

> ⚠️ **Regra:** Preço de compra histórico não deve mudar quando o cadastro ou cotação atual mudar.

---

## Venda

Snapshot de venda pode preservar:
- valor unitário;
- valor total;
- quantidade;
- contraparte;
- data;
- animal/lote;
- descontos;
- condição de venda.

> ⚠️ **Regra:** Valor de venda não é lucro final.

---

## Sanitário

Snapshot sanitário pode preservar:
- produto;
- lote de estoque;
- dose;
- quantidade;
- unidade;
- custo unitário;
- custo total;
- regra de carência aplicada, se modelada;
- data do evento.

> ⚠️ **Regra:** Custo sanitário histórico não deve depender do custo atual do lote de estoque.

---

## Estoque

Snapshot de estoque pode preservar:
- lote;
- custo de entrada;
- custo unitário resolvido;
- quantidade consumida;
- unidade;
- validade;
- fornecedor;
- data de entrada.

> ⚠️ **Regra:** Baixa de estoque deve ser idempotente e auditável.

---

## Sociedade pecuária

Quando houver sociedade, o snapshot pode preservar:
- sócios;
- percentuais;
- animais envolvidos;
- data;
- valor associado;
- regra de partilha.

> ⚠️ **Regra:** Sociedade não deve ser tratada como tag visual.

---

## Fonte do snapshot

O snapshot deve indicar origem:

- `manual`
- `estoque`
- `compra`
- `protocolo`
- `evento`
- `rateio`
- `importado`
- (ou equivalente).

### Snapshot parcial
Se parte dos dados estiver ausente, o snapshot pode ser parcial. Deve declarar limitação.

> 💡 **Exemplo:** `Snapshot parcial: lote de estoque sem custo unitário.`

### Alteração posterior
Alterar cadastro, produto, estoque ou protocolo depois não deve alterar o snapshot histórico. 

Se houver correção, usar:
- correção auditável;
- novo evento;
- estorno;
- contra-lançamento;
- campo de correção, se modelado.

> ⚠️ Não editar silenciosamente o histórico.

---

## Relação com eventos

Eventos são fatos históricos. Quando o evento tem impacto econômico, deve preservar snapshot suficiente para auditoria.

### Exemplos
- evento sanitário com baixa;
- venda;
- compra;
- movimentação econômica.

---

## Relação com sync/offline

Snapshots devem ser compatíveis com offline-first.

### Regras
- salvar localmente com dados disponíveis;
- preservar idempotência;
- evitar duplicidade em retry;
- permitir rollback;
- reconciliar divergências;
- não depender de consulta remota posterior para definir custo histórico crítico.

---

## Edge cases

Verificar:
- snapshot sem fonte;
- custo ausente;
- custo zero real;
- produto alterado depois;
- estoque alterado depois;
- protocolo alterado depois;
- retry duplicando baixa;
- correção de custo;
- venda parcial;
- rateio recalculado;
- sync parcial;
- rollback de evento com snapshot.

---

## Critério de aceite

Snapshot econômico é aceitável quando:

- [ ] captura o valor relevante no momento do fato;
- [ ] declara a fonte;
- [ ] distingue dado ausente de valor zero;
- [ ] preserva o histórico;
- [ ] não depende do preço atual para reconstituir o passado;
- [ ] suporta auditoria;
- [ ] funciona offline;
- [ ] mantém vínculo com evento/operação.

```