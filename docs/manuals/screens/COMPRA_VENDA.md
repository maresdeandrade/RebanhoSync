# Manual da Tela — Compra, Venda e Sociedade

Atualizado em: 2026-05-31

## Para que serve

A tela de Compra/Venda/Sociedade organiza operações patrimoniais e econômicas sobre animais.

Use para:

* registrar compra;
* registrar venda;
* registrar saída;
* consultar valores;
* informar contraparte;
* acompanhar vínculo econômico;
* registrar sociedade pecuária, quando disponível.

---

## Conceitos principais

### Compra

Entrada econômica ou patrimonial de animal/lote.

Pode envolver: data, animal/lote, contraparte, valor, custo e observação.

### Venda

Saída econômica de animal/lote.

Pode envolver: data, animal/lote, contraparte, valor, status final e observação.

### Sociedade pecuária

Vínculo patrimonial/econômico entre partes.

> ⚠️ **Atenção:** Sociedade não é tag visual.

---

## Regras importantes

> ⚠️ **Regras Obrigatórias:**
> * Valor de venda $\neq$ lucro final.
> * Custo ausente $\neq$ custo zero.
> * Carência sanitária $\neq$ aptidão comercial.
> * Sem carência vigente $\neq$ apto para venda/abate.
> 
> 

---

## Ações comuns

### Registrar compra

Use quando houve entrada por compra. Preencha os dados disponíveis. Se o custo não for informado, o sistema deve tratar como custo ausente, não como zero real.

### Registrar venda

Use quando houve venda real. Atenção: venda altera o estado patrimonial/status do animal quando o fluxo estiver implementado.

### Registrar sociedade

Use quando houver vínculo societário sobre animais. Informar participantes e percentuais/regras quando disponíveis.

---

## Antes de registrar venda

Verifique operacionalmente:

* animal correto;
* lote correto;
* contraparte;
* data;
* valor;
* status do animal;
* pendências relevantes;
* carência sanitária (se aplicável);
* documentação;
* decisão humana/operacional.

> ⚠️ **Atenção:** O app não deve liberar venda automaticamente apenas por sinal sanitário.

---

## Margem e custo

O app pode mostrar:

* custo de aquisição;
* valor de venda;
* custo sanitário conhecido;
* margem parcial.

Mas pode **não** incluir:

* nutrição;
* mão de obra;
* transporte;
* impostos;
* depreciação;
* custos fixos;
* rateios não modelados.

---

## O que não interpretar errado

| Informação | Não significa |
| --- | --- |
| **Valor de venda informado** | Lucro final |
| **Custo ausente** | Custo zero |
| **Margem parcial** | Resultado líquido |
| **Sem carência sanitária vigente** | Apto para venda |
| **Animal ativo** | Pronto para venda |
| **Último peso** | Peso atual confiável |

---

## Boas práticas

* Conferir animal/lote antes de confirmar.
* Informar contraparte.
* Informar valor quando disponível.
* Registrar observação em exceções.
* Não usar venda para corrigir cadastro.
* Não registrar saída sem clareza do motivo.

---

## Erros comuns

* **“O sistema mostrou sem carência, então posso vender”**
Não. Esse é um sinal sanitário limitado. Venda exige decisão operacional própria.
* **“Valor de venda é lucro”**
Não. Valor de venda é receita ou valor declarado.
* **“Custo em branco é zero”**
Não. Custo em branco é custo não informado.

---

## Quando acionar suporte

Acione o suporte se:

* venda alterou status errado;
* animal vendido continua ativo;
* compra/venda duplicou;
* valor não aparece;
* contraparte não aparece;
* sociedade ficou incorreta;
* operação foi registrada na fazenda errada;
* precisa corrigir venda/saída crítica.