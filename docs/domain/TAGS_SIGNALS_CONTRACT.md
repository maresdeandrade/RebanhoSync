# Tags, Sinais e Insights — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir o contrato de uso de tags, sinais e insights no RebanhoSync.

Este documento impede que elementos auxiliares de UX sejam tratados como fonte primária, regra crítica ou prova operacional.

---

## Decisão central

Tags, sinais e insights são **auxiliares de UX/consulta**.

Eles podem ajudar o usuário a enxergar prioridades, filtros, pendências e limitações.

Eles não podem virar fonte de verdade, regra de negócio crítica ou autorização operacional.

---

## Contrato

```txt
Evento = fato
Agenda = intenção/tarefa futura
state_* = estado atual/read model
Protocolo = regra/configuração
Tags/sinais/insights = auxiliares

```

### Detalhes transversais

* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/EVENTS_AGENDA_CONTRACT.md`

---

## Definições

| Conceito | Papel |
| --- | --- |
| **Tag** | Marcador visual ou classificatório auxiliar. |
| **Sinal** | Indicação derivada para alerta, prioridade ou leitura operacional. |
| **Insight** | Composição read-only de fontes já carregadas para responder uma pergunta operacional. |

---

## Permitido

Tags, sinais e insights podem:

* alertar;
* filtrar;
* priorizar;
* agrupar;
* destacar pendências;
* compor painel read-only;
* indicar limitação;
* sinalizar fonte ausente;
* orientar navegação;
* apoiar consulta operacional.

---

## Proibido

Tags, sinais e insights não podem:

* ser fonte primária;
* substituir evento;
* substituir agenda;
* substituir `state_*`;
* substituir protocolo;
* provar execução;
* concluir agenda;
* gerar evento;
* gerar agenda;
* recalcular protocolo;
* decidir carência;
* autorizar venda;
* autorizar abate;
* afirmar peso atual confiável;
* afirmar aptidão operacional crítica;
* persistir decisão técnica sem fonte própria.

---

## Códigos permitidos como sinais auxiliares

Exemplos permitidos:

* `agenda:pendente`
* `agenda:vence_hoje`
* `agenda:atrasada`
* `sanitario:pendencia_aberta`
* `sanitario:pendencia_atrasada`
* `sanitario:carencia_ativa`
* `sanitario:sem_carencia_vigente`
* `animal:ativo`
* `animal:vendido`
* `animal:morto`
* `lote:sem_lote`
* `estagio:desconhecido`

> ⚠️ Esses sinais apenas indicam estado ou pendência com base em fonte própria.

---

## Códigos bloqueados

Não criar sinais como:

* `comercial:pronto_venda`
* `comercial:apto_abate`
* `peso:atual_confiavel`
* `sanitario:liberacao_final`
* `protocolo:executado`
* `agenda:concluida_como_fato`
* `reproducao:iatf_pendente`


> ⚠️ **Motivo:** esses temas exigem fonte técnica explícita ou modelo ainda não confirmado.

---

## Fonte primária obrigatória

Todo sinal ou insight deve declarar de onde veio.

| Pergunta | Fonte primária correta |
| --- | --- |
| Pendência futura | Agenda aberta / `state_agenda_itens` |
| Atrasado/vencendo | Agenda aberta + data de referência |
| Histórico executado | `eventos` + detail tables |
| Estado atual do animal | `state_animais` ou read model equivalente |
| Regra configurada | Protocolo/configuração |
| Produto aplicado | Evento sanitário + detail |
| Peso registrado | Evento de pesagem |
| Peso atual confiável | Fonte técnica explícita ainda não assumida |
| Carência | Fonte técnica explícita ainda não assumida |

---

## Persistência

Por padrão:

* sinais não devem ser persistidos como verdade;
* insights devem ser read-only;
* tags persistidas, se existirem, devem ser tratadas como metadado auxiliar;
* nenhuma tag persistida pode substituir evento, agenda ou read model.

---

## Insights

Insights devem:

* ser determinísticos;
* declarar fonte;
* declarar limitação;
* não fazer IO direto quando estiverem em core puro;
* não chamar Supabase/Dexie diretamente em camada pura;
* não criar agenda;
* não criar evento;
* não persistir tags;
* não decidir regra crítica.

---

## Status de resposta

Um insight pode responder como:

| Status | Significado |
| --- | --- |
| **Completo** | Fonte carregada e suficiente para a pergunta. |
| **Vazio** | Fonte carregada, sem itens. |
| **Parcial** | Fonte carregada, mas com limitações. |
| **Bloqueado** | Fonte obrigatória ausente ou decisão não permitida. |

---

## Limitações obrigatórias

Deve declarar limitação quando:

* fonte primária está ausente;
* detail técnico está incompleto;
* período não está definido;
* pergunta exige fonte crítica;
* resposta depende de validação;
* há mistura de dados atuais e históricos;
* existe apenas sinal visual.

---

## Exemplos corretos

### Correto

* **Sinal:** `agenda:atrasada`
* **Fonte:** `state_agenda_itens`
* **Uso:** destacar pendência vencida.

### Correto

* **Insight:** manejos sanitários executados no mês
* **Fonte:** `eventos` + `eventos_sanitario`
* **Uso:** KPI histórico.

### Correto

* **Status:** bloqueado
* **Pergunta:** animal livre de carência?
* **Fonte disponível:** evento sanitário
* **Fonte necessária:** regra técnica consolidada de carência

---

## Exemplos proibidos

### Proibido

* Tag "sanitário ok" autoriza venda.

### Proibido

* Agenda concluída gera KPI histórico sem evento.

### Proibido

* Insight calcula "apto para abate" com base em último peso e ausência de pendência.

### Proibido

* Protocolo aplicado significa protocolo executado.

---

## Critério de aceite

Um uso de tag, sinal ou insight é aceitável quando:

* declara fonte;
* preserva fonte de verdade;
* não substitui evento/agenda/read model/protocolo;
* não autoriza decisão crítica;
* não persiste conclusão técnica indevida;
* declara limitação quando necessário;
* funciona como apoio visual/consulta.

```


```