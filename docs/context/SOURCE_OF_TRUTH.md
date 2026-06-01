```md
# Source of Truth — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Definir quais fontes respondem cada tipo de pergunta no RebanhoSync.

Este documento existe para evitar duplicidade de fonte de verdade, inferências indevidas e uso incorreto de Agenda, Eventos, `state_*`, Protocolos, tags, sinais e insights.

---

## Regra central

```txt
Agenda = intenção/tarefa futura
Evento = fato histórico executado
state_* = estado atual/read model
Protocolo = regra/configuração
Tags, sinais e insights = auxiliares de UX/consulta

```

---

## Ordem de fonte de verdade em conflito

Em caso de conflito, confiar nesta ordem:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico em `docs/archive/`.

> ⚠️ **Observação:** `docs/archive/**` não é fonte operacional atual.

---

## Camadas oficiais

| Camada | Papel | Fonte primária para | Não serve para |
| --- | --- | --- | --- |
| `eventos` + detail tables | Histórico factual | fatos executados, linha do tempo, auditoria, KPIs históricos | intenção futura, pendência, regra |
| `agenda_itens` / `state_agenda_itens` | Intenção/tarefa futura | pendências, vencimentos, próximos manejos | histórico factual, KPI histórico |
| `state_*` | Estado atual/read model | situação corrente, status atual, leitura operacional | prova histórica completa |
| Protocolos/configurações | Regras/templates | geração/recalculo de agenda, política operacional | prova de execução |
| Tags/sinais/insights | Auxiliar visual/consulta | alerta, filtro, priorização, painel read-only | decisão crítica, fonte primária |

---

## Agenda

Agenda representa intenção operacional.

### Exemplos

* tarefa futura;
* pendência aberta;
* manejo vencido;
* manejo previsto;
* atividade planejada por protocolo.

### Agenda pode responder

* O que está pendente?
* O que vence hoje?
* O que está atrasado?
* Quais manejos estão previstos?
* Qual tarefa precisa de ação?

### Agenda não pode responder

* O que foi executado?
* Qual manejo realmente aconteceu?
* Quantas aplicações foram realizadas no mês?
* O animal está livre de carência?
* O protocolo foi executado?
* O animal está apto para venda/abate?

> ⚠️ **Regra:** Agenda concluída sem evento vinculado **não deve ser tratada como fato histórico confiável**.

---

## Eventos

Eventos representam fatos executados.

### Exemplos

* aplicação sanitária realizada;
* pesagem realizada;
* movimentação executada;
* parto registrado;
* morte registrada;
* venda realizada;
* baixa/consumo executado;
* operação financeira registrada.

### Eventos podem responder

* O que aconteceu?
* Quando aconteceu?
* Quem executou?
* Qual animal/lote foi afetado?
* Quais KPIs históricos podem ser calculados?
* Qual é a linha do tempo operacional?

### Eventos não devem responder sozinhos

* Estado atual se houver read model específico mais recente.
* Tarefa futura.
* Protocolo configurado.
* Decisão crítica sem detail técnico suficiente.

---

## Detail tables

Quando o evento tem domínio específico, o fato histórico deve ser complementado por tabelas de detalhe.

### Exemplos conceituais

| Evento | Detail esperado |
| --- | --- |
| Sanitário | produto, dose, lote de estoque, protocolo, observação técnica |
| Pesagem | peso, método, data, animal/lote |
| Movimentação | origem, destino, data, responsável |
| Reprodução | tipo, mãe, cria, parto, vínculo do episódio |
| Financeiro | valor, contraparte, categoria, vínculo operacional |
| Óbito | animal, causa, data, responsável |

> ⚠️ Sem detail suficiente, o evento pode existir, mas a resposta operacional deve declarar limitação.

---

## `state_*`

`state_*` representa estado atual/read model.

### Exemplos

* animal ativo/vendido/morto;
* lote atual;
* pasto atual;
* estágio atual, se explicitamente modelado;
* agenda materializada;
* leitura consolidada para painel.

### `state_*` pode responder

* Onde o animal está agora?
* Qual o status atual?
* Qual lote/pasto atual?
* Qual é a visão operacional corrente?
* Quais itens estão abertos agora?

### `state_*` não pode responder

* Histórico completo.
* O que aconteceu em um período.
* Quem executou determinada ação.
* Prova de execução sem evento.
* KPI histórico sem evento.

---

## Protocolos

Protocolos são regras/configurações/templates.

### Exemplos

* protocolo sanitário;
* regra de calendário;
* configuração de recorrência;
* template operacional;
* regra de geração de agenda.

### Protocolo pode responder

* Qual regra está configurada?
* Que agenda deve ser gerada?
* Qual intervalo ou sequência está prevista?
* Qual produto/regime está planejado?

### Protocolo não pode responder

* O que foi executado?
* Se o animal recebeu produto.
* Se há carência ativa ou livre.
* Se está apto para venda/abate.
* Se o protocolo foi cumprido.

---

## Tags, sinais e insights

Tags, sinais e insights são auxiliares.

### Podem

* priorizar visualmente;
* filtrar listas;
* indicar atenção;
* compor painel read-only;
* declarar limitação de resposta;
* ajudar o usuário a navegar.

### Não podem

* ser fonte primária;
* substituir evento;
* substituir agenda;
* substituir `state_*`;
* bloquear decisão crítica sozinhos;
* afirmar carência;
* autorizar venda/abate;
* afirmar peso confiável;
* provar execução de protocolo.

---

## Perguntas e fontes corretas

| Pergunta | Fonte correta |
| --- | --- |
| O que está pendente? | Agenda aberta / `state_agenda_itens` |
| O que vence hoje? | Agenda aberta com data de referência |
| O que está atrasado? | Agenda aberta com data de referência |
| O que foi feito no mês? | `eventos` + detail tables |
| Quantos manejos sanitários foram executados? | Eventos sanitários |
| Qual é o status atual do animal? | `state_animais` ou read model atual equivalente |
| Qual lote/pasto atual? | `state_*` atual ou read model equivalente |
| Qual regra sanitária está configurada? | Protocolo/configuração |
| Qual produto foi aplicado? | Evento sanitário + detail |
| O protocolo foi executado? | Evento vinculado à execução, não protocolo isolado |
| O animal está livre de carência? | Fonte técnica explícita de carência consolidada |
| O animal está pronto para venda? | Fonte técnica/comercial explícita |
| O animal está apto para abate? | Fonte técnica explícita |
| Qual foi o ganho de peso no período? | Eventos de pesagem com datas válidas |
| Qual é o peso atual confiável? | Fonte técnica explícita de peso atual confiável |

---

## Decisões bloqueadas sem fonte técnica explícita

Não automatizar nem afirmar como certo:

* carência ativa;
* livre de carência;
* peso atual confiável;
* pronto para venda;
* apto para abate;
* protocolo executado;
* agenda concluída como fato histórico;
* IATF pendente amplo;
* conformidade regulatória universal;
* liberação sanitária para trânsito sem fonte explícita.

---

## Critérios de modelagem

Antes de criar ou revisar regra, classificar:

* **É fato executado?**
* Use evento.

* **É tarefa futura ou pendência?**
* Use agenda.

* **É estado atual?**
* Use `state_*` ou read model equivalente.

* **É regra/configuração?**
* Use protocolo/configuração.

* **É alerta/filtro/apoio visual?**
* Use tag/sinal/insight.

* **É decisão crítica?**
* Exigir fonte técnica explícita e auditável.



---

## Riscos operacionais

| Risco | Consequência |
| --- | --- |
| Usar agenda como histórico | KPI falso e auditoria incorreta |
| Usar protocolo como execução | manejo não executado pode parecer cumprido |
| Usar tag como fonte primária | decisão crítica sem base técnica |
| Usar `state_*` como histórico | perda de linha do tempo |
| Criar read model concorrente | duplicidade de verdade |
| Ignorar detail tables | resposta parcial apresentada como completa |
| Ignorar `fazenda_id` | risco cross-tenant |

---

## Critério de aceite

Uma mudança respeita este contrato quando:

* histórico vem de eventos;
* futuro vem de agenda;
* estado atual vem de `state_*`;
* regra vem de protocolo/configuração;
* tag/sinal/insight permanece auxiliar;
* decisão crítica exige fonte técnica explícita;
* limitações são declaradas quando a fonte é parcial;
* não há fonte paralela de verdade.

```

```