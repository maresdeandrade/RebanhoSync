```md
# Events and Agenda Contract — RebanhoSync

## Objetivo

Definir o contrato técnico entre Agenda, Eventos, `state_*`, Protocolos, tags, sinais e insights.

---

## Regra central

```txt
Agenda ≠ Histórico
Evento = Fato
state_* = Estado atual
Protocolo = Regra
Tags/sinais/insights = Auxiliares

```

---

## Camadas

| Camada | Papel | Fonte primária para |
| --- | --- | --- |
| **Agenda** | intenção/tarefa futura | pendências, vencimentos, próximos manejos |
| **Eventos** | fato executado | histórico, auditoria, KPIs |
| **`state_*`** | estado atual/read model | situação corrente |
| **Protocolo** | regra/configuração | geração de agenda/proposta operacional |
| **Tags/sinais/insights** | auxiliar de UX/consulta | filtro, alerta, priorização |

---

## Agenda

Agenda representa:

* intenção;
* tarefa futura;
* pendência;
* item vencido;
* item a vencer;
* planejamento operacional.

> ⚠️ Agenda não comprova execução.

### Permitido

* listar pendências;
* calcular vencidos;
* calcular próximos manejos;
* orientar ação operacional;
* materializar tarefa derivada de protocolo.

### Proibido

* usar como histórico factual;
* usar agenda concluída como prova isolada de execução;
* calcular KPI histórico só com agenda;
* inferir protocolo executado sem evento;
* inferir carência/venda/abate.

---

## Eventos

Eventos representam fato executado.

Devem ser usados para:

* histórico;
* auditoria;
* KPIs;
* linha do tempo;
* comprovação operacional;
* correções históricas quando modeladas.

### Detail tables

Quando aplicável, evento base deve ter detalhe específico:

* sanitário;
* pesagem;
* nutrição;
* movimentação;
* reprodução;
* financeiro;
* óbito;
* outros domínios.

---

## `state_*`

`state_*` representa estado atual/read model.

Serve para responder:

* onde o animal está agora;
* status atual;
* lote atual;
* estágio atual, se explicitamente modelado;
* visão operacional corrente.

> ⚠️ Não serve como histórico completo.

---

## Protocolo

Protocolo representa:

* regra;
* configuração;
* template;
* calendário;
* política operacional.

> ⚠️ Protocolo não é execução.

### Permitido

* gerar agenda;
* recalcular pendências;
* orientar manejo;
* definir regra operacional.

### Proibido

* tratar como evento executado;
* afirmar que animal recebeu manejo só porque protocolo existe;
* inferir carência ativa sem fonte técnica explícita.

---

## Tags, sinais e insights

São auxiliares de UX/consulta.

### Podem

* priorizar visualmente;
* filtrar;
* sinalizar atenção;
* compor painel read-only;
* indicar limitação.

### Não podem

* ser fonte primária;
* bloquear decisão crítica sozinhos;
* provar evento;
* substituir agenda/evento/read model;
* autorizar venda/abate;
* afirmar carência ativa/livre.

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
* IATF pendente amplo.

---

## Critérios de modelagem

Antes de criar uma regra, responder:

* É fato executado?
* → Evento.

* É tarefa futura ou pendência?
* → Agenda.

* É estado atual derivado?
* → `state_*`.

* É regra/configuração?
* → Protocolo.

* É apenas sinal visual/filtro?
* → Tag/sinal/insight.


---

## Critério de aceite

Uma mudança respeita este contrato quando:

* histórico vem de evento;
* futuro vem de agenda;
* estado atual vem de `state_*`;
* regra vem de protocolo;
* tag/sinal/insight não vira fonte primária;
* decisão crítica só ocorre com fonte técnica explícita.

```

```