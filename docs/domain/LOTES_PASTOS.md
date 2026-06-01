# Lotes, Pastos e Movimentação — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Definir o contrato de domínio para lotes, pastos, localização atual, movimentação, lotação e histórico de permanência.

Este documento evita confusão entre estado atual, histórico de movimentação, agrupamento operacional e indicadores produtivos.

---

## Escopo

Este documento cobre:

* lote;
* pasto;
* estrutura produtiva;
* localização atual;
* movimentação interna;
* origem/destino;
* permanência;
* lotação;
* histórico de movimentação;
* ganho de peso por período;
* limitações de cálculo.

---

## Conceitos

| Conceito | Papel |
| --- | --- |
| **Lote** | Agrupamento operacional de animais. |
| **Pasto** | Unidade física/produtiva de alocação. |
| **Movimentação** | Fato de mudança de localização/grupo. |
| **Estado atual** | Lote/pasto corrente do animal ou grupo. |
| **Histórico** | Sequência de eventos de movimentação. |
| **Lotação** | Métrica dependente de área, animais e período. |

---

## Lote

Lote é agrupamento operacional.

Pode representar: grupo de manejo, grupo sanitário, grupo comercial, grupo produtivo, grupo em um pasto ou grupo temporário.

### Lote pode responder

* quais animais estão agrupados agora;
* qual manejo pode ser aplicado ao grupo;
* qual é o estado atual do agrupamento;
* qual lote está associado a uma agenda ou evento.

### Lote não pode responder sozinho

* histórico completo de permanência;
* ganho de peso por período;
* custo total por animal;
* aptidão para venda;
* status sanitário consolidado.

---

## Pasto

Pasto é unidade física/produtiva.

Pode ter: nome, área, capacidade estimada, status, observações e lotes/animais alocados.

### Pasto pode apoiar

* localização;
* planejamento de ocupação;
* manejo de lotação;
* histórico produtivo quando há eventos suficientes.

### Pasto não pode inferir sozinho

* produtividade real;
* ganho de peso;
* tempo de lotação confiável;
* degradação;
* capacidade operacional validada.

---

## Movimentação

Movimentação é fato operacional.

> ⚠️ **Fonte correta:** Evento de movimentação.

Movimentação pode envolver: animal individual, grupo de animais, lote, pasto, origem, destino, data, responsável e motivo.

---

## Estado atual vs histórico

| Pergunta | Fonte correta |
| --- | --- |
| Onde o animal está agora? | `state_*` ou read model atual |
| Para onde o animal foi movido? | Evento de movimentação |
| Quanto tempo ficou em um pasto? | Eventos de entrada/saída + datas |
| Qual lote atual? | `state_*` |
| Qual o histórico completo? | Eventos de movimentação |

---

## Permanência

Tempo de permanência exige: data de entrada, data de saída ou data de referência, origem/destino, animal/lote identificado e eventos consistentes.

> ⚠️ **Regra:** Não calcular como fato se: há lacuna entre eventos, entrada não foi registrada, saída não foi registrada, animal foi alterado manualmente sem evento, ou o estado atual contradiz o histórico.

---

## Lotação

Lotação depende de: área do pasto, quantidade de animais, período, categoria/unidade animal (se modelada), eventos de entrada/saída e estado atual no período.

### Permitido

* exibir lotação atual com fonte declarada;
* calcular lotação histórica se eventos e área forem suficientes;
* declarar métrica parcial.

### Proibido

* afirmar taxa histórica confiável sem eventos completos;
* inferir capacidade produtiva sem fonte;
* usar lote atual como histórico completo.

---

## Ganho de peso por período

Ganho de peso exige: pesagem inicial, pesagem final, datas válidas, vínculo com animal/lote, permanência no lote/pasto no período (se a análise for por área) e regra de inclusão/exclusão.

### Não inferir

* ganho por pasto sem pesagens suficientes;
* ganho por lote se animais mudaram no período sem rastreio;
* ganho médio confiável com dados incompletos.

---

## Movimentação e agenda

Agenda pode planejar movimentação futura.

> ⚠️ **Regra:** Agenda de movimentação ≠ movimentação executada. Movimentação executada exige evento.

---

## Movimentação e compliance/trânsito

Movimentação interna não é necessariamente trânsito regulatório. Trânsito externo pode exigir: origem/destino externo, GTA, documentação, sanidade e compliance. Esses elementos não devem ser inferidos automaticamente.

### Detalhes operacionais

* Podem usar a skill: `movimentacao-transito-conformidade`.

---

## Edge cases

Verificar:

* animal sem lote;
* animal em lote inexistente;
* animal vendido ainda em lote ativo;
* animal morto ainda em pasto ativo;
* movimentação para mesmo destino;
* movimentação parcial de lote;
* saída sem entrada;
* entrada sem saída;
* eventos duplicados por retry;
* mudança manual de lote sem evento;
* área do pasto ausente;
* período de análise incompleto.

---

## Indicadores possíveis

Com fonte adequada, podem ser calculados: animais por lote, animais por pasto, ocupação atual, tempo de permanência, histórico de movimentação, ganho de peso por período, taxa de lotação, rotação de pasto e saída/entrada por período.

> ⚠️ Cada indicador deve declarar fonte e limitação.

---

## Critério de aceite

Uma mudança em lotes/pastos é aceitável quando:

* separa estado atual de histórico;
* usa evento para movimentação executada;
* usa agenda apenas como intenção;
* preserva `fazenda_id`;
* não cria relação cross-tenant;
* não calcula lotação/ganho sem fonte suficiente;
* declara limitação em dados parciais;
* preserva rollback/idempotência se houver sync.

```


```