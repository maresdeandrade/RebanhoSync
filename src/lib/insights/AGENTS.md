```md
# AGENTS - src/lib/insights

Capability: `infra.insights.*`

## Natureza

- Camada read-only de composição operacional.
- Core puro: recebe dados já carregados e não faz IO.
- Sem fonte primária própria.
- Sem persistência própria.
- Sem adapters/loaders/stores.
- Sem autoridade operacional final.

## Módulos atuais

- `types.ts`: contratos e unions de insight.
- `sourceContract.ts`: helpers e validações de fonte por `questionKind`.
- `agendaNeeds.ts`: necessidades/pendências por agenda aberta.
- `sanitarySupplyNeeds.ts`: insumos sanitários futuros por agenda sanitária aberta.
- `historicalActivitySummary.ts`: resumo histórico por eventos.
- `monthlyOperationalKpis.ts`: KPIs mensais históricos por eventos.
- `herdStageSummary.ts`: estado atual do rebanho por `state_animais`.
- `tagSignals.ts`: sinais auxiliares derivados de insights answerable.
- `sanitaryWithdrawalSignals.ts`: sinais sanitários de carência a partir de eventos estruturados.
- `biosecurityReadModel.ts` ou equivalente: leitura de ocorrências reais de biossegurança, quando existir.
- Relatórios/read models externos podem consumir sinais, mas sinais não viram fonte primária.

## Permitido

- Tipos e helpers puros.
- Cálculos deterministas sobre dados recebidos por parâmetro.
- Validações que impedem insight sem fonte primária ou sem bloqueio explícito.
- Sinais derivados sem persistência.
- Documentar guardrails locais desta pasta.
- Emitir sinais sanitários somente quando houver fonte primária adequada.

## Proibido

- Consultar Supabase, Dexie, `fetch`, `window`, `localStorage`, filesystem ou relógio global.
- Gerar, concluir, cancelar, deletar ou recalcular agenda.
- Gerar, editar ou inferir evento factual.
- Recalcular protocolo sanitário ou motor de protocolo.
- Usar protocolo como execução.
- Usar agenda como evento histórico.
- Usar checklist regulatório contextual como ocorrência.
- Usar overlay contextual como pendência.
- Usar ausência de runtime como não conformidade.
- Usar `state_*` atual como histórico sem limitação `partial`.
- Persistir tag, marcador ou sinal.
- Usar marcador/tag/sinal como fonte primária.
- Decidir venda, abate, peso atual confiável ou IATF amplo.
- Criar `operational_report` diretamente `answerable`.

## Carência

Carência pode gerar sinal somente com fonte primária em evento sanitário estruturado.

Permitido:

- `sanitario:carencia_ativa`;
- `sanitario:livre_carencia`.

Proibido:

- inferir carência por agenda;
- inferir carência por protocolo;
- inferir carência por catálogo oficial isolado;
- transformar livre de carência em pronto para venda;
- transformar livre de carência em apto para abate.

## Biossegurança e doenças notificáveis

Biossegurança e notificáveis podem gerar sinais somente a partir de ocorrência real registrada em evento.

Fontes permitidas:

- `eventos.payload.biosseguranca_ocorrencia`;
- evento de `alerta_sanitario`;
- `sanitario_casos`, quando carregado e explicitamente informado;
- agenda específica vinculada por `source_evento_id`, apenas para pendência corretiva.

Fontes proibidas como primárias:

- protocolo;
- checklist regulatório;
- overlay contextual sem ocorrência;
- ausência de runtime;
- tags/marcadores.

Sinais permitidos:

- `biosseguranca:ocorrencia_aberta`;
- `biosseguranca:ocorrencia_com_pendencia`;
- `biosseguranca:alta_gravidade`;
- `biosseguranca:pendencia_corretiva_vencida`;
- `sanitario:suspeita_notificavel`;
- `sanitario:notificacao_pendente`.

## Exceções e reconciliação sanitária

A camada pode apontar exceções, desde que receba fontes primárias carregadas.

Sinais permitidos:

- `sanitario:excecao_aberta`;
- `sanitario:rastreabilidade_incompleta`;
- `sanitario:estoque_inconsistente`;
- `sanitario:custo_inconsistente`.

Fontes possíveis:

- `eventos`;
- `eventos_sanitario`;
- `insumo_movimentacoes`;
- agenda específica vinculada por `source_evento_id`;
- payload factual de ocorrência.

A camada não pode corrigir, reconciliar ou criar fato. Só sinaliza.

## Fontes por pergunta

- `future_need`: agenda materializada aberta, normalmente `state_agenda_itens`.
- `current_pending`: agenda aberta, pendência corretiva específica ou read model de pendência atual.
- `current_state`: `state_*` ou read model atual validado.
- `historical_kpi`: `eventos`, `eventos_*` ou read model histórico derivado de eventos.
- `workflow_kpi`: apenas módulo específico de workflow, quando existir; não confundir com execução factual.
- `configured_rule`: protocolos/configurações, nunca execução.
- `operational_report`: composição futura por seções; não answerable direto.

## Regra local

Todo insight operacional deve ser:

1. `answerable`, com `primarySource` não vazio; ou
2. `blocked`, com motivo de bloqueio explícito.

`complete` significa resposta calculada.  
`empty` significa resposta válida com zero itens.  
`partial` exige limitação declarada.  
`blocked` significa que a pergunta não pode ser respondida com segurança pelas fontes atuais.

## Checklist antes de editar

- Confirmar escopo permitido e proibido da tarefa.
- Rodar preflight quando criar ou alterar arquivo da pasta.
- Manter a mudança em um único capability `infra.insights.*`.
- Não tocar Agenda, Registrar, Supabase, Dexie, UI, migrations, seed, Sanitário ou Reprodução sem pedido explícito.
- Preferir funções puras pequenas e testes de contrato.
- Verificar se a fonte primária é evento, agenda, estado atual ou protocolo.
- Confirmar que sinais não viraram regra crítica.

## Checklist de revisão

- A fonte primária bate com o `questionKind`?
- Agenda ficou restrita a necessidade/pendência/workflow, não histórico?
- Eventos ficaram como fonte primária de histórico/KPI/carência/ocorrência?
- `state_*` ficou restrito a estado atual?
- Protocolo ficou restrito a regra configurada?
- Checklist contextual ficou fora de pendência?
- Ocorrência real ficou baseada em evento?
- Sinais ficaram auxiliares e não persistidos?
- Bloqueios críticos continuam bloqueados?
- `operational_report` continua proibido como answerable direto?
- `pnpm test src/lib/insights/__tests__`, `pnpm run lint` e `pnpm run build` foram executados ou o motivo foi registrado?