# Compra, Venda e Operações Patrimoniais — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir o contrato de domínio para compra, venda, sociedade, saída, custos, contraparte, snapshots econômicos e limites de decisão comercial.

Este documento evita que status comercial, aptidão para venda/abate ou margem econômica sejam inferidos sem fonte técnica explícita.

---

## Escopo

Este documento cobre:

* compra de animais;
* venda de animais;
* saída;
* contraparte;
* sociedade pecuária;
* custo declarado;
* snapshot econômico;
* vínculo com animal/lote;
* status patrimonial;
* margem/custo como leitura parcial;
* limites de venda/abate.

---

## Contrato central

| Conceito | Fonte |
| --- | --- |
| **Compra realizada** | Evento/operação de compra |
| **Venda realizada** | Evento/operação de venda |
| **Saída patrimonial** | Evento/operação rastreável |
| **Custo histórico** | Snapshot econômico ou fonte financeira explícita |
| **Estado atual vendido** | `state_*` ou read model atualizado por evento |
| **Pronto para venda** | Fonte técnica/comercial explícita |
| **Apto para abate** | Fonte técnica explícita |

---

## Compra

Compra representa entrada patrimonial/econômica.

Pode envolver: animal individual, lote, contraparte, data, valor unitário, valor total, custos adicionais, origem, condição inicial, lote/pasto inicial e documento/anexo (se modelado).

> ⚠️ **Regra:** Compra realizada deve ser fato rastreável. Cadastro inicial sem compra não deve ser tratado automaticamente como compra.

---

## Venda

Venda representa saída patrimonial/econômica.

Pode envolver: animal individual, lote, contraparte, data, valor unitário, valor total, destino, condição de saída, custos/descontos e status final.

> ⚠️ **Regra:** Venda realizada deve gerar ou estar vinculada a fato histórico rastreável. Venda planejada não é venda executada.

---

## Saída

Saída pode ocorrer por:

* venda;
* óbito;
* transferência;
* descarte;
* abate (se modelado);
* ajuste administrativo.

> ⚠️ **Regra:** Toda saída factual deve preservar motivo, data e fonte.

---

## Contraparte

Contraparte é pessoa ou empresa relacionada à operação.

Pode ser: vendedor, comprador, parceiro, prestador, sócio, transportador ou outro agente econômico.

> ⚠️ **Regra:** Contraparte não substitui evento. Ela apenas qualifica a operação.

---

## Sociedade pecuária

Sociedade pecuária representa vínculo patrimonial/econômico entre partes sobre animais ou lote.

Pode envolver: sócios, percentual, animais vinculados, datas, regras de partilha, histórico de entrada/saída e documentos.

> ⚠️ **Regra:** Sociedade é operação patrimonial/econômica, não simples tag.

### Não confundir com

* lote;
* proprietário único;
* contraparte genérica;
* classificação visual.

---

## Custo

Custo pode ser: custo de aquisição, custo operacional, custo sanitário, custo nutricional, custo de manejo, custo rateado, custo por evento ou custo por lote.

> ⚠️ **Regra:** Custo histórico deve preservar fonte e contexto. Não recompor custo histórico apenas com estado atual de estoque ou preço atual.

---

## Snapshot econômico

Snapshot econômico é captura do valor/custo no momento da operação.

Serve para: preservar histórico, evitar recomputar com preço atual, permitir auditoria e apoiar margem.

### Deve declarar

* fonte;
* data;
* valor;
* unidade;
* vínculo operacional;
* animal/lote;
* contraparte (se aplicável).

---

## Margem e KPIs comerciais

Margem só deve ser apresentada como confiável se as fontes forem suficientes.

Exige, conforme caso: receita de venda, custo de aquisição, custos operacionais, período, rateios, animais/lote, exclusões e despesas associadas.

### Não afirmar

* lucro real;
* margem final;
* custo por arroba;
* ROI;
* resultado por lote;
* sem fonte completa e regra documentada.

---

## Pronto para venda

Status “pronto para venda” é bloqueado sem fonte técnica/comercial explícita.

### Não basta

* categoria;
* estágio;
* último peso;
* ausência de pendência;
* tag visual;
* protocolo configurado;
* agenda vazia.

### Fonte futura válida pode considerar

* peso confiável;
* status sanitário;
* carência;
* idade/categoria;
* mercado;
* preço;
* regra comercial;
* validação do produtor.

---

## Apto para abate

Status “apto para abate” é bloqueado sem fonte técnica explícita.

Pode exigir: carência, sanidade, peso, idade, documentação, legislação, regra de frigorífico, status animal e origem/destino.

> ⚠️ **Regra:** Não automatizar aptidão para abate no MVP sem fonte consolidada.

---

## Relação com sanitário

Sanitário pode influenciar compra/venda, mas não deve liberar venda/abate sozinho. Carência é bloqueada sem fonte explícita.

### Referências

* `docs/domain/SANITARIO.md`
* `docs/context/KNOWN_GAPS.md`

---

## Relação com animais

Venda/saída altera status atual do animal. Histórico deve preservar evento/operação.

### Referência

* `docs/domain/ANIMAIS_TAXONOMIA.md`

---

## Relação com lotes/pastos

Compra/venda pode operar por lote.

### Riscos

* lote misto;
* venda parcial;
* animal vendido ainda ativo no lote;
* saída sem atualizar estado;
* histórico de movimentação inconsistente.

### Referência

* `docs/domain/LOTES_PASTOS.md`

---

## Edge cases

Verificar:

* venda parcial de lote;
* animal vendido com agenda ativa;
* animal morto vendido por erro;
* animal sem custo de entrada;
* custo ausente tratado como zero;
* contraparte ausente;
* venda sem data;
* venda offline duplicada por retry;
* rollback de venda;
* animal em sociedade vendido;
* percentual de sociedade inconsistente;
* transferência confundida com venda.

---

## Indicadores possíveis

Com fonte adequada: animais por lote, animais por pasto, ocupação atual, tempo de permanência, histórico de movimentação, ganho de peso por período, taxa de lotação, rotação de pasto e saída/entrada por período.

> ⚠️ Cada indicador deve declarar fonte e limitação.

---

## Validação

Mudanças nesse domínio devem considerar:

* teste de compra;
* teste de venda;
* teste de status animal;
* teste de custo/snapshot;
* teste de rollback/retry;
* teste de sociedade, se envolvida;
* baseline Supabase se schema/RLS/RPC for alterado.

### Referências

* `docs/technical/TESTING_GATES.md`
* `.agents/skills/animal-cadastro-origem-destino/SKILL.md`
* `.agents/skills/movimentacao-transito-conformidade/SKILL.md`

---

## Critério de aceite

Uma mudança em compra/venda é aceitável quando:

* preserva fato histórico;
* atualiza estado atual de forma coerente;
* preserva snapshot econômico quando necessário;
* não infere venda/abate sem fonte;
* não trata custo ausente como custo real zero;
* respeita `fazenda_id`;
* é idempotente quando offline/sync;
* declara limitações dos KPIs.

```


```