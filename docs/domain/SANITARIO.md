> **Estado confirmado — 23/10/2026:** bootstrap `sanitario-initial-20261022-v1` concluído: nove famílias `active/approved`, febre aftosa `retired`, doze itens homologados, cinco decisões anteriores preservadas e gates operacionais OFF. A migration `20261022230000` foi aplicada; o recibo é `sanitary-bootstrap-v2:e798ee50-7bda-4cd8-bebe-6ac5e44e8315`. [Evidência da execução e replay](../review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_REMOTE_RESULT_20261023.json). As notas de preparação abaixo são históricas; não indicam pendência de autorização ou necessidade de repetir a implantação. A integração local não autoriza reexecução, deploy ou ativação de gates.

> **Adendo normativo proposto — 15/10/2026 (não implementado):** para planejamento Sanitário V2, separar **consulta**, **sugestão**, **Agenda manual condicional**, **Agenda automática condicional** e **execução factual**. Produto comercial ainda não identificado **não bloqueia Agenda genérica de manejo**, mas não autoriza selecionar dose, via, carência, esquema de reforço ou produto. A automação requer regra/versionamento aprovados, contexto da fazenda, elegibilidade individual, Evento anterior quando necessário e deduplicação persistente; não cria Evento, estoque ou carência. **Esta revisão não altera os estados do catálogo ou flags**, nem autoriza importação. Ver [política e decisões por 20 itens](../review/SANITARIO_V2_POLITICA_AGENDA_CONDICIONAL_20261015.md) e [matriz de decisões](../review/evidence/SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv). **Ajustes A–E incorporados:** restrição `no_agenda_auto` mantém **todos os três itens de raiva** sem automação até revisão **aprovada e versionada**; vacinas multivalentes (ex.: Fertiguard/Poliguard) exigem composição, janela e histórico compatíveis para **uma única aplicação/Evento** com cobertura multiprotocolo rastreável; B19 concilia períodos federais e somente os prazos estaduais de comprovação preserváveis pelo art. 3º; Agenda genérica não adquire esquema/dose por inferência; relatórios locais e os quatro achados Fallow permanecem **relatados, sem IDs brutos conferidos**. Revisar a [matriz por 20 itens](../review/evidence/SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv) junto com a política.

> **Patch local — 22/10/2026, sem publicação ou aprovação remota:** novas versões com `catalog_review_scope=manual_planning` permitem curadoria nacional de raiva para consulta/planejamento manual, preservando `no_agenda_auto` e flags de automação desligadas. A migration `20261022230000_sanitario_manual_catalog_review_v2.sql` mantém autenticação, digest, CAS, replay e auditoria; não aprova registros nem altera gates. Adesão continua na configuração sanitária existente da fazenda; o motor consulta os overlays versionados do protocolo e o município cadastrado, sem solicitar legislação ao produtor ou inferir foco/perifoco, obrigatoriedade ou dispensa por endereço. Ausência/expiração de cobertura mantém consulta/manual; menores de três meses ou indicação contextual exigem confirmação e responsável técnico. Variantes com condição materna usam Evento compatível documentado antes do nascimento ou contexto documental explícito, sem tratar ausência de histórico como mãe não vacinada. Reforço anual de `class_scheme` usa aniversário do calendário, inclusive ano bissexto. O pacote de candidatas é somente revisão pelo publicador canônico; `--apply` permanece recusado nesse caminho. CattleMaster e Bovigen Lepto 8 permanecem propostas bloqueadas onde faltam condições de runtime; Bovela não comprova IBR. Nada neste patch certifica produto, registro vigente ou execução.

```markdown
# Sanitário — RebanhoSync

Atualizado em: 2026-10-15

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

## Planejamento condicional local — revisão A–E de 16/10/2026

- `protocol_item_snapshot.planningKind` distingue `avaliacao_manejo_generica` e `aplicacao_esquema_definido` no writer local; tarefas anteriores não são migradas nem reinterpretadas.
- Novas intenções dos callers manuais legados são avaliações genéricas. Esquemas definidos exigem produto/formulação, autorização explícita por espécie/sexo/idade, fontes por campo e histórico do mesmo produto quando aplicável.
- A geração condicional revalida catálogo/contexto/dados factuais sob transação Dexie; `allows_agenda_auto` e `no_agenda_auto` não são alterados pela UI ou pelo histórico.
- B19 exige UF, mantém proibição em SC e distingue elegibilidade/fato/comprovação. Não há novo cálculo de prazo de comprovação estadual neste patch.
- Conformidade histórica usa pré-checagem factual, não a ausência de aprovação prospectiva do catálogo.
- Cobertura multiprotocolo permanece informativa; o modelo factual singular impede materializar duas aplicações equivalentes como se fossem independentes. Nenhuma relação persistente nova é inferida.
- Evidência, testes e restrições: [entrega local A–E](../review/evidence/SANITARIO_V2_A_E_IMPLEMENTACAO_LOCAL_20261016.md).

## Contrato central

| Conceito | Fonte primária |
|---|---|
| Regra sanitária | Protocolo/configuração |
| Fonte técnica da regra | Referência bibliográfica, norma oficial, bula ou MV responsável |
| Produto, dose, via e carência planejada | Produto sanitário/fonte técnica explícita |
| Tarefa sanitária futura | Agenda |
| Elegibilidade por janela | Cálculo derivado de animal + regra + eventos |
| Contexto operacional explícito | Entrada declarada pelo usuário para pré-checagem/preview |
| Demanda agrupada | Leitura derivada de elegibilidade/lote/janela |
| Preview operacional | Simulação derivada antes de materializar agenda |
| Aplicação executada | Evento sanitário |
| Histórico sanitário de entrada | Evento/histórico anterior à entrada, classificado por origem e evidência |
| Produto aplicado | `eventos_sanitario` estruturado |
| Estoque consumido | `insumo_movimentacoes` vinculada ao evento |
| Custo sanitário | Snapshot no evento/movimento |
| Carência operacional | Evento factual + `eventos_sanitario.produto_snapshot.withdrawalSnapshot` + fonte técnica forte explícita |
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
- Contexto operacional explícito não substitui fonte técnica, não executa protocolo e não libera operação.
- Histórico sanitário de entrada documentado pode apoiar pré-checagem; declaração sem documento não libera regra crítica.
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

A partir da 12F3, os payloads candidatos dos Protocolos Sanitarios v2 foram validados contra o schema real e seguem bloqueados para import bruto. A 12F4 definiu adapter/normalizer candidato, ainda sem seed/import. A 12F5 validou esse adapter com script local somente leitura. A 12G criou importador controlado usando exclusivamente o payload canonico 12F10, com `--validate`, `--dry-run` e `--apply` protegido por `ALLOW_SANITARIO_IMPORT=1`. A 12I conectou os protocolos importados ao offline-first Dexie como catalogo `catalog_*` pull-only/read-only. Qualquer import ou leitura local deve preservar:

- `agenda_allowed = false` enquanto houver sourceGap critico;
- `approved_for_catalog = false` ate aprovacao curatorial propria;
- B19 como regra nacional para femeas bovinas e bubalinas de 3 a 8 meses, com excecao de obrigatoriedade nas UFs de risco A (IN 10/2017 art. 10; Portaria SDA/MAPA 1.633/2026) e proibicao de B19 em Santa Catarina conforme CIDASC;
- febre aftosa como archived/blocked, sem rotina operacional;
- ProductClassGroup antiparasitario dependente de ProductClass real e produto executado;
- SourceRefs separados de sourceGaps e sourcePolicy.
- itens com ProductClassGroup nao devem ser convertidos para `product_class`, `specific_product` ou `none` sem decisao estrutural explicita.

A 12F6 tomou a decisao estrutural documental: a forma futura recomendada e suporte direto a `product_class_group` no item com `product_class_group_id` referenciando `sanitario_product_class_groups_v2(id)`. A 12F7 criou essa migration controlada no schema real, com enum, coluna, FK, CHECK e trigger de validacao de grupo ativo/escopo/status. A 12F8 revalidou o adapter e adaptou documentalmente os 6 itens antiparasitarios com `product_class_group_id` por lookup, elevando a contagem de itens adaptaveis para 19. A 12F9 gerou payload JSON completo candidato e a 12F10 consolidou a fonte final em `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`, originalmente com 10 protocolos, 19 itens, 4 ProductClassGroups e 16 rejeicoes de members, sempre com `execute_import=false`. A 12G implementou o importador controlado e executou apply real local. O saneamento posterior do catalogo v2 corrigiu `raiva_herbivoros`, tombstonando o item antigo `raiva_area_risco_anual` e mantendo tres itens ativos: `raiva_primovac_dose1`, `raiva_primovac_reforco_30d` e `raiva_reforco_anual_area_risco`, todos `draft`, `manual_only`, `allows_agenda_auto=false` e com produto real exigido na execucao. Ajuste curatorial posterior tombstonou `matrizes_pre_parto_lepto_reforco_situacional` para evitar concorrencia com o protocolo proprio `leptospirose`; o catalogo ativo fica com 20 itens. A 12H criou leitura read-only a partir do banco em `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts`, confirmando B19 nacional, aftosa bloqueada e antiparasitarios com ProductClassGroup sem criar agenda, evento, estoque, carencia ativa ou liberacao operacional. A 12I criou stores Dexie v27 e pull remoto/local read-only para esse catalogo, preservando tombstones e sem `queue_ops` ou push. Members seguem bloqueados sem `class_id` real.

### Catalogo de Protocolos Sanitarios v2 local/offline

A camada local de Protocolos Sanitarios v2 é cache offline-first de leitura, não fonte paralela de verdade.

A rota `/protocolos-sanitarios/catalogo-v2` expõe esse cache em UI read-only. Ela deve ler pela camada local `readLocalSanitaryProtocolCatalogV2`, sem ler JSON canonico ou Supabase direto em runtime.

Stores locais:

- `catalog_sanitario_protocolos_v2`;
- `catalog_sanitario_protocolo_itens_versions_v2`;
- `catalog_sanitario_product_class_groups_v2`.

Regras:

- pull remoto permitido apenas para leitura/merge de catalogo;
- `catalog_*` permanece pull-only;
- não usar `queue_ops` para protocolos, itens ou ProductClassGroups;
- não criar push/sync-batch de escrita para catalogo;
- não importar ProductClassGroup members sem `class_id`;
- não criar agenda, evento, estoque, carencia ativa ou liberação operacional a partir da leitura;
- não exibir CTA de agenda, execução, estoque, carencia ou liberação operacional nessa superficie;
- ProductClassGroup não valida execução, dose ou carência;
- execução real continua exigindo produto real e snapshot técnico.

Um protocolo pode nascer de:

1. base regulatória oficial;
2. overlay operacional do pack;
3. protocolo customizado da fazenda.

Essas camadas não devem competir como se fossem a mesma coisa.

### Revisao tecnica de evidencias e versionamento

Revisao de evidencias de 2026-10-14:

- `b19_femeas_3_8_meses`, `clostridial_primovac_dose2` e `ibr_bvd_primovac_dose2` possuem novos IDs fisicos e versao 2 no candidato 12F10. Os IDs anteriores permanecem em `snapshot_template.metadata.supersedes`.
- O importador apenas planeja aposentadoria da versao anterior explicitamente identificada quando ela ainda esta `draft`; uma versao ativa ou identidade divergente bloqueia o plano. Nao houve importacao.
- Referencia Fortress 7: segunda dose em 28–42 dias. Referencias Poliguard/Bovigen Repro Total SE: 21–30 dias. Intervalos nao sao universais da classe.
- Prazo nacional de comprovacao de brucelose: 10/07 e 10/01 do ano seguinte; prazos estaduais anteriores podem ser preservados nos termos da Portaria 1.633/2026.

### Registro factual e uso prospectivo por Agenda v2

A conclusao manual declara `registrationMode=executed_fact` e exige confirmacao de aplicacao ja realizada, data nao futura, produto real, dose/unidade/via e integridade dos vinculos por fazenda. Nao concede autorizacao prospectiva: o evento preserva `prospective_authorization=false` e os sinais curatoriais/regionais em `catalog_review_warnings`. Produto com curadoria pendente pode ser selecionado com aviso; status curatorial do app nao e situacao de registro no MAPA. Consulta externa indisponivel nao comprova irregularidade.

Sem declaracao factual, a politica prospectiva continua exigindo protocolo `active`/`approved`, item `active` e contexto UF valido quando exigido. Identidade do catalogo, tenant e vinculos fisicos de item/produto/classe/grupo continuam verificados nos dois modos; a transacao preserva fato, estoque e fila de forma atomica. O modo factual preserva o snapshot historico mesmo que o protocolo esteja draft/retired ou os dados tecnicos do produto estejam pendentes; isso nao valida dose, gestacao, lactacao ou especie automaticamente.

`canExecute` na lista de agendas manuais representa acesso ao registro de fato ja realizado, nao permissao veterinaria para aplicar o produto. Registro de aplicacao nao prova conformidade regulatoria. Carencia desconhecida impede sua derivacao ou declaracao de livre de carencia, sem impedir registrar o fato. Estoque negativo, identidade incoerente, fazenda divergente e falta de confirmacao permanecem rejeitados.

Os avisos curatoriais sao relidos dentro da transacao e preservados no Evento, detalhe e fila. A resolucao UUID de classe para `class_key` ignora classes/members de outras fazendas; cache parcial nao comprova incompatibilidade. Item somente-alerta continua nao executavel mesmo quando apenas o snapshot esta disponivel. Conclusoes locais concorrentes da mesma agenda retornam o unico fato persistido.

A pre-checagem prospectiva B19 continua verificando UF; historico documentado permanece `completed` mesmo com UF atual ausente/excluida, sem autorizar nova vacinacao. Automacao e publicacao nao foram ativadas. A barreira local nao substitui RLS; ausencia de teste remoto nesta entrega nao e evidencia de irregularidade do produto nem defeito comprovado de producao.

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

A Fase 11.5 consolidou contratos puros para redesenhar a agenda sanitária. A Fase 12C criou a fundação SQL/RLS da persistência v2 em tabelas dedicadas. A Fase 12E4 adicionou base Dexie/offline e sync controlado para Agenda v2. A Fase 12E5 adicionou hardening de cursor incremental, retry/replay de closures, sucesso parcial e bloqueios de superficie. A Fase 12F0 estruturou Protocolos Sanitarios v2 como catalogo curatorial candidato documental, sem seed e sem ativacao. A Fase 12F1 normalizou protocolos, itens, ProductClassGroups, rotationRule, sourceRefs por campo e sourceGaps em artefatos tecnicos candidatos para futura seed/importacao. A Fase 12F2 converteu esses artefatos em payloads candidatos de seed/import, sem executar importacao. Avanços locais posteriores conectaram a Central Sanitária v2 em `/protocolos-sanitarios` para consulta, janelas, agenda local, histórico e planejamento manual, mantendo seed funcional, execução automática, estoque e carência ativa fora do escopo.

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

### Contexto operacional explícito

Contexto operacional explícito é entrada estruturada informada pelo usuário para avaliar janelas que dependem de condição externa.

Campos iniciais:

- área de risco para raiva;
- cadência sanitária anual/semestral;
- contexto reprodutivo pré-parto/periparto;
- manejo pré-desmama, recria, pré-confinamento ou pasto vedado.

Regras:

- contexto operacional entra somente na pré-checagem/preview e no snapshot de planejamento da agenda manual;
- contexto operacional não altera fonte técnica do protocolo;
- contexto operacional não é execução, evento, histórico, estoque, carência ou liberação;
- quando o contexto exigido não estiver informado, a elegibilidade deve permanecer como dados insuficientes ou ambígua;
- texto de UI não deve ser usado como regra técnica.

### Histórico sanitário de entrada

Histórico sanitário de entrada permite registrar fatos anteriores à entrada do animal no app/fazenda, especialmente animais comprados ou já existentes no cadastro inicial.

Origens aceitas:

- `internal_execution`;
- `external_documented`;
- `external_declared`;
- `legacy_import`.

Evidência:

- documentada;
- declarada;
- desconhecida.

Regras:

- evento interno executado continua contando como histórico executado;
- histórico externo documentado pode apoiar somente o campo coberto quando houver vínculo suficiente com protocolo/item, referência presente e cobertura estruturada; isso não autentica o conteúdo do documento;
- histórico externo declarado gera aviso, mas não libera regra crítica;
- histórico legado ambíguo não libera dose/reforço;
- agenda futura não conta como histórico;
- histórico externo não cria agenda, execução local, baixa de estoque ou carência ativa; quando o sync estiver habilitado, usa `queue_ops` apenas para transportar o fato `standalone_fact`;
- B19 em fêmea adulta sem comprovação documentada deve gerar pendência documental, não agenda de vacinação;
- B19 em fêmea adulta com referência e cobertura estruturadas pode ter somente o requisito coberto apoiado pelo histórico externo; o sistema não atesta a autenticidade do documento;
- B19 em fêmea de 3 a 8 meses sem histórico continua planejável.

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

O Sync Sanitário v2 está implementado sob gates desligados, mas não concluído:

- agenda e `agenda_animais`: implementados; criação e execução primária certificadas no Supabase local descartável em C1–C8;
- evento e detalhe: `apply_factual_core` de execução primária com estoque certificado no caminho builder → fila → worker → Edge/RPC → PostgreSQL → ACK/pull;
- retry/replay/idempotência: replay, perda de ACK, timeout, crash de renderer e retomada offline certificados nesse recorte;
- sucesso parcial: validado localmente, com E2E remoto pendente;
- conflito stale de `replace_agenda_animals`: recertificado remotamente em 05/10/2026; multi-dispositivo completo não recertificado;
- histórico externo/documental: implementado e validado localmente, com E2E remoto não executado;
- movimento de estoque sanitário: consumo vinculado ao fato certificado nesse recorte, incluindo unicidade concorrente e rejeição terminal quando o fato dependente é rejeitado;
- recálculo explícito da Conformidade após pull: pendente.

O gate remoto está desligado, a feature flag local é `false` e o rollout não está autorizado. Produção não foi alterada.

A certificação de 15/10/2026 usou exclusivamente fixtures sintéticas e gates temporários no Supabase local descartável; todos foram desligados ao final. Não certifica dispositivo móvel físico, novo uso prospectivo, importação de protocolo ou liberação operacional. Evidência: [revisão da integração](../review/evidence/SANITARIO_V2_PR_REVIEW_20261014.md).

A Agenda preserva as colunas/FKs legadas para operações antigas. Referências canônicas são armazenadas em `catalog_protocolo_v2_id` e `catalog_protocol_item_version_v2_id`, com validação server-side de fazenda e vínculo do item; o pull as materializa no formato local existente. Nenhuma referência histórica é migrada ou reescrita implicitamente.

Quando a aplicação factual é rejeitada e não existe recibo factual aplicado, o consumo dependente recebe rejeição terminal auditável. O worker preserva Evento/detalhe e os envelopes rejeitados em estado terminal, sem retry automático ou sucesso remoto falso. A API pública de reconciliação rearma explicitamente o core e o consumo da mesma gesture, preservando identidades e payloads, sem reaplicar o fato/estoque local. A referência primária da execução continua no Evento e nos alvos da Agenda; `Agenda.execution_evento_id` permanece um campo legado.

Na Edge, execução primária com `registration_mode=executed_fact` e `prospective_authorization=false` não depende do status curatorial atual nem do timestamp geral do produto. Identidade/nome/classe, tombstone e toda evidência técnica específica continuam validados; carência desconhecida não vira zero. O aviso retrospectivo permanece no payload auditável. Envelopes legados sem a declaração explícita mantêm validação estrita. C5 certificou curadoria pendente e retry após reparo de identidade no catálogo; não certificou reconstrução de envelopes apagados por versões antigas nem reconciliação universal de fontes alteradas.

`SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED` em 05/10/2026 após PT409, PostgREST 14.18 e E2E remoto stale de `replace_agenda_animals`. Historicamente, `40001` não retornava pelo transporte antes do timeout. Ver [evidência canônica](../context/PROJECT_STATUS.md#recertificação-remota-stale-sanitário-v2--05102026). Gate remoto `OFF`, flag `false`, rollout e importação real não autorizados; outras RPCs não foram recertificadas.

Os itens 3.9, 3.13, 4, 5 e 6 estão validados localmente; o hardening integrado local foi executado. Demais E2Es remotos, rollout e fechamento da Fase 12 permanecem pendentes; a recertificação stale não amplia esse escopo.

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

### Contrato operacional validado localmente na Fase 12

O `withdrawalSnapshot` fica congelado dentro do `produto_snapshot` do Evento factual e não é reconstruído pelo catálogo atual durante retry, replay ou projeção.

Estados preservados por finalidade e animal:

- `calculated`: regra única aplicável informa período e término calculado;
- `explicit_absence`: fonte forte comprova ausência de carência;
- `unknown`: produto, contexto, fonte, cobertura ou regra são ausentes/insuficientes;
- `ambiguous`: mais de uma regra igualmente aplicável produz resultados não equivalentes;
- `not_permitted`: a fonte técnica não permite o uso/finalidade declarados.

Aplicabilidade:

- usa somente produto executado, espécie, aptidão quando exigida, via, finalidade, fonte, cobertura e qualificadores previstos no contrato;
- regras semanticamente equivalentes são selecionadas deterministicamente; regras divergentes não calculam;
- carne e leite são independentes e a cobertura de uma finalidade não se amplia para a outra;
- ausência de catálogo offline não impede o Evento, mas mantém a carência desconhecida sem fabricar evidência.

Semântica temporal implementada:

- horas: adição exata ao instante factual, sem arredondamento;
- dias: data nominal em `America/Sao_Paulo`, com término inclusivo no fim do dia nominal;
- animais com contextos distintos no mesmo Evento preservam resultados próprios.

Correções e projeção:

- cada correção é novo Evento e mantém snapshot próprio;
- correção de data ou técnica pode alterar a carência vigente; correção somente de custo preserva o significado sanitário;
- a projeção pura percorre a cadeia factual linear; ramificação permanece conflito explícito;
- legado insuficiente e histórico externo permanecem desconhecidos e não criam carência operacional;
- cálculo, reprojeção ou término não movimenta estoque nem autoriza venda, abate, leite, trânsito ou movimentação.

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

O Sync Sanitário v2 usa o staging `zqloazqzhwauamcejmuz`. Produção não foi alterada, o gate remoto permanece desligado, a feature flag local permanece `false`, o rollout não foi autorizado e não restaram fixtures sintéticas.

Validações locais cobrem multi-tenant, RLS, retry/replay, idempotência, sucesso parcial, cutover e reconcile. O E2E remoto permanece parcial; o blocker stale de `replace_agenda_animals` foi fechado em 05/10/2026, sem recertificar as demais RPCs.

### Roadmap sanitário consolidado

- Conformidade Sanitária v2 local: concluída e validada.
- Documentação curta do Sanitário v2 local: concluída.
- Sync Remoto Sanitário v2: em andamento.
- Histórico externo/documental 3.8: implementado e validado localmente.
- Estoque 3.9, recálculo 3.13, produto/fonte por campo 4, correção append-only 5 e carência operacional 6: validados localmente.
- Hardening integrado local de 3.9, 3.13, 4, 5 e 6: executado.
- Próxima pendência: certificação remota acumulada; Fase 12 aberta, gates desligados e rollout não autorizado.

O roadmap macro e os estados por subitem ficam em [ROADMAP.md](../product/ROADMAP.md). O estado técnico detalhado fica em [CURRENT_PHASE_HANDOFF.md](../review/CURRENT_PHASE_HANDOFF.md).

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

A base local/sync da Agenda Sanitária v2 inclui:

- `ops_sanitario_agenda_v2`;
- `ops_sanitario_agenda_animais_v2`;
- `ops_sanitario_agenda_closures_v2`.

Regras atuais:

- Agenda v2 é operacional por fazenda e usa pull por `fazenda_id`;
- não existe catálogo global de agenda;
- pull respeita ordem agenda -> animais -> closures;
- push/pull de agenda e animais foi implementado sob gate, com E2E remoto parcial;
- núcleo factual de evento/detalhe foi implementado, com E2E remoto pendente;
- closure administrativa continua separada da execução factual;
- closure fecha ou cancela intenção e não cria evento sanitário executado;
- closure não cria baixa de estoque;
- closure não calcula carência ativa;
- closure não libera venda, abate, leite ou aptidão operacional;
- ProductClass v2 e catálogo técnico sanitário v2 continuam pull-only.
- pulls sanitários v2 usam merge não destrutivo e cursor incremental quando o contrato da tabela possui `updated_at`;
- Dexie v28 inclui a relação factual `event_eventos_animais`;
- cutover local usa manifesto `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`.

### Central Sanitária v2 e superfícies contextuais

A rota `/protocolos-sanitarios` é a Central Sanitária operacional. Ela concentra planejamento, janelas, elegibilidade, preview completo, agenda manual local, catálogo sanitário, histórico sanitário e pendências documentais.

O plano automático da fazenda usa `state_fazenda_sanidade_config.payload.sanitary_agenda_automation_v2`, com referências exatas a protocolo/item/versão/produto, contexto, revisão e confirmação da ativação. A gravação reutiliza o gesture canônico de configuração; não cria outro catálogo. A confirmação vale para o plano ativado, dispensando confirmação de cada tarefa.

O campo opcional `ruleContexts` permite contexto por versão física do item, preservando a leitura de planos antigos com contexto comum. Calendários exigem adoção explícita para a UF, limitada aos meses da versão aprovada; recria usa o estágio de vida canônico, sem confundi-lo com categoria zootécnica. Pré-desmama exige sistema intensivo/leiteiro ou orientação referenciada. Pré-confinamento e avaliação pré-parto exigem data, referência e alvos; esses dados são intenção programada, não fatos de deslocamento ou reprodução. Pré-parto respeita sexo e contexto reprodutivo. Leptospirose dose 2 continua bloqueada na referência canônica atual; outra formulação depende de variante, esquema e aprovação próprios.

Planos com contextos avançados são gravados com `schemaVersion: 2`; planos V1 continuam legíveis. Clientes anteriores, que aceitam somente V1, rejeitam o plano V2 antes de gerar ou sobrescrever intenções, evitando ignorar silenciosamente as novas condições. Operações/Agendas anteriores não são regravadas por essa evolução.

Identidades de calendário são por ano/mês e contextos programados usam sua data. Fato de ano anterior não elimina a próxima janela; segunda dose comprovadamente executada não é recriada apenas por faltar Agenda local. Cancelamento automático suprime sua janela, preservando a possibilidade de outro manejo explicitamente programado. A Central apresenta cobertura, sugestões e motivos de exclusão de todos os itens carregados, sem transformar normalização em autorização.

A abertura da Central, alterações dos dados locais e reconnect reavaliam as regras selecionadas. O writer revalida plano, versão, autorização técnica, janela e elegibilidade sob a mesma transação das intenções. A identidade por fazenda/animal/regra/versão/janela é persistente; retries preservam Agendas geradas, reagendamentos e cancelamentos. Reforços usam o histórico factual compatível do precheck. Planejamento não cria Evento, estoque ou carência.

A automação continua local: o writer de Agenda não enfileira push remoto e nenhuma flag sanitária é habilitada. A configuração segue a fila existente, mas convergência de planos concorrentes entre dispositivos e sincronização das Agendas automáticas ainda exigem homologação do contrato remoto. `allows_agenda_auto=false`, `no_agenda_auto` e falta de aprovação técnica continuam bloqueantes; fixtures aprovadas não autorizam itens do catálogo operacional.

Superfícies:

- `Janelas sanitárias`: seleção por protocolo/item, contexto operacional explícito, pré-checagem local e filtro inicial por animal ou lote;
- `Agenda sanitária`: leitura local de `ops_sanitario_agenda_v2`, com reagendamento/cancelamento apenas para agendas não executadas;
- `Catálogo sanitário`: consulta read-only do catálogo v2 local/offline;
- `Histórico sanitário`: execução interna, histórico externo documentado, declarações e legado ambíguo separados;
- `Conformidade`: read model derivado/somente leitura por animal, lote, protocolo e item, sem liberação automática.

Regras da Conformidade v2:

- evento sanitário executado é a única prova de execução local;
- agenda futura aparece apenas como planejamento;
- fechamento/conclusão administrativa sem evento não prova execução;
- histórico `external_documented` exige classe documentada e referência vinculada para apoiar regra crítica;
- histórico declarado ou documento sem referência permanece pendência documental;
- execução parcial de lote não se generaliza aos demais animais;
- a leitura não cria agenda, evento, estoque, carência ou autorização operacional.

Regras de navegação:

- detalhe do animal é visão contextual individual, não planejamento completo;
- detalhe do lote é visão contextual do grupo, não planejamento completo;
- animal/lote podem abrir a Central com filtro inicial por query params;
- `animalId` tem prioridade sobre `loteId`; quando ambos existem, o lote é apenas contexto auxiliar;
- filtro por lote lista apenas animais do lote;
- limpar filtro volta à visão geral e não deve persistir filtro indevidamente;
- filtros, badges e atalhos não criam agenda, evento, estoque, carência ativa ou `queue_ops`.

Regras de UX:

- não exibir UUID cru ou `snake_case` na UI;
- execução permanece bloqueada/desabilitada quando a superfície é de planejamento;
- reagendar agenda não executada altera apenas data planejada;
- cancelar agenda não executada altera apenas status da agenda.

### Resumos sanitários em animal e lote

As abas de Sanidade em `AnimalDetalhe` e `LoteDetalhe` são resumos operacionais contextuais.

Elas devem mostrar por padrão:

- resumo de status;
- pendências documentais críticas;
- histórico de entrada quando aplicável;
- agenda sanitária futura;
- atalhos para a Central Sanitária filtrada.

Devem ficar fechados sob demanda:

- pré-checagem técnica completa;
- preview manual completo;
- listas completas de candidatas, atrasadas, bloqueadas e não aplicáveis.

Essas abas não devem exibir lista linear repetida de todos os itens nem botões por item no modo compacto.

### Revisão curatorial eletrônica V2

A revisão global ocorre no Backoffice, com ação explícita de administrador autorizado em `app_superadmins`. Não exige fazenda ou identificação do futuro executor. A RPC valida a permissão no banco, o hash do conteúdo e as versões; decisão e promoção dos registros canônicos são atômicas e auditadas em `app_admin_audit_events`.

Somente os itens selecionados e tecnicamente completos recebem permissão automática. A avaliação genérica B19 conserva as condições normativas de elegibilidade e execução. As seis avaliações PAR/DES/CONF/PARTO com fonte Embrapa regional conservam o limite de UF `DF`, contexto individual e ausência de produto/dose/via/carência. A fonte permanece apoio: a decisão registrada por campo não a transforma em norma/bula. Uma fazenda não amplia o alcance regional da versão aprovada.

As sete versões dependentes de evidência comercial permanecem sem aprovação; os três itens de raiva conservam `no_agenda_auto`, os dois de aftosa e LEP2 canônica continuam bloqueados. Publicação de regra não gera Agenda por si só: o plano persistente da fazenda exige ativação explícita e o motor existente avalia cada animal. Ver [evidência e homologação](../review/evidence/SANITARIO_V2_APROVACAO_ELETRONICA_20261017.md).

### Planejamento por classe — contrato local R04B

Novas versões podem optar por `snapshot_template.metadata.planning_scope=class_scheme`, mantendo a ação de vacinação e a chave lógica. Reutilizam `product_requirement_kind=product_class` e `executionProductPolicy=required_at_execution`, sem produto, dose ou via antecipados. Exigem fonte/cobertura por elegibilidade, janela, classe e espécie; uma bula sustenta somente sua variante, não toda a classe. Dose 2 exige Evento compatível; o reforço anual parte da conclusão da série inicial definida em `booster_rule.previous_logical_item_key` ou do próprio reforço factual, sem tolerância inventada.

A Agenda congela versão, janela, fontes e recorrência nos JSON existentes. Na aplicação, o produto real precisa comprovar compatibilidade com a variante e vigência comercial; a transação revalida essa prova. Registro explícito de fato ocorrido preserva não conformidades como alertas, sem convertê-las em autorização. Carência continua dependente do produto/fato, com desconhecidos preservados.

Esse contrato está implementado localmente e a migration curatorial correspondente não foi aplicada ao remoto. Cinco candidatas estão preparadas, nenhuma aprovada; os sete itens e as Agendas R05 permanecem preservados. Raiva conserva consulta/manual e depende de variante regional aprovada para futura automação; aftosa continua fora da vacinação de rotina; LEP2 v1 permanece incompatível com Leptoferm bovino. Ver [matriz e previews R04B](../review/SANITARIO_V2_R04B_CLASSES_20261021.md).

R04B.2 prepara publicação incremental pelo importador canônico existente: cinco versões, oito coberturas, duas revisões de classe e dois vínculos produto/fonte. Pais existentes são apenas referências; produtos não recebem autorização de aplicação. A aprovação canônica também limpa `proposal_only`, mantendo flags coerentes com `allows_agenda_auto`. Publicação, decisões por digest e homologação incremental dependem de autorizações distintas. Ver [certificação e plano executável R04B.2](../review/SANITARIO_V2_R04B2_CERTIFICACAO_20261021.md).

O fechamento local de 22/10 estende a mesma rota `--incremental` para um lote derivado de sete versões elegíveis: Poliguard e Bovigen V4J5 (duas cada) e três itens de raiva exclusivamente para consulta/planejamento manual. O lote contém doze coberturas e duas fontes novas; não cria produtos nem altera Leptoferm, suas restrições ou as aprovações anteriores. A classe IBR/BVD recebe somente revisão taxonômica, mantendo `manual_only` e `can_validate_execution=false`; a classe raiva permanece `needs_review`. Variantes CattleMaster e Bovigen Lepto 8 ficam fora da publicação elegível. CAS de pais/predecessores, conflitos em novas chaves, locks e preservação de R04/R05 passam pelo publicador existente.

Por decisão do proprietário, a implantação inicial usa `--bootstrap-initial` no mesmo publicador, com manifesto `sanitario-initial-20261022-v1` para os doze itens de CLO, LEP, IBR/BVD e raiva manual. Publicação e bootstrap compartilham transação e rollback; o bootstrap reutiliza a validação técnica interna e registra `SANITARY_CATALOG_BOOTSTRAP_V2` na auditoria existente. A identidade do único administrador representa o principal da implantação, sem simular sessão ou revisão humana: `approved_by` permanece nulo nos quatro protocolos, `interactive_review=false` e as fontes recebem `catalogBootstrap`, sem `catalogFieldReview`. Versão, request ID, hashes e estado posterior vinculado ao recibo protegem o replay. Não há nova RPC pública, concessão de acesso ou alteração de RLS. A curadoria interativa existente permanece para revisões futuras. A execução autorizada foi concluída em 23/10/2026, conforme a evidência acima; manifesto e planos de preparação permanecem preservados como histórico, sem constituir autorização para nova execução.

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
