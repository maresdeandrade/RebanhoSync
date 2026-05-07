# Insights

Status: camada `infra.insights` read-only/core puro.

`src/lib/insights/` compoe respostas operacionais a partir de dados ja carregados em memoria. A camada nao e dominio primario, store local, adapter remoto, UI, job, migration ou fonte paralela de verdade. Cada saida deve declarar fonte primaria ou bloqueio explicito.

## Objetivo

- Organizar necessidades futuras, pendencias atuais, estado corrente, KPIs historicos e sinais auxiliares.
- Separar pergunta operacional, fonte primaria, limitacoes e resultado.
- Impedir que agenda, protocolo, estado atual ou sinal sejam usados fora do seu papel conceitual.
- Manter o core puro: sem IO, sem storage, sem relogio global e sem side effects.

## Nao objetivos

- Nao consultar Supabase, Dexie, `fetch`, filesystem, browser APIs ou UI.
- Nao gerar, concluir, cancelar, deletar ou reconciliar agenda.
- Nao criar, alterar ou inferir evento factual.
- Nao recalcular protocolo sanitario ou motor de protocolo.
- Nao decidir carencia ativa/livre, pronto para venda, apto para abate, peso atual confiavel ou IATF pendente amplo.
- Nao persistir tags, marcadores ou sinais.
- Nao compor `operational_report` diretamente `answerable`.

## Contrato de fontes de verdade

| Pergunta | Fonte primaria correta | Fonte proibida como verdade |
|---|---|---|
| O que precisa ser feito? | `state_agenda_itens` / agenda materializada aberta | eventos, protocolo isolado, sinal/tag |
| O que esta pendente agora? | agenda aberta ou read model de pendencia atual | evento historico, protocolo isolado, sinal/tag |
| O que ja aconteceu? | `eventos` + detail tables / `eventos_*` | agenda, protocolo, `state_*` atual, sinal/tag |
| Qual e o estado atual? | `state_*` ou read model atual validado | agenda, evento como fonte primaria, sinal/tag |
| Qual regra esta configurada? | protocolos/configuracoes | agenda, evento, sinal/tag |
| Qual KPI mensal historico? | eventos historicos no periodo | agenda, `state_animais`, protocolo, sinal/tag |
| Qual sinal visual aplicar? | insight answerable com fonte primaria | sinal/tag como fonte primaria |

Agenda nunca comprova execucao. Protocolo nunca comprova execucao. `state_*` representa estado corrente, nao historico. Eventos + detail tables sao a fonte primaria para historico e KPI factual.

## Mapa pergunta -> modulo -> fonte primaria

| Pergunta | Modulo | `questionKind` | Fonte primaria |
|---|---|---|---|
| Necessidades futuras por agenda | `agendaNeeds.ts` | `future_need` | `state_agenda_itens` |
| Pendencias atuais por agenda | `agendaNeeds.ts` | `current_pending` | `state_agenda_itens` |
| Necessidade futura de insumos sanitarios | `sanitarySupplyNeeds.ts` | `future_need` / `current_pending` | `state_agenda_itens` |
| Atividades historicas agregadas | `historicalActivitySummary.ts` | `historical_kpi` | `eventos` ou `eventos_*` |
| KPIs operacionais mensais historicos | `monthlyOperationalKpis.ts` | `historical_kpi` | `eventos` |
| Rebanho por estagio/lote/status | `herdStageSummary.ts` | `current_state` | `state_animais` |
| Sinais auxiliares derivados | `tagSignals.ts` | herda do insight de origem | fonte primaria do insight de origem |
| Contratos e validacoes | `sourceContract.ts` / `types.ts` | todos | conforme tipo de pergunta |

## Camadas conceituais

- Agenda: intencao futura ou tarefa operacional mutavel. Pode responder necessidade e pendencia, mas nao historico factual.
- Evento: fato historico. Deve ser a base de KPI historico e atividade executada.
- Estado atual: `state_*` ou read model corrente. Responde situacao atual, nao periodo historico.
- Protocolo: regra ou configuracao. Nao comprova execucao realizada.
- Sinal/tag: auxiliar visual, filtro ou agrupamento derivado. Nao e fonte primaria e nao e persistido nesta camada.

## Padrao `answerability`

Todo insight deve ser:

- `answerable`: possui `primarySource` nao vazio, contrato validado e pode retornar `complete`, `empty` ou `partial`.
- `blocked`: nao possui fonte primaria suficiente ou a pergunta e proibida sem fonte futura/validacao.

Status de resultado:

- `complete`: resposta calculada sem limitacao que altere a confianca principal.
- `empty`: resposta valida, com zero itens/eventos encontrados.
- `partial`: resposta calculada com limitacao declarada ou fallback controlado.
- `blocked`: resposta nao deve ser calculada.

`operational_report` existe como tipo reservado para composicao por secoes, mas nao pode ser `answerable` diretamente.

## Escopo por modulo

### `types.ts`

Define unions e interfaces centrais: `InsightQuestionKind`, `InsightSourceContract`, `OperationalInsight`, `answerability`, `resultStatus` e bloqueios.

### `sourceContract.ts`

Cria e valida contratos puros. Valida fonte por `questionKind`, bloqueia `operational_report` answerable direto e exige `requiredSources` para bloqueios que dependem de fonte futura.

### `agendaNeeds.ts`

Compoe agendas abertas/materializadas por escopo: `all_open`, `due_today`, `overdue`, `due_within_days`. Aceita apenas `future_need` e `current_pending`. Exclui concluida, cancelada e deletada. Valida datas por parametro. Nao responde KPI historico.

### `sanitarySupplyNeeds.ts`

Calcula necessidade futura/pendencia atual de insumos sanitarios a partir de agendas abertas ja carregadas. Usa apenas itens `domain = "sanitario"`. Agrupa por produto identificado, trata produto ausente como resultado parcial quando ha dados parciais e nao recalcula protocolo sanitario.

### `historicalActivitySummary.ts`

Resume eventos historicos por periodo. Aceita apenas `historical_kpi`. Usa eventos como fonte primaria. Agrupa por dominio, lote e animal. Quando precisa usar `currentLoteId` como fallback para lote, retorna `partial` com limitacao e declara `state_animais` como auxiliar.

### `monthlyOperationalKpis.ts`

Calcula KPIs operacionais mensais historicos exclusivamente a partir de eventos ja carregados. Exige `periodStart` e `periodEnd` no mesmo mes. Ignora `deletedAt`, agrupa por dominio e opcionalmente por lote/animal. Nao usa agenda, `state_animais` ou protocolo como historico.

### `herdStageSummary.ts`

Resume estado atual do rebanho por estagio, lote e status usando `state_animais` ou read model atual validado. Aceita apenas `current_state`. Exclui deletados, inclui `ativo` por padrao e usa `estagio_desconhecido` / `sem_lote` quando o estado atual nao informa esses campos. Nao infere estagio por idade, peso ou eventos.

### `tagSignals.ts`

Emite sinais operacionais calculados a partir de insights `answerable`. Nao persiste tags, nao cria marcador manual e nao usa sinal como fonte primaria. Sinais bloqueados, como carencia, venda/abate, peso atual confiavel, protocolo executado e agenda concluida como fato, nao sao emitidos.

## Limitacoes obrigatorias

- Agenda concluida genericamente nao comprova evento factual.
- Agenda cancelada ou concluida nao entra como necessidade futura.
- Protocolo isolado nao entra como execucao nem necessidade materializada.
- `state_animais` atual nao pode ser usado para inferir historico de lote/categoria no periodo.
- KPI historico por lote deve usar lote registrado no evento; fallback para lote atual so e permitido como `partial` e com limitacao.
- Produto ausente em necessidade sanitaria nao deve ser inferido.
- Sinal/tag nunca substitui agenda, evento, protocolo, `state_*` ou read model.
- Carencia, venda/abate, peso atual confiavel e IATF amplo permanecem fora do escopo implementado.

## Anti-exemplos proibidos

- Contar agendas concluidas como animais vacinados.
- Usar protocolo configurado para dizer que uma aplicacao ocorreu.
- Usar `state_animais.loteId` atual para KPI historico por lote sem declarar `partial`.
- Usar sinal `agenda:atrasada` como fonte primaria de relatorio.
- Responder pronto para venda/abate a partir de status visual, agenda ou marcador.
- Emitir `sanitario:livre_carencia` ou `comercial:apto_abate` sem read model validado.
- Criar `operational_report` como insight unico `answerable` para burlar validacoes por pergunta.

## Checklist para novos modulos

- Definir exatamente um `questionKind` ou lista curta permitida.
- Receber dados ja carregados por parametro.
- Receber `generatedAt`, datas e periodos por parametro.
- Declarar `primarySource`, `auxiliarySources`, `excludedSources` e `limitations`.
- Retornar `empty` para zero valido e `blocked` apenas quando falta fonte ou a pergunta e insegura.
- Validar periodo/data quando houver filtro temporal.
- Nao importar Supabase, Dexie, UI, stores, adapters ou paginas.
- Nao criar side effects, persistencia, agenda, evento, protocolo ou tags.
- Testar fontes proibidas e casos `complete`, `empty`, `partial` ou `blocked` aplicaveis.

## Checklist para revisao de agentes

- O modulo continua core puro e read-only?
- O `questionKind` corresponde a fonte primaria?
- Existe resposta sem `primarySource` ou sem bloqueio explicito?
- Alguma agenda foi tratada como historico?
- Algum protocolo foi tratado como execucao?
- Algum `state_*` atual foi usado como historico sem `partial` e limitacao?
- Algum sinal/tag virou fonte primaria?
- Alguma regra bloqueada foi calculada como existente?
- `operational_report` foi mantido fora de `answerable` direto?
- Os testes cobrem fonte errada, dados vazios e limitacoes relevantes?

## Comandos de validacao

```bash
pnpm test src/lib/insights/__tests__
pnpm run lint
pnpm run build
git status --short --untracked-files=all
```
