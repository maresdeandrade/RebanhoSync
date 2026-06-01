# Manual da Tela — Lotes e Pastos

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Para que serve

A tela de Lotes e Pastos ajuda a acompanhar a estrutura produtiva da fazenda.

Use para:

* consultar lotes;
* consultar pastos;
* ver animais alocados;
* acompanhar localização atual;
* apoiar movimentações;
* observar ocupação e organização do rebanho.

---

## Conceitos principais

### Lote

Agrupamento operacional de animais.

**Exemplos:**

* lote de recria;
* lote de engorda;
* lote de vacas paridas;
* lote de bezerros.

### Pasto

Área física/produtiva da fazenda.

**Exemplos:**

* Pasto 01;
* Piquete A;
* Curral;
* Área de maternidade.

---

## Estado atual

A tela pode mostrar onde os animais estão agora. Isso não substitui o histórico.

> 💡 O histórico de permanência depende de eventos de movimentação.

---

## Ações comuns

* **Criar lote:** Use para organizar grupos de animais.
* **Criar pasto:** Use para cadastrar áreas produtivas.
* **Ver animais do lote:** Mostra os animais atualmente vinculados ao lote.
* **Registrar movimentação:** Use quando animais mudarem de lote, pasto ou localização.

---

## Movimentação

A movimentação executada deve ser registrada como fato.

> ⚠️ **Regra:** Movimentação planejada = agenda. Movimentação executada = evento.

---

## Indicadores possíveis

A tela pode apoiar:

* quantidade de animais por lote;
* quantidade de animais por pasto;
* ocupação atual;
* permanência (se houver eventos suficientes);
* histórico de movimentação (se registrado);
* ganho de peso por período (se houver pesagens válidas);
* ECC médio do lote (se houver ECC individual estruturado).

---

## Limitações

### Lotação histórica

Depende de: entrada, saída, datas, área, animais/lote e eventos consistentes.

### Ganho de peso

Depende de: pesagem inicial, pesagem final, datas válidas, vínculo com animal/lote e período definido.

### ECC médio

Depende de ECC individual ou registro estruturado. O ECC global de pasto não deve ser tratado automaticamente como ECC individual de cada animal.

---

## O que não interpretar errado

| Informação | Não significa |
| --- | --- |
| **Animal aparece no pasto** | Histórico completo de permanência |
| **Lote tem animais** | Lotação ideal |
| **Pasto vazio** | Nunca teve animais |
| **Último peso do animal** | Ganho de peso do lote |
| **ECC médio parcial** | Estado corporal confiável de todo o lote |
| **Movimentação prevista** | Movimentação executada |

---

## Boas práticas

* Registrar movimentações reais.
* Conferir lote/pasto atual após movimentação.
* Evitar alterar localização apenas por edição manual se o fluxo correto for movimentação.
* Registrar pesagens quando quiser calcular ganho de peso.
* Registrar ECC individual quando quiser média confiável por lote.

---

## Erros comuns

* **“O animal está neste pasto, então sempre esteve aqui”**
Incorreto. Isso é o estado atual.
* **“Consigo calcular ganho de peso sem pesagem”**
Não. O ganho de peso exige pesagens válidas.
* **“Pasto sem animal agora significa sem ocupação no período”**
Não. Para período histórico, use eventos de movimentação.

---

## Quando acionar suporte

Acione o suporte se:

* animal aparece em lote errado;
* pasto não mostra os animais esperados;
* movimentação duplicou;
* movimentação não atualizou estado atual;
* histórico de movimentação parece incompleto;
* dados aparecem na fazenda errada.