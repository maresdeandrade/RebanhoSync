# RebanhoSync — Auditoria do Estado Real e Contrato de Fontes de Verdade

| Campo | Valor |
|---|---|
| Status | Documento ajustado pós-validação Codex |
| Natureza | Consolidação técnica somente leitura |
| Escopo | Agenda, eventos, `state_*`, protocolos, recompute, deduplicação, conclusão/cancelamento, fontes de verdade e lacunas operacionais |
| Base | Consolidação das análises derivadas dos Prompts 1 e 2 + validação Codex pós-auditoria |

---

## 0. Objetivo do documento

Este documento consolida, em formato validável, dois blocos centrais:

1. **Auditoria do estado real** do RebanhoSync, baseada nas análises já realizadas.
2. **Contrato de fontes de verdade**, para orientar as próximas propostas de camada `insights`, marcadores inteligentes, MVP, UX operacional, relatórios e consultas futuras.

Este documento não propõe implementação. Ele organiza o que está validado, parcialmente validado, inferido, não confirmado no código inspecionado ou bloqueado até este ponto.

---

## 1. Critérios de classificação

| Classificação | Significado |
|---|---|
| **validado** | Evidência consistente nas análises consolidadas, com arquivo, função, tabela, migration, teste ou fluxo citado. |
| **parcialmente validado** | Existe evidência de parte do fluxo, mas não do comportamento completo ou da fonte consolidada. |
| **inferido** | Dedução razoável a partir da arquitetura ou de nomes/campos, mas sem comprovação explícita suficiente. |
| **não confirmado no código inspecionado** | Não há evidência suficiente nas análises fornecidas. |
| **bloqueado** | Não deve orientar decisão funcional/crítica até nova inspeção ou criação de fonte consolidada. |
| **bloqueado como fonte primária** | Pode até existir como dado auxiliar, mas não pode comprovar a pergunta operacional. |

---

## Parte 1 — Auditoria do estado real

---

### 2. Veredito executivo da auditoria

| Tema | Estado consolidado |
|---|---|
| Agenda | validada como camada mutável de intenção/tarefa operacional. Não é histórico factual. |
| Eventos | validados como camada factual/histórica, estruturados em `eventos` + detail tables. |
| `state_*` | validado como estado corrente/read model local/offline via Dexie. |
| Protocolos | validados como regras, templates ou configurações. Não são execução realizada. |
| Sanitário | Domínio mais maduro: recompute, dedup, agenda protocolar, RPC de conclusão e views/read models. Compliance sanitário está parcialmente validado e não deve ser tratado como bloqueio operacional completo e universal sem nova validação. |
| Reprodução/cria | Jornada da cria pós-parto possui geração automática validada/parcialmente validada. Motor geral reprodutivo/IATF não confirmado no código inspecionado. |
| Pesagem | Evento factual validado. Peso atual consolidado não confirmado no código inspecionado. |
| Nutrição | Evento factual validado. Agenda automática geral não confirmada no código inspecionado. |
| Movimentação | Evento factual validado. Pode alterar lote atual do animal. Agenda automática geral não confirmada no código inspecionado. |
| Financeiro/comercial | Eventos de compra/venda parcialmente validados. Aptidão para venda/abate não consolidada. |
| Óbito | Evento/estado parcialmente validado; pode cancelar agendas informadas. Cancelamento universal não confirmado no código inspecionado. |
| Tags/marcadores | Não existe camada real de marcadores/tags no repositório. Termos como tag, label, badge, chip, status e classificação aparecem em UI, identificação ou domínio, mas não constituem camada de marcadores operacionais. |
| Carência | Há base parcial em produto/protocolo/evento sanitário, mas não há fonte operacional consolidada validada. |
| Pronto para venda/abate | Não há regra/read model único validado. Deve permanecer bloqueado como decisão automatizada. |

---

### 3. Separação conceitual obrigatória

| Camada | Significado no RebanhoSync | Status |
|---|---|---|
| `state_*` | Estado corrente/read model local/offline. | validado |
| `event_*` / `eventos*` | Histórico factual de ocorrências realizadas. | validado |
| `state_agenda_itens` / `agenda_itens` | Intenção futura/tarefa operacional mutável. | validado |
| Protocolos | Regra, template ou configuração aplicável. | validado |
| Compliance/bloqueios | Interpretação operacional/regulatória baseada em regras e estado. | parcialmente validado |
| Tags/marcadores | Classificação/filtro/sinalização futura possível. | não confirmado no código inspecionado |
| Relatório operacional | Saída derivada; não é fonte primária. | validado como conceito |

---

### 4. Agenda — comportamento real consolidado

| Item | Estado consolidado | Classificação | Observação |
|---|---|---|---|
| Agenda como camada mutável | `agenda_itens` / `state_agenda_itens` representa tarefa/intenção operacional. | validado | Não é evento histórico. |
| Store local da agenda | `agenda_itens` remoto mapeia para `state_agenda_itens`. | validado | Parte do modelo offline-first. |
| Geração automática sanitária | Protocolos/itens sanitários elegíveis podem gerar agenda. | validado | Domínio mais bem comprovado. |
| Scheduler TS sanitário | Motor determinístico puro de elegibilidade/materialização. | parcialmente validado | Persistência efetiva aparece mais fortemente no SQL/gestos. |
| Recompute sanitário por animal | Há RPC/função de recompute sanitário por animal, mas o disparo automático por alteração de dados do animal não foi confirmado no código inspecionado. | parcialmente validado / não confirmado quanto ao disparo automático por mutação do animal | O recompute por protocolo/config foi mais claramente validado. |
| Recompute por protocolo/config | Alterações em protocolos/config sanitária podem disparar recompute. | validado | Citado via `sync-batch`/RPC/migrations. |
| Job periódico independente | Não evidenciado. | não confirmado no código inspecionado | Não assumir recompute periódico autônomo. |
| Deduplicação | Dedup por `dedup_key` canônico e índice único parcial para agenda ativa/agendada. | validado | Essencial para evitar duplicidade operacional. |
| Jornada da cria | Parto/cria pode gerar agendas como umbigo, D7, D30, desmame. | parcialmente validado | Ligado à jornada da cria, não a motor reprodutivo geral. |
| Agenda geral de reprodução/IATF | IATF aparece como termo/opção/label em partes do sistema, mas não foi confirmado como engine geral persistido de agenda reprodutiva. | não confirmado no código inspecionado | Não assumir automação reprodutiva ampla. |
| Conclusão sanitária direta | Pode chamar RPC que cria/vincula evento sanitário e conclui agenda. | validado | Fluxo sanitário é especial. |
| Conclusão via Registrar | Quando há `sourceTaskId` e evento vinculado, agenda pode ser concluída com `source_evento_id`. | validado | Agenda vinculada a evento factual. |
| Conclusão direta não sanitária | Atualiza status da agenda. Evento não confirmado. | parcialmente validado | Não tratar como execução factual. |
| Cancelamento pela agenda | Atualiza status para `cancelado`. | parcialmente validado | Evento de cancelamento não confirmado. |
| Cancelamento por recompute sanitário | Recompute pode cancelar itens não elegíveis/invalidados. | parcialmente validado | Escopo sanitário. |
| Cancelamento por óbito | Pode ocorrer se agendas forem informadas. | parcialmente validado | Cancelamento universal/zumbi não descartado. |
| Agenda concluída altera evento | Não evidenciado. | não confirmado no código inspecionado | Relação correta é evento como fato; agenda guarda vínculo. |
| Evento sanitário fecha agenda | validado em fluxos vinculados. | validado | Depende de vínculo/regra. |
| Agenda órfã/zumbi | Possível em casos de soft delete, venda/óbito sem cancelamento, protocolo removido ou falha de reconcile. | inferido / parcialmente validado | Deve ser tratado como risco arquitetural. |

---

### 5. Eventos históricos — comportamento real consolidado

| Item | Estado consolidado | Classificação |
|---|---|---|
| Tabela principal | `eventos` é a tabela factual base. | validado |
| Detail tables | `eventos_sanitario`, `eventos_pesagem`, `eventos_nutricao`, `eventos_movimentacao`, `eventos_reproducao`, `eventos_financeiro`. | validado |
| Domínios citados | Sanitário, alerta sanitário, conformidade, pesagem, nutrição, movimentação, reprodução, financeiro, óbito. | parcialmente validado |
| Append-only | Eventos possuem proteção contra update destrutivo de negócio via trigger/função, com exceções técnicas controladas como metadados, `deleted_at`, `updated_at` e `server_received_at`. | parcialmente validado |
| Correção de evento | Correção histórica por `corrige_evento_id` é parcialmente validada: o campo existe, mas o fluxo completo de correção não foi confirmado. | parcialmente validado |
| Sanitário | Evento base + detail sanitário; pode fechar agenda vinculada. | validado |
| Pesagem | Evento base + detail de pesagem. Peso atual não consolidado. | parcialmente validado |
| Nutrição | Evento base + detail de nutrição. Estado atual derivado não confirmado. | parcialmente validado |
| Movimentação | Evento pode alterar lote atual do animal. | parcialmente validado |
| Financeiro | Evento financeiro; venda pode alterar status do animal. | parcialmente validado |
| Compra financeira | Pode criar animais e evento de pesagem de entrada. | parcialmente validado |
| Reprodução | Evento reprodutivo; parto pode gerar cria, agenda da cria e atualizar fatos taxonômicos. | parcialmente validado |
| Óbito | Atualiza animal para morto e pode cancelar agendas informadas. | parcialmente validado |

---

### 6. Estado atual `state_*` — comportamento real consolidado

| Item | Fonte primária/estrutura | Estado consolidado | Classificação |
|---|---|---|---|
| Animal | `state_animais` / `animais` | Estado corrente do animal. | validado |
| Lote | `state_lotes` / `lotes` | Estado corrente do lote. | validado |
| Pasto | `state_pastos` / `pastos` | Estado corrente do pasto. | parcialmente validado |
| Sexo | Campo do animal | Usado em elegibilidade/regras. | validado |
| Idade | Derivada de `data_nascimento` | Não é necessariamente campo persistido. | validado como derivado |
| Categoria/estágio | Derivação taxonômica/payload/config | parcialmente validada. | parcialmente validado |
| Peso histórico | `eventos_pesagem` | Histórico validado. | validado |
| Peso atual | Última pesagem/read model/payload | Fonte consolidada não confirmada no código inspecionado. | bloqueado |
| Status reprodutivo | Eventos reprodutivos, payload, taxonomy facts e/ou view/função | Read model/função parcialmente validada; não é fonte universal consolidada para todos os fluxos, especialmente IATF. | parcialmente validado |
| Status sanitário | Agenda sanitária + eventos + compliance/views | Não há coluna única validada. | parcialmente validado |
| Carência | Produto/protocolo/evento sanitário | Não há read model operacional consolidado validado. | bloqueado |
| Bloqueios | Compliance/read model/config/protocolos oficiais | parcialmente validado; não tratar como bloqueio operacional completo e universal sem nova validação. | parcialmente validado |
| Aptidão reprodução | Derivação por sexo/status/eventos/payload | parcialmente validado. | parcialmente validado |
| Aptidão venda/abate | Exigiria estado + peso + carência + bloqueios + comercial | Não consolidado. | bloqueado |

---

### 7. Protocolos — comportamento real consolidado

> **Regra central:** protocolo configurado não é execução realizada.

| Item | Estado consolidado | Classificação |
|---|---|---|
| Protocolos da fazenda | `protocolos_sanitarios` e `protocolos_sanitarios_itens`. | validado |
| Protocolos oficiais/canônicos | Catálogos oficiais e itens oficiais via migrations/seed. | validado |
| Protocolos customizados | UI/gestos permitem criação/edição/deleção na fazenda. | parcialmente validado |
| Pack oficial/template/custom | Agrupamento citado nas análises. | parcialmente validado |
| Itens de protocolo | Produto, tipo, intervalo, dose, `gera_agenda`, payload, dedup. | validado |
| Campos de calendário | `mode`, `anchor`, `scheduleKind`, `intervalDays`, idade, dependências, `generatesAgenda`. | parcialmente validado |
| Dependências entre itens | Scheduler/migrations citam dependências e regime sequencial. | parcialmente validado |
| Deduplicação | Dedup canônico por família/item/versão/período/chave. | validado |
| Compliance | Uso de catálogos oficiais/config para blockers/warnings. | parcialmente validado |
| Protocolo → agenda | validado quando aplicável/elegível e `gera_agenda=true`. | parcialmente validado |
| Agenda → execução | Execução real exige evento. | validado |
| Itens oficiais sem agenda | Nem todo item oficial gera agenda. | validado |
| Tags/marcadores | Não existe camada real de marcadores/tags no repositório. | não confirmado no código inspecionado |

---

### 8. Lacunas consolidadas da auditoria

| Lacuna | Resultado | Impacto |
|---|---|---|
| Motor geral de agenda reprodutiva/IATF | não confirmado no código inspecionado. | Não assumir agenda automática reprodutiva ampla. |
| Agenda da cria após venda/óbito/mudança de estado | parcialmente validado. | Risco de agenda zumbi. |
| Job periódico de recompute | não confirmado no código inspecionado. | Recompute parece depender de triggers/RPC/sync. |
| Append-only em todas as tabelas de evento | parcialmente validado. | Não afirmar imutabilidade absoluta; há proteção contra update destrutivo de negócio com exceções técnicas controladas. |
| Peso atual persistido/confiável | Não consolidado. | Risco em dose, venda, estágio, GMD e relatórios. |
| Carência operacional por animal/lote | Não consolidada. | Risco sanitário/comercial alto. |
| Aptidão venda/abate | Não consolidada. | Não automatizar decisão. |
| Tags/marcadores | Não existem como camada real de marcadores operacionais. | Não usar como fonte primária. |
| Agenda manual genérica | A tabela de agenda permite itens operacionais, mas um fluxo completo e amplo de agenda manual genérica não foi confirmado no código inspecionado. | Não assumir rail operacional amplo confirmado. |
| Evento editável/correção | Campo existe; fluxo completo não confirmado no código inspecionado. | Não afirmar edição. |
| Conclusão direta não sanitária gerar evento | Não confirmada no código inspecionado. | Não tratar como execução factual. |

---

## Parte 2 — Contrato de fontes de verdade

---

### 9. Princípios normativos

1. **Evento é fato.**
   Toda execução realizada deve ser comprovada por `eventos` + detail table quando aplicável.

2. **Agenda é intenção.**
   Agenda representa pendência, tarefa, necessidade futura ou intenção operacional. Não prova execução.

3. **Agenda concluída sem evento não é execução factual.**
   Pode indicar tarefa encerrada, mas não deve entrar em histórico de realização.

4. **Protocolo é regra.**
   Protocolo ativo não significa que algo foi feito, nem necessariamente que há pendência.

5. **`state_*` é estado atual.**
   Não deve ser usado como histórico sem eventos.

6. **Read model/view é derivação.**
   Só deve ser usado quando sua regra de derivação estiver clara.

7. **Tags/marcadores não são fonte primária.**
   Se forem criados futuramente, devem ser auxiliares, auditáveis, recalculáveis ou manuais com rastreabilidade.

8. **Relatório operacional não é fonte.**
   É uma saída derivada. Deve declarar a fonte primária usada.

---

### 10. Matriz consolidada de fontes de verdade

| Tipo de verdade | Fonte primária | Fonte auxiliar | Não usar como fonte primária | Classificação |
|---|---|---|---|---|
| Execução realizada | `eventos` + detail tables | Agenda vinculada por `source_task_id` / `source_evento_id` | Agenda concluída sem evento | validado |
| Histórico sanitário | `eventos` + `eventos_sanitario` | Histórico sanitário/view, protocolo/item vinculado | Protocolo ativo, agenda aberta | validado |
| Pendência futura | `agenda_itens` / `state_agenda_itens` com status válido | Protocolo, animal/lote, produto, views sanitárias | Evento passado isolado | validado |
| Necessidade de vacina/produto | Agenda válida no período + produto/protocolo vinculado | Upcoming/views, protocolos, lote/animal ativo | Apenas protocolo ativo; apenas histórico | parcialmente validado |
| Estado atual do animal | `state_animais` + read model/derivação explícita | Eventos recentes, payload, taxonomy facts | Eventos brutos sem reconciliação | parcialmente validado |
| Estado atual do lote | `state_lotes` + animais ativos vinculados | Movimentações, pastos | Histórico isolado | parcialmente validado |
| Status sanitário | Agenda sanitária + eventos sanitários + compliance/read model | Protocolos/config sanitária | Tags ou protocolo isolado | parcialmente validado |
| Status reprodutivo | Read model/função parcialmente validada + eventos reprodutivos | `taxonomy_facts`, payload, estado matriz/cria | Agenda de diagnóstico pendente | parcialmente validado |
| Carência | Não há fonte consolidada validada | Eventos sanitários + produto + regra de carência | Tag, agenda, protocolo isolado | bloqueado |
| Pronto para venda/abate | Não há fonte única validada | Estado atual + peso + carência + bloqueios + status comercial | Marcador manual, agenda, intuição operacional | bloqueado |
| Protocolo aplicável | Protocolo ativo + item + regra de elegibilidade/aplicabilidade | Scheduler/recompute, animal/lote/config | Evento passado isolado | parcialmente validado |
| Execução de protocolo | Evento factual vinculado ao protocolo/item | Agenda concluída com evento vinculado | Protocolo ativo; agenda concluída sem evento | validado |
| Compliance/bloqueio | Read model/motor de compliance parcialmente validado | Eventos, protocolos oficiais, config | Tag manual | parcialmente validado |
| Marcador/tag | não confirmado no código inspecionado | Futuramente pode apoiar filtros | Qualquer decisão histórica/sanitária/comercial | não confirmado no código inspecionado |
| Relatório histórico | Eventos | Detail tables, protocolo vinculado | Agenda, state isolado | validado |
| Relatório operacional futuro | Agenda materializada válida quando o domínio tiver agenda confirmada + estado atual + protocolo | Views/read models | Eventos passados isolados | parcialmente validado |

---

### 11. Matriz de perguntas operacionais

| Pergunta | Fonte primária correta | Classificação | Regra de segurança |
|---|---|---|---|
| Quantas vacinas/produtos preciso para lote X no período Y? | `agenda_itens` válidos no período + produto/protocolo | parcialmente validado | Excluir canceladas/concluídas/deletadas; evitar duplicidade por dedup/recompute. |
| Quantos animais estão em cada estágio? | `state_animais` + derivação taxonômica validada | parcialmente validado | Não usar eventos brutos sem read model. |
| Quais animais têm pendências críticas? | Agenda aberta/atrasada + compliance/read model | parcialmente validado | Não usar apenas protocolo ativo. |
| Quais estão em carência? | Ainda sem fonte consolidada validada | bloqueado | Exige regra por evento sanitário + produto + período de carência. |
| Quais estão prontos para venda/abate? | Ainda sem fonte única validada | bloqueado | Exige peso, carência, bloqueios, estado comercial e status vivo/ativo. |
| Quais fêmeas estão prenhes? | Read model/função reprodutiva parcialmente validada + eventos | parcialmente validado | Agenda de diagnóstico não prova prenhez. |
| Quais bezerros precisam desmamar? | Agenda da cria/desmame materializada + idade | parcialmente validado | Idade isolada sugere elegibilidade, não tarefa aberta. |
| Quais lotes concentram atraso sanitário? | `agenda_itens` ou view de pendências sanitárias agregada por lote | parcialmente validado | Não usar eventos concluídos para medir atraso. |
| Quais protocolos estão ativos? | `protocolos_sanitarios` ativos | validado | Não inferir execução. |
| Quais protocolos foram executados? | Eventos sanitários vinculados | validado | Agenda concluída sem evento não conta. |
| Quais agendas estão atrasadas? | `agenda_itens` abertas vencidas | validado | Filtrar canceladas/concluídas/deletadas. |
| Quais eventos ocorreram no período? | `eventos` + detail tables por `occurred_at/on` | validado | Agenda nunca substitui evento. |
| Quantos animais foram vendidos? | Eventos financeiros/venda para histórico; `state_animais.status` para estoque atual | parcialmente validado | Separar “vendidos no período” de “status atual vendido”. |
| Quantos animais morreram? | Evento de óbito para histórico; `state_animais.status='morto'` para estado atual | parcialmente validado | Não contar ausência de lote como óbito. |
| Quais animais possuem bloqueio sanitário? | Compliance/read model parcialmente validado | parcialmente validado | Marcador manual não bloqueia/libera. |

---

### 12. Regras de fonte primária por tipo de pergunta

| Tipo de pergunta | Usar como fonte primária | Usar apenas como apoio | Não usar como fonte primária |
|---|---|---|---|
| Necessidade futura | Agenda materializada válida quando o domínio tiver agenda confirmada; protocolo aplicável apenas como apoio quando a agenda ainda for calculável | Estado atual, lote, animal, produto | Eventos concluídos isolados; tags |
| Histórico realizado | `eventos` + detail tables | Agenda vinculada, protocolo, payload | Agenda sem evento; protocolo ativo; `state_*` |
| Estado atual do animal | `state_animais` e read model/derivação explícita | Eventos recentes, payload facts | Evento isolado sem reconciliação; agenda |
| Status sanitário | Views/read models sanitários, agenda sanitária aberta, histórico sanitário para executado | Protocolos, eventos, payload | Tags; protocolo ativo isolado |
| Status reprodutivo | Read model/função parcialmente validada + eventos reprodutivos | `taxonomy_facts`, payload, contexto de episódio | Tags; agenda sem evento |
| Estágio/categoria | Derivação taxonômica a partir de `state_animais`, payload e config | Eventos reprodutivos/pesagem se incorporados ao read model | Protocolo; agenda; tags |
| Carência | Fonte consolidada ainda não confirmada | Evento sanitário/medicamento, produto, regra de carência | Tags; protocolo isolado; agenda |
| Aptidão venda/abate | Fonte única ainda não confirmada; exige composição | Estado atual, compliance, eventos, peso, carência | Marcador manual; agenda concluída sem evento |
| Protocolo aplicável | Protocolo ativo + item + regra de elegibilidade/aplicabilidade | Estado animal/lote/fazenda, config sanitária | Evento; agenda isolada |
| Execução de protocolo | Evento factual vinculado ao item/protocolo | Agenda concluída com `source_evento_id` | Protocolo ativo; agenda sem evento |
| Pendência operacional | Agenda aberta e/ou read model de compliance | Protocolo, estado animal/lote, atraso | Eventos concluídos; tags |
| Relatório financeiro | Eventos financeiros e detail table | Estado atual do animal, contraparte | Agenda; protocolo |
| Marcador/filtro visual | Camada auxiliar futura, se existir e for auditável | Read models e fontes primárias originadoras | Marcador como verdade primária |

---

### 13. Casos críticos de ambiguidade

#### 13.1 Agenda concluída sem evento vinculado

| Pergunta | Decisão |
|---|---|
| Pode ser considerada execução factual? | Não. |
| Pode entrar em relatório histórico? | Não como execução. |
| Pode entrar em relatório operacional? | Sim, apenas como tarefa encerrada ou inconsistência operacional. |
| Qual fonte prevalece? | Para execução: `eventos`. Para tarefa: `agenda_itens`. |

#### 13.2 Protocolo ativo sem agenda gerada

| Pergunta | Decisão |
|---|---|
| Significa execução? | Não. |
| Significa pendência? | Não necessariamente. |
| Quando gera necessidade futura? | Quando o domínio tiver agenda confirmada e protocolo/item for aplicável, elegível, materializável e gerar agenda materializada válida. Esta regra está mais fortemente validada para sanitário e cria/pós-parto; outros domínios exigem validação específica. |

#### 13.3 Evento sanitário sem agenda vinculada

| Pergunta | Decisão |
|---|---|
| É execução factual? | Sim, se há `eventos` + `eventos_sanitario`. |
| Deve alterar status operacional? | Pode, se read model/recompute reconhecer. |
| Deve retroalimentar agenda futura? | Apenas se regra explícita reconhecer o evento como âncora. |

#### 13.4 Animal vendido ou morto com agendas futuras

| Pergunta | Decisão |
|---|---|
| Agenda deve ser considerada válida? | Conservadoramente, não deve ser pendência ativa se animal está vendido/morto. |
| Qual fonte prevalece? | `state_animais.status` para estado atual; `eventos` para histórico. |
| Risco | Agenda zumbi. |

#### 13.5 Marcador manual “pronto para venda”

| Pergunta | Decisão |
|---|---|
| Pode autorizar venda? | Não. |
| Pode substituir carência/bloqueio? | Não. |
| Pode aparecer como filtro? | Sim, futuramente, apenas como filtro auxiliar. |

#### 13.6 Peso atual derivado de evento de pesagem

| Pergunta | Decisão |
|---|---|
| Evento de pesagem é histórico ou estado atual? | Histórico. |
| Quando pode ser usado como peso atual? | Quando houver regra explícita de última pesagem válida/read model. |
| Risco sem read model | Peso antigo, duplicado ou inválido afetar dose, venda, estágio e relatório. |

---

### 14. Decisões bloqueadas

| Decisão | Status | Motivo |
|---|---|---|
| Criar camada persistida de tags | bloqueado | Não existe camada real de marcadores/tags no repositório; risco de verdade paralela. |
| Relatório de animais em carência | bloqueado | Falta read model/regra operacional confirmada. |
| Relatório de pronto para venda/abate | bloqueado | Exige cruzamento ainda não consolidado: peso, carência, bloqueio, status comercial. |
| Motor geral de agenda reprodutiva/IATF | bloqueado | IATF aparece como termo/opção/label, mas não como engine geral persistido de agenda reprodutiva. |
| Peso atual como campo confiável | bloqueado | Última pesagem válida/read model não confirmado no código inspecionado. |
| Agenda concluída como execução | bloqueado | Viola Two Rails. |
| Protocolo ativo como execução | bloqueado | Protocolo é regra, não fato. |
| Consulta em linguagem natural | bloqueado nesta fase | Sem read models estáveis, a IA tende a usar fonte errada. |
| Geração automática de agenda por IA | bloqueado nesta fase | Agenda deve seguir motor determinístico auditável. |
| Conclusão automática por IA | bloqueado | Execução factual exige ato/registro humano ou fluxo explicitamente autorizado. |

---

### 15. Contexto obrigatório para próximos prompts

Use este bloco integralmente nos próximos prompts.

```markdown
## Contexto consolidado obrigatório — RebanhoSync

- Agenda é intenção/tarefa operacional mutável, não histórico factual.
- Evento é a fonte primária de execução realizada.
- `state_*` representa estado atual/read model, não histórico.
- Protocolo configurado não é execução realizada.
- Sanitário possui a automação de agenda mais validada.
- Jornada da cria pós-parto possui geração automática validada/parcialmente validada.
- Agenda automática geral de reprodução/IATF não está confirmada no código inspecionado.
- Pesagem, nutrição, movimentação e financeiro são eventos confirmados, mas não motores gerais confirmados de agenda automática.
- Tags/marcadores não estão confirmados como camada existente.
- Marcadores, se propostos, devem ser auxiliares, recalculáveis ou auditáveis, nunca fonte primária.
- Necessidades futuras devem partir de agenda materializada válida quando o domínio tiver agenda confirmada; esta regra está mais fortemente validada para sanitário e cria/pós-parto.
- Histórico realizado deve partir de eventos.
- Estado atual deve partir de `state_*`, views/read models ou derivação explicitamente documentada.
- Agenda concluída sem evento vinculado não deve ser tratada como execução factual.
- Protocolo ativo sem agenda não significa pendência nem execução.
- Evento sanitário sem agenda vinculada é execução factual, mas sua retroalimentação operacional depende de regra explícita.
- Animal vendido/morto deve prevalecer como estado atual sobre agendas futuras não reconciliadas.
- Carência, peso atual persistido e aptidão venda/abate permanecem bloqueados como decisões automatizadas por falta de fonte composta/read model consolidado suficiente.
- Qualquer proposta futura deve indicar: fonte primária, fonte auxiliar, fonte proibida/insuficiente, risco e classificação.
```

---

### 16. Checklist de validação

Antes de aprovar este documento, validar:

- [ ] A separação agenda/evento/protocolo/estado está correta.
- [ ] Agenda concluída sem evento foi explicitamente excluída de histórico factual.
- [ ] Protocolo ativo foi explicitamente excluído como execução.
- [ ] Tags/marcadores foram classificados como não confirmados e auxiliares.
- [ ] Carência permanece bloqueada como relatório confiável até read model/regra confirmada.
- [ ] Pronto para venda/abate permanece bloqueado até fonte consolidada.
- [ ] Peso atual não foi tratado como campo confiável sem read model.
- [ ] IATF/reprodução geral não foi tratado como agenda automática confirmada no código inspecionado.
- [ ] Necessidade futura usa agenda materializada válida nos domínios com agenda confirmada, não histórico isolado.
- [ ] Histórico realizado usa eventos, não agenda.
- [ ] Estado atual usa `state_*`, views ou derivação explícita.

---

### 17. Veredito para continuidade

Este documento deve ser usado como base normativa para:

1. Evolucao da camada `src/lib/insights/`.
2. Avaliação de marcadores inteligentes.
3. MVP de inteligência operacional.
4. Estratégia de relatórios por lote/período/animal.
5. Definição de riscos e testes mínimos.
6. UX operacional de Central Operacional, Agenda, Animais e Lotes.

A primeira implementação read-only da Central Operacional já existe e deve continuar respeitando este contrato de fontes de verdade.


---

## Parte 3 — Proposta consolidada da camada `src/lib/insights/`

---

### 18. Status da proposta

**Status:** Core puro/read-only implementado e integrado passivamente à Home.
**Natureza:** Composição operacional sem ação de domínio
**Escopo:** Camada de composição operacional baseada no contrato de fontes de verdade

A camada `src/lib/insights/` está alinhada como composição operacional, não como fonte primária nem motor de regra crítica, porque:

- não seja fonte primária;
- não duplique regras críticas existentes;
- não substitua eventos, agenda, protocolos ou `state_*`;
- não crie nova verdade paralela;
- usa funções puras;
- separe cálculo operacional de UI;
- declare fonte primária, fonte auxiliar, fonte proibida, risco e classificação para cada resposta;
- use SQL/view para relatórios críticos, agregações pesadas e consistência multiusuário;
- mantenha paridade TS/SQL para regras críticas.

---

### 19. Decisão executiva

| Decisão | Resultado |
|---|---|
| Criar camada `insights` | Concluído como core puro/read-only. |
| Implementar agora | Primeira integração passiva concluída na Home por `src/features/operationalInsights/`. |
| Primeiro MVP seguro | Pendências por agenda materializada válida, pendências sanitárias por agenda/produto, resumo de rebanho por `state_animais`, KPIs mensais por eventos e sinais auxiliares não persistidos. |
| Módulos seguros implementados | `agendaNeeds.ts`, `sanitarySupplyNeeds.ts`, `herdStageSummary.ts`, `monthlyOperationalKpis.ts`, `tagSignals.ts`. |
| Módulos parciais | `herdStageSummary.ts`, `reproductionSummary.ts`. |
| Módulos bloqueados | `commercialReadiness.ts` conclusivo, carência ativa operacional, tags/marcadores persistidos, consulta em linguagem natural, IA gerando agenda, IA concluindo execução. |

---

### 20. Mapa consolidado de responsabilidade dos módulos

| Arquivo sugerido | Responsabilidade proposta | Entrada | Saída | Fonte primária | Fonte auxiliar | Fonte proibida/insuficiente | Classificação | Risco | Decisão |
|---|---|---|---|---|---|---|---|---|---|
| `agendaNeeds.ts` | Calcular necessidades futuras baseadas em agenda materializada válida quando o domínio tiver agenda confirmada. | `state_agenda_itens`, período, lote, domínio, status, animal. | Necessidades futuras por animal/lote/período. | Agenda aberta válida em domínio com agenda confirmada. | Animais ativos, protocolos, produtos, `dedup_key`. | Eventos históricos isolados, protocolo ativo sem agenda, tags. | Recomendado agora para sanitário/cria; parcialmente validado como regra geral. | Contar agenda cancelada, concluída, deletada ou de animal morto/vendido. | Núcleo inicial. |
| `vaccineNeeds.ts` | Especialização sanitária de `agendaNeeds` para vacinas/produtos. | Agenda sanitária + protocolo/item/produto. | Quantidade por produto, protocolo, lote e período. | Agenda sanitária aberta válida. | `source_ref`, payload, protocolos, produto, config sanitária. | Evento passado, protocolo ativo isolado, tag. | Recomendado agora. | Duplicar regra sanitária ou divergir de `agendaNeeds`. | Deve compor `agendaNeeds`, não recriar motor. |
| `sanitaryRiskSummary.ts` | Consolidar atrasos, vencimentos e alertas sanitários. | Agenda sanitária, views sanitárias, compliance parcialmente validado, eventos sanitários. | Pendências críticas, atrasos, vencimentos e alertas. | Agenda sanitária aberta/views sanitárias. | Eventos sanitários, protocolos oficiais, config sanitária. | Protocolo ativo sem agenda, tag manual, evento isolado. | Recomendado agora com ressalva de compliance parcial. | Tratar compliance como bloqueio operacional completo e universal. | Apenas compor fontes existentes. |
| `lotOperationalSummary.ts` | Agregar informações operacionais por lote. | Saídas de `agendaNeeds`, `vaccineNeeds`, `sanitaryRiskSummary` e estado do lote. | Resumo operacional por lote. | Agenda válida + `state_animais` + `state_lotes`. | Eventos recentes, protocolos, compliance. | Tags como fonte primária; recontagem crua de eventos sem read model. | Recomendado agora. | Virar fonte de verdade paralela. | Deve ser agregador derivado, não fonte própria. |
| `herdStageSummary.ts` | Sumarizar rebanho por categoria, fase ou estágio. | `state_animais`, payload, taxonomia, data de referência. | Contagem por estágio/categoria/lote. | `state_animais` + derivação taxonômica confirmada. | Eventos reprodutivos/pesagem se incorporados a read model. | Agenda, tags, evento isolado. | Depende de validação no código. | Divergência entre TS, payload e read model; inclusão de mortos/vendidos. | Recomendar futuramente com paridade/read model. |
| `reproductionSummary.ts` | Resumir reprodução e jornada da cria. | Eventos reprodutivos, `state_animais`, agenda da cria, `taxonomy_facts`. | Prenhez, parto próximo, cria, desmame, pendências da cria. | Eventos de reprodução + `state_animais`/read model parcialmente validado. | Agenda da cria, payload facts. | Agenda IATF não confirmada, tags. | Depende de validação no código. | Generalizar IATF sem base confirmada. | Separar cria/pós-parto de motor reprodutivo geral. |
| `commercialReadiness.ts` | Pré-check futuro de prontidão para venda/abate. | Peso, carência, bloqueios, status comercial, idade, lote. | Lista de aptidão ou pré-check não conclusivo. | Ainda sem fonte consolidada suficiente. | `state_animais`, destino produtivo, eventos, compliance parcialmente validado. | Marcador “pronto”, agenda, protocolo ativo. | bloqueado nesta fase. | Falso positivo sanitário/comercial. | Apenas contrato futuro; não autorização. |
| `tagClassifiers.ts` | Classificação auxiliar/recalculável para UI, se marcadores forem criados. | Fontes primárias já consolidadas. | Badges/marcadores derivados ou temporários. | Nenhuma camada real de marcadores/tags existe hoje. | Agenda, eventos, `state_*`, views. | Tag manual como verdade, tag persistida sem rastreabilidade. | bloqueado nesta fase para persistência. | Verdade paralela desatualizada. | No máximo derivação volátil de UI no futuro; marcadores são proposta auxiliar, nunca fonte primária. |

---

### 21. Arquitetura conceitual recomendada

#### 21.1 Núcleo seguro inicial

| Módulo | O que pode responder | O que não pode responder | Dependências | Risco |
|---|---|---|---|---|
| `agendaNeeds.ts` | O que precisa ser feito no futuro por agenda materializada válida nos domínios com agenda confirmada. | Execução histórica. | Agenda aberta válida, animal ativo, período, lote. | Médio. |
| `vaccineNeeds.ts` | Quantas vacinas/produtos são necessários por lote/período. | Vacinas já aplicadas. | Agenda sanitária, protocolo/item/produto. | Médio. |
| `sanitaryRiskSummary.ts` | Pendências sanitárias atrasadas, vencendo hoje ou próximas. | Carência ativa consolidada, se ainda sem read model. | Agenda/views sanitárias, compliance parcialmente validado. | Médio. |
| `lotOperationalSummary.ts` | Visão operacional do lote: próximos manejos, atrasos, necessidades. | Aptidão comercial ou histórico factual. | Saídas dos módulos anteriores + `state_lotes`. | Médio. |

#### 21.2 Núcleo parcial, dependente de validação

| Módulo | O que pode responder parcialmente | Dependência | Risco |
|---|---|---|---|
| `herdStageSummary.ts` | Quantidade por sexo, idade, categoria e alguns estágios se a taxonomia estiver estabilizada. | Taxonomia TS/SQL, payload, read model. | Divergência de classificação. |
| `reproductionSummary.ts` | Jornada da cria, desmame, parto/prenhez se fonte reprodutiva estiver clara. | Eventos reprodutivos, `taxonomy_facts`, agenda da cria. | Generalizar IATF sem evidência. |

#### 21.3 Núcleo bloqueado nesta fase

| Módulo/feature | Motivo do bloqueio |
|---|---|
| `commercialReadiness.ts` conclusivo | Exige peso atual confiável, carência ativa, bloqueios e status comercial consolidados. |
| `withdrawalPeriod` / carência ativa | Falta read model/regra operacional validada. |
| `tagClassifiers.ts` persistido | Não existe camada real de marcadores/tags no repositório e uma persistência sem rastreabilidade pode virar verdade paralela. |
| `naturalLanguageInsights` | Sem roteamento seguro pergunta → fonte, há alto risco de resposta operacional incorreta. |
| IA gerando agenda | Agenda deve ser determinística e auditável. |
| IA concluindo execução | Execução factual exige evento, autoria e evidência. |

---

### 22. Casos de uso mínimos

#### 22.1 Quantas vacinas/produtos preciso para o lote X no período Y?

**Classificação:** validado para sanitário/cria; parcialmente validado como regra geral. Recomendado agora apenas quando usar agenda materializada válida em domínio com agenda confirmada.

| Aspecto | Recomendação | Fonte primária | Risco | Classificação |
|---|---|---|---|---|
| Filtros obrigatórios | `fazenda_id`, `lote_id`, período inicial/final, domínio, produto, protocolo, status da agenda, animal ativo. | Agenda / `state_agenda_itens`. | Contar item fora do recorte. | Recomendado agora. |
| Status incluído | Apenas agenda aberta válida, usualmente `status='agendado'`. | Agenda. | Incluir item já resolvido. | Recomendado agora. |
| Status excluído | Excluir canceladas, concluídas, deletadas/tombstone. | Agenda. | Superestimar necessidade. | Recomendado agora. |
| Animal elegível | Excluir animal vendido, morto ou inativo. | `state_animais.status`. | Agenda zumbi. | Recomendado agora. |
| Agrupamento | Por lote, produto, protocolo, data prevista, prioridade/atraso. | Agenda + protocolo/item. | Produto indefinido ou agrupamento ambíguo. | Recomendado agora. |
| Cálculo de doses | 1 item de agenda válido = 1 necessidade operacional base, salvo regra/payload explícito. | Agenda + protocolo/item. | Embutir dose fixa errada. | Recomendado agora. |
| Margem de perda | Parâmetro externo configurável; não hardcoded no core. | Configuração do relatório/UI. | Margem virar regra sanitária implícita. | Recomendado agora. |
| Deduplicação | Usar `dedup_key` quando existir; fallback conservador por animal + item/protocolo + data/produto. | Agenda/dedup. | Duplicidade por recompute. | Recomendado agora. |
| Protocolo aplicável sem agenda | Não contar como necessidade materializada. | Protocolo + motor/read model. | Transformar configuração em necessidade. | Recomendado agora. |
| Agenda sem produto | Separar em “produto indefinido” ou “insumo a definir”. | Agenda/payload. | Misturar com estoque real. | Recomendado agora. |
| Fonte proibida | Eventos concluídos isolados, protocolo ativo isolado, tags. | — | Confundir passado/configuração com futuro. | Recomendado agora. |

---

#### 22.2 Quantos animais estão em cada estágio?

**Classificação:** parcialmente validado / depende de validação no código.

| Estágio/categoria | Fonte primária | Fonte auxiliar | Pode responder hoje? | Lacuna | Classificação |
|---|---|---|---|---|---|
| Sexo | `state_animais.sexo`. | — | Sim. | Baixa. | Recomendado agora. |
| Idade | `state_animais.data_nascimento` + data de referência. | Timezone/data de corte. | Sim. | Definir data de corte. | Recomendado agora. |
| Categoria zootécnica | Taxonomia existente + `state_animais`. | Config de ciclo, payload. | parcialmente validado. | Confirmar se relatório oficial ou derivação local. | Depende de validação. |
| Fase veterinária/produtiva | Taxonomia + payload facts. | Eventos incorporados ao read model. | parcialmente validado. | Divergência se evento recente não atualiza payload/read model. | Depende de validação. |
| Estado reprodutivo | Eventos reprodução + read model/função parcialmente validada. | `taxonomy_facts`, agenda da cria. | parcialmente validado. | Fonte única por lote/período não consolidada. | Depende de validação. |
| Estágio sanitário | Agenda/views sanitárias. | Eventos sanitários, protocolos. | parcialmente validado. | Não há campo único de status sanitário. | Recomendado futuramente. |
| Estado comercial | `state_animais.status`, destino produtivo. | Eventos financeiros. | parcialmente validado. | Não equivale a “pronto para venda”. | Recomendado futuramente. |
| Peso atual | Não consolidado. | Última pesagem, payload metrics. | Não seguro. | Última pesagem válida não consolidada. | Recomendado futuramente. |
| Marcador/tag | não confirmado no código inspecionado. | — | Não. | Camada de tags não existe confirmada. | bloqueado. |

---

#### 22.3 Quais animais têm pendências críticas?

**Classificação geral:** Recomendado agora para agenda/sanitário; parcial para demais domínios.

| Critério crítico | Fonte primária | Fonte auxiliar | Pode ser calculado agora? | Risco | Classificação |
|---|---|---|---|---|---|
| Agenda atrasada | Agenda aberta com `data_prevista < hoje`. | Animal/lote/protocolo. | Sim. | Contar cancelada/concluída. | Recomendado agora. |
| Agenda vence hoje | Agenda aberta com `data_prevista = hoje`. | Animal/lote. | Sim. | Timezone/data de corte. | Recomendado agora. |
| Agenda vence em 7 dias | Agenda aberta no intervalo. | Animal/lote/protocolo. | Sim. | Incluir animal morto/vendido. | Recomendado agora. |
| Brucelose perto do fim da janela | Agenda sanitária/protocolo + idade/sexo. | Protocolo/item/nascimento. | parcialmente validado. | Recriar regra sanitária fora do motor. | Recomendado futuramente. |
| Bloqueio sanitário/compliance | Read model/motor de compliance parcialmente validado. | Protocolos oficiais/config. | parcialmente validado. | Bloqueio genérico virar animal-específico indevido. | Recomendado futuramente. |
| Parto próximo | Read model/fato reprodutivo validado. | Agenda/reprodução/payload. | parcialmente validado. | Prenhez/status divergir. | Depende de validação. |
| Desmame próximo | Agenda da cria/desmame ou read model. | Idade/payload. | parcialmente validado. | Confundir idade elegível com pendência aberta. | Depende de validação. |
| Reavaliação pendente | Agenda específica, se existir. | Evento anterior. | não confirmado no código inspecionado. | Criar pendência sem regra. | Depende de validação. |
| Tratamento recente | Evento sanitário/medicamento. | Produto/payload. | Histórico sim; pendência não. | Usar evento passado como pendência atual. | Recomendado futuramente. |
| Carência ativa | Fonte consolidada não confirmada. | Evento medicamento + regra produto. | Não seguro. | Falso negativo grave. | bloqueado. |
| Bloqueio de movimentação | Compliance/read model. | Agenda/eventos sanitários. | parcialmente validado. | Bloqueio genérico vs animal/lote. | Recomendado futuramente. |
| Animal vendido/morto com agenda futura | `state_animais.status` + agenda aberta. | Eventos venda/óbito. | Sim, como alerta de qualidade. | Agenda zumbi. | Recomendado agora. |

---

#### 22.4 Quais animais estão prontos para venda/abate?

**Classificação:** bloqueado nesta fase. Pode existir futuramente como pré-check não conclusivo.

| Critério | Fonte primária necessária | Fonte atual confirmada? | Lacuna | Risco |
|---|---|---|---|---|
| Peso-alvo | Peso atual consolidado + regra de peso-alvo. | parcialmente validado/não consolidado. | Última pesagem válida não estabilizada. | Falso positivo para venda. |
| Última pesagem válida | `vw_animais_peso_atual` ou equivalente. | não confirmado no código inspecionado. | Definir validade temporal e fonte. | Peso antigo. |
| Carência | `vw_animais_carencia_ativa` ou equivalente. | não confirmado no código inspecionado. | Regra produto/evento/período ausente. | Venda em carência. |
| Bloqueios sanitários | Read model de bloqueios. | parcialmente validado. | Consolidar animal/lote/fluxo. | Liberar bloqueado. |
| Bloqueios comerciais | Regra comercial consolidada. | não confirmado no código inspecionado. | Fonte de bloqueio comercial ausente. | Decisão indevida. |
| Status comercial | `state_animais.status`, destino produtivo. | parcialmente validado. | Destino produtivo não equivale a aptidão. | Confundir destino com pronto. |
| Status vivo/ativo | `state_animais.status='ativo'`. | Sim. | Baixa. | Incluir morto/vendido. |
| Lote | `state_animais.lote_id` / `state_lotes`. | Sim. | Sync pendente. | Lote incorreto. |
| Idade | `data_nascimento`. | Sim. | Data de corte. | Classificação errada. |
| Eventos financeiros | `eventos_financeiro`. | Sim para histórico. | Não define prontidão. | Confundir venda realizada com pronto para venda. |

**Decisão:** `commercialReadiness.ts` deve permanecer bloqueado como módulo conclusivo. Se existir no futuro, deve começar como checklist não conclusivo, mostrando lacunas e bloqueios, nunca como autorização de venda/abate.

---

### 23. Read models/views recomendados

| View/read model | Fonte primária | Fonte auxiliar | Pergunta que responde | Uso na UI | Riscos | Classificação | Observação |
|---|---|---|---|---|---|---|---|
| `vw_agenda_necessidades` | Agenda aberta válida. | Animais, lotes, protocolos. | O que precisa ser feito? | Cards de próximos manejos/pendências. | Duplicidade por recompute; incluir inativos. | Recomendado agora/futuramente. | Boa candidata para centralizar filtros. |
| `vw_necessidade_insumos_periodo` | Agenda válida + produto/protocolo. | Payload, margem configurável. | Quantos produtos/vacinas preciso? | Relatório de insumos. | Produto indefinido ou duplicado. | Recomendado agora/futuramente. | Não contar protocolo sem agenda. |
| `vw_rebanho_estagios` | `state_animais` + taxonomia. | Config ciclo, payload facts. | Quantos animais por categoria/fase? | Painel de rebanho. | Divergência TS/SQL. | Recomendado futuramente. | Exige regra única/paridade. |
| `vw_animais_bloqueios` | Compliance/read model + agenda/eventos. | Protocolos oficiais/config. | Quem tem bloqueio operacional? | Alertas e filtros de risco. | Bloqueio genérico virar animal-específico indevido. | Recomendado futuramente. | Separar bloqueio por animal, lote e fazenda. |
| `vw_animais_carencia_ativa` | Eventos medicamentos/sanitários + regra de carência. | Produto, protocolo, payload. | Quem está em carência? | Bloqueio venda/abate/movimentação. | Erro sanitário/comercial grave. | bloqueado nesta fase. | Primeiro definir regra fonte. |
| `vw_animais_peso_atual` | Eventos de pesagem válidos. | Payload metrics, data de validade. | Qual é o peso atual confiável? | Estágio, venda, lote, dose. | Peso antigo ou inválido. | Recomendado futuramente. | Necessário antes de aptidão comercial. |
| `vw_animais_prontos_venda` | Peso + carência + bloqueios + estado comercial. | Eventos financeiros/sanitários. | Quem pode vender/abater? | Pré-check comercial. | Falso positivo alto. | bloqueado nesta fase. | Só depois de carência, peso e bloqueios consolidados. |
| `vw_lote_resumo_operacional` | Agenda + animais ativos. | Eventos recentes, protocolos, compliance. | Resumo do lote. | Dashboard por lote. | Virar fonte paralela. | Recomendado agora/futuramente. | Deve ser agregador, não fonte primária. |

---

### 24. Decisão TypeScript vs SQL/view

| Cálculo | TypeScript | SQL/view | Precisa paridade TS/SQL? | Depende de recompute? | Status |
|---|---|---|---|---|---|
| Filtros locais de agenda | Sim. | Opcional. | Não obrigatória. | Não. | Recomendado agora. |
| Necessidade por agenda materializada válida | Sim para offline/UI. | Sim para relatório. | Sim, se virar relatório oficial. | validado para sanitário/cria; parcialmente validado como regra geral. | Recomendado agora nos domínios com agenda confirmada. |
| Necessidade de insumos por período/lote | Sim para simulação. | Sim preferencial. | Sim. | parcialmente validado. | Recomendado agora. |
| Dedup sanitário | Sim. | Sim. | Sim, crítico. | Sim. | validado/crítico. |
| Elegibilidade sanitária | Sim. | Sim. | Sim, crítico. | Sim. | validado/crítico. |
| Recompute sanitário | Não como regra principal. | Sim. | Sim com scheduler TS. | Sim. | validado. |
| Contagem por estágio | Sim para UI local. | Sim para relatório. | Sim se oficial. | Pode depender. | Recomendado futuramente. |
| Status reprodutivo parcialmente validado | Sim. | Sim se usado em relatório/agenda. | Sim. | Sim. | Não tratar como fonte universal consolidada, especialmente IATF. |
| Jornada da cria | Sim. | Opcional/ideal para relatório. | Sim se relatório oficial. | parcialmente validado. | Depende de validação. |
| Peso atual | Sim para exibir. | Sim preferencial. | Sim se usado em decisão. | Sim. | Recomendado futuramente. |
| Carência ativa | Não isolado. | Sim preferencial. | Sim crítico. | Sim/event-driven. | bloqueado. |
| Pronto venda/abate | Não isolado. | Sim/read model composto. | Sim crítico. | Sim/event-driven. | bloqueado. |
| Tags/classificadores | Apenas derivação volátil. | Não persistir nesta fase. | Não aplicável. | Não. | bloqueado. |

---

### 25. O que não deve ser implementado ainda

| Item | Decisão | Motivo | Evidência necessária para desbloquear |
|---|---|---|---|
| `commercialReadiness.ts` conclusivo | bloqueado. | Depende de peso atual, carência, bloqueios e status comercial consolidados. | Views/read models estáveis de peso, carência e bloqueios. |
| `tagClassifiers.ts` persistido | bloqueado. | Não existe camada real de marcadores/tags e marcadores não podem virar fonte primária. | Modelo de tags derivadas, auditáveis e recalculáveis. |
| Carência ativa | bloqueado. | Regra consolidada não confirmada. | Contrato evento/produto/carência/período. |
| Pronto para venda/abate | bloqueado. | Alto risco de falso positivo. | Peso atual + carência + bloqueios + status comercial. |
| Motor geral IATF | bloqueado. | não confirmado no código inspecionado como agenda automática geral. | Auditoria específica de reprodução/IATF. |
| Consulta em linguagem natural | bloqueado. | Sem roteamento seguro pergunta → fonte. | Camada de intents e contrato de fontes. |
| IA gerando agenda | bloqueado. | Agenda deve ser determinística/auditável. | Política de revisão/autorização e motor determinístico. |
| IA concluindo execução | bloqueado. | Execução exige evento factual e autoria clara. | Política de autorização, evidência e auditoria. |
| Relatório baseado em agenda concluída sem evento | Não recomendado. | Agenda concluída sem evento não é execução factual. | Evento vinculado ou regra formal equivalente. |
| Relatório baseado em protocolo ativo como execução | Não recomendado. | Protocolo é configuração, não execução. | Evento factual vinculado ao protocolo/item. |

---

### 26. MVP seguro da camada `insights`

| MVP | Escopo | Fonte primária | Risco | Classificação |
|---|---|---|---|---|
| MVP 1 — Seguro agora | Necessidades por agenda materializada válida; vacinas/produtos por lote/período; agendas atrasadas; próximas 7/30 dias; resumo sanitário; agregação por lote; exclusão de canceladas/concluídas/deletadas; exclusão de vendidos/mortos. | Agenda válida em domínio com agenda confirmada + `state_animais` + protocolos/produtos. | Médio. | Recomendado agora para sanitário/cria; parcialmente validado como regra geral. |
| MVP 2 — Parcial, com validação | Rebanho por estágio; reprodução/cria; desmame; prenhez; status reprodutivo parcialmente validado. | `state_animais`, `taxonomy_facts`, eventos de reprodução, agenda da cria. | Médio/alto. | Depende de validação no código. |
| MVP 3 — Futuro/bloqueado | Pronto venda/abate; carência ativa; marcadores persistidos; consulta em linguagem natural; IA gerando agenda; IA concluindo execução. | Ainda não consolidada. | Alto/muito alto. | bloqueado nesta fase. |

**MVP recomendado:** MVP 1 — Insights de agenda e necessidades sanitárias por lote/período.

---

### 27. Testes recomendados futuramente

| Tipo de teste | O que valida | Fonte de verdade | Risco prevenido |
|---|---|---|---|
| Unitário | Necessidade de vacina/produto ignora agendas canceladas. | Agenda. | Supercontagem. |
| Unitário | Necessidade ignora agendas concluídas. | Agenda. | Contar execução/passado como futuro. |
| Unitário | Necessidade ignora agendas deletadas/tombstone. | Agenda. | Contar item removido. |
| Unitário | Necessidade não duplica `dedup_key`. | Agenda/dedup. | Duplicidade por recompute. |
| Unitário | Animal vendido/morto não entra em necessidade futura. | `state_animais.status`. | Agenda zumbi. |
| Unitário | Protocolo ativo sem agenda não conta como necessidade. | Protocolo/agenda. | Configuração virar tarefa. |
| Unitário | Agenda concluída sem evento não entra como histórico. | Eventos. | Falso histórico. |
| Unitário | Evento sanitário entra como histórico mesmo sem agenda. | `eventos` + detail. | Perder execução factual. |
| Integração | Recompute sanitário gera agenda válida. | Motor SQL/scheduler. | Falha de materialização. |
| Integração | Alteração de protocolo/config dispara recompute. | Sync/RPC. | Agenda desatualizada. |
| Integração | Conclusão sanitária via RPC cria evento e fecha agenda. | RPC + eventos + agenda. | Execução sem vínculo. |
| Integração | Registrar com `sourceTaskId` fecha agenda com `source_evento_id`. | Registrar + agenda. | Agenda aberta após execução. |
| Integração | Óbito/venda invalida pendências futuras. | Estado animal + agenda. | Pendência zumbi. |
| Integração | Rollback/reconcile não deixa agenda duplicada. | Offline/sync. | Duplicidade local/remota. |
| Paridade TS/SQL | Dedup sanitário. | Scheduler + SQL. | Divergência de agenda. |
| Paridade TS/SQL | Elegibilidade sanitária. | Scheduler + SQL. | Animal indevido em agenda. |
| Paridade TS/SQL | Materialização de agenda. | Scheduler + SQL. | Agenda ausente/duplicada. |
| Paridade TS/SQL | Necessidades por período/lote. | View + TS. | Relatório inconsistente. |
| Paridade TS/SQL futura | Carência ativa. | View + TS. | Venda em carência. |
| Paridade TS/SQL futura | Peso atual. | View + TS. | Estágio/venda errados. |

---

### 28. Fontes obrigatórias por resposta operacional

| Resposta operacional | Fonte primária obrigatória |
|---|---|
| O que precisa ser feito | Agenda aberta válida. |
| O que já foi feito | Eventos + detail tables. |
| Estado atual | `state_*` ou read model derivado. |
| Necessidade de insumos | Agenda válida + produto/protocolo. |
| Pendência sanitária | Agenda sanitária/views sanitárias. |
| Histórico sanitário | `eventos` + `eventos_sanitario`. |
| Estágio/categoria | `state_animais` + taxonomia/read model. |
| Bloqueio operacional | Compliance/read model validado. |
| Pronto venda/abate | Não responder conclusivamente ainda. |
| Carência ativa | Não responder ainda como estado consolidado. |
| Tag/marcador | Nunca como fonte primária. |

---

### 29. Veredito final da Parte 3

`src/lib/insights/` existe hoje como **camada pura/read-only de composição e leitura operacional**, não como motor de verdade, fonte primária ou motor de regra crítica.

A primeira entrega de menor risco foi concluída com:

1. `agendaNeeds.ts`;
2. `sanitarySupplyNeeds.ts`;
3. `herdStageSummary.ts`;
4. `monthlyOperationalKpis.ts`;
5. `tagSignals.ts` como sinais auxiliares não persistidos;
6. `src/features/operationalInsights/` como adapter/hook/painel read-only;
7. `src/pages/Home.tsx` como primeira superfície passiva da Central Operacional.

Não devem avançar nesta fase:

- `commercialReadiness.ts` conclusivo;
- carência ativa operacional;
- tags/marcadores persistidos;
- motor geral IATF;
- consulta em linguagem natural;
- IA gerando agenda;
- IA concluindo execução.

A diretriz central permanece:

> **Necessidade futura vem de agenda materializada válida quando o domínio tiver agenda confirmada. Histórico realizado vem de eventos. Estado atual vem de `state_*` ou read model explícito. Protocolo é regra. Marcador é auxiliar.**


---

## Parte 4 — Proposta unificada de Marcadores Inteligentes

---

### 30. Status da proposta

**Status:** Proposta conceitual futura; não existe camada real de marcadores/tags no repositório.
**Natureza:** Não implementar nesta etapa
**Termo recomendado na UX:** **Marcadores**
**Princípio central:** Marcadores são auxiliares visuais, filtros e agrupadores. Não são fonte primária de verdade.

Termos como `tag`, `label`, `badge`, `chip`, `status` e classificação aparecem em contextos de UI, identificação ou domínio, mas não constituem camada de marcadores operacionais.

A adoção de Marcadores Inteligentes é **recomendada**, desde que subordinada ao contrato de fontes de verdade:

- evento continua sendo a fonte de execução realizada;
- agenda continua sendo intenção/tarefa operacional;
- `state_*` continua sendo estado atual;
- protocolo continua sendo regra/configuração;
- marcador nunca substitui evento, agenda, protocolo, `state_*`, view ou read model;
- marcador manual nunca autoriza decisão sanitária, reprodutiva ou comercial crítica.

---

### 31. Veredito executivo

| Decisão | Resultado |
|---|---|
| Marcadores fazem sentido? | Sim, recomendados como camada auxiliar de UX, filtro, priorização e agrupamento. |
| Devem existir como fonte de verdade? | Não. Nunca. |
| Devem ser persistidos? | Apenas marcadores manuais/operacionais auditáveis. |
| Marcadores derivados devem ser persistidos? | Não como regra. Preferir view/read model/função pura. Persistência derivada só como cache explícito, invalidável e não-autoritativo. |
| Estratégia recomendada | Modelo híbrido: manuais persistidos; derivados calculados/recalculáveis. |
| Marcadores comerciais conclusivos | bloqueados nesta fase. |
| Marcadores de carência ativa | bloqueados até read model/regra consolidada. |
| Marcadores de agenda | Recomendados, se derivados de agenda aberta válida em domínio com agenda confirmada. |
| Marcadores de protocolo | Recomendados apenas como agrupadores, nunca como execução. |

---

### 32. Por que Marcadores agregam valor

| Tela/fluxo | Valor operacional | Classificação |
|---|---|---|
| Agenda | Filtros rápidos: atrasada, vence hoje, vence 7 dias, crítica, sanitário, cria. | Recomendado |
| Lista de animais | Busca rápida por sexo, idade, categoria, observação, pendência, manejo. | Recomendado |
| Animal individual | Resumo visual de sinais relevantes: prenhe, tratamento recente, observar, pendência. | Recomendado |
| Lote | Visão de lote com pendência, lote em observação, lote com cria/desmama próxima. | Recomendado |
| Registrar | Pré-contexto antes de lançar evento: animal em agenda, animal a observar, pendência sanitária. | Recomendado |
| Sanitário | Brucelose pendente/atrasada, agenda vencida, tratamento recente. | Recomendado com cautela |
| Reprodução/cria | Prenhez, parto próximo, neonato, desmama próxima. | Depende de validação |
| Comercial | Segurar venda manual, pré-check pendente. | bloqueado para decisão conclusiva |
| Relatórios | Segmentação operacional por marcadores derivados ou manuais auditáveis. | Recomendado com cautela |

---

### 33. Problemas que os Marcadores resolvem

| Problema | Como marcador ajuda | Risco se mal usado |
|---|---|---|
| Excesso de informação por animal/lote | Resume sinais em chips visuais. | Chip virar verdade primária. |
| Dificuldade de priorizar agenda | Permite filtrar atraso, vencimento e criticidade. | Contar agenda inválida ou zumbi. |
| Necessidade de listas rápidas de manejo | Cria listas como “observar” ou “separar curral”. | Manual virar evento factual. |
| Cruzamento mental de estado + agenda + protocolo | Sintetiza condição calculada. | Duplicar regra crítica fora do motor. |
| Comunicação entre campo e escritório | Marcadores manuais organizam ações sem alterar histórico. | Falta de auditoria e rastreabilidade. |
| Relatórios por recorte operacional | Agrupa animais/lotes sem reescrever regra primária. | Relatório baseado em marcador em vez de fonte real. |

---

### 34. Tipos de Marcadores

#### 34.1 Marcadores de sistema / derivados

**Definição:** Marcadores calculados automaticamente a partir de fontes de verdade.

**Regra:** Não editáveis manualmente.

| Marcador | Fonte primária esperada | Uso seguro | Classificação | Observação |
|---|---|---|---|---|
| `sexo:femea` / `sexo:macho` | `state_animais.sexo` | Filtro visual/lista. | Recomendado | Baixo risco. |
| `idade:3-8m` | `state_animais.data_nascimento` + data de referência | Filtro de janela etária. | Recomendado | Deve recalcular/expirar. |
| `categoria:bezerra` / `categoria:novilha` | Taxonomia/read model validado | Agrupamento operacional. | Depende de validação | Não duplicar regra taxonômica. |
| `agenda:vence_hoje` | Agenda aberta válida | Prioridade diária. | Recomendado | Deve expirar/recalcular diariamente. |
| `agenda:vence_7d` | Agenda aberta válida | Planejamento de curto prazo. | Recomendado | Deve ignorar canceladas/concluídas/deletadas. |
| `agenda:atrasada` | Agenda aberta vencida | Filtro crítico. | Recomendado | Alto valor operacional. |
| `agenda:critica` | Agenda + severidade definida em regra/read model | Priorização. | Depende de validação | Definir fonte da criticidade. |
| `sanitario:brucelose_pendente` | Agenda sanitária aberta/protocolo aplicável | Filtro sanitário. | Recomendado com cautela | Não usar protocolo isolado. |
| `sanitario:brucelose_atrasada` | Agenda sanitária vencida | Prioridade sanitária. | Recomendado | Deve apontar para agenda/item. |
| `sanitario:tratamento_recente` | Evento sanitário/medicamento | Contexto visual. | Recomendado futuramente | Histórico, não pendência. |
| `sanitario:carencia_ativa` | Read model de carência ativa | Bloqueio/alerta futuro. | bloqueado nesta fase | Falta fonte consolidada. |
| `reproducao:prenhe` | Evento/read model reprodutivo validado | Contexto reprodutivo. | Depende de validação | Deve apontar para fonte. |
| `reproducao:parto_proximo` | Data prevista/read model validado | Alerta operacional. | Depende de validação | Deve expirar após parto/aborto/reclassificação. |
| `cria:neonato` | Data de nascimento/payload validado | Filtro de cria. | Recomendado com cautela | Baixo risco se apenas visual. |
| `cria:desmama_proxima` | Agenda de desmame ou read model | Planejamento de manejo. | Depende de validação | Preferir agenda materializada. |
| `terminacao:peso_alvo_atingido` | Peso atual consolidado | Pré-sinal visual futuro. | bloqueado nesta fase | Peso atual não consolidado. |
| `comercial:pronto_venda` | Read model comercial composto | Pré-check futuro. | bloqueado nesta fase | Não pode autorizar venda. |

**Regras obrigatórias para derivados:**

- não editáveis manualmente;
- recalculáveis e idempotentes;
- derivados exclusivamente de `state_*`, `agenda_itens`, `eventos`, protocolos ou `vw_*` confirmadas;
- devem ter `source_type` e `source_ref_id` sempre que possível;
- devem ter `expires_at` quando dependem de data/janela;
- devem ser removidos/recalculados após rollback/reconcile;
- não substituem evento, agenda, protocolo ou estado atual;
- exigem paridade TS/SQL quando usados em regra crítica ou offline.

---

#### 34.2 Marcadores operacionais / manuais

**Definição:** Marcações feitas por usuários para organização prática do manejo.

**Regra:** Editáveis e auditáveis, mas sem valor factual técnico.

| Marcador | Uso seguro | Fonte primária | Classificação | Observação |
|---|---|---|---|---|
| `manejo:separar_curral` | Lista operacional para apartação. | Manual auditável. | Recomendado | Não significa evento realizado. |
| `manejo:observar` | Animal sob observação. | Manual auditável. | Recomendado | Deve ter autor/data/observação. |
| `risco:animal_fraco` | Alerta visual para equipe. | Manual auditável. | Recomendado | Não substitui diagnóstico/evento sanitário. |
| `comercial:segurar_venda` | Bloqueio operacional conservador. | Manual auditável. | Recomendado | Pode impedir ação por prudência, mas não comprova carência. |
| `lote_operacional:desmama_maio` | Lista/lote de manejo. | Manual auditável. | Recomendado | Não substitui agenda de desmame. |

**Regras obrigatórias para manuais:**

- devem ser editáveis apenas por perfil autorizado;
- devem ter auditoria: autor, data, alteração, remoção e motivo quando aplicável;
- não geram evento factual sozinhos;
- não concluem protocolo;
- não alteram `state_*` crítico;
- não autorizam venda/abate/movimentação crítica;
- podem entrar em filtros, listas e painéis operacionais;
- devem poder expirar, ser arquivados ou removidos;
- devem ser visualmente diferenciados dos marcadores derivados.

---

#### 34.3 Marcadores de protocolo

**Definição:** Marcadores para agrupar itens associados a protocolo, item de protocolo ou agenda protocolar.

**Regra:** Não comprovam execução.

| Marcador | Fonte esperada | Uso seguro | Classificação | Observação |
|---|---|---|---|---|
| `protocolo:brucelose` | Protocolo/item/agenda | Agrupar pendências ou histórico vinculado. | Recomendado | Não é execução. |
| `protocolo:raiva_d1` | Item de protocolo/agenda | Filtrar etapa específica. | Recomendado | Deve apontar para item quando possível. |
| `protocolo:vermifugacao_180d` | Item de protocolo | Agrupar rotina. | Recomendado | Não criar regra paralela de intervalo. |
| `protocolo:iatf_d0` | Protocolo reprodutivo futuro | Agrupar fase de protocolo. | não confirmado no código inspecionado | Motor IATF geral não confirmado. |

**Regras obrigatórias para protocolo:**

- úteis para agrupamento e filtros;
- não comprovam execução;
- devem apontar para `protocolo`, `protocolo_item`, `protocol_item_version_id` ou `agenda_item` quando possível;
- não devem existir se a fonte protocolar não existir;
- não criam agenda sozinhos;
- não substituem evento factual.

---

### 35. Modelo conceitual recomendado

**Status:** proposta futura, sem migration nesta etapa.

#### 35.1 `tag_definitions`

Catálogo de marcadores.

| Campo | Finalidade | Classificação |
|---|---|---|
| `id` | Identificador interno. | Recomendado |
| `code` | Código estável, ex.: `agenda:atrasada`. | Recomendado |
| `label` | Nome exibido na UX. | Recomendado |
| `domain` | Domínio: agenda, sanitário, reprodução, cria, comercial, manejo etc. | Recomendado |
| `kind` | Tipo: `system`, `manual`, `protocol`, `operational`. | Recomendado |
| `is_system` | Indica marcador derivado/sistema. | Recomendado |
| `is_user_editable` | Controla se usuário pode aplicar/remover. | Recomendado |
| `description` | Explicação operacional. | Recomendado |
| `severity` | `info`, `warning`, `critical`, `blocking`, se aplicável. | Recomendado |
| `created_at` | Auditoria técnica. | Recomendado |
| `updated_at` | Auditoria técnica. | Recomendado |

#### 35.2 `entity_tags`

Associação marcador-entidade.

| Campo | Finalidade | Classificação |
|---|---|---|
| `id` | Identificador da associação. | Recomendado |
| `fazenda_id` | Escopo multi-tenant. | Recomendado |
| `entity_type` | Tipo da entidade marcada. | Recomendado |
| `entity_id` | ID da entidade marcada. | Recomendado |
| `tag_code` | Código do marcador. | Recomendado |
| `source_type` | Origem da marcação. | Recomendado |
| `source_ref_id` | ID da fonte rastreável, quando houver. | Recomendado |
| `confidence` | Grau de confiança, se derivado/inferido. | inferido |
| `created_at` | Auditoria. | Recomendado |
| `updated_at` | Auditoria. | Recomendado |
| `expires_at` | Expiração de marcador temporal. | Recomendado |
| `created_by` | Autor da marcação manual. | Recomendado futuramente |
| `removed_at` | Remoção lógica. | Recomendado futuramente |
| `removed_by` | Autor da remoção. | Recomendado futuramente |
| `reason` | Motivo opcional da marcação manual. | Recomendado futuramente |

#### 35.3 Valores esperados

| Campo | Valores esperados |
|---|---|
| `entity_type` | `animal`, `lote`, `pasto`, `agenda_item`, `protocolo`, `evento` |
| `source_type` | `state`, `event`, `agenda`, `protocol`, `manual`, `system_recompute` |

---

### 36. Estratégia de persistência

| Estratégia | Vantagem | Desvantagem | Risco | Recomendação |
|---|---|---|---|---|
| Marcadores persistidos | Leitura rápida, indexável, útil offline, bom para listas manuais. | Exige invalidação, rollback/reconcile e limpeza. | Tag zumbi virar decisão. | Recomendado apenas para manuais/operacionais. |
| Marcadores calculados em view/função | Refletem fonte de verdade, reduzem risco de desatualização. | Podem pesar em listas grandes; offline exige equivalente TS. | Divergência TS/SQL. | Recomendado para derivados e críticos. |
| Modelo híbrido | Equilibra performance, auditoria e segurança. | Mais complexo; exige merge UI de manual + derivado. | Confusão UX entre manual e derivado. | Estratégia principal recomendada. |

**Direção recomendada:**

- persistir somente marcadores manuais/operacionais auditáveis;
- calcular marcadores derivados por view, read model ou função pura;
- permitir cache derivado apenas se for explicitamente não-autoritativo, expirar e for invalidável;
- recalcular derivados críticos após sync, rollback, reconcile, recompute, evento novo, alteração de agenda e alteração de estado animal;
- distinguir visualmente marcador manual, derivado e protocolar.

---

### 37. Marcadores proibidos manualmente

| Marcador/domínio | Motivo | Decisão |
|---|---|---|
| `sanitario:*` resolutivo | Pode sugerir vacina, carência, tratamento ou pendência. | bloqueado manualmente, salvo marcador operacional conservador claramente manual. |
| `sanitario:carencia_ativa` | Impacto sanitário/comercial alto. | bloqueado manualmente e bloqueado até read model. |
| `sanitario:brucelose_pendente` / `sanitario:brucelose_atrasada` | Deve vir da agenda/protocolo aplicável. | Somente derivado. |
| `reproducao:prenhe` | Deve vir de evento/read model reprodutivo. | Somente derivado. |
| `reproducao:vazia` | Alto risco sem read model claro. | Somente derivado/futuro. |
| `cria:neonato` / `cria:desmama_proxima` | Dependem de nascimento/agenda/read model. | Somente derivado. |
| `terminacao:peso_alvo_atingido` | Peso atual não consolidado. | bloqueado nesta fase. |
| `comercial:pronto_venda` | Exige peso, carência, bloqueios e estado comercial. | bloqueado nesta fase. |
| `agenda:concluida` como execução | Agenda não é fato. | bloqueado como histórico. |
| `protocolo:executado` | Execução vem de evento. | bloqueado. |

---

### 38. Regras de expiração, rastreabilidade e recompute

| Regra | Aplicação |
|---|---|
| `source_type` obrigatório | Todo marcador derivado deve declarar origem: `state`, `event`, `agenda`, `protocol`, `system_recompute`. |
| `source_ref_id` obrigatório quando houver entidade-fonte | Ex.: `agenda:atrasada` aponta para agenda; `protocolo:brucelose` aponta para protocolo/item. |
| `expires_at` obrigatório para marcadores temporais | Ex.: `agenda:vence_7d`, `agenda:vence_hoje`, `idade:3-8m`, tratamento recente. |
| Recompute após evento novo | Evento sanitário/reprodutivo/pesagem deve invalidar marcadores afetados. |
| Recompute após agenda alterada | Conclusão, cancelamento, remarcação ou soft delete deve recalcular marcadores de agenda. |
| Recompute após rollback/reconcile | Marcadores derivados não podem sobreviver a rollback de fonte. |
| Paridade TS/SQL | Obrigatória para marcadores críticos usados offline e online. |
| Visualização diferenciada | Manual, sistema e protocolo devem ter aparência e tooltip diferentes. |

---

### 39. Relação com `src/lib/insights/`

A camada `insights` deve ser a principal candidata para gerar marcadores derivados **não persistidos**.

| Fonte | Marcadores derivados possíveis | Módulo provável | Status |
|---|---|---|---|
| Agenda válida | `agenda:vence_hoje`, `agenda:vence_7d`, `agenda:atrasada` | `agendaNeeds.ts` | Recomendado agora |
| Agenda/protocolo sanitário | `sanitario:brucelose_pendente`, `sanitario:brucelose_atrasada` | `sanitaryRiskSummary.ts` | Recomendado com cautela |
| Estado animal | `sexo:*`, `idade:*`, categorias simples | `herdStageSummary.ts` | parcialmente validado / exige validação |
| Eventos sanitários | `sanitario:tratamento_recente` | `sanitaryRiskSummary.ts` | Futuro/validação |
| Reprodução/cria | `reproducao:prenhe`, `cria:neonato`, `cria:desmama_proxima` | `reproductionSummary.ts` | parcialmente validado / exige validação |
| Comercial | `comercial:pronto_venda`, `terminacao:peso_alvo_atingido` | `commercialReadiness.ts` | bloqueado |
| Manual | `manejo:observar`, `manejo:separar_curral`, `comercial:segurar_venda` | Futuro serviço de marcadores manuais | Futuro recomendado |

---

### 40. MVP recomendado para Marcadores

| Fase | Escopo | Fonte primária | Persistência | Classificação |
|---|---|---|---|---|
| MVP 1 | Marcadores derivados de agenda: `agenda:atrasada`, `agenda:vence_hoje`, `agenda:vence_7d`. | Agenda aberta válida. | Calculado, não persistido. | Recomendado agora. |
| MVP 1 | Marcadores manuais simples: `manejo:observar`, `manejo:separar_curral`. | Manual auditável. | Persistido futuramente com auditoria. | Recomendado futuramente. |
| MVP 2 | Marcadores sanitários derivados: brucelose pendente/atrasada, tratamento recente. | Agenda sanitária/eventos sanitários. | Calculado/view. | Depende de validação. |
| MVP 2 | Marcadores de cria/reprodução simples. | Eventos/read model/agenda da cria. | Calculado/view. | Depende de validação. |
| MVP 3 | Marcadores de carência, peso-alvo, pronto venda. | Read models ainda ausentes. | Não definir agora. | bloqueado. |

---

### 41. Testes recomendados futuramente

| Tipo | Teste | Risco prevenido |
|---|---|---|
| Unitário | `agenda:atrasada` ignora canceladas, concluídas e deletadas. | Marcador falso de pendência. |
| Unitário | `agenda:vence_7d` expira e vira `agenda:vence_hoje` na data correta. | Marcador temporal desatualizado. |
| Unitário | Marcador manual não gera evento. | Falso histórico. |
| Unitário | Marcador manual não conclui agenda/protocolo. | Violação Two Rails. |
| Unitário | `protocolo:*` não conta como execução. | Protocolo virar fato. |
| Integração | Conclusão de agenda remove/recalcula `agenda:atrasada`. | Tag zumbi. |
| Integração | Venda/óbito remove marcadores derivados de agenda futura. | Pendência em animal inativo. |
| Integração | Rollback/reconcile remove marcador derivado sem fonte. | Marcador órfão. |
| Paridade TS/SQL | Marcadores derivados críticos têm mesmo resultado offline/online. | Divergência de decisão. |
| Segurança/RLS | Usuário só edita marcadores manuais da fazenda permitida. | Vazamento multi-tenant. |

---

---

## Parte 5 — Síntese consolidada sobre Marcadores Inteligentes

### 51. Três camadas obrigatórias

| Camada | Regra consolidada | Decisão |
|---|---|---|
| Marcadores derivados | Calculados, não editáveis, rastreáveis, expiráveis e nunca fonte primária. | Recomendados como cálculo/view/read model. |
| Marcadores manuais | Persistidos futuramente, auditáveis e úteis para manejo, sem efeito factual ou técnico crítico. | Recomendados apenas para organização operacional. |
| Marcadores de protocolo | Agrupadores de rotina, protocolo, item de protocolo ou agenda gerada. | Nunca comprovam execução. |

**Estratégia recomendada:** modelo híbrido.

- Manuais persistidos e auditáveis.
- Derivados calculados via views, read models ou funções puras.
- Críticos com paridade TypeScript/SQL.
- Comerciais e sanitários sensíveis bloqueados até fonte consolidada.

> **Diretriz final:** marcador melhora a leitura operacional. Não cria fato, não executa protocolo, não autoriza venda, não substitui agenda, não substitui evento e não substitui estado atual.

---

### 52. Veredito consolidado

**Status:** proposta conceitual futura.  
**Implementação:** nenhuma implementação de código, migration, seed ou teste.  
**Premissa central:** marcador é camada auxiliar de classificação, filtro, priorização e UX. Não é fonte primária de verdade.

Marcadores fazem sentido para o RebanhoSync porque reduzem carga cognitiva no campo, ajudam em filtros rápidos, agrupamentos de manejo, listas operacionais e dashboards. O risco aumenta quando são tratados como prova histórica, execução de protocolo ou autorização sanitária/comercial.

| Pergunta | Decisão |
|---|---|
| Marcadores fazem sentido? | Sim, desde que sejam auxiliares. |
| Podem ser fonte primária? | Não. |
| Podem comprovar vacinação, tratamento, prenhez ou carência? | Não. |
| Podem executar protocolo? | Não. |
| Podem substituir agenda, evento ou `state_*`? | Não. |
| Podem autorizar venda/abate isoladamente? | Não. |
| Podem apoiar filtros, listas e dashboards? | Sim. |

**Uso permitido:**

- etiquetas visuais;
- filtros rápidos;
- agrupadores operacionais;
- sinalizadores de risco;
- auxiliares de relatório;
- atalhos cognitivos para curral, lote, agenda e animal.

**Uso proibido:**

- fonte primária de verdade;
- prova de vacinação, tratamento, prenhez ou carência;
- execução de protocolo;
- evento histórico;
- substituto de agenda;
- substituto de `state_*`;
- autorização isolada para venda/abate;
- regra sanitária, reprodutiva ou comercial crítica.

**Síntese de fontes:**

| Camada | Pergunta respondida |
|---|---|
| Agenda | O que precisa ser feito. |
| Evento | O que foi feito. |
| `state_*` | Qual é a situação atual. |
| Protocolo | Qual regra deve ser aplicada. |
| Marcador | Como classificar, filtrar e consultar rapidamente. |

---

### 53. Onde Marcadores agregam valor

| Tela/fluxo | Uso recomendado | Risco |
|---|---|---|
| Agenda | Filtros: atrasada, vence hoje, vence 7 dias, crítica, sanitário, cria. | Baixo/médio |
| Lista de animais | Busca rápida por sexo, categoria, estágio, risco e manejo. | Baixo |
| Animal individual | Resumo visual: prenhe, tratamento recente, pendência, observar. | Médio |
| Lote | Pendências do lote, manejo, cria, desmama, observação. | Baixo/médio |
| Registrar | Pré-contexto antes de lançar evento. | Médio |
| Sanitário | Brucelose, carência, tratamento recente, reavaliação. | Alto |
| Reprodução/cria | Prenhe, diagnóstico pendente, parto próximo, neonato, desmama. | Médio/alto |
| Comercial | Segurar venda, pronto para venda, bloqueio comercial. | Alto |
| Relatórios | Segmentação por marcador derivado ou manual auditável. | Médio |

---

### 54. Classificação consolidada dos Marcadores

#### 54.1 Marcadores de sistema / derivados

**Definição:** projeções recalculáveis a partir de fonte real: `state_*`, agenda, evento, protocolo, view ou read model.  
**Regra:** não editáveis manualmente.

**Exemplos recomendados:**

| Domínio | Marcadores |
|---|---|
| Sexo | `sexo:femea`, `sexo:macho` |
| Categoria/idade | `categoria:bezerra`, `categoria:novilha`, `idade:3-8m` |
| Sanitário | `sanitario:brucelose_elegivel`, `sanitario:brucelose_pendente`, `sanitario:brucelose_atrasada`, `sanitario:carencia_ativa`, `sanitario:tratamento_recente`, `sanitario:reavaliacao_pendente` |
| Reprodução | `reproducao:apta`, `reproducao:exposta`, `reproducao:diagnostico_pendente`, `reproducao:prenhe`, `reproducao:vazia`, `reproducao:parto_proximo` |
| Cria | `cria:neonato`, `cria:desmama_proxima` |
| Terminação/comercial | `terminacao:peso_alvo_atingido`, `comercial:pronto_venda` |
| Agenda | `agenda:vence_hoje`, `agenda:vence_7d`, `agenda:atrasada`, `agenda:critica` |

| Regra | Decisão |
|---|---|
| Editável manualmente? | Não. |
| Recalculável? | Sim. |
| Pode expirar? | Sim, quando temporal. |
| Precisa apontar origem? | Sim, sempre que possível. |
| Pode substituir evento? | Não. |
| Pode substituir protocolo? | Não. |
| Pode autorizar venda/abate sozinho? | Não. |
| Precisa paridade TS/SQL? | Sim, se usado offline ou em regra crítica. |

#### 54.2 Marcadores operacionais / manuais

**Definição:** marcações feitas pela equipe para organização prática.

**Exemplos:**

- `manejo:separar_curral`
- `manejo:observar`
- `risco:animal_fraco`
- `comercial:segurar_venda`
- `lote_operacional:desmama_maio`

| Regra | Decisão |
|---|---|
| Editável? | Sim, por perfil autorizado. |
| Auditável? | Sim. |
| Altera histórico? | Não. |
| Gera evento factual? | Não. |
| Executa protocolo? | Não. |
| Pode entrar em filtros/listas? | Sim. |
| Pode bloquear ação por segurança? | Sim, se for bloqueio conservador. |
| Pode liberar ação crítica? | Não. |

**Exemplo aceitável:** `comercial:segurar_venda` pode impedir uma venda por cautela operacional.  
**Exemplo proibido:** `comercial:pronto_venda` aplicado manualmente para liberar venda.

#### 54.3 Marcadores de protocolo

**Definição:** etiquetas de agrupamento ligadas a protocolo, item de protocolo ou agenda gerada.

**Exemplos:**

- `protocolo:brucelose`
- `protocolo:raiva_d1`
- `protocolo:vermifugacao_180d`
- `protocolo:iatf_d0`

| Regra | Decisão |
|---|---|
| Úteis para agrupamento? | Sim. |
| Representam execução? | Não. |
| Geram agenda sozinhos? | Não. |
| Precisam apontar fonte? | Sim. |
| Fonte esperada | `protocolo_id`, `protocolo_item_id`, `agenda_item_id`. |

---

### 55. Modelo de dados recomendado

**Status:** proposta futura, sem implementação.

#### 55.1 `tag_definitions`

Catálogo controlado de marcadores.

| Campo | Finalidade |
|---|---|
| `id` | Identificador interno. |
| `code` | Código estável, ex.: `agenda:atrasada`. |
| `label` | Nome exibido na UX. |
| `domain` | Agenda, sanitário, reprodução, cria, comercial, manejo. |
| `kind` | `system`, `manual`, `protocol`, `operational`. |
| `is_system` | Indica marcador derivado. |
| `is_user_editable` | Controla aplicação manual. |
| `description` | Explicação operacional. |
| `severity` | `info`, `warning`, `critical`, `blocking`. |
| `created_at` | Auditoria. |
| `updated_at` | Auditoria. |

#### 55.2 `entity_tags`

Associação entre marcador e entidade.

| Campo | Finalidade |
|---|---|
| `id` | Identificador. |
| `fazenda_id` | Escopo multi-tenant. |
| `entity_type` | Tipo da entidade. |
| `entity_id` | ID da entidade. |
| `tag_code` | Código do marcador. |
| `source_type` | Origem da marcação. |
| `source_ref_id` | ID rastreável da fonte. |
| `confidence` | Confiança, se houver inferência. |
| `created_at` | Auditoria. |
| `updated_at` | Auditoria. |
| `expires_at` | Expiração de marcador temporal. |

#### 55.3 Valores esperados

| Campo | Valores esperados |
|---|---|
| `entity_type` | `animal`, `lote`, `pasto`, `agenda_item`, `protocolo`, `evento` |
| `source_type` | `state`, `event`, `agenda`, `protocol`, `manual`, `system_recompute` |

Esse modelo converge para catálogo + associação rastreável + origem explícita.

---

### 56. Estratégia de persistência consolidada

**Recomendação principal:** modelo híbrido.

| Estratégia | Vantagem | Risco | Decisão |
|---|---|---|---|
| Marcadores persistidos | Leitura rápida, bom offline, auditável. | Tag zumbi / stale data. | Usar para manuais. |
| Marcadores calculados em view/função | Mais fiel à fonte de verdade. | Custo computacional / paridade offline. | Usar para derivados críticos. |
| Modelo híbrido | Equilíbrio entre performance e segurança. | Maior complexidade. | Recomendado. |

**Regra prática:**

| Tipo | Direção |
|---|---|
| Manual | Persistido + auditável. |
| Derivado simples | Calculado. |
| Derivado crítico | View/read model + paridade TS/SQL. |
| Temporal | `expires_at` + recompute. |
| Sanitário/comercial crítico | Nunca persistir como verdade final. |

Persistir tudo é perigoso. Calcular tudo pode ser pesado. O modelo híbrido é a direção mais segura.

---

### 57. Marcadores proibidos manualmente

Esses marcadores devem ser somente derivados:

| Domínio | Marcadores |
|---|---|
| Sanitário | `sanitario:brucelose_elegivel`, `sanitario:brucelose_pendente`, `sanitario:brucelose_atrasada`, `sanitario:carencia_ativa`, `sanitario:tratamento_recente`, `sanitario:reavaliacao_pendente` |
| Reprodução | `reproducao:prenhe`, `reproducao:vazia`, `reproducao:parto_proximo`, `reproducao:diagnostico_pendente` |
| Cria | `cria:neonato`, `cria:desmama_proxima` |
| Terminação/comercial | `terminacao:peso_alvo_atingido`, `comercial:pronto_venda` |
| Agenda | `agenda:vence_hoje`, `agenda:vence_7d`, `agenda:atrasada`, `agenda:critica` |

**Motivo:** todos dependem de uma fonte técnica:

- evento;
- agenda aberta;
- protocolo aplicável;
- estado atual;
- cálculo temporal;
- read model de carência;
- peso atual;
- bloqueios sanitários/comerciais;
- regra reprodutiva.

Permitir edição manual nesses casos quebra rastreabilidade e pode gerar falso positivo operacional.

---

### 58. Restrições críticas consolidadas

| Restrição | Aplicação |
|---|---|
| Marcador não é fonte primária. | Sempre. |
| Marcador derivado não é editável. | Sempre. |
| Marcador manual não altera evento. | Sempre. |
| Marcador manual não executa protocolo. | Sempre. |
| Marcador manual não libera venda/abate. | Sempre. |
| Marcador crítico exige `source_ref_id`. | Sanitário, reprodução, comercial e agenda. |
| Marcador temporal exige `expires_at`. | Agenda, neonato, tratamento recente e parto próximo. |
| Rollback/reconcile deve recalcular derivados. | Obrigatório. |
| Paridade TS/SQL para offline. | Obrigatória em regra crítica. |
| UX deve diferenciar manual vs derivado. | Obrigatório. |

---

### 59. Riscos consolidados

| Risco | Severidade | Mitigação |
|---|---|---|
| Marcador virar fonte de verdade. | Alto | Exibir origem e bloquear uso como autorização. |
| Tag zumbi. | Alto | `expires_at`, recompute e invalidação por fonte. |
| Manual substituir evento. | Alto | Bloquear domínios críticos para edição. |
| `comercial:pronto_venda` falso positivo. | Alto | Calcular por read model composto; nunca manual. |
| `sanitario:carencia_ativa` falso negativo. | Alto | Exigir fonte sanitária/comercial primária. |
| Divergência TS/SQL. | Médio/alto | Contrato único + testes de paridade. |
| Ruído visual. | Médio | Limite de marcadores visíveis e severidade. |
| Performance mobile. | Médio | Materialização parcial, índices e lazy loading. |
| Offline desatualizado. | Médio/alto | Status visual de sincronização e recompute pós-sync. |
| Falta de auditoria manual. | Médio | `created_by`, `updated_by`, timestamps e histórico. |

---

### 60. UX recomendada

**Termo recomendado:** Marcadores.

Evitar “tags” como termo principal, porque parece genérico e técnico. “Marcadores” comunica melhor sinalização, filtro e organização.

#### 60.1 Separação visual obrigatória

| Tipo | Aparência sugerida |
|---|---|
| Derivado de sistema | Chip com ícone de sistema/cadeado. |
| Manual | Chip editável com ícone de pessoa. |
| Protocolo | Chip com ícone de calendário/protocolo. |
| Crítico/bloqueante | Chip destacado, mas com origem visível. |

#### 60.2 Microcopy sugerida

**Marcador derivado:**  
Marcador derivado de agenda aberta. Não pode ser editado manualmente. Origem: Agenda #123 — Brucelose D1 vencida.

**Marcador manual:**  
Marcador manual criado por João em 05/05/2026. Uso operacional: separar no curral. Não altera histórico do animal.

---

### 61. MVP recomendado

#### 61.1 Fase 1 — Marcadores de agenda

**Risco:** baixo.  
**Valor:** alto.

**Marcadores:**

- `agenda:vence_hoje`
- `agenda:vence_7d`
- `agenda:atrasada`

**Usos:**

- Agenda;
- Central Operacional;
- Lote;
- Lista de animais.

**Fonte primária:** `agenda_itens` / `state_agenda_itens`.

**Cuidados:**

- ignorar agenda concluída;
- ignorar agenda cancelada;
- ignorar deletada;
- recalcular por data;
- não duplicar por protocolo/recompute.

#### 61.2 Fase 2 — Marcadores manuais operacionais

**Marcadores:**

- `manejo:separar_curral`
- `manejo:observar`
- `risco:animal_fraco`
- `comercial:segurar_venda`
- `lote_operacional:desmama_maio`

**Requisitos:**

- persistência;
- auditoria;
- permissão por perfil;
- sincronização offline;
- histórico de alteração;
- ausência de efeito sobre evento/protocolo.

#### 61.3 Fase 3 — Marcadores sanitários derivados

**Marcadores:**

- `sanitario:brucelose_pendente`
- `sanitario:brucelose_atrasada`
- `sanitario:tratamento_recente`

Adiar `sanitario:carencia_ativa` até haver read model/fonte consolidada e validada.

#### 61.4 Fase 4 — Marcadores reprodutivos/cria

**Marcadores:**

- `reproducao:prenhe`
- `reproducao:diagnostico_pendente`
- `reproducao:parto_proximo`
- `cria:neonato`
- `cria:desmama_proxima`

Exige validação forte de fonte e eventos.

#### 61.5 Fase 5 — Comercial/venda

**Marcadores:**

- `terminacao:peso_alvo_atingido`
- `comercial:pronto_venda`

Deve ser a última fase por ter maior risco de falso positivo. Depende da combinação de:

- peso;
- carência;
- bloqueios;
- status comercial;
- lote;
- idade;
- estágio;
- eventos recentes;
- restrições sanitárias.

---

### 62. Testes mínimos recomendados

| Tipo | Teste |
|---|---|
| Unitário | Classificador de marcador derivado. |
| Unitário | Marcador manual não altera regra técnica. |
| Unitário | Agenda vencida gera `agenda:atrasada`. |
| Unitário | Agenda concluída remove `agenda:atrasada`. |
| Unitário | `expires_at` remove marcador temporal. |
| Unitário | `comercial:pronto_venda` é bloqueado manualmente. |
| Unitário | `sanitario:carencia_ativa` é bloqueado manualmente. |
| Integração | Criar evento sanitário conclui agenda e recalcula marcadores. |
| Integração | Rollback de evento reabre marcador derivado quando aplicável. |
| Integração | Marcador manual sincroniza offline/online. |
| Integração | Marcador manual não gera evento. |
| Integração | Protocolo gera agenda, mas não execução. |
| Integração | Marcador de protocolo aponta para protocolo/item/agenda. |
| Paridade TS/SQL | `agenda:atrasada`. |
| Paridade TS/SQL | `agenda:vence_hoje`. |
| Paridade TS/SQL | `sanitario:brucelose_pendente`. |
| Paridade TS/SQL | `reproducao:prenhe`. |
| Paridade TS/SQL | `cria:neonato`. |
| Paridade TS/SQL | `comercial:pronto_venda`, quando existir. |

---

### 63. Decisão final

#### 63.1 O que consolidar como direção

- Adotar o conceito de Marcadores Inteligentes.
- Usar modelo híbrido.
- Persistir apenas marcadores manuais/operacionais inicialmente.
- Calcular derivados críticos por view/read model/função pura.
- Exigir `source_type`, `source_ref_id` e `expires_at` quando aplicável.
- Bloquear edição manual de qualquer marcador sanitário, reprodutivo, comercial ou de agenda crítica.
- Começar pelo MVP de agenda + marcadores manuais.
- Deixar comercial/venda para fase final.

#### 63.2 O que não fazer

- Não criar marcador como substituto de evento.
- Não usar marcador para confirmar protocolo.
- Não liberar venda/abate por marcador.
- Não permitir `sanitario:*`, `reproducao:*`, `agenda:*` crítico ou `comercial:pronto_venda` manual.
- Não persistir derivado crítico como verdade final.
- Não misturar “manual” e “derivado” visualmente.

#### 63.3 Veredito executivo

Marcadores Inteligentes são pertinentes para o RebanhoSync, mas devem nascer como camada auxiliar de UX e consulta, não como camada decisória.

| Categoria | Arquitetura recomendada |
|---|---|
| Marcadores manuais | Persistidos, auditáveis e sincronizáveis. |
| Marcadores derivados simples | Calculados. |
| Marcadores críticos | Read model/view + paridade TS/SQL. |
| Marcadores comerciais/sanitários | Nunca fonte primária. |

**MVP mais seguro:** começar por `agenda:*` e `manejo:*`.

**Maior risco:** `comercial:pronto_venda` e `sanitario:carencia_ativa` virarem chips visuais sem fonte técnica rastreável.

