    # ACTIVE_PHASE_PLAN - Fase 12I + execução sanitária operacional pós-12I

    **Status:** Fase 12I concluída localmente; execução sanitária explícita posterior concluída localmente, sem abrir nova fase.
    **Foco:** Catálogo permanece `catalog_*` pull-only. Agenda é intenção; sua execução confirmada cria evento factual, com estoque e carência somente quando os requisitos explícitos forem atendidos.
    **Criado:** 2026-06-15
    **Atualizado:** 2026-07-17
    **Plano base:** solicitação direta da Fase 12I.

    ---

    ## Objetivo em 1 paragrafo

    A Fase 12I conectou a leitura read-only dos Protocolos Sanitarios v2 ao offline-first Dexie. O avanço posterior mantém o catálogo como fonte pull-only e adiciona execução manual exclusivamente a partir de agenda existente: confirmação explícita cria um evento sanitário factual, preserva animais/produto/aplicação e pode gerar baixa de estoque e carência apenas sob regras explícitas. A agenda não é histórico, não há execução por janela ou pré-checagem e não há liberação operacional.

    ---

    ## Decisao 12I

    Decisao: `12I_CATALOGO_SANITARIO_V2_OFFLINE_READ_ONLY`.

    Entregue nesta fase:
    - stores Dexie v27 `catalog_sanitario_protocolos_v2` e `catalog_sanitario_protocolo_itens_versions_v2`;
    - índices ampliados do store `catalog_sanitario_product_class_groups_v2`;
    - mapeamento remoto/local para `sanitario_protocolos_v2` e `sanitario_protocolo_itens_versions_v2`;
    - pull remoto `pullSanitarioProtocolCatalogV2` para protocolos, itens e grupos globais;
    - leitura local Dexie read-only em `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts`;
    - testes focados de store, pull, cursor incremental e leitura local.

    Resultado local:
    - diagnóstico inicial confirmou carga 12G aplicada: `--dry-run` com 0 `create`, 0 `update`, 33 `skip`, 16 `reject`;
    - pull implementado usa merge incremental, preserva tombstones e não limpa stores;
    - leitura local confirma 10 protocolos, 20 itens ativos apos saneamento de raiva e matrizes pre-parto, 4 grupos, B19 nacional, aftosa bloqueada e 6 itens antiparasitarios com ProductClassGroup;
    - avanço UI posterior criou `/protocolos-sanitarios/catalogo-v2` para consulta local/offline read-only;
    - execução posterior por agenda cria evento sanitário idempotente, detalhe e vínculos de animais, sem alterar protocolo ou catálogo;
    - estoque é baixado apenas após o evento, por `source_evento_id`; carência exige produto real e regra técnica explícita;
    - não há `queue_ops` paralelo, migration, alteração de schema/RLS/Edge Function ou liberação operacional.

    Proximo passo seguro:
    - validar em runtime a execução confirmada de agenda com animais, produto cadastrado, lote opcional, retry idempotente e histórico factual.

    ---

    ## Decisao 12H

    Decisao: `12H_LEITURA_READ_ONLY_PROTOCOLS_SANITARIOS_V2_IMPORTADOS`.

    Entregue nesta fase:
    - modulo `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts`;
    - teste focado `src/lib/sanitario/catalog/__tests__/sanitaryProtocolCatalogV2.test.ts`;
    - consultas read-only para protocolos, itens por protocolo e ProductClassGroups;
    - resumo read-only `buildSanitaryProtocolCatalogSummaryV2`;
    - validacao de invariantes `validateSanitaryProtocolCatalogReadOnlyInvariantsV2`;
    - relatorio unico `docs/review/evidence/RELATORIO_12H_LEITURA_PROTOCOLS_SANITARIOS_V2.md`.

    Resultado local:
    - diagnostico inicial confirmou carga 12G aplicada: `--dry-run` com 0 `create`, 0 `update`, 33 `skip`, 16 `reject`;
    - testes focados passaram;
    - leitura usa banco via cliente Supabase-like, nao JSON;
    - nenhum member foi importado;
    - nenhuma agenda, evento, estoque, carencia ativa ou liberacao operacional foi criada.

    Proximo passo seguro:
    - conectar esta leitura a uma superficie UI read-only ou a pull offline objetivo, sem agenda automatica.

    ---

    ## Decisao 12G

    Decisao: `12G_IMPORTADOR_CONTROLADO_PROTOCOLS_SANITARIOS_V2_COM_PAYLOAD_12F10`.

    Entregue nesta fase:
    - script `scripts/codex/import-sanitario-protocols-v2.mjs`;
    - modo `--validate` somente leitura;
    - modo `--dry-run` com lookup em banco e plano deterministico sem escrita;
    - modo `--apply` transacional, bloqueado sem `ALLOW_SANITARIO_IMPORT=1`;
    - relatório unico `docs/review/evidence/RELATORIO_12G_IMPORTADOR_SANITARIO_V2.md`.

    Resultado local:
    - `--validate`: passou;
    - apply real executado: 33 `create`, 0 `update`, 0 `skip`, 16 `reject`;
    - `--dry-run` pos-apply: 0 `create`, 0 `update`, 33 `skip`, 16 `reject`;
    - `--apply` sem flag: bloqueado com erro explicito;
    - members permanecem rejeitados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

    Nao implementado nesta fase:
    - migration;
    - schema/RLS;
    - UI;
    - Dexie/sync/Edge Function;
    - agenda, evento, estoque, carencia ativa ou liberacao operacional;
    - import de ProductClassGroup members.

    Proximo passo seguro:
    - conectar leitura read-only dos protocolos sanitarios v2 ao catalogo/local/offline, sem agenda automatica.

    ---

    ## Decisao 12F10

    Decisao: `12F10_CONSOLIDAR_ARTEFATOS_CANONICOS_ANTES_DE_12G0`.

    Entregue nesta fase:
    - payload canonico `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`;
    - decision record `docs/review/evidence/SANITARIO_PROTOCOLS_V2_DECISION_RECORD_12F10.md`;
    - import gate `docs/review/evidence/SANITARIO_PROTOCOLS_V2_IMPORT_GATE_12F10.md`;
    - indice `docs/review/evidence/ARCHIVE_INDEX_SANITARIO_12F0_12F9.md`;
    - plano `docs/review/PLANO_FASE_12F10_CONSOLIDACAO_DOCUMENTAL_SANITARIO_V2.md`.

    Proxima fase segura:
    - `12G0 — dry-run real do import usando somente o payload canonico 12F10, com autorizacao explicita, transacao e rollback`.

    ---

    ## Decisao 12F9

    Decisao: `FASE 12F9 CONCLUIDA COMO GERACAO JSON CANDIDATA NAO DESTRUTIVA`.

    Entregue nesta fase:
    - plano `docs/review/PLANO_FASE_12F9_PAYLOAD_JSON_COMPLETO_PROTOCOLOS_V2.md`;
    - script `scripts/codex/validate-sanitario-complete-payloads-12f9.mjs`;
    - JSON `docs/review/evidence/PAYLOAD_JSON_PROTOCOLOS_V2_12F9.json`;
    - JSON `docs/review/evidence/PAYLOAD_JSON_ITENS_PROTOCOLOS_V2_12F9.json`;
    - JSON `docs/review/evidence/PAYLOAD_JSON_PRODUCT_CLASS_GROUPS_12F9.json`;
    - JSON `docs/review/evidence/REJEICOES_PAYLOAD_JSON_12F9.json`;
    - relatorio `docs/review/evidence/RELATORIO_12F9_PAYLOAD_JSON_COMPLETO.md`;
    - resultado `docs/review/evidence/RESULTADO_VALIDACAO_PAYLOAD_JSON_12F9.md`.

    Validacao:
    - `node scripts/codex/validate-sanitario-complete-payloads-12f9.mjs`: passou com 543 PASS, 0 WARNING, 0 FAIL.

    Proxima fase segura:
    - `12G0 — Import controlado/dry-run dos payloads candidatos, apenas se houver autorizacao explicita para carga real`.

    ---

    ## Decisao 12F8

    Decisao: `FASE 12F8 CONCLUIDA COMO REVALIDACAO NAO DESTRUTIVA DO ADAPTER`.

    Entregue nesta fase:
    - plano `docs/review/PLANO_FASE_12F8_REVALIDACAO_ADAPTER_PRODUCT_CLASS_GROUP.md`;
    - script `scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs`;
    - evidencia `docs/review/evidence/REVALIDACAO_ADAPTER_SCHEMA_ATUALIZADO_12F8.md`;
    - evidencia `docs/review/evidence/PAYLOADS_ADAPTADOS_PRODUCT_CLASS_GROUP_12F8.md`;
    - evidencia `docs/review/evidence/REJEICOES_REMANESCENTES_12F8.md`;
    - evidencia `docs/review/evidence/RESULTADO_VALIDACAO_12F8.md`;
    - 6 itens antiparasitarios antes rejeitados adaptados como payload candidato com `product_class_group_id` por lookup;
    - contagem de itens adaptaveis passou de 13 para 19;
    - rejeicao `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM` zerada;
    - 16 ProductClassGroup members continuam bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

    Nao implementado nesta fase:
    - seed/import real;
    - migration nova;
    - insercao no banco;
    - ProductClass, ProductClassGroup ou member novo;
    - UUID artificial;
    - UI, Dexie/sync ou Edge Function;
    - agenda real, evento real, estoque, carencia ativa ou liberacao operacional.

    Validacao:
    - `node scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs`: passou com 167 PASS, 0 WARNING, 0 FAIL.

    Proxima fase segura:
    - `12F9 — Gerar payload JSON completo importavel candidato para protocolos/itens/grupos, ainda sem executar import`.

    ---

    ## Decisao 12F7

    Decisao: `FASE 12F7 CONCLUIDA COMO MIGRATION CONTROLADA`.

    Entregue nesta fase:
    - migration `supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql`;
    - enum SQL `sanitario_product_requirement_kind_v2_enum` aceita `product_class_group`;
    - coluna `product_class_group_id` em `sanitario_protocolo_itens_versions_v2`;
    - FK `sanitario_item_product_class_group_id_fkey`;
    - CHECK de requisito de produto com `specific_product`, `product_class`, `product_class_group` e `none`;
    - trigger `trg_validate_protocol_item_product_class_group_v2` para validar grupo ativo, escopo e bloqueio de agenda automatica com grupo blocked/archived;
    - contrato TS `SanitaryProtocolItemVersionV2.productClassGroupId`;
    - testes focados atualizados.

    Nao implementado nesta fase:
    - seed/import real;
    - protocolo ativo;
    - `approved_for_catalog`;
    - `agenda_allowed`;
    - UI;
    - Dexie/sync;
    - Edge Function;
    - agenda real;
    - evento real;
    - estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Validacoes:
    - `pnpm test -- src/lib/sanitario/rules`: passou;
    - `supabase db reset`: passou;
    - `pnpm test -- supabase/functions/sync-batch`: passou;
    - `pnpm run lint`: passou;
    - `pnpm run build`: passou com warnings conhecidos de Browserslist/chunks.

    Proxima fase segura:
    - `12F8 — Revalidar adapter 12F4/12F5 contra schema atualizado e tentar adaptar os 6 itens antiparasitarios antes rejeitados, ainda sem seed/import real`.

    ---

    ## Historico anterior — Fase 12F6

    ### Decisao 12F6

    Decisao: `RECOMENDAR OPCAO A — SUPORTE DIRETO A PRODUCT_CLASS_GROUP NO ITEM`.

    Entregue nesta fase:
    - plano principal `docs/review/PLANO_FASE_12F6_DECISAO_PRODUCT_CLASS_GROUP_ITENS.md`;
    - evidencia `docs/review/evidence/DECISAO_PRODUCT_CLASS_GROUP_ITENS_12F6.md`;
    - evidencia `docs/review/evidence/MATRIZ_OPCOES_PRODUCT_CLASS_GROUP_12F6.md`;
    - evidencia `docs/review/evidence/CONTRATO_SCHEMA_FUTURO_PRODUCT_CLASS_GROUP_12F6.md`;
    - evidencia `docs/review/evidence/CRITERIOS_12F7_PRODUCT_CLASS_GROUP.md`;
    - recomendacao para futura migration controlada com enum `product_class_group`, coluna `product_class_group_id`, FK para `sanitario_product_class_groups_v2(id)` e CHECK de requisito unico;
    - rejeicao formal de converter `product_class_group` para `product_class`, `specific_product` ou `none`;
    - preservacao dos 6 itens antiparasitarios como bloqueados ate existir schema futuro;
    - preservacao de ProductClassGroup members bloqueados ate existir `class_id` real.

    Nao implementado nesta fase:
    - migration;
    - alteracao de enum, tabela, constraint, FK, RLS ou policy;
    - seed/import executado;
    - codigo funcional/runtime;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Proxima fase segura:
    - `12F7 — Migration controlada para suportar ProductClassGroup em itens de protocolo sanitario v2`, ainda sem seed/import real e sem ativacao automatica.

    ---

    ## Historico anterior — Fase 12F5

    ### Decisao 12F5

    Decisao: `FASE 12F5 CONCLUIDA COMO VALIDACAO AUTOMATIZADA NAO DESTRUTIVA`.

    Entregue nesta fase:
    - script local `scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs`;
    - plano principal `docs/review/PLANO_FASE_12F5_VALIDACAO_AUTOMATIZADA_ADAPTER.md`;
    - evidencia `docs/review/evidence/VALIDACAO_AUTOMATIZADA_ADAPTER_12F5.md`;
    - evidencia `docs/review/evidence/RESULTADO_VALIDACAO_ADAPTER_12F5.md`;
    - evidencia `docs/review/evidence/REGRAS_VALIDACAO_ADAPTER_12F5.md`;
    - validacao automatizada com exit code 0;
    - resultado: 300 PASS, 1 WARNING, 0 FAIL;
    - B19 nacional validada;
    - aftosa archived/blocked validada;
    - ProductClassGroup em itens rejeitado corretamente;
    - ProductClassGroup members bloqueados corretamente;
    - flags proibidas ausentes;
    - zero `agenda_allowed`;
    - zero `approved_for_catalog`.

    Nao implementado nesta fase:
    - seed/import executado;
    - migration;
    - alteracao de schema;
    - codigo funcional/runtime de produto;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Proxima fase segura:
    - `12F6 — Decisao estrutural sobre ProductClassGroup em itens`, ainda sem seed/import real.

    ---

    ## Historico anterior — Fase 12F4

    Decisao: `FASE 12F4 CONCLUIDA COMO ADAPTER/NORMALIZER CANDIDATO DOCUMENTAL`.

    Entregue nesta fase:
    - plano principal `docs/review/PLANO_FASE_12F4_ADAPTER_PAYLOADS_SCHEMA_REAL.md`;
    - evidencia `docs/review/evidence/ADAPTER_PROTOCOLOS_V2_12F4.md`;
    - evidencia `docs/review/evidence/ADAPTER_ITENS_PROTOCOLOS_V2_12F4.md`;
    - evidencia `docs/review/evidence/ADAPTER_PRODUCT_CLASS_GROUPS_12F4.md`;
    - evidencia `docs/review/evidence/ADAPTER_SOURCE_REFS_ROTATION_RULES_12F4.md`;
    - evidencia `docs/review/evidence/REJEICOES_PAYLOADS_12F4.md`;
    - evidencia `docs/review/evidence/PAYLOADS_ADAPTADOS_SCHEMA_REAL_12F4.md`;
    - 10 protocolos adaptaveis;
    - 13 itens adaptaveis;
    - 6 itens antiparasitarios rejeitados por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`;
    - 4 ProductClassGroups adaptaveis parcialmente;
    - 16 ProductClassGroup members bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`;
    - SourceRefs e RotationRules direcionados para JSONB existente;
    - B19 nacional preservada;
    - aftosa preservada como archived/blocked;
    - zero `agenda_allowed`;
    - zero `approved_for_catalog`.

    Nao implementado nesta fase:
    - seed/import executado;
    - migration;
    - alteracao de schema;
    - codigo funcional/runtime;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Proxima fase segura:
    - `12F5 — Validacao automatizada do adapter/normalizer candidato`, ainda sem aplicar seed/import e sem ativacao automatica.

    ---

    ## Historico anterior — Fase 12F3

    Decisao: `FASE 12F3 CONCLUIDA COMO VALIDACAO TECNICA DOCUMENTAL`.

    Entregue nesta fase:
    - plano principal `docs/review/PLANO_FASE_12F3_VALIDACAO_PAYLOADS_SCHEMA_REAL.md`;
    - evidencia `docs/review/evidence/VALIDACAO_SCHEMA_REAL_PROTOCOLOS_12F3.md`;
    - evidencia `docs/review/evidence/VALIDACAO_SCHEMA_REAL_ITENS_12F3.md`;
    - evidencia `docs/review/evidence/VALIDACAO_SCHEMA_REAL_PRODUCT_CLASS_GROUPS_12F3.md`;
    - evidencia `docs/review/evidence/VALIDACAO_SCHEMA_REAL_SOURCE_REFS_12F3.md`;
    - evidencia `docs/review/evidence/MAPA_AJUSTES_PAYLOADS_12F3.md`;
    - tabelas reais auditadas: `sanitario_protocolos_v2`, `sanitario_protocolo_itens_versions_v2`, `sanitario_product_classes_v2`, `sanitario_product_class_groups_v2`, `sanitario_product_class_group_members_v2` e `sanitario_product_class_default_rules_v2`;
    - identificado que `sanitario_rotation_rules_v2` e `sanitario_source_refs_field_level_v2` nao existem como tabelas reais;
    - divergencias de coluna, enum, JSONB, FK e RLS documentadas;
    - ProductClassGroup members bloqueados ate mapeamento para `class_id`;
    - B19 preservada como regra nacional para femeas bovinas e bubalinas de 3 a 8 meses;
    - aftosa preservada como archived/blocked e `productRequirementKind = none`;
    - zero `agenda_allowed`;
    - zero `approved_for_catalog`.

    Nao implementado nesta fase:
    - seed/import executado;
    - migration;
    - alteracao de schema;
    - codigo funcional/runtime;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Proxima fase segura:
    - `12F4 — Adapter/normalizer de payload candidato para schema real`, ainda sem aplicar seed/import e sem ativacao automatica.

    ---

    ## Historico anterior — Fase 12F2

    Decisao: `FASE 12F2 CONCLUIDA COMO ARTEFATO IMPORTAVEL CANDIDATO`.

    Entregue nesta fase:
    - plano principal `docs/review/PLANO_FASE_12F2_SEED_CANDIDATA_PROTOCOLOS_V2.md`;
    - payload candidato `docs/review/evidence/SEED_PROTOCOLOS_V2_CANDIDATA_12F2.md`;
    - payload candidato `docs/review/evidence/SEED_ITENS_PROTOCOLOS_V2_CANDIDATA_12F2.md`;
    - payload candidato `docs/review/evidence/SEED_PRODUCT_CLASS_GROUPS_CANDIDATA_12F2.md`;
    - payload candidato `docs/review/evidence/SEED_ROTATION_RULES_CANDIDATA_12F2.md`;
    - payload candidato `docs/review/evidence/SEED_SOURCE_REFS_CANDIDATA_12F2.md`;
    - 10 protocolos em payload candidato;
    - 19 itens versionados em payload candidato;
    - 4 ProductClassGroups antiparasitarios fechados;
    - sourceRefs por campo preservados;
    - sourceGaps criticos preservados;
    - fragilidades pre-12F3 registradas, incluindo reconciliacao de ProductClassGroup members contra schema real e changelog 22->19;
    - zero `agenda_allowed`;
    - zero `approved_for_catalog`;
    - aftosa preservada como `archived/blocked`;
    - B19 preservada como regra nacional para femeas bovinas e bubalinas de 3 a 8 meses.

    Nao implementado nesta fase:
    - seed executada;
    - migration;
    - alteracao de schema;
    - codigo funcional/runtime;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Proxima fase segura:
    - `12F3 — Validacao tecnica dos payloads candidatos e reconciliacao contra schema real`, ainda sem aplicar seed/import e sem ativacao automatica.

    ---

    ## Historico anterior — Fase 12F1

    Decisao: `FASE 12F1 CONCLUIDA COMO NORMALIZACAO TECNICA CANDIDATA`.

    Entregue nesta fase:
    - plano principal `docs/review/PLANO_FASE_12F1_NORMALIZACAO_PROTOCOLOS_V2.md`;
    - evidencia `docs/review/evidence/PROTOCOLOS_SANITARIOS_V2_NORMALIZADOS_12F1.md`;
    - evidencia `docs/review/evidence/PROTOCOLO_ITENS_NORMALIZADOS_12F1.md`;
    - evidencia `docs/review/evidence/PRODUCT_CLASS_GROUPS_NORMALIZADOS_12F1.md`;
    - evidencia `docs/review/evidence/ROTATION_RULES_ANTIPARASITARIOS_12F1.md`;
    - evidencia `docs/review/evidence/SOURCE_REFS_FIELD_LEVEL_12F1.md`;
    - 10 protocolos normalizados;
    - 19 itens normalizados;
    - 4 `ProductClassGroup` antiparasitarios fechados;
    - `associacoes_antiparasitarias` marcada como `reserved_candidate`;
    - `rotationRule` antiparasitario padrao definido;
    - `sourceRefs` por campo critico, `sourcePolicy` separada e `sourceGaps` explicitos;
    - nenhum item promovido a `agenda_allowed`;
    - febre aftosa preservada como `archived/blocked` com `productRequirementKind = none`.

    Validacao curatorial final:
    - Brucelose B19 possui regra normativa nacional consolidada para femeas bovinas e bubalinas de 3 a 8 meses.
    - B19 usa `legal_status = obrigatorio_norma_nacional`, `curationStatus = needs_review`, `automationStatus = manual_only`, `allowsAgendaAuto = false` e `agenda_allowed = false`.
    - Bloqueios da B19 permanecem operacionais: `requires_mv_habilitado`, `requires_official_record_flow`, `requires_marking_when_applicable`, `requires_executed_product_snapshot` e `requires_product_catalog_validation`.
    - Aftosa contingencia usa `productRequirementKind = none`, sem produto sugerido.
    - `sourceRef` real foi separado de `sourcePolicy` baseada em produto executado.

    Nao implementado nesta fase:
    - codigo funcional;
    - migration;
    - seed real;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - baixa de estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    Proxima fase autorizavel:
    - `12F2 — Seed/import real candidato dos Protocolos Sanitarios v2, condicionado a revisao tecnica e ainda sem ativacao automatica`.

    ---

    ## Historico anterior — Fase 12F0

    Decisao: `FASE 12F0 CONCLUIDA COMO CATALOGO CURATORIAL CANDIDATO`.

    Entregue nesta fase:
    - plano principal `docs/review/PLANO_FASE_12F0_ESTRUTURACAO_CURATORIAL_PROTOCOLOS_SANITARIOS_V2.md`;
    - evidencia `docs/review/evidence/PROTOCOLOS_SANITARIOS_V2_CANDIDATOS_12F0.md`;
    - evidencia `docs/review/evidence/ITENS_PROTOCOLO_SANITARIO_V2_CANDIDATOS_12F0.md`;
    - evidencia `docs/review/evidence/MAPA_FONTES_PROTOCOLOS_SANITARIOS_V2_12F0.md`;
    - 10 protocolos candidatos classificados;
    - 19 itens candidatos estruturados;
    - ProductRequirement definido por item;
    - ProductClass/ProductClassGroup mapeado quando aplicavel;
    - sourceRefs/source_gaps documentados;
    - nenhum item promovido a `agenda_allowed`;
    - febre aftosa preservada como `archived/blocked`.

    Nao implementado nesta fase:
    - codigo funcional;
    - migration;
    - seed;
    - UI;
    - Dexie/sync;
    - agenda real;
    - evento real;
    - baixa de estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    ## Historico anterior — Fase 12E5

    **Status:** Fase 12E5 concluida localmente - hardening final offline/sync sanitario v2.
    **Foco:** Cursor incremental por `updated_at`, retry/replay seguro de closures, sucesso parcial, bloqueios permanentes de superficie e gate 12F.
    **Criado:** 2026-06-13
    **Atualizado:** 2026-06-13
    **Plano base:** 12E5 - Hardening offline/sync sanitario v2

    ---

    ## Objetivo em 1 paragrafo

    Executar a Fase 12E5 endurecendo a fundacao offline/sync sanitaria v2 antes da 12F: adicionar cursor incremental local por `updated_at` aos pulls sanitarios v2, preservar tombstones, reforcar retry/replay e sucesso parcial de closures, bloquear permanentemente push de `catalog_*` e `state_*`, manter agenda/animais v2 pull-only e documentar o gate tecnico para protocolos. A fase nao estrutura protocolo real, nao cria seed, nao altera UI, nao cria evento sanitario executado, nao baixa estoque, nao calcula carencia ativa e nao libera venda, abate, leite ou aptidao operacional.

    ---

    ## Decisao 12E5

    Decisao: `PROSSEGUIR PARA GATE 12F COM FUNDACAO OFFLINE/SYNC ENDURECIDA`.

    Implementado nesta fase:
    - store Dexie v26 `sync_pull_cursors` para cursores locais por tabela/escopo;
    - pull incremental por `updated_at` para ProductClass v2, catalogo tecnico sanitario v2 com `updated_at` e Agenda Sanitaria v2;
    - full fetch inicial permanece quando nao ha cursor;
    - filtro incremental usa `updated_at >= last_updated_at` para nao perder empates e depende do merge/upsert idempotente local;
    - tombstones com `deleted_at` continuam preservados no pull incremental;
    - `sanitario_produto_fontes_v2` permanece em full fetch/merge porque o contrato local/remoto usado na 12E3 nao possui `updated_at`;
    - bloqueio local explicito de `state_*` como superficie direta de push;
    - testes de retry de rede, replay por `client_op_id`, sucesso parcial e conflito de closure reforcados;
    - sync-batch preserva idempotencia de replay por duplicidade generica de `client_op_id` e continua rejeitando closure ativa duplicada como conflito controlado.

    Gate 12F:
    - `catalog_*` confirmado como pull-only;
    - `state_*` confirmado como read-model, sem superficie direta de push;
    - ProductClass v2 e catalogo tecnico sanitario v2 disponiveis offline e pull-only;
    - Agenda v2 offline/sync estavel como intencao operacional;
    - agenda/animais v2 seguem pull-only;
    - closure pushavel continua restrita a fechamento administrativo sem execucao;
    - closure nao cria evento, estoque, carencia ativa ou liberacao operacional;
    - baseline funcional, sync-batch, lint e build devem passar antes de iniciar 12F;
    - P0 aberto deve bloquear 12F.

    Nao implementado nesta fase:
    - protocolo sanitario real estruturado;
    - seed curatorial;a
    - UI;
    - migration;
    - evento sanitario executado;
    - baixa de estoque;
    - carencia ativa;
    - venda, abate, leite ou aptidao operacional.

    ---

    ## Decisao 12E4

    Decisao: `PROSSEGUIR COM ESCOPO CONTROLADO`.

    Implementado nesta fase:
    - stores Dexie v25 para `ops_sanitario_agenda_v2`, `ops_sanitario_agenda_animais_v2` e `ops_sanitario_agenda_closures_v2`;
    - tipos locais minimos espelhando os campos reais da migration da Agenda Sanitaria v2;
    - `tableMap` remoto -> local para as 3 estruturas `ops_*`;
    - pull especifico `pullSanitarioAgendaV2(fazenda_id)`;
    - pull tenant por `fazenda_id`, sem pull global;
    - ordem de pull `sanitario_agenda_v2` -> `sanitario_agenda_animais_v2` -> `sanitario_agenda_closures_v2`;
    - aplicacao local em modo merge, preservando `updated_at`, `deleted_at`, metadata e vinculos `agenda_id`/`animal_id`;
    - bloqueio local de push para `catalog_*`, `sanitario_agenda_v2` e `sanitario_agenda_animais_v2`;
    - push controlado de `sanitario_agenda_closures_v2`;
    - push de closure bloqueia `executed_with_event`, `partially_executed_with_event` e qualquer `execution_evento_id` preenchido;
    - reconciliacao pos-sync com `pullSanitarioAgendaV2`;
    - sucesso parcial especifico para gestures compostas apenas por closures: aceitas saem de `queue_ops`, rejeitadas permanecem rastreaveis;
    - conflito de closure ativa duplicada mapeado para `sanitario_agenda_closure_already_exists`.

    Nao implementado nesta fase:
    - push de catalogos `catalog_*`;
    - push de `state_*`;
    - push de agenda/animais v2;
    - evento sanitario executado;
    - snapshot tecnico de evento;
    - baixa de estoque;
    - carencia ativa;
    - liberacao de venda, abate, leite ou aptidao operacional;
    - protocolo estruturado real;
    - UI, migration ou seed.

    ---

    ## Evidencia tecnica

    Arquivos gerados/alterados:
    - `src/lib/offline/db.ts`
    - `src/lib/offline/types.ts`
    - `src/lib/offline/tableMap.ts`
    - `src/lib/offline/pull.ts`
    - `src/lib/offline/ops.ts`
    - `src/lib/offline/syncWorker.ts`
    - `src/lib/offline/__tests__/sanitarioAgendaV2Store.test.ts`
    - `src/lib/offline/__tests__/sanitarioAgendaV2Pull.test.ts`
    - `src/lib/offline/__tests__/sanitarioAgendaV2Sync.test.ts`
    - `supabase/functions/sync-batch/index.ts`
    - `supabase/functions/sync-batch/rules.ts`
    - `supabase/functions/sync-batch/rules.test.ts`
    - docs ativos de fase/status/roadmap/dominio

    ---

    ## Criterios de aceitacao da fase

    - [x] Stores Dexie da Agenda Sanitaria v2 criadas.
    - [x] Pull remoto Agenda v2 implementado por fazenda.
    - [x] Pull respeita ordem agenda -> animais -> closures.
    - [x] `deleted_at` e `updated_at` preservados quando existem no contrato remoto.
    - [x] Push controlado implementado somente para closures.
    - [x] Push de closure restrito a fechamento administrativo sem `execution_evento_id`.
    - [x] Idempotencia por `client_op_id` preservada no push de closure.
    - [x] Conflito de closure duplicada tratado como rejeicao controlada.
    - [x] Sucesso parcial tratado para gestures de closures.
    - [x] Nenhum push de `catalog_*` implementado.
    - [x] Nenhum push novo de `state_*` implementado.
    - [x] ProductClass e catalogo tecnico sanitario v2 seguem pull-only.
    - [x] Nenhuma UI alterada.
    - [x] Nenhuma migration criada.
    - [x] Nenhum seed criado.
    - [x] Nenhum protocolo estruturado criado.
    - [x] Nenhum evento sanitario executado criado.
    - [x] Nenhuma baixa de estoque criada.
    - [x] Nenhuma carencia ativa criada.
    - [x] Nenhuma liberacao de venda, abate, leite ou aptidao criada.

    ## Proxima fase segura

    `12E5 - Hardening offline/sync` ou `12F - Estruturacao curatorial dos protocolos`, conforme decisao de gate.
