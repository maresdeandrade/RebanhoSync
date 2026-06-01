```markdown
# Insights

Status: camada `infra.insights` read-only/core puro.

Atualizado em: 2026-06-01  
**Baseline Commit:** `32d7779`

`src/lib/insights/` compõe respostas operacionais a partir de dados já carregados em memória. A camada não é domínio primário, store local, adapter remoto, UI, job, migration ou fonte paralela de verdade. Cada saída deve declarar fonte primária ou bloqueio explícito.

---

## Objetivo

- Organizar necessidades futuras, pendências atuais, estado corrente, KPIs históricos, exceções e sinais auxiliares.
- Separar pergunta operacional, fonte primária, limitações e resultado.
- Impedir que agenda, protocolo, estado atual, checklist, tag ou sinal sejam usados fora do seu papel conceitual.
- Manter o core puro: sem IO, sem storage, sem relógio global e sem side effects.
- Apoiar composição operacional read-only sem criar fato, tarefa, regra crítica ou autorização operacional.

---

## Não objetivos

- Não consultar Supabase, Dexie, `fetch`, filesystem, browser APIs ou UI.
- Não gerar, concluir, cancelar, deletar, reconciliar ou recalcular agenda.
- Não criar, alterar, corrigir, cancelar ou inferir evento factual.
- Não recalcular protocolo sanitário ou motor de protocolo.
- Não decidir pronto para venda, apto para abate, peso atual confiável ou IATF pendente amplo.
- Não persistir tags, marcadores ou sinais.
- Não compor `operational_report` diretamente `answerable`.
- Não transformar checklist regulatório contextual em pendência acionável.
- Não transformar ausência de runtime em não conformidade.
- Não transformar ausência de suspeita clínica em tarefa.

---

## Contrato de fontes de verdade

| Pergunta | Fonte primária correta | Fonte proibida como verdade |
|---|---|---|
| O que precisa ser feito? | `state_agenda_itens` / agenda materializada aberta | eventos, protocolo isolado, checklist contextual, sinal/tag |
| O que está pendente agora? | agenda aberta, agenda corretiva específica or read model de pendência atual | evento histórico isolado, protocolo isolado, checklist contextual, sinal/tag |
| O que já aconteceu? | `eventos` + detail tables / `eventos_*` | agenda, protocolo, `state_*` atual, checklist, sinal/tag |
| Qual é o estado atual? | `state_*` ou read model atual validado | agenda, evento como fonte primária isolada, sinal/tag |
| Qual regra está configurada? | protocolos/configurações | agenda, evento, sinal/tag |
| Qual KPI mensal histórico? | eventos históricos no período | agenda, `state_animais`, protocolo, sinal/tag |
| Qual carência sanitária existe? | `eventos_sanitario` estruturado | agenda, protocolo, catálogo oficial, checklist, sinal/tag |
| Qual ocorrência de biossegurança existe? | `eventos.payload.biosseguranca_ocorrencia` | checklist, overlay contextual, ausência de runtime, sinal/tag |
| Qual suspeita notificável existe? | evento de ocorrência/alerta ou `sanitario_casos` carregado | catálogo de doenças, ausência de suspeita, checklist, sinal/tag |
| Qual exceção sanitária existe? | eventos, `eventos_sanitario`, `insumo_movimentacoes`, agenda específica vinculada | protocolo isolado, agenda geral, checklist contextual, sinal/tag |
| Qual sinal visual aplicar? | insight answerable com fonte primária | sinal/tag como fonte primária |

Agenda nunca comprova execução.  
Protocolo nunca comprova execução.  
Checklist contextual nunca comprova conformidade.  
`state_*` representa estado corrente, não histórico.  
Eventos + detail tables são a fonte primária para histórico e KPI factual.

---

## Mapa pergunta -> módulo -> fonte primária

| Pergunta | Módulo | `questionKind` | Fonte primária |
|---|---|---|---|
| Necessidades futuras por agenda | `agendaNeeds.ts` | `future_need` | `state_agenda_itens` |
| Pendências atuais por agenda | `agendaNeeds.ts` | `current_pending` | `state_agenda_itens` |
| Necessidade futura de insumos sanitários | `sanitarySupplyNeeds.ts` | `future_need` / `current_pending` | `state_agenda_itens` |
| Atividades históricas agregadas | `historicalActivitySummary.ts` | `historical_kpi` | `eventos` ou `eventos_*` |
| KPIs operacionais mensais históricos | `monthlyOperationalKpis.ts` | `historical_kpi` | `eventos` |
| Rebanho por estágio/lote/status | `herdStageSummary.ts` | `current_state` | `state_animais` |
| Carência sanitária | módulo específico de carência, quando existir | `current_state` / `current_pending` | `eventos_sanitario` estruturado |
| Ocorrências de biossegurança | `biosecurityReadModel.ts` ou equivalente | `current_pending` / `historical_kpi` | `eventos.payload.biosseguranca_ocorrencia` |
| Suspeitas notificáveis | read model sanitário específico | `current_pending` | evento de ocorrência/alerta ou `sanitario_casos` carregado |
| Exceções sanitárias | read model de exceções, quando existir | `current_pending` / `operational_report` composto | eventos, `eventos_sanitario`, `insumo_movimentacoes` |
| Sinais auxiliares derivados | `tagSignals.ts` | herda do insight de origem | fonte primária do insight de origem |
| Contratos e validações | `sourceContract.ts` / `types.ts` | todos | conforme tipo de pergunta |

---

## Camadas conceituais

- **Agenda:** intenção futura ou tarefa operacional mutável. Pode responder necessidade e pendência, mas não histórico factual.
- **Evento:** fato histórico. Deve ser a base de KPI histórico, atividade executada, rastreabilidade, ocorrência e correção.
- **Estado atual:** `state_*` ou read model corrente. Responde situação atual, não período histórico.
- **Protocolo:** regra ou configuração. Não comprova execução realizada.
- **Compliance/checklist:** contexto regulatório ou documental. Não é pendência por padrão.
- **Ocorrência:** fato contextual registrado em evento. Pode gerar pendência específica.
- **Sinal/tag:** auxiliar visual, filtro ou agrupamento derivado. Não é fonte primária e não é persistido nesta camada.

---

## Padrão `answerability`

Todo insight deve ser:

- `answerable`: possui `primarySource` não vazio, contrato validado e pode retornar `complete`, `empty` ou `partial`.
- `blocked`: não possui fonte primária suficiente ou a pergunta exige inferência proibida.

Estados:

- `complete`: resposta calculada com fonte suficiente.
- `empty`: fonte carregada e válida, mas com zero itens.
- `partial`: fonte carregada com limitação declarada.
- `blocked`: fonte ausente, inadequada ou proibida para a pergunta.

---

## Agenda

Agenda pode responder:

- necessidades futuras;
- pendências abertas;
- pendências corretivas específicas;
- tarefas vencidas;
- tarefas de hoje;
- tarefas em janela futura.

Agenda não pode responder:

- execução histórica;
- aplicação realizada;
- produto aplicado;
- carência real;
- diagnóstico;
- conformidade final;
- aptidão comercial.

> Regra: agenda é intenção. Não é fato.

---

## Evento

Evento pode responder:

- histórico;
- KPI factual;
- atividade executada;
- produto aplicado;
- custo histórico;
- ocorrência registrada;
- correção vinculada;
- resolução/cancelamento de ocorrência;
- estorno/contra-lançamento, quando modelado como fato.

Evento não deve ser inferido por:

- agenda concluída sem evento;
- protocolo ativo;
- checklist preenchido;
- tag;
- sinal.

> Regra: evento é fato append-only.

---

## Protocolo

Protocolo pode responder:

- regra configurada;
- calendário configurado;
- versão de item sanitário;
- etapa planejável;
- fonte de materialização futura.

Protocolo não pode responder:

- execução;
- produto efetivamente aplicado;
- carência real;
- custo real;
- baixa de estoque;
- ocorrência clínica;
- conformidade final.

> Regra: protocolo é regra, não execução.

---

## Compliance regulatório

Compliance sanitário é camada separada.

Pode envolver:

- catálogo oficial;
- overlay por fazenda/UF;
- feed-ban;
- doença notificável;
- suspeita clínica;
- checklist documental;
- biossegurança;
- alertas regulatórios.

### Compliance pode

- alertar;
- orientar validação;
- expor checklist contextual;
- exigir revisão quando houver runtime acionável;
- bloquear se houver regra técnica explícita;
- gerar pendência específica se houver ocorrência ou runtime acionável.

### Compliance não pode

- criar evento sem ocorrência real;
- comprovar execução;
- inferir carência;
- liberar venda/abate;
- substituir protocolo operacional;
- transformar ausência de runtime em não conformidade;
- transformar checklist disponível em pendência geral.

> Regra: compliance contextual não é pendência operacional.

---

## Checklists

Checklist pode ser:

- contextual;
- documental;
- vinculado a transporte/movimentação;
- vinculado a uso de produto;
- vinculado a ocorrência;
- vinculado a pendência corretiva específica.

Checklist não pode ser:

- pendência geral por padrão;
- fonte primária de execução;
- prova universal de conformidade;
- fonte de carência;
- autorização comercial.

---

## Biossegurança

Biossegurança deve ser tratada como ocorrência contextual.

Rotina normal:

```txt
sem_ocorrencia_informada

```

Esse estado significa apenas que nenhuma ocorrência foi informada. Não significa “conforme”.

Ocorrência real deve vir de evento append-only com: `payload.biosseguranca_ocorrencia`.

Campos esperados:

* `schema_version`;
* `categoria_ocorrencia`;
* `tipo_ocorrencia`;
* `tipos_ocorrencia`;
* `escopo_tipo`;
* `escopos_tipo`;
* `animal_id`;
* `animal_ids`;
* `lote_id`;
* `local_id`;
* `evento_id`;
* `agenda_item_id`;
* `gravidade`;
* `descricao`;
* `outro_relato`;
* `acao_imediata`;
* `gera_pendencia`;
* `prazo_correcao`;
* `status`.

### Sinais permitidos

* `biosseguranca:ocorrencia_aberta`;
* `biosseguranca:ocorrencia_com_pendencia`;
* `biosseguranca:alta_gravidade`;
* `biosseguranca:pendencia_corretiva_vencida`.

### Fontes proibidas

* checklist contextual;
* overlay sem ocorrência;
* ausência de runtime;
* protocolo;
* tag/sinal.

---

## Doenças notificáveis e suspeita clínica

Doença notificável deve ser ocorrência/caso vinculado.

Fonte permitida:

* evento de ocorrência;
* evento `alerta_sanitario`;
* `sanitario_casos`, quando carregado;
* agenda específica vinculada ao evento, apenas para notificação pendente.

Regras:

* sem suspeita concreta = não há pendência;
* suspeita sem vínculo clínico deve ser bloqueada;
* vínculo aceito: `animal_id`, `animal_ids` ou `lote_id`;
* com animal, pode haver `alerta_sanitario` + `sanitario_casos`;
* com lote sem animal, fica em evento/payload até existir caso coletivo por lote;
* notificação pendente só nasce de ocorrência real com `gera_pendencia=true`.

### Sinais permitidos

* `sanitario:suspeita_notificavel`;
* `sanitario:notificacao_pendente`.

### Proibido

* criar tarefa para confirmar ausência de doença;
* tratar catálogo de doenças como caso real;
* tratar checklist de notificação como pendência geral;
* inferir diagnóstico final.

---

## Produtos e insumos sanitários

Necessidade futura de insumos sanitários pode usar agenda aberta, desde que a limitação seja declarada.

Fonte permitida:

* agenda sanitária aberta;
* produto explícito carregado;
* quantidade explícita carregada.

Limitações obrigatórias:

* se não houver produto, marcar parcial ou bloqueado;
* se não houver quantidade, declarar limitação;
* não inferir consumo real por agenda;
* não inferir estoque consumido sem evento/movimentação.

---

## Custo/snapshot sanitário

Quando houver custo vinculado ao consumo sanitário, o evento deve preservar snapshot econômico suficiente.

Fonte primária:

* `eventos_sanitario`;
* `insumo_movimentacoes`;
* snapshot econômico explícito.

Não depender apenas do estado atual do estoque para recompor custo histórico.

> Regra: custo histórico precisa ser auditável no momento da execução ou por fonte econômica explícita.

---

## Carência

Carência pode ser respondida quando houver fonte estruturada suficiente em evento sanitário.

Fonte necessária:

* produto aplicado;
* espécie/categoria, quando aplicável;
* dose;
* via;
* data de aplicação;
* regra técnica de carência;
* carência calculada ou registrada;
* validade/exceções quando aplicável.

### Sinais permitidos

* `sanitario:carencia_ativa`;
* `sanitario:livre_carencia`.

### Proibido

* inferir carência por agenda;
* inferir carência por protocolo;
* inferir carência por catálogo oficial;
* inferir carência por checklist;
* usar carência como liberação comercial;
* afirmar pronto para venda;
* afirmar apto para abate.

> Regra: livre de carência é evidência sanitária, não autorização comercial.

---

## Venda/abate

Sanitário sozinho não deve liberar venda/abate.

Venda/abate exige composição explícita com:

* status animal;
* peso confiável, se necessário;
* carência;
* sanidade;
* regra comercial;
* documentação;
* fonte técnica.

Proibido emitir:

* `comercial:pronto_venda`;
* `comercial:apto_abate`.

---

## Exceções e reconciliação sanitária

A camada de insights pode apontar exceções, mas não reconciliar.

Exceções possíveis:

* evento sanitário sem produto;
* evento sanitário sem lote de estoque;
* evento sanitário sem custo;
* evento sanitário sem dose;
* evento sanitário sem via;
* estoque vencido na data do evento;
* movimentação ausente;
* movimentação duplicada;
* custo inconsistente;
* carência incompleta;
* ocorrência de biossegurança aberta;
* ocorrência com pendência aberta;
* suspeita notificável aberta;
* pendência corretiva vencida.

### Sinais permitidos

* `sanitario:excecao_aberta`;
* `sanitario:rastreabilidade_incompleta`;
* `sanitario:estoque_inconsistente`;
* `sanitario:custo_inconsistente`.

### Fontes permitidas

* `eventos`;
* `eventos_sanitario`;
* `insumo_movimentacoes`;
* `eventos.payload.biosseguranca_ocorrencia`;
* agenda específica vinculada por `source_evento_id`.

### Proibido

* corrigir evento;
* criar evento de correção;
* estornar estoque;
* concluir agenda;
* cancelar ocorrência;
* reconciliar saldo;
* persistir status.

> Regra: insights apontam exceções; domínio/eventos resolvem exceções.

---

## Edge cases

Verificar:

* agenda sanitária vencida;
* agenda concluída sem evento;
* evento sem produto;
* evento sem dose;
* evento sem via;
* produto sem lote de estoque;
* custo ausente;
* retry duplicando baixa;
* animal vendido/morto com pendência sanitária;
* lote misto;
* protocolo alterado após evento;
* compliance regulatório sem aplicabilidade;
* overlay sem runtime;
* checklist contextual sem ocorrência;
* suspeita clínica sem confirmação;
* suspeita notificável sem vínculo clínico;
* biossegurança sem ocorrência informada;
* ocorrência com pendência vencida;
* correção histórica tentando editar evento original;
* estoque negativo sem regra explícita.

---

## Validação

Mudanças em insights devem validar conforme risco:

* testes de contrato de fonte;
* testes de `answerability`;
* testes de bloqueio;
* testes de sinais;
* testes de integração com adapter passivo, se aplicável;
* lint;
* build.

Comandos mínimos:

```bash
pnpm test src/lib/insights/__tests__
pnpm run lint
pnpm run build

```

Se a mudança tocar sanitário, eventos, relatórios ou adapter operacional:

```bash
powershell -File scripts/codex/validate.ps1 -TouchedPaths "src/lib/insights","src/features/operationalInsights","src/lib/sanitario","src/lib/events","src/lib/reports"
graphify update .
git diff --check

```

---

## Referências

* `docs/domain/SANITARIO.md`
* `docs/technical/TESTING_GATES.md`
* `src/lib/insights/AGENTS.md`
* `.agents/skills/sanitario-registro-operacional/SKILL.md`
* `.agents/skills/sanitario-catalogo-regulatorio-compliance/SKILL.md`

---

## Critério de aceite

Uma mudança em insights é aceitável quando:

* separa protocolo, agenda, evento, estado atual, compliance e ocorrência;
* não trata agenda como histórico;
* não trata protocolo como execução;
* não trata checklist contextual como pendência;
* não usa ausência de runtime como não conformidade;
* não cria fato, tarefa, correção ou persistência;
* usa evento estruturado para carência, quando responder carência;
* não libera venda/abate;
* preserva fonte primária declarada;
* declara limitações;
* mantém core puro;
* respeita offline-first e RLS por não fazer IO;
* testes/lint/build passam ou limitação é registrada.

**Decisão:** mantenha `docs/domain/SANITARIO.md` como contrato canônico único; este README de insights apenas referencia e aplica o contrato ao escopo `infra.insights`.

```

```