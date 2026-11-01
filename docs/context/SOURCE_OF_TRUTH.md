```md
# Source of Truth — RebanhoSync

Atualizado em: 2026-10-30

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
Contexto operacional explícito = entrada declarada para pré-checagem
Tags, sinais e insights = auxiliares de UX/consulta
Fechamento de agenda = estado administrativo da intenção

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
| Produto/fonte técnica sanitária | dose, via, apresentação, carência e fonte crítica | regra sanitária tecnicamente justificada, carência vinculada ao produto | execução sem evento |
| Contexto operacional sanitário | entrada estruturada declarada | pré-checagem/preview e snapshot de planejamento | fonte técnica primária, execução, carência, liberação |
| Demanda/preview sanitário | derivado operacional | agrupamento, simulação e planejamento | histórico, agenda persistida, evento |
| Histórico sanitário de entrada | fato anterior à entrada, com origem/evidência | pré-checagem conservadora e auditoria documental | execução local, baixa de estoque, carência automática |
| Fechamento de agenda | estado administrativo da intenção | encerramento/cancelamento/dispensa da tarefa | fato sanitário executado |
| Conformidade Sanitária v2 | read model local derivado/somente leitura | leitura conservadora por animal, lote, protocolo e item | fonte primária, liberação operacional |
| Status de sync | estado técnico de transporte/reconcile | retry, suporte e auditoria técnica | prova de execução, conformidade ou liberação |
| Tags/sinais/insights | Auxiliar visual/consulta | alerta, filtro, priorização, painel read-only | decisão crítica, fonte primária |

---

## Política de registro, alertas e elegibilidade

Política de produto consolidada em 30/10/2026. RebanhoSync é plataforma de gestão: registra intenções, fatos e evidências; não emite autorização ou proibição sanitária/fiscal de trânsito. Registrar um fato não o torna regular, documentalmente verificado ou elegível para certificação. Obrigações e decisões de autoridades externas continuam externas ao sistema.

Esta matriz é normativa. O [mapa GTA-03/CAS-02](../review/GTA_03_CAS_02_POLICY_20261030.md) distingue diagnóstico de entrada, adequação funcional local e limites de reconciliação/certificação. Resultados de implementação exigem evidência própria; a matriz sozinha não os comprova.

### Matriz canônica de decisão

As ações podem coexistir. **REGISTRAR** exige identidade, vínculos e estrutura tecnicamente válidos; **ALERTAR** conserva evidência e incerteza; **CONDICIONAR ELEGIBILIDADE** aplica somente ao programa/avaliação ou à recomendação prospectiva explicitamente identificada; **BLOQUEAR POR INTEGRIDADE TÉCNICA** impede escrita insegura, nunca representa fiscalização do fato.

| Situação | REGISTRAR | ALERTAR | CONDICIONAR ELEGIBILIDADE | BLOQUEAR POR INTEGRIDADE TÉCNICA |
| --- | --- | --- | --- | --- |
| Fato ocorrido com GTA ausente, checklist incompleto ou documento não verificado | Sim, com declaração/proveniência e lacunas preservadas | Todos os avisos aplicáveis | Somente avaliação específica; não afirmar documento válido | Não pela pendência documental |
| Fato ocorrido com caso sanitário aberto, restrição ou carência | Sim, sem apagar a inconformidade | Fonte, casos/restrições e possível divergência da projeção | Independente do registro; depende do programa e fonte | Não pela condição sanitária em si |
| Atualização de estado decorrente de fato já ocorrido | Sim, pelo writer do domínio e revisão válida | Preservar restrições e conflito caso/projeção | Estado atualizado não comprova aptidão | Sim para CAS stale, identidade ou vínculos inválidos; preservar fatos já aplicados |
| Planejamento manual genérico | Sim como Agenda/intenção, sem simular execução | Limitações, contraindicações e dados faltantes | Não inferir elegibilidade, produto, dose ou liberação | Sim se a própria intenção tiver identidade/estrutura inválida |
| Sugestão técnica, esquema definido ou automação | Só materializar intenção com o contrato próprio satisfeito | Explicar condições não atendidas | Condicionar recomendação/automação à regra, versão, fontes e contexto; oferecer planejamento genérico quando cabível | Não fabricar regra, dose, Evento ou execução para contornar requisito |
| Documento declarado/anexado sem verificação da fonte | Registrar declaração ou evidência disponível | Verificação e validade desconhecidas/pendentes | Não classificar como válido/comprovado por mera presença | Sim para vínculo/tenant/identidade inválidos, não por falta de verificação externa |
| Avaliação de conformidade/certificação | Registrar avaliação somente em escopo definido | Programa, versão, critérios, fonte e lacunas | Elegibilidade específica; desconhecido não equivale a elegível | Sim para integridade/autorização técnica da avaliação; não bloquear o histórico da fazenda |
| RLS, fazenda divergente, FK inválida, identidade conflitante ou CAS stale | Não aplicar a mutação inválida; conservar trabalho e fatos válidos | Motivo técnico e resultado por operação | Não converter falha de sync em avaliação sanitária | Sim; sem bypass, rebase silencioso ou sucesso fictício |

Fato ocorrido e intenção futura devem ser explicitamente distinguidos pelos callers. Não tornar todos os guards avisos por filtragem de texto nem atribuir a pendência clínica/documental a uma falha técnica. Dados obrigatórios do contrato implementado não são fabricados para registrar informação desconhecida; eventual registro incompleto exige contrato próprio de lacunas, sem dispensar RLS, FKs ou identidade.

### Alertas sanitários e projeções divergentes — CAS-02A

`sanitario_casos` expressa o estado do caso, Eventos preservam os fatos/vínculos e `animal.payload.sanidade_alerta` é projeção/compatibilidade. A leitura deve considerar todos os casos da mesma fazenda/animal, não só o primeiro/mais recente. Caso não excluído em `aberto` ou `em_acompanhamento`, com `closed_at=null` e `movement_blocked=true`, sustenta alerta de restrição, mesmo com payload stale, ausente ou sem bloqueio. O nome legado `movement_blocked` não constitui proibição emitida pelo aplicativo.

Combinar essa evidência com alertas legados ainda presentes no payload e demais restrições independentes, preservando a origem de cada sinal. Caso encerrado/cancelado/excluído não sustenta sozinho alerta de caso aberto; seu encerramento não limpa outro caso nem resolve silenciosamente sinal legado sem vínculo comprovado. Estado incoerente ou cobertura parcial deve ser apresentado como desconhecido/divergente, não como ausência confirmada de restrição.

A leitura compartilhada deve alimentar os fluxos, não ficar restrita a um componente ou cache booleano paralelo. Offline só se conhecem os dados disponíveis; ausência local de caso não comprova ausência remota. Troca de fazenda invalida o recorte anterior. Nenhum desses alertas, isoladamente, impede registro factual. A consulta autoritativa de programa futuro deve validar suas fontes no backend; não introduzir uma barreira sanitária universal no banco para registrar fatos.

### Reconciliação de projeções — CAS-02B

CAS continua autoritativo no PostgreSQL. Uma gesture pode ter fatos aplicados e projeção rejeitada: distinguir resultados por operação, preservar ambos e não apresentar sucesso integral. Pull não repara automaticamente uma intenção perdida nem certifica conformidade. Resolver leitura derivada primeiro; corrigir projeção persistida apenas quando o consumidor realmente exigir e houver contrato de auditoria demonstrado.

Uma correção exclusivamente técnica usa snapshot atual, nova identidade operacional e vínculo auditável à operação rejeitada e aos Eventos/casos existentes. Preserva `client_op_id`, `client_tx_id`, `expected_revision` e `before_snapshot` originais; não recria fatos, encerra casos ou altera decisões sanitárias. Preservar campos não relacionados do payload. Mudança concorrente relevante do animal ou dos casos exige nova reconciliação explícita, sem merge/rebase silencioso.

O contrato deve provar replay, resultado terminal e recuperação após ACK perdido/restart, inclusive depois de outra mutação do animal, sem usar apenas a última identidade da linha como auditoria histórica. Reutilizar mecanismos existentes somente com suficiência demonstrada; se precisar de novo armazenamento/comando transacional, entregar proposta específica antes de implementação. Não criar ledger genérico ou nova fonte clínica antecipadamente.

### Camada futura de conformidade/certificação

Definir por programa: finalidade, responsável pela avaliação, jurisdição, vigência/versão da regra, fonte verificável, identidade/proveniência da evidência e critérios de elegibilidade. Distinguir declarado, evidência disponível, verificação pendente/desconhecida e verificação confirmada pela fonte; anexar documento não o valida. Avaliação negativa ou desconhecida não apaga fato nem impede seu registro. Nenhum estado do aplicativo substitui decisão do emissor/autoridade competente.

Não implementar certificador, motor regulatório universal, integração oficial, PNIB/SISBOV ou infraestrutura genérica por esta política. Catálogos, janelas, curadoria, recomendações e automações existentes mantêm seus contratos específicos; não representam autorização oficial nem devem ser usados como rejeição retrospectiva do fato.

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

Cancelamento e dispensa encerram a intenção e não criam fato sanitário.

### Agenda Sanitária v2

Na Agenda Sanitária v2, os comandos puros têm papéis separados:

| Comando | Papel | Não pode fazer |
| --- | --- | --- |
| `agenda_intent` | materializar intenção futura em core puro | criar evento, baixar estoque, calcular carência |
| `event_execution_intent` | representar execução sanitária como evento futuro | persistir evento automaticamente, fechar agenda por si só |
| `agenda_closure_intent` | fechar administrativamente a intenção | criar histórico sanitário, criar evento, baixar estoque |

Demanda agrupada e preview operacional são derivados. Eles não são fonte primária de histórico, não substituem agenda persistida e não calculam carência ativa.

Agenda sanitária manual local em `ops_sanitario_agenda_v2` é intenção futura. Reagendar agenda não executada altera apenas a data planejada; cancelar agenda não executada altera apenas o status da agenda.

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

### Produto e fonte técnica sanitária

Produto sanitário e fonte técnica explícita são fontes para dose, via, apresentação e carência planejada. Carência confiável exige produto executado em evento sanitário e fonte técnica explícita.

Guideline isolado não deve ser tratado como fonte única de decisão crítica.

### Contexto operacional sanitário

Contexto operacional sanitário é entrada explícita do usuário para protocolos que dependem de condição externa, como área de risco para raiva, cadência anual/semestral, contexto reprodutivo ou manejo.

Pode responder:

* qual contexto foi usado na pré-checagem;
* por que uma janela deixou de estar ambígua;
* qual snapshot de planejamento foi usado ao criar agenda manual.

Não pode responder:

* se o protocolo foi executado;
* se há carência ativa;
* se venda, abate, leite ou aptidão operacional estão liberados;
* qual é a fonte técnica primária da regra.

### Histórico sanitário de entrada

Histórico sanitário de entrada representa fato sanitário anterior à entrada no app/fazenda.

Pode ser:

* interno executado;
* externo documentado;
* externo declarado;
* importado legado.

Uso correto:

* externo documentado pode apoiar pré-checagem quando houver vínculo suficiente com protocolo/item e referência de evidência estruturada;
* declaração sem documento gera aviso ou pendência documental;
* legado ambíguo não libera regra crítica.

Regras adicionais:

* `external_declared` não comprova regra crítica;
* `external_documented` exige referência documental para comprovação crítica;
* execução parcial vale somente para animais vinculados ao Evento;
* resposta ou status de sync não altera a força probatória da origem.

Não pode:

* criar execução local;
* criar agenda automática;
* baixar estoque;
* calcular carência ativa automaticamente;
* substituir evento interno executado.

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
| Há histórico sanitário anterior suficiente? | Evento interno ou histórico externo documentado vinculado ao protocolo/item |
| A janela sanitária depende de contexto externo? | Pré-checagem + contexto operacional explícito informado |
| Qual animal/lote está filtrado na Central Sanitária? | Query params + filtro visual aplicado, sem virar fonte de verdade |
| O animal está livre de carência? | Fonte técnica explícita de carência consolidada |
| O animal está pronto para venda? | Fonte técnica/comercial explícita |
| O animal está apto para abate? | Fonte técnica explícita |
| A execução parcial vale para quais animais? | Relação factual Evento–Animal |
| O sync foi aplicado? | Resultado técnico por operação; não prova execução sanitária por si só |
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
* histórico externo declarado como comprovação crítica;
* histórico externo documentado sem referência como comprovação crítica;
* resposta de sync como liberação de venda, abate, leite ou aptidão;
* contexto operacional como fonte técnica primária;
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
