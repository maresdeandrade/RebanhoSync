```markdown
# Sanitário — RebanhoSync

Atualizado em: 2026-06-08
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
| Fase 12D0 | Modelo canônico documental — protocolo/produto/fonte técnica | Concluída |
| Fase 12D1 | Schema v2 e contratos TypeScript mínimos persistidos | Concluída |
| Fase 12D2 | Builders/adapters puros de snapshots técnicos | Concluída |
| Fase 12D3 | Extração curatorial de protocolos candidatos v2 — matrizes revisáveis | Concluída — rebaseline conceitual aplicado em 12D4 |
| Fase 12D4 | Rebaseline conceitual: ProductClass, enums canônicos, ExecutionProductPolicy | Concluída |
| Fase 12D5 | Contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy | Concluída |
| Fase 12D6 | Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass | Concluída |
| Fase 12E0 | Diagnóstico técnico e contrato de offline/sync | Concluída |
| Fase 12E1 | Dexie schema/stores para ProductClass v2 | Concluída localmente |
| Fase 12E2 | Sincronização de ProductClass (sync-batch) e baseline P1 | Não iniciada |
| Fase 12E3 | Dexie & Sync para Agenda Sanitária v2 | Não iniciada |

### ProductClass v2 local/offline

A Fase 12E1 criou apenas a base local Dexie/IndexedDB para as 4 estruturas ProductClass v2:

- `catalog_sanitario_product_classes_v2`;
- `catalog_sanitario_product_class_groups_v2`;
- `catalog_sanitario_product_class_group_members_v2`;
- `catalog_sanitario_product_class_default_rules_v2`.

Contrato da 12E1:

- `scope = 'global'` é representável localmente com `fazenda_id = null`;
- `scope = 'tenant'` é representável localmente com `fazenda_id` preenchido;
- `deleted_at`, `updated_at`, `metadata`, `limitations`, arrays e JSON estruturados são preservados;
- o cache local ainda não implementa pull remoto, push remoto, sync-batch, seed, protocolo, agenda, evento ou carência ativa;
- catálogo global segue preparado como leitura futura/pull-only, sem edição local autorizada.

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
