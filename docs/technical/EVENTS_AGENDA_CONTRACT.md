```md
# Events and Agenda Contract — RebanhoSync

Atualizado em: 2026-06-06
**Baseline Commit:** `32d7779`

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
Fechamento de agenda = estado administrativo da intenção

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

## Agenda Sanitária v2

A Fase 11.5 consolidou a Agenda Sanitária v2 como contrato core puro/documental. Este contrato ainda não representa schema, migration, RLS, Dexie, sync-batch, RPC ou UI implementados.

Pipeline conceitual:

```txt
Regra/produto/fonte técnica
-> janela sanitária
-> elegibilidade individual
-> demanda agrupada
-> preview operacional
-> agenda_intent
-> event_execution_intent
-> agenda_closure_intent
```

### Camadas v2

| Camada | Papel | Fonte primária para | Não serve para |
| --- | --- | --- | --- |
| Regra/protocolo | configuração sanitária com fonte técnica | critério operacional, janela, produto esperado | execução |
| Produto/fonte técnica | dose, via, apresentação e carência | carência e aplicação tecnicamente descrita | histórico sem evento |
| Janela sanitária | período operacional derivado | elegibilidade e planejamento | evento executado |
| Elegibilidade | cálculo derivado por animal | status operacional derivado | histórico |
| Demanda agrupada | leitura derivada de elegibilidade/lote/janela | agrupamento operacional | agenda, evento, carência |
| Preview operacional | simulação editável | planejamento antes da confirmação | persistência, evento, estoque |
| `agenda_intent` | intenção de agenda materializada em core puro | planejamento futuro | histórico, estoque, carência |
| `event_execution_intent` | intenção de registrar execução sanitária como evento futuro | fronteira de execução | persistência automática |
| `agenda_closure_intent` | intenção de fechamento administrativo | estado da intenção | evento, histórico sanitário |

### Materialização idempotente

`agenda_intent` representa planejamento sanitário confirmado em core puro.

Regras:

* usa `dedupKey` estável;
* preserva vínculo com `previewGroupId` e `sourceDemandKey`;
* rejeita data ausente, inválida ou fora da janela;
* não cria evento;
* não baixa estoque;
* não calcula carência;
* não autoriza venda/abate.

### Execução sanitária

`event_execution_intent` representa uma intenção de evento sanitário executado.

Regras:

* declara `createsEvent: true`;
* declara `persistsEvent: false`;
* execução parcial exige motivo para animais planejados não executados;
* produto executado não é inferido automaticamente do produto planejado;
* baixa de estoque futura deve nascer do evento real, não da agenda.

### Fechamento administrativo

`agenda_closure_intent` representa fechamento da intenção, não fato sanitário.

Tipos conceituais preservados nos contratos TypeScript:

* `executed_with_event`;
* `partially_executed_with_event`;
* `closed_without_execution`;
* `cancelled`;
* `dismissed`.

Regras:

* fechamento executado/parcial exige evento compatível;
* fechamento parcial preserva animais planejados não executados e exige motivo;
* fechamento sem execução, cancelamento e dispensa exigem motivo;
* fechamento sem execução, cancelamento e dispensa rejeitam evento informado por engano;
* fechamento não cria evento;
* fechamento não cria histórico sanitário;
* fechamento não baixa estoque;
* fechamento não calcula carência.

### Nomenclatura ainda não persistida

Não tratar como enum/schema real enquanto não houver migration correspondente:

* agenda aberta/programada;
* fechamento executado com evento;
* fechamento parcial com evento;
* fechamento sem execução;
* cancelamento;
* dispensa.

Não documentar como persistidos os status conceituais `aberta`, `programada`, `concluido_executado`, `cancelado`, `dispensado` e `fechado_sem_execucao` sem migration/schema específica.

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
* reconciliar pendência aberta com evento executado quando escopo e manejo forem equivalentes.

### Proibido

* usar como histórico factual;
* usar agenda concluída como prova isolada de execução;
* calcular KPI histórico só com agenda;
* inferir protocolo executado sem evento;
* inferir carência/venda/abate.

### Reconciliação Agenda -> Evento

Uma pendência pode ser marcada como concluída por evento quando a execução real gera `source_evento_id` e o escopo é compatível.

* Registro individual: reconciliar apenas com item do mesmo `animal_id`.
* Registro por lote: tratar o lote como atalho de seleção e reconciliar itens individuais dos animais com o mesmo `lote_id`.
* Registro por lote deve concluir no máximo o item compatível mais antigo de cada animal.
* Item individual não deve ser concluído por evento de lote se tipo/produto ou protocolo não forem compatíveis.
* Ação direta "Concluir tarefa" deve criar ou vincular evento conforme contrato do domínio, não apenas alterar status local.

### Ação agrupada na Agenda

O botão agregado "Registrar" depende do modo de agrupamento:

* Agrupamento por tipo de demanda pode oferecer ação agrupada para registrar o mesmo manejo em múltiplos animais.
* Agrupamento por animal só pode oferecer ação agrupada quando existir uma única demanda aberta no grupo.
* Se o animal tiver múltiplas demandas abertas, cada item deve ser registrado individualmente para preservar produto, protocolo, dose, estoque e demais detalhes de execução.
* Agrupamento por evento/demanda deve identificar produto, protocolo/marco e dose quando disponíveis; rótulos genéricos como "Vacina" não bastam quando houver múltiplas vacinas acumuladas.

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
