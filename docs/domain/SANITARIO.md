```markdown
# Sanitário — RebanhoSync

Atualizado em: 2026-06-06
**Baseline Commit:** `32d7779`

## Objetivo

Definir o contrato canônico do domínio sanitário do RebanhoSync.

Este documento separa protocolo sanitário, agenda sanitária, evento sanitário, produto, estoque, compliance, suspeita clínica, biossegurança, carência, sinais sanitários e correções históricas.

Este é o documento normativo principal do domínio sanitário. Não criar `SANITARIO_CONTRACT.md` separado enquanto este arquivo continuar claro e objetivo.

---

## Escopo

Este documento cobre:

- protocolo sanitário;
- agenda sanitária;
- evento sanitário;
- vacinação;
- vermifugação;
- tratamento;
- exame;
- produto veterinário;
- dose;
- lote de estoque;
- baixa de estoque;
- custo/snapshot sanitário;
- compliance regulatório;
- checklist documental/contextual;
- suspeita clínica;
- doença notificável;
- biossegurança;
- carência;
- ocorrências sanitárias;
- pendências corretivas;
- exceções e reconciliação sanitária;
- sinais sanitários e relatórios operacionais.

Fora do escopo deste documento:

- venda;
- abate;
- sociedade pecuária;
- motor comercial;
- autorização final de comercialização;
- peso atual confiável;
- resultado econômico global.

---

## Contrato central

| Conceito | Fonte primária |
|---|---|
| Regra sanitária | Protocolo/configuração |
| Fonte técnica da regra | Referência bibliográfica, norma oficial, bula ou MV responsável |
| Produto, dose, via e carência planejada | Produto sanitário/fonte técnica explícita |
| Tarefa sanitária futura | Agenda |
| Elegibilidade por janela | Cálculo derivado de animal + regra + eventos |
| Demanda agrupada | Leitura derivada de elegibilidade/lote/janela |
| Preview operacional | Simulação derivada antes de materializar agenda |
| Aplicação executada | Evento sanitário |
| Produto aplicado | `eventos_sanitario` estruturado |
| Estoque consumido | `insumo_movimentacoes` vinculada ao evento |
| Custo sanitário | Snapshot no evento/movimento |
| Carência | Colunas estruturadas de `eventos_sanitario` |
| Compliance regulatório | Catálogo/overlay/read model contextual |
| Checklist documental | Contexto ou fluxo específico, não pendência geral |
| Biossegurança | Ocorrência contextual registrada em evento |
| Doença notificável | Suspeita/caso vinculado a animal/lote/evento |
| Pendência corretiva | Agenda específica vinculada a evento/ocorrência |
| Fechamento administrativo | Estado da intenção de agenda, não histórico |
| Correção histórica | Novo evento vinculado, não edição destrutiva |
| Sinal/insight | Leitura auxiliar, nunca fonte primária |

---

## Regras invioláveis

- Agenda é intenção/tarefa futura, não histórico.
- Evento é fato executado, append-only.
- Protocolo é regra/configuração, não execução.
- Checklist regulatório disponível não é pendência.
- Ausência de runtime de compliance não é não conformidade.
- Ausência de suspeita clínica não gera tarefa.
- Tags, sinais e insights são auxiliares, nunca fonte primária.
- Carência só pode ser calculada a partir de evento sanitário estruturado.
- Produto executado e fonte técnica explícita são necessários para carência confiável.
- Demanda, preview e agenda não calculam carência ativa.
- Livre de carência não significa apto para venda ou abate.
- Fechamento administrativo da agenda não cria evento nem histórico sanitário.
- Correção sanitária deve gerar novo fato vinculado, não editar destrutivamente o passado.
- Doença notificável exige vínculo clínico com animal, animais, lote ou evento.

---

## Protocolos sanitários

Protocolos sanitários são regras operacionais versionadas.

Um protocolo pode nascer de:

1. base regulatória oficial;
2. overlay operacional do pack;
3. protocolo customizado da fazenda.

Essas camadas não devem competir como se fossem a mesma coisa.

### Contrato de versionamento

- `logical_item_key` identifica a etapa lógica.
- `protocolos_sanitarios_itens.id` identifica a versão física imutável da etapa.
- `version` identifica a versão legível da etapa.
- Apenas uma versão ativa deve existir por etapa lógica.
- Mudança semântica cria nova versão física.
- Mudança simples pode atualizar a versão ativa.

Mudanças semânticas incluem:

- produto;
- dose;
- unidade;
- intervalo;
- `gera_agenda`;
- calendário/agendamento;
- dependência;
- `item_code`;
- dedup;
- regime/milestone;
- carência;
- tipo da etapa.

Eventos e agendas antigas continuam vinculados à versão física usada na época.

### Regra, produto e fonte técnica

A Agenda Sanitária v2 exige separar regra sanitária de produto sanitário.

Regras:

- campo crítico de regra sanitária exige fonte técnica explícita;
- guideline não é fonte única suficiente para decisão crítica;
- produto sanitário é fonte primária de dose, via, apresentação e carência quando houver produto vinculado;
- protocolo pode complementar carência apenas com fonte explícita;
- carência futura deve depender do produto executado no evento, não do produto apenas planejado.

---

## Agenda Sanitária v2

A Fase 11.5 consolidou contratos puros para redesenhar a agenda sanitária. A Fase 12C criou a fundação SQL/RLS da persistência v2 em tabelas dedicadas, ainda sem Dexie, sync-batch, RPC/Edge Function, seed funcional ou UI conectados.

Pipeline conceitual:

```txt
Regra/produto/fonte técnica
→ janela sanitária
→ elegibilidade individual
→ demanda agrupada
→ preview operacional
→ agenda_intent
→ event_execution_intent
→ agenda_closure_intent
```

### Janela sanitária e elegibilidade

Janela sanitária é o período operacional recomendado/limite para ação.

Elegibilidade:

- é core puro;
- deriva de animal, regra/protocolo, eventos sanitários executados e data de referência;
- retorna limitações explícitas quando faltam dados;
- `completed` depende de evento sanitário compatível, executado e não futuro;
- agenda concluída não satisfaz histórico sanitário.

### Demanda agrupada e preview

Demanda agrupada:

- é derivada de elegibilidade;
- agrupa por protocolo, item/produto/classe, ação, lote, janela e status derivado;
- não cria agenda;
- não cria evento;
- não usa `productName` ou `loteName` como identidade.

Preview operacional:

- é simulação derivada antes da materialização;
- preserva bloqueios `insufficient_data`;
- expõe grupos acionáveis;
- não persiste;
- não cria evento, estoque ou carência.

### Agenda intent

`agenda_intent` representa comando/intenção de agenda sanitária em core puro.

Regras:

- usa `dedupKey` estável;
- preserva `previewGroupId` e `sourceDemandKey`;
- rejeita datas inválidas, ausentes ou fora da janela;
- não persiste agenda real;
- não cria evento;
- não baixa estoque;
- não calcula carência.

Persistência remota introduzida na 12C:

- `sanitario_agenda_v2`: intenção futura persistida;
- `sanitario_agenda_animais_v2`: escopo planejado por animal;
- `sanitario_agenda_closures_v2`: fechamento administrativo.

`agenda_itens` sanitário legado não é a superfície sanitária alvo da v2.

### Event execution intent

`event_execution_intent` representa intenção de execução sanitária como evento futuro.

Regras:

- declara `createsEvent: true`;
- declara `persistsEvent: false`;
- não fecha agenda;
- não baixa estoque;
- não calcula carência;
- execução parcial exige motivo para animais planejados não executados;
- produto executado não é inferido automaticamente do produto planejado.

### Agenda closure intent

`agenda_closure_intent` representa fechamento administrativo da intenção.

Tipos do contrato TypeScript:

- `executed_with_event`;
- `partially_executed_with_event`;
- `closed_without_execution`;
- `cancelled`;
- `dismissed`.

Regras:

- fechamento executado/parcial exige evento compatível;
- fechamento sem execução, cancelamento e dispensa exigem motivo;
- fechamento parcial preserva animais planejados não executados;
- fechamento não cria evento;
- fechamento não cria histórico sanitário;
- fechamento não baixa estoque;
- fechamento não calcula carência.

### Limitações atuais

Ainda não implementado após a 12C:

- Dexie/local-first da Agenda v2;
- sync-batch/replay/rollback/sucesso parcial da Agenda v2;
- RPC/Edge Function operacional para Agenda v2;
- UI operacional da Agenda v2.

---

## Agenda sanitária

Agenda sanitária representa intenção ou pendência futura.

Pode nascer de:

- protocolo operacional com `gera_agenda=true`;
- recompute/scheduler sanitário;
- pendência corretiva específica gerada por ocorrência real.

Agenda não deve nascer de:

- checklist regulatório apenas disponível;
- ausência de runtime;
- ausência de suspeita clínica;
- necessidade de “confirmar que não há doença”;
- protocolo isolado sem regra de agendamento;
- sinal ou insight.

### Agenda corretiva

Uma pendência corretiva sanitária só deve ser criada quando houver:

- ocorrência real registrada;
- `gera_pendencia=true`;
- `prazo_correcao` informado;
- evento de origem criado no mesmo gesto ou fluxo transacional.

A agenda corretiva deve preservar:

- `source_evento_id`;
- `animal_id`, quando houver;
- `lote_id`, when houver;
- vínculos adicionais no payload, como `animal_ids`, `local_id`, `evento_id`, `agenda_item_id`.

---

## Evento sanitário

Evento sanitário é fato histórico executado.

Deve preservar, quando aplicável:

- `protocol_item_version_id`;
- `protocol_item_logical_key`;
- `protocol_item_version`;
- `protocol_item_snapshot`;
- produto aplicado;
- lote de estoque;
- dose;
- unidade;
- via;
- responsável;
- carência;
- custo;
- baixa de estoque vinculada.

O evento sanitário não deve depender da versão ativa atual do protocolo para explicar o passado.

---

## Rastreabilidade sanitária

`eventos_sanitario` deve ser a fonte factual para rastreabilidade de execução.

Campos estruturados esperados:

- `produto_veterinario_id`;
- `produto_nome_snapshot`;
- `estoque_lote_id`;
- `estoque_lote_codigo_snapshot`;
- `lote_fabricante`;
- `validade_produto`;
- `dose_quantidade`;
- `dose_unidade`;
- `via_aplicacao`;
- `responsavel_nome`;
- `responsavel_tipo`;
- `carencia_carne_dias`;
- `carencia_leite_dias`;
- `carencia_carne_ate`;
- `carencia_leite_ate`;
- `custo_unitario_snapshot`;
- `custo_total_snapshot`.

Payload pode existir como snapshot auxiliar, mas não deve ser a única fonte para campos críticos usados em filtro, relatório, carência, custo ou auditoria.

---

## Estoque sanitário

Quando houver `estoque_lote_id`, o evento sanitário deve gerar baixa idempotente de estoque.

No registro operacional em lote, o formulário pode sugerir `1` dose por cabeça e a via base do produto/tipo sanitário. A quantidade consumida deve ser calculada por `dose × quantidade de animais manejados` e gravada junto do evento para rastreabilidade e baixa de estoque.

Regras:

- baixa vinculada ao evento;
- sem duplicidade em retry/sync;
- saldo negativo não deve ser aceito silenciosamente;
- lote, validade e custo devem ser copiados como snapshot quando disponíveis;
- estorno/contra-lançamento deve ser novo fato vinculado, não apagamento silencioso.

---

## Carência

Carência é derivada de evento sanitário estruturado com produto executado e fonte técnica explícita.

Permitido:

- `sanitario:carencia_ativa`;
- `sanitario:livre_carencia`.

Proibido:

- calcular carência por agenda;
- calcular carência por demanda agrupada;
- calcular carência por preview operacional;
- calcular carência por fechamento administrativo;
- calcular carência por protocolo isolado;
- calcular carência por catálogo oficial isolado;
- usar ausência de carência como autorização comercial;
- emitir `comercial:pronto_venda` ou `comercial:apto_abate` nesta camada.

Livre de carência é apenas uma evidência sanitária. Não é decisão comercial final.

---

## Compliance regulatório

Compliance regulatório é camada contextual.

Itens do catálogo oficial/regulatório podem ficar disponíveis como orientação, checklist ou exigência documental, mas não viram pendência automaticamente.

### Estados conceituais

- `contextual`: contexto regulatório disponível.
- `actionable`: pendência/ação real acionável.
- `resolvido`: ação já tratada.
- `bloqueado_por_regra`: bloqueio técnico explícito.

Regras:

- sem `overlay_runtime` = contexto, não pendência;
- runtime conforme = contexto/resolvido;
- runtime pendente ou ajuste necessário = acionável;
- checklist disponível não bloqueia manejo por si só;
- ausência de preenchimento não significa não conformidade.

---

## Checklists

Checklist é apoio operacional/documental.

Checklist pode ser:

- contextual;
- acionado por evento;
- acionado por movimento/transporte;
- vinculado a ocorrência;
- vinculado a pendência corretiva real.

Checklist não deve ser:

- pendência geral da fazenda;
- tarefa para confirmar ausência de doença;
- prova de conformidade universal;
- fonte primária de evento sanitário;
- substituto de registro factual.

---

## Biossegurança

Biossegurança é ocorrência contextual, não checklist obrigatório geral.

Rotina normal:

```txt
biosseguranca_status = "sem_ocorrencia_informada"

```

Esse estado significa apenas ausência de ocorrência informada, não conformidade validada.

### Ocorrência de biossegurança

A ocorrência real é registrada em evento append-only com `payload.biosseguranca_ocorrencia`.

Contrato esperado:

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

Campos singulares permanecem por compatibilidade. Campos plurais representam o contrato novo.

### Estados

* `sem_ocorrencia_informada`
* `ocorrencia_registrada`
* `ocorrencia_com_pendencia`

Não usar conforme como default.

### Doenças notificáveis

Doença notificável não é pendência geral.

Deve existir como suspeita/caso vinculado a:

* animal;
* múltiplos animais;
* lote;
* evento;
* ocorrência clínica.

Regra:

* sem suspeita concreta = não gera pendência;
* suspeita com animal = pode abrir `alerta_sanitario` e `sanitario_casos`;
* suspeita com lote sem animal = fica registrada em evento/payload até existir modelagem própria de caso por lote;
* notificação pendente só nasce de ocorrência real com `gera_pendencia=true`.

Nunca criar pendência geral da fazenda para confirmar ausência de doença.

### Suspeita clínica e terapia não recorrente

Suspeita clínica, tratamento terapêutico e protocolo clínico não recorrente não devem ser tratados como protocolo operacional recorrente por padrão.

Regra:

* suspeita clínica = evento/caso;
* tratamento executado = evento;
* terapia não recorrente = apoio clínico ou registro pontual;
* protocolo clínico recorrente só deve existir se houver regra operacional explícita.

### Exceções e reconciliação sanitária

A Fase 5 deve tratar exceções e correções sem quebrar histórico.

Exceções esperadas:

* evento sanitário sem produto;
* evento sem lote de estoque;
* evento sem custo;
* evento sem dose;
* evento sem via;
* estoque vencido na data do evento;
* movimentação ausente;
* movimentação duplicada;
* custo inconsistente;
* carência incompleta;
* ocorrência de biossegurança aberta;
* ocorrência com pendência aberta;
* suspeita notificável aberta;
* pendência corretiva vencida.

Correções devem ser novos fatos vinculados:

* `complemento_rastreabilidade`;
* `correcao_custo`;
* `correcao_lote_estoque`;
* `estorno_baixa_estoque`;
* `contra_lancamento_estoque`;
* `resolucao_ocorrencia_biosseguranca`;
* `cancelamento_ocorrencia_biosseguranca`;
* `encerramento_pendencia_corretiva`.

Proibido corrigir evento histórico por update destrutivo.

### Sinais e insights sanitários

Sinais sanitários são auxiliares e recalculáveis.

Sinais permitidos quando houver fonte primária adequada:

* `sanitario:carencia_ativa`;
* `sanitario:livre_carencia`;
* `sanitario:excecao_aberta`;
* `sanitario:rastreabilidade_incompleta`;
* `sanitario:estoque_inconsistente`;
* `sanitario:custo_inconsistente`;
* `biosseguranca:ocorrencia_aberta`;
* `biosseguranca:ocorrencia_com_pendencia`;
* `biosseguranca:alta_gravidade`;
* `biosseguranca:pendencia_corretiva_vencida`;
* `sanitario:suspeita_notificavel`;
* `sanitario:notificacao_pendente`.

Sinais proibidos nesta camada:

* `comercial:pronto_venda`;
* `comercial:apto_abate`;
* `peso:atual_confiavel`;
* `protocolo:executado`;
* `agenda:concluida_como_fato`.

### Relatórios sanitários

Relatórios podem consolidar:

* gasto sanitário por período;
* gasto por animal;
* gasto por lote pecuário;
* gasto por lote de estoque;
* uso por produto;
* histórico por protocolo/item/version;
* animais em carência ativa;
* eventos sem rastreabilidade completa;
* produtos aplicados sem lote de estoque;
* eventos sem custo;
* inconsistências de estoque;
* ocorrências de biossegurança por tipo/gravidade/escopo/status;
* suspeitas notificáveis abertas;
* pendências corretivas abertas ou vencidas.

Relatórios não devem transformar sinal em fonte primária.

### Robustez e staging

A Fase 6 deve validar:

* multi-tenant;
* concorrência;
* sync;
* RLS;
* retry;
* recompute;
* baixa de estoque idempotente;
* agenda corretiva;
* ocorrência + pendência;
* protocolos versionados;
* eventos sanitários rastreáveis.

Essa fase deve validar uso real, não criar novo domínio.

### Roadmap sanitário consolidado

| Fase | Escopo | Status esperado |
| --- | --- | --- |
| Fase 1 | Protocolos, versionamento, legado `protocol_item_id` | Encerrada |
| Fase 2 | Rastreabilidade sanitária operacional | Encerrada |
| Fase 3 | Consolidação de histórico, relatórios e sinais | Encerrada |
| Fase 4 | Clínica, compliance, checklists, biossegurança, doenças notificáveis | Encerrada |
| Fase 5 | Exceções, correções e reconciliação sanitária | Concluída; hardening residual |
| Fase 6 | Robustez sanitária em staging/RLS/sync | Hardening residual |
| Fase 11.5 | Agenda Sanitária v2 em contratos puros | Fechada localmente; persistência/sync/schema pendentes |

### Antipadrões proibidos

* Usar agenda como histórico.
* Usar protocolo como execução.
* Usar checklist como conformidade universal.
* Usar ausência de pendência como prova sanitária.
* Criar pendência geral para ausência de doença.
* Criar carência por protocolo ou catálogo isolado.
* Editar destrutivamente evento histórico.
* Usar tag/sinal como fonte primária.
* Autorizar venda/abate por sinal sanitário isolado.

---

```

```
