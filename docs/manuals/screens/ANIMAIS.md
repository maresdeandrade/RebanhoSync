# Manual da Tela — Animais

Atualizado em: 2026-07-12
**Baseline Commit:** `32d7779`

## Para que serve

A tela de Animais/Rebanho permite consultar e gerenciar os animais da fazenda.

Use para:

* cadastrar animal;
* consultar identificação;
* ver status atual;
* consultar lote/pasto atual;
* acessar histórico;
* acessar resumo sanitário contextual;
* ver pendências e sinais auxiliares.

---

## Conceitos principais

### Animal

Unidade individual de gestão.

Pode ter: identificação, sexo, raça, categoria, estágio, status, lote atual, pasto atual, histórico e sinais auxiliares.

### Status atual

Mostra a situação consolidada do animal agora.

**Exemplos:**

* ativo
* vendido
* morto
* inativo

> ⚠️ **Atenção:** Status atual não substitui histórico.

### Histórico

Histórico vem de eventos.

**Exemplos:**

* pesagem
* vacinação
* movimentação
* compra
* venda
* parto
* óbito

### Sanidade do animal

A aba Sanidade do detalhe do animal é um resumo contextual, não a Central Sanitária completa.

Ela pode mostrar:

* resumo sanitário;
* pendências documentais críticas;
* histórico sanitário de entrada;
* declarações;
* agenda sanitária futura;
* ação `Registrar histórico anterior`;
* atalho `Abrir Central Sanitária filtrada para este animal`.

Detalhes técnicos da pré-checagem devem ficar fechados por padrão.

> ⚠️ **Regra:** Agenda futura não conta como histórico executado. Histórico anterior não registra execução local da fazenda.

---

## Ações comuns

* **Adicionar animal:** Use para cadastrar um novo animal na fazenda. Preencha os dados mínimos necessários para identificação.
* **Editar animal:** Use para corrigir dados cadastrais.
> ⚠️ **Atenção:** Alterações cadastrais não devem apagar o histórico.


* **Ver histórico:** Use para consultar fatos executados relacionados ao animal.
* **Registrar manejo:** Use quando um fato novo será registrado para o animal.
* **Registrar histórico anterior:** Use quando o animal já entrou com histórico sanitário prévio documentado, declarado ou importado.
* **Abrir Central Sanitária filtrada:** Use para ver janelas, elegibilidade e planejamento completo daquele animal na Central Sanitária.

---

## Informações importantes

### Lote atual

Mostra onde o animal está alocado agora. Não representa o histórico completo de movimentação.

### Pasto atual

Mostra a localização atual, quando disponível. O histórico de permanência depende de eventos de movimentação.

### Último peso

Pode mostrar a última pesagem registrada.

> ⚠️ **Atenção:** Não significa automaticamente peso atual confiável.

### Categoria e estágio

Ajudam a classificar o animal. Não devem ser usados sozinhos para decidir: venda, abate, carência, aptidão reprodutiva ou peso confiável.

### Sinais auxiliares

A tela pode mostrar sinais como:

* animal ativo
* vendido
* morto
* sem lote
* estágio desconhecido
* pendência sanitária
* carência sanitária ativa
* sem carência sanitária vigente nas fontes estruturadas disponíveis

> 💡 **Nota:** Esses sinais ajudam a consulta, mas não substituem evento, estado ou decisão técnica.

---

## O que não interpretar errado

| Informação | Não significa |
| --- | --- |
| **Animal ativo** | Apto para venda |
| **Último peso registrado** | Peso atual confiável |
| **Sem carência sanitária vigente** | Apto para abate |
| **Animal em lote** | Histórico completo de lote |
| **Estágio definido** | Aptidão operacional automática |
| **Sem pendência** | Tudo regularizado |
| **Histórico anterior declarado** | Comprovação documental suficiente |
| **Agenda futura** | Evento sanitário executado |
| **Resumo sanitário do animal** | Planejamento completo da Central Sanitária |

---

## Boas práticas

* Manter identificação clara.
* Registrar eventos executados.
* Evitar editar dado histórico manualmente.
* Usar movimentação para trocar lote/pasto quando aplicável.
* Revisar animais sem lote.
* Verificar animais com estágio desconhecido.
* Registrar evidência documental quando houver histórico sanitário anterior à entrada.
* Usar o atalho filtrado para abrir a Central Sanitária quando precisar avaliar janelas ou planejar agenda.

---

## Erros comuns

* **“O animal está ativo, então pode vender”**
Incorreto. Venda exige fluxo próprio e validação operacional.
* **“Último peso é o peso atual”**
Não necessariamente. Peso atual confiável exige regra própria.
* **“Sem carência sanitária vigente significa liberado”**
Não. É apenas sinal sanitário limitado às fontes estruturadas disponíveis.

---

## Quando acionar suporte

Acione o suporte se:

* o animal sumiu;
* o animal duplicou;
* o status ficou incorreto;
* o histórico não aparece;
* o lote/pasto atual parece errado;
* a venda/óbito/movimentação alterou o animal incorretamente;
* os dados aparecem na fazenda errada.

---
