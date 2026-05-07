# AGENTS - src/lib/insights

Capability: `infra.insights.*`

## Natureza

- Camada read-only de composicao operacional.
- Core puro: recebe dados ja carregados e nao faz IO.
- Sem fonte primaria propria.
- Sem persistencia propria.
- Sem adapters/loaders/stores.

## Modulos atuais

- `types.ts`: contratos e unions de insight.
- `sourceContract.ts`: helpers e validacoes de fonte por `questionKind`.
- `agendaNeeds.ts`: necessidades/pendencias por agenda aberta.
- `sanitarySupplyNeeds.ts`: insumos sanitarios futuros por agenda sanitaria aberta.
- `historicalActivitySummary.ts`: resumo historico por eventos.
- `monthlyOperationalKpis.ts`: KPIs mensais historicos por eventos.
- `herdStageSummary.ts`: estado atual do rebanho por `state_animais`.
- `tagSignals.ts`: sinais auxiliares derivados de insights answerable.

## Permitido

- Tipos e helpers puros.
- Calculos deterministas sobre dados recebidos por parametro.
- Validacoes que impedem insight sem fonte primaria ou sem bloqueio explicito.
- Sinais derivados sem persistencia.
- Documentar guardrails locais desta pasta.

## Proibido

- Consultar Supabase, Dexie, `fetch`, `window`, `localStorage`, filesystem ou relogio global.
- Gerar, concluir, cancelar, deletar ou recalcular agenda.
- Gerar, editar ou inferir evento factual.
- Recalcular protocolo sanitario ou motor de protocolo.
- Usar protocolo como execucao.
- Usar agenda como evento historico.
- Usar `state_*` atual como historico sem limitacao `partial`.
- Persistir tag, marcador ou sinal.
- Usar marcador/tag/sinal como fonte primaria.
- Decidir carencia, venda, abate, peso atual confiavel ou IATF amplo.
- Criar `operational_report` diretamente `answerable`.

## Fontes por pergunta

- `future_need`: agenda materializada aberta, normalmente `state_agenda_itens`.
- `current_pending`: agenda aberta ou read model de pendencia atual.
- `current_state`: `state_*` ou read model atual validado.
- `historical_kpi`: `eventos`, `eventos_*` ou read model historico derivado de eventos.
- `workflow_kpi`: apenas modulo especifico de workflow, quando existir; nao confundir com execucao factual.
- `configured_rule`: protocolos/configuracoes, nunca execucao.
- `operational_report`: composicao futura por secoes; nao answerable direto.

## Regra local

Todo insight operacional deve ser:

1. `answerable`, com `primarySource` nao vazio; ou
2. `blocked`, com motivo de bloqueio explicito.

`complete` significa resposta calculada. `empty` significa resposta valida com zero itens. `partial` exige limitacao declarada. `blocked` significa que a pergunta nao pode ser respondida com seguranca pelas fontes atuais.

## Checklist antes de editar

- Confirmar escopo permitido e proibido da tarefa.
- Rodar preflight quando criar ou alterar arquivo da pasta.
- Manter a mudanca em um unico capability `infra.insights.*`.
- Nao tocar Agenda, Registrar, Supabase, Dexie, UI, migrations, seed, Sanitário ou Reprodução sem pedido explicito.
- Preferir funcoes puras pequenas e testes de contrato.

## Checklist de revisao

- A fonte primaria bate com o `questionKind`?
- Agenda ficou restrita a necessidade/pendencia/workflow, nao historico?
- Eventos ficaram como fonte primaria de historico/KPI?
- `state_*` ficou restrito a estado atual?
- Protocolo ficou restrito a regra configurada?
- Sinais ficaram auxiliares e nao persistidos?
- Bloqueios criticos continuam bloqueados?
- `operational_report` continua proibido como answerable direto?
- `pnpm test src/lib/insights/__tests__`, `pnpm run lint` e `pnpm run build` foram executados ou o motivo foi registrado?
