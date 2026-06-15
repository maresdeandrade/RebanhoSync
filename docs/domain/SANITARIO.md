```markdown
# Sanitário — RebanhoSync

Atualizado em: 2026-06-15
**Baseline Commit:** `c2bac2b`

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
- Payload candidato de protocolo não é seed aplicada, dado ativo, agenda ou evento.
- ProductClassGroup não valida execução sozinho; execução exige produto real quando aplicável.
- Carência ativa nasce somente de evento executado com produto real e snapshot técnico.
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

## Snapshots técnicos sanitários v2

A partir da 12D2, snapshots técnicos são montados por builders puros e determinísticos antes de qualquer integração offline/sync.

Contrato:

- `AgendaTechnicalSnapshot` documenta intenção técnica planejada.
- `AgendaTechnicalSnapshot` pode carregar produto planejado e fontes por campo.
- `AgendaTechnicalSnapshot` não carrega carência ativa, produto executado, baixa de estoque ou autorização de venda/abate.
- `EventTechnicalSnapshot` documenta execução real.
- `EventTechnicalSnapshot` exige produto executado, dose executada, via executada e snapshot de carência do produto executado.
- Produto planejado na agenda não vira produto executado automaticamente.
- Guideline isolado não valida campo crítico.
- Fonte forte precisa cobrir o `field_key` específico.
- Bubalino não herda autorização de bovino.
- `NAO_AUTORIZADO` bloqueia agenda automática.
- `PRECISA_VALIDAR` preserva limitação explícita.
- `EXTRAPOLADO` exige MV responsável para execução futura.
- Carência zero exige fonte forte explícita.
- Carência `unknown` e `not_permitted` bloqueiam leitura de livre de carência ou uso declarado.

Implementação pura:

- `buildAgendaTechnicalSnapshotV2`;
- `buildEventTechnicalSnapshotV2`;
- `createSanitaryAgendaV2SnapshotPayload`.

Essas funções não persistem dados, não consultam Supabase/Dexie, não criam agenda, não criam evento e não calculam carência ativa.

---

## Protocolos sanitários

Protocolos sanitários são regras operacionais versionadas.

A partir da 12F3, os payloads candidatos dos Protocolos Sanitarios v2 foram validados contra o schema real e seguem bloqueados para import bruto. A 12F4 definiu adapter/normalizer candidato, ainda sem seed/import. A 12F5 validou esse adapter com script local somente leitura. A 12G criou importador controlado usando exclusivamente o payload canonico 12F10, com `--validate`, `--dry-run` e `--apply` protegido por `ALLOW_SANITARIO_IMPORT=1`. Qualquer import deve preservar:

- `agenda_allowed = false` enquanto houver sourceGap critico;
- `approved_for_catalog = false` ate aprovacao curatorial propria;
- B19 como regra nacional para femeas bovinas e bubalinas de 3 a 8 meses;
- febre aftosa como archived/blocked, sem rotina operacional;
- ProductClassGroup antiparasitario dependente de ProductClass real e produto executado;
- SourceRefs separados de sourceGaps e sourcePolicy.
- itens com ProductClassGroup nao devem ser convertidos para `product_class`, `specific_product` ou `none` sem decisao estrutural explicita.

A 12F6 tomou a decisao estrutural documental: a forma futura recomendada e suporte direto a `product_class_group` no item com `product_class_group_id` referenciando `sanitario_product_class_groups_v2(id)`. A 12F7 criou essa migration controlada no schema real, com enum, coluna, FK, CHECK e trigger de validacao de grupo ativo/escopo/status. A 12F8 revalidou o adapter e adaptou documentalmente os 6 itens antiparasitarios com `product_class_group_id` por lookup, elevando a contagem de itens adaptaveis para 19. A 12F9 gerou payload JSON completo candidato e a 12F10 consolidou a fonte final em `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`, com 10 protocolos, 19 itens, 4 ProductClassGroups e 16 rejeicoes de members, sempre com `execute_import=false`. A 12G implementou o importador controlado; nenhum import real foi aplicado nesta rodada e members seguem bloqueados sem `class_id` real.

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

### Modelo canônico de protocolo/produto/fonte

A Fase 12D0 definiu o contrato canônico mínimo que deve preceder offline/sync amplo da Agenda Sanitária v2.

Fonte técnica (`SourceRef`) deve declarar:

- tipo da fonte: norma oficial, bula, registro de produto, bibliografia, guideline de apoio ou MV responsável;
- emissor, versão, data/publicação/acesso e jurisdição quando aplicável;
- `field_keys` cobertos pela fonte;
- força da fonte: forte, apoio ou fraca;
- limitações;
- status por campo: `SIM_BULA`, `SIM_NORMA`, `PRECISA_VALIDAR`, `NAO_AUTORIZADO` ou `EXTRAPOLADO`.

Produto sanitário deve declarar identidade, registro, fabricante, classe, princípio ativo, espécie autorizada, categoria/aptidão, dose, via, apresentação, regras de carência, contraindicações, fontes e status curatorial.

Regra de carência pertence ao produto executado. Carência zero exige fonte explícita e não pode ser inferida por ausência de prazo.

Protocolo sanitário v2 deve ser versionado e composto por itens versionados imutáveis. Mudança semântica em produto, dose, via, janela, reforço, elegibilidade, fonte, espécie, carência ou status regulatório cria nova versão de item.

Bubalino não herda autorização de bovino por padrão:

- `SIM_BULA`: bula/registro cita bubalino;
- `SIM_NORMA`: norma oficial inclui bubalino ou bovídeos;
- `PRECISA_VALIDAR`: guideline/literatura sugere, mas falta fonte forte;
- `NAO_AUTORIZADO`: fonte forte não autoriza ou restringe;
- `EXTRAPOLADO`: uso fora da bula/norma, exige MV responsável e limitação explícita.

Itens experimentais, emergentes ou de alerta não entram em protocolo automático, agenda automática, evento sugerido ou cálculo de carência.

Guidelines técnicos podem apoiar curadoria e casos de teste, mas não substituem bula, norma oficial, registro sanitário ou decisão veterinária responsável para campo crítico.

Snapshots técnicos:

- agenda v2 deve congelar regra, item versionado, janela, produto planejado, fontes, limitações e status de autorização como intenção técnica planejada;
- evento sanitário deve congelar produto executado, dose/via executadas, fonte forte de carência e snapshot de carência;
- produto planejado em agenda não vira produto executado automaticamente.

### Contrato persistido v2

A Fase 12D1 criou o primeiro contrato persistido canônico em paralelo ao legado operacional.

Estruturas v2:

- `sanitario_fontes_tecnicas_v2`;
- `sanitario_fonte_cobertura_campos_v2`;
- `sanitario_produtos_v2`;
- `sanitario_produto_especie_autorizacao_v2`;
- `sanitario_produto_fontes_v2`;
- `sanitario_produto_dose_rules_v2`;
- `sanitario_produto_carencia_rules_v2`;
- `sanitario_produto_carencia_fontes_v2`;
- `sanitario_protocolos_v2`;
- `sanitario_protocolo_itens_versions_v2`.

Contratos TypeScript v2:

- `SanitarySourceRefV2`;
- `FieldSourceStatus`;
- `SanitaryProductV2`;
- `SpeciesAuthorizationV2`;
- `WithdrawalRuleV2`;
- `SanitaryProtocolV2`;
- `SanitaryProtocolItemVersionV2`;
- `AgendaTechnicalSnapshot`;
- `EventTechnicalSnapshot`.

Regras registradas:

- fonte forte precisa cobrir o `field_key` crítico;
- guideline de apoio não pode ser fonte forte isolada;
- dose, via, apresentação, autorização por espécie, carência e obrigatoriedade legal exigem fonte forte;
- carência `zero` exige fonte explícita;
- carência `unknown` bloqueia leitura de livre de carência;
- `not_permitted` bloqueia o uso declarado;
- `NAO_AUTORIZADO` bloqueia agenda automática futura;
- `PRECISA_VALIDAR` preserva limitação;
- `EXTRAPOLADO` exige MV responsável para execução futura;
- `somente_alerta` e `bloqueado` não podem gerar agenda automática;
- snapshot de agenda não carrega carência ativa;
- snapshot de evento exige produto executado real e snapshot de carência.

Legados `produtos_veterinarios`, `protocolos_sanitarios`, `protocolos_sanitarios_itens` e catálogos oficiais continuam operacionais por dependência ativa de UI/offline/sync, mas não são o contrato canônico v2.

---

## Agenda Sanitária v2

A Fase 11.5 consolidou contratos puros para redesenhar a agenda sanitária. A Fase 12C criou a fundação SQL/RLS da persistência v2 em tabelas dedicadas. A Fase 12E4 adicionou base Dexie/offline e sync controlado para Agenda v2. A Fase 12E5 adicionou hardening de cursor incremental, retry/replay de closures, sucesso parcial e bloqueios de superficie. A Fase 12F0 estruturou Protocolos Sanitarios v2 como catalogo curatorial candidato documental, sem seed e sem ativacao. A Fase 12F1 normalizou protocolos, itens, ProductClassGroups, rotationRule, sourceRefs por campo e sourceGaps em artefatos tecnicos candidatos para futura seed/importacao. A Fase 12F2 converteu esses artefatos em payloads candidatos de seed/import, sem executar importacao. Ainda nao ha UI conectada, seed funcional aplicada, protocolo ativo/importado, evento executado, estoque ou carência ativa.

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

Implementado localmente na 12E4:

- stores Dexie `ops_sanitario_agenda_v2`, `ops_sanitario_agenda_animais_v2` e `ops_sanitario_agenda_closures_v2`;
- pull remoto por `fazenda_id`, sem pull global, na ordem agenda -> animais -> closures;
- merge/upsert preservando `updated_at`, `deleted_at` quando existente, metadata e vínculos;
- push controlado somente para `sanitario_agenda_closures_v2`;
- push de closure na 12E4 bloqueia `executed_with_event`, `partially_executed_with_event` e qualquer `execution_evento_id` preenchido;
- conflito de closure ativa duplicada tratado como rejeição rastreável;
- sucesso parcial de closures sem perda silenciosa local.

Hardening implementado na 12E5:

- `sync_pull_cursors` local guarda cursor por tabela/escopo;
- ProductClass v2, catalogo tecnico sanitario v2 com `updated_at` e Agenda v2 usam pull incremental por `updated_at`;
- full fetch inicial continua possivel quando cursor nao existe;
- tombstones `deleted_at` continuam preservados por merge/upsert;
- `sanitario_produto_fontes_v2` permanece full fetch/merge por nao possuir `updated_at`;
- falha de rede em closure preserva `queue_ops` para retry;
- closure aplicada sai da fila; closure rejeitada fica rastreavel em `queue_rejections`;
- conflito de closure duplicada dispara reconciliacao por pull da Agenda v2;
- `catalog_*` nao e superficie de push;
- `state_*` nao e superficie direta de push;
- agenda/animais v2 permanecem pull-only;
- closure pushavel continua restrita a `closed_without_execution`, `cancelled` ou `dismissed`, sempre sem `execution_evento_id`.

Gate para 12F:

- iniciar protocolos curatoriais somente com P0 zerado;
- baseline funcional, sync-batch, lint e build verdes;
- ProductClass v2 e catalogo tecnico disponiveis offline;
- Agenda v2 estabilizada como intencao;
- closure sem execucao preservada;
- carencia ativa continua nascendo apenas de evento executado com produto/fonte tecnica.

Ainda não implementado após a 12F2:

- RPC/Edge Function operacional para Agenda v2;
- UI operacional da Agenda v2.
- push de `sanitario_agenda_v2` e `sanitario_agenda_animais_v2`.
- seed/importacao ativa de protocolos v2;
- validacao tecnica dos payloads 12F2 contra schema real;
- agenda automatica a partir de protocolos v2.
- promocao de qualquer item para `agenda_allowed`.
- carencia ativa derivada de protocolo ou agenda.

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
| Fase 12D0 | Modelo canônico documental — protocolo/produto/fonte técnica | Concluída |
| Fase 12D1 | Schema v2 e contratos TypeScript mínimos persistidos | Concluída |
| Fase 12D2 | Builders/adapters puros de snapshots técnicos | Concluída |
| Fase 12D3 | Extração curatorial de protocolos candidatos v2 — matrizes revisáveis | Concluída — rebaseline conceitual aplicado em 12D4 |
| Fase 12D4 | Rebaseline conceitual: ProductClass, enums canônicos, ExecutionProductPolicy | Concluída |
| Fase 12D5 | Contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy | Concluída |
| Fase 12D6 | Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass | Concluída |
| Fase 12E0 | Diagnóstico técnico e contrato de offline/sync | Concluída |
| Fase 12E1 | Dexie schema/stores para ProductClass v2 | Concluída localmente |
| Fase 12E2 | Pull remoto ProductClass v2 para Dexie e baseline P1 | Concluída localmente |
| Fase 12E3 | Catálogo técnico sanitário v2 ampliado | Concluída localmente |
| Fase 12E4 | Agenda Sanitária v2 offline/sync controlado | Concluída localmente |
| Fase 12E5 | Hardening offline/sync sanitario v2 | Concluída localmente |
| Fase 12F0 | Estruturacao curatorial dos Protocolos Sanitarios v2 como catalogo candidato | Concluída localmente |
| Fase 12F1 | Normalizacao dos Protocolos Sanitarios v2 em artefatos tecnicos candidatos | Concluída localmente |
| Fase 12F2 | Payloads candidatos de seed/import dos Protocolos Sanitarios v2 | Concluída localmente |
| Fase 12F3-12F8 | Validacao, adapter, decisao/migration ProductClassGroup e revalidacao dos 6 itens antiparasitarios | Concluídas localmente; sem seed/import real |
| Fase 12G | Importador controlado dos Protocolos Sanitarios v2 usando payload canonico 12F10 | Concluída localmente; apply bloqueado sem flag |

### ProductClass v2 local/offline

A Fase 12E1 criou a base local Dexie/IndexedDB para as 4 estruturas ProductClass v2, e a Fase 12E2 adicionou o pull remoto para cache local:

- `catalog_sanitario_product_classes_v2`;
- `catalog_sanitario_product_class_groups_v2`;
- `catalog_sanitario_product_class_group_members_v2`;
- `catalog_sanitario_product_class_default_rules_v2`.

Contrato atual:

- `scope = 'global'` é representável localmente com `fazenda_id = null`;
- `scope = 'tenant'` é representável localmente com `fazenda_id` preenchido;
- pull global usa consulta separada com `scope = 'global'` e `fazenda_id is null`;
- pull tenant usa consulta separada com `scope = 'tenant'` e `fazenda_id` da fazenda atual;
- ProductClass v2 permanece pull-only nesta etapa: remoto -> Dexie local;
- `deleted_at`, `updated_at`, `metadata`, `limitations`, arrays e JSON estruturados são preservados;
- o cache local nao implementa push remoto, `queue_ops`, sync-batch ProductClass, seed, protocolo, agenda, evento ou carência ativa;
- catálogo global segue como leitura futura/pull-only, sem edição local autorizada.

### Catálogo técnico sanitário v2 local/offline

A Fase 12E3 criou a base local Dexie/IndexedDB e pull remoto para as 7 estruturas autorizadas do catálogo técnico sanitário v2:

- `catalog_sanitario_fontes_tecnicas_v2`;
- `catalog_sanitario_fonte_cobertura_campos_v2`;
- `catalog_sanitario_produtos_v2`;
- `catalog_sanitario_produto_especie_autorizacao_v2`;
- `catalog_sanitario_produto_fontes_v2`;
- `catalog_sanitario_produto_dose_rules_v2`;
- `catalog_sanitario_produto_carencia_rules_v2`.

Contrato atual:

- fontes técnicas globais são baixadas por consulta separada com `scope = 'global'` e `fazenda_id is null`;
- fontes técnicas da fazenda são baixadas por consulta separada com `scope = 'fazenda'` e `fazenda_id`, conforme enum real da migration ativa;
- produtos, autorizações por espécie, vínculos produto-fonte, regras de dose e regras catalogadas de carência são armazenados como catálogo técnico pull-only;
- `deleted_at`, `updated_at`, `metadata`, `limitations`, arrays e JSON estruturados são preservados;
- bubalino não herda autorização bovina por cache local ou selector implícito;
- regras de carência em catálogo não são carência ativa e não liberam venda, abate, leite ou aptidão operacional;
- `sanitario_produto_carencia_fontes_v2`, `sanitario_protocolos_v2` e `sanitario_protocolo_itens_versions_v2` permanecem fora da 12E3;
- o cache local não implementa push remoto, `queue_ops`, sync-batch, UI, migration, seed, protocolo estruturado, agenda, evento ou baixa de estoque.

### Agenda Sanitária v2 local/offline

A Fase 12E4 criou a base local/sync controlada da Agenda Sanitária v2:

- `ops_sanitario_agenda_v2`;
- `ops_sanitario_agenda_animais_v2`;
- `ops_sanitario_agenda_closures_v2`.

Regras atuais:

- Agenda v2 é operacional por fazenda e usa pull por `fazenda_id`;
- não existe catálogo global de agenda;
- pull respeita ordem agenda -> animais -> closures;
- agenda/animais v2 permanecem pull por fazenda nesta etapa;
- push é permitido somente para closures operacionais;
- push de closure operacional nesta etapa significa apenas `closed_without_execution`, `cancelled` ou `dismissed`, sempre sem `execution_evento_id`;
- closure fecha ou cancela intenção e não cria evento sanitário executado;
- closure não cria baixa de estoque;
- closure não calcula carência ativa;
- closure não libera venda, abate, leite ou aptidão operacional;
- ProductClass v2 e catálogo técnico sanitário v2 continuam pull-only.
- A partir da 12E5, pulls sanitarios v2 usam cursor incremental por `updated_at` quando a tabela possui esse campo; `sanitario_produto_fontes_v2` permanece full fetch/merge por contrato sem `updated_at`.

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
