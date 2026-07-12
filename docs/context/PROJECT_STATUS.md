# Project Status — RebanhoSync

Atualizado em: 2026-07-12
**Baseline Commit:** `3853b80`

## Objetivo

Registrar o estado vivo do projeto RebanhoSync em formato curto, operacional e útil para agentes, revisões e priorização.

Este documento não é changelog detalhado, auditoria histórica ou roadmap completo.

---

## Status atual

RebanhoSync está em beta interno, com MVP operacional.

A fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado — está concluída localmente.

Foi criada a fase extra 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente — antes da Fase 12.

A Fase 11.5 foi fechada localmente pela 11.5H, reconciliada documentalmente pela 11.5I e rebaselineada estrategicamente pela 11.5J. A Fase 12 foi aberta em 12A documental/diagnóstica, avançou em 12B para modelagem clean/reset documental, em 12C para fundação SQL/RLS/reset controlado, em 12D0 para modelo canônico de protocolo/produto/fonte técnica, em 12D1 para schema/contratos mínimos persistidos, em 12D2 para builders/adapters puros de snapshots técnicos, em 12D3 para extração curatorial de protocolos candidatos v2 para revisão, em 12D4 para rebaseline conceitual das matrizes, em 12D5 para contratos TypeScript puros de ProductClass, ProductClassGroup e ExecutionProductPolicy, em 12D6 para schema SQL, RLS e tabelas no banco de dados para ProductClass, em 12E0 para diagnóstico/contrato offline-sync, em 12E1 para stores Dexie locais de ProductClass v2, em 12E2 para pull remoto ProductClass v2 para cache Dexie local, em 12E3 para base Dexie/pull remoto do catalogo tecnico sanitario v2 ampliado, em 12E4 para base offline/sync controlada da Agenda Sanitaria v2, em 12E5 para hardening final offline/sync sanitario v2, em 12F0-12F9 para curadoria, adapter, migration controlada ProductClassGroup e payload JSON candidato, em 12F10 para consolidacao documental em payload canonico unico, em 12G para implementar e executar localmente o importador controlado com `validate`, `dry-run` e `apply` protegido por flag, em 12H para implementar leitura read-only dos protocolos v2 importados a partir do banco, e em 12I para conectar esse catalogo ao offline-first Dexie em modo pull-only/read-only.

Último gate validado:

- Fase 9A Inventário Operacional concluída localmente;
- unidade de compra/apresentação, unidade base e unidade de consumo/evento separadas;
- custo total, custo por entrada e custo unitário/base separados;
- baixa nutricional idempotente por evento/source validada local e remotamente;
- snapshot econômico preservado como derivado/read-only;
- Fase 9B Relatórios Operacionais de Custo Parcial concluída localmente;
- `inventory.partialCost` implementado como leitura derivada/read model;
- custo conhecido e custo ausente separados;
- `0` tratado como custo válido e `null`/`undefined` como custo ausente;
- baseline funcional Supabase passou após reset local;
- suite global `pnpm test` passou (260 arquivos, 1747 testes);
- lint e build passaram.

Último avanço local:

- Subfase 9C — Sociedade Patrimonial e Classificação Operacional Read-only concluída localmente;
- sociedade patrimonial mapeada em tipos, Dexie, pull/tableMap, migrations/RLS e Registrar;
- participação/sociedade e isolamento por `fazenda_id` confirmados;
- `classificationSnapshot` revisado como leitura/snapshot com `source` e `limitations`;
- teste de contrato adicionado para confirmar que classificação não expõe autorização de venda, abate ou carência;
- nenhum avanço para DRE, ROI, margem, custo por arroba, motor comercial avançado, carência liberatória ou autorização crítica.
- Subfase 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase executada;
- Fase 9 concluída localmente;
- Fase 10A — Diagnóstico UX e mapa de fricção concluída sem patch;
- Fase 10B — Agenda/Registrar: clareza de intenção futura vs execução real concluída localmente.
- Fase 10C — Home/Central Operacional concluída localmente.
- Fase 10D — Animal, Eventos e Histórico concluída localmente.
- Fase 10E — Integração via Histórico para Lotes/Pastos, Relatórios e Compra/Venda concluída localmente.
- Fase 10F — Fechamento da Fase 10 e handoff executada;
- Fase 10 — UX Operacional dos Fluxos Centrais concluída localmente.
- Fase 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado concluída documentalmente.
- Fase 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos concluída localmente.
- Fase 11C — Ocupação, lotação e movimentações concluída localmente.
- Fase 11D — Desempenho read-only se houver fonte suficiente concluída localmente.
- Fase 11E — Relatórios operacionais ampliados concluída localmente.
- Fase 11F — Fechamento documental executada.
- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado concluída localmente.
- Fase 11.5A — Diagnóstico + contrato alvo da Agenda Sanitária v2 concluída localmente.
- Fase 11.5B0 — Contrato bibliográfico de regra sanitária e produto concluída localmente.
- Fase 11.5B1 — Motor puro de elegibilidade sanitária por janela concluída localmente.
- Fase 11.5B1.1 — Hardening de dose múltipla e âncora por evento concluída localmente.
- Fase 11.5C — Demanda sanitária agrupada concluída localmente.
- Fase 11.5D — Preview operacional editável concluída localmente.
- Fase 11.5E — Materialização idempotente da agenda sanitária concluída localmente.
- Fase 11.5F — Execução sanitária como evento concluída localmente em escopo reduzido.
- Fase 11.5G — Semântica final de fechamento da agenda concluída localmente em core puro.
- Fase 11.5H — Fechamento e handoff concluída localmente como etapa documental.
- Fase 11.5I — Reconciliação de contratos normativos pós-Agenda Sanitária v2 concluída localmente.
- Fase 11.5J — Rebaseline estratégico do roadmap técnico executada documentalmente.
- Fase 12A — Auditoria do fluxo legado e decisão de schema da Agenda Sanitária v2 executada documentalmente em escopo reduzido.
- Fase 12B — Modelagem clean da persistência sanitária v2 com liberdade de reset executada documentalmente em escopo reduzido.
- Fase 12C — Migration clean da Agenda Sanitária v2 e reset controlado do legado sanitário executada em escopo reduzido SQL/RLS.
- Fase 12D0 — Modelo canônico de Protocolo Sanitário v2, Produto e Fonte Técnica executada documentalmente em escopo reduzido.
- Fase 12D1 — Schema e contratos mínimos de Produto, Protocolo e Fonte Técnica v2 executada em escopo reduzido SQL/RLS e TypeScript puro.
- Fase 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2 executada em escopo reduzido TypeScript puro.
- Fase 12D3 — Extração curatorial de protocolos candidatos v2 executada documentalmente em escopo reduzido.
- Fase 12D4 — Rebaseline conceitual das matrizes executada documentalmente em escopo reduzido.
- Fase 12D5 — Contratos TypeScript de ProductClass executada em TypeScript puro.
- Fase 12D6 — Schema SQL, RLS e Tabelas para ProductClass executada em escopo reduzido SQL/RLS.
- Fase 12E0 — Diagnóstico técnico e contrato de implementação offline/sync executada documentalmente em escopo reduzido.
- Fase 12E1 — Dexie schema/stores para ProductClass v2 executada localmente em escopo reduzido, criando apenas armazenamento local `catalog_*`.
- Fase 12E2 — Pull remoto ProductClass v2 executada localmente em escopo reduzido, baixando catalogo global e tenant para Dexie sem push, sem `queue_ops` e sem sync-batch ProductClass.
- Fase 12E3 — Catalogo tecnico sanitario v2 ampliado executada localmente em escopo reduzido, criando stores Dexie v24 e pull remoto para 7 tabelas autorizadas, sem push, sem `queue_ops`, sem sync-batch, sem UI, sem migration, sem seed, sem protocolo, sem agenda, sem evento e sem carencia ativa.
- Fase 12E4 — Agenda Sanitaria v2 offline/sync executada localmente em escopo controlado, criando stores Dexie v25 `ops_*`, pull remoto por `fazenda_id` e push controlado somente para closures, sem UI, sem migration, sem seed, sem evento executado, sem estoque, sem carencia ativa e sem protocolo estruturado.
- Fase 12E5 — Hardening final offline/sync sanitario v2 executada localmente, criando cursor Dexie v26 por tabela/escopo, pull incremental por `updated_at` para ProductClass v2, catalogo tecnico sanitario v2 com `updated_at` e Agenda v2, retry/replay seguro de closures, sucesso parcial rastreavel, bloqueio de push por `catalog_*` e `state_*`, e gate tecnico para 12F.
- Fase 12F0 — Estruturacao curatorial dos Protocolos Sanitarios v2 executada documentalmente, classificando 10 protocolos candidatos, itens, ProductRequirement, ProductClass/ProductClassGroup, sourceRefs/sourceGaps e bloqueando `agenda_allowed`.
- Fase 12F1 — Normalizacao dos Protocolos Sanitarios v2 executada documentalmente, criando artefatos estruturados para futura seed/importacao candidata, com 10 protocolos, 19 itens, 4 ProductClassGroups antiparasitarios, rotationRule e sourceRefs por campo, sem seed real, migration, UI, runtime, agenda, evento, estoque ou carencia ativa.
- Fase 12F2 — Seed/import candidata dos Protocolos Sanitarios v2 executada documentalmente, criando payloads para protocolos, itens, ProductClassGroups/membros, rotationRules e sourceRefs field-level, sem executar seed/import, sem migration, sem schema/runtime/UI/Dexie/sync, sem agenda, evento, estoque, carencia ativa ou liberacao operacional.
- Fase 12F3 — Validacao tecnica dos payloads candidatos contra schema real executada documentalmente, auditando tabelas SQL/contratos TypeScript, bloqueando import bruto por divergencias de enum/coluna/FK/ProductClassGroup/sourceRefs e autorizando somente proxima fase de adapter/normalizer sem seed/import.
- Fase 12F4 — Adapter/normalizer dos payloads candidatos para schema real executada documentalmente, classificando 10 protocolos, 13 itens e 4 grupos como adaptaveis, rejeitando 6 itens ProductClassGroup e bloqueando 16 members sem `class_id`, sem seed/import, migration, schema, runtime, UI, Dexie, sync, agenda, evento, estoque ou carencia ativa.
- Fase 12F5 — Validacao automatizada do adapter/normalizer candidato executada com script local somente leitura, retornando 300 PASS, 1 WARNING e 0 FAIL, sem seed/import, migration, schema, runtime funcional, UI, Dexie, sync, agenda, evento, estoque ou carencia ativa.
- Fase 12F6 — Decisao estrutural ProductClassGroup em itens executada documentalmente, recomendando futura migration com enum `product_class_group`, coluna `product_class_group_id`, FK para `sanitario_product_class_groups_v2(id)` e CHECK de requisito unico, sem aplicar migration, seed/import, runtime, UI, Dexie, sync, agenda, evento, estoque ou carencia ativa.
- Fase 12F7 — Migration controlada ProductClassGroup em itens executada localmente, adicionando enum `product_class_group`, coluna `product_class_group_id`, FK, CHECK e trigger de validacao de grupo ativo/escopo/status, sem seed/import, UI, Dexie, sync, agenda, evento, estoque ou carencia ativa.
- Fase 12F8 — Revalidacao do adapter ProductClassGroup executada localmente, adaptando documentalmente os 6 itens antiparasitarios antes rejeitados com `product_class_group_id` por lookup, elevando itens adaptaveis para 19 e mantendo 16 members bloqueados sem `class_id`, sem seed/import, migration nova, UI, Dexie, sync, agenda, evento, estoque ou carencia ativa.
- Fase 12G — Importador controlado dos Protocolos Sanitarios v2 executada localmente, criando `scripts/codex/import-sanitario-protocols-v2.mjs` com modos `--validate`, `--dry-run` e `--apply`; apply real executado com 33 `create`, 0 `update`, 0 `skip`, 16 `reject`; dry-run pos-apply confirmou 0 `create`, 0 `update`, 33 `skip`, 16 `reject`; members seguem rejeitados, sem agenda, evento, estoque, carencia ativa ou liberacao operacional.
- Fase 12H — Leitura read-only dos Protocolos Sanitarios v2 importados executada localmente, criando `src/lib/sanitario/catalog/sanitaryProtocolCatalogV2.ts` para consultar banco, listar protocolos, itens e ProductClassGroups, montar resumo read-only e validar B19/aftosa/antiparasitarios sem agenda, evento, estoque, carencia ativa ou liberacao operacional.
- Fase 12I — Catalogo Sanitario v2 read-only offline-first executada localmente, criando stores Dexie v27 para protocolos e itens, pull remoto `pullSanitarioProtocolCatalogV2`, leitura local Dexie e testes de store/pull/cursor/resumo, sem push, `queue_ops`, agenda, evento, estoque, carencia ativa ou liberacao operacional.
- Avanco UI pos-12I — Superficie read-only `/protocolos-sanitarios/catalogo-v2` criada para consultar o catalogo sanitario v2 local/offline, exibindo resumo, protocolos, itens e bloqueios sem ler JSON/Supabase direto e sem criar automacao operacional.
- Saneamento sanitario v2 pos-12I — A superficie `/protocolos-sanitarios` passou por saneamento inicial para consulta segura do Catalogo Sanitario v2, ocultando Pack Oficial, Conformidade e Protocolos da fazenda enquanto nao havia Central operacional. O protocolo `raiva_herbivoros` mantem tres itens ativos sem duplicidade anual: dose inicial, reforco 30d e reforco anual em area de risco. O item antigo `raiva_area_risco_anual` e o item concorrente `matrizes_pre_parto_lepto_reforco_situacional` foram tombstonados por import controlado idempotente; o catalogo ativo fica com 20 itens, sem agenda, evento, estoque, carencia ativa ou liberacao operacional.
- Avanco UI sanitario pos-12I — A rota `/protocolos-sanitarios` passou a atuar como Central Sanitaria v2, com abas para Janelas sanitarias, Agenda sanitaria local, Catalogo, Historico e conformidade futura/desabilitada. A Central le agenda local em `ops_sanitario_agenda_v2`, permite reagendar/cancelar somente agendas nao executadas e mantem execucao bloqueada. Foram adicionados contexto operacional explicito para pre-checagem, historico sanitario de entrada separado por origem/evidencia, pendencias documentais, filtro inicial por animal/lote via query params e badges de filtro ativo, sem migration, schema/RLS/Edge, evento, estoque, carencia ativa, push ou `queue_ops`.
- Avanco UX sanitario contextual pos-12I — As abas Sanidade de `AnimalDetalhe` e `LoteDetalhe` foram compactadas para resumo operacional contextual. O animal/lote mostram resumo, pendencias principais, historico de entrada quando aplicavel, agenda futura e atalhos para a Central Sanitaria filtrada. Preview completo, listas extensas, bloqueadas/nao aplicaveis e botoes por item ficam fora da visualizacao padrao ou em detalhe tecnico fechado. A Central continua sendo a superficie principal para janelas, elegibilidade, preview completo e planejamento agrupado.

Último avanço local da Fase 10:

- Home usa `Registrar execucao` como CTA principal;
- Home reforça que agenda é pendência e Registrar grava execução real;
- atalhos da Home indicam registro de evento executado, sem autorizar venda, abate ou carência;
- painel da Central explicita estados completo, parcial, vazio e bloqueado;
- sinais auxiliares seguem leitura read-only, sem persistir tags e sem autorização operacional;
- testes focados de Home e OperationalInsights passaram;
- nenhuma regra crítica nova foi criada;
- nenhum cálculo de insight/relatório foi alterado;
- nenhuma alteração em Supabase/RLS/migrations/RPC/sync.
- AnimalDetalhe diferencia `Estado atual` de histórico e reforça que status/classificação não autorizam venda ou abate;
- venda no detalhe do animal e quick action de Registrar aparecem como registro manual;
- Eventos explicita histórico de eventos executados e novo registro manual;
- nenhum cálculo de classificação, evento ou relatório foi alterado;
- nenhuma alteração em Supabase/RLS/migrations/RPC/sync.
- Lotes/Pastos reforçam estado atual/read model e histórico de movimentos/manejos executados;
- Relatórios reforçam leitura derivada/parcial, sem DRE, ROI, margem ou custo por arroba;
- Compra/Venda aparece como registro manual informado pelo usuário, sem recomendação ou autorização comercial;
- histórico operacional foi usado como ponte entre 10D e os fluxos finais da 10E;
- nenhum cálculo de relatório/insight/classificação foi alterado;
- nenhuma alteração em Supabase/RLS/migrations/RPC/sync.

Último avanço local da Fase 11:

- leituras de lote/pasto/desempenho preservam fonte explícita, período e limitação;
- `state_*` permanece estado atual/read model;
- eventos permanecem histórico/fato executado;
- `state_pasto_ocupacoes` permanece read model parcial de ocupação atual;
- GMD depende de pesagens explícitas válidas;
- GMD agregado de lote/pasto permanece parcial sem permanência comprovada no período;
- UA/ha depende de `area_ha` válida e peso explícito;
- relatórios operacionais ampliados declaram fonte, período e limitação;
- custo operacional parcial não é DRE, ROI, margem ou custo por arroba;
- nenhuma alteração em Supabase/RLS/migrations/RPC/schema/sync/edge functions.

Último avanço local da Fase 11.5:

- 11.5H fechou documentalmente a Agenda Sanitária v2;
- contratos 11.5A a 11.5G foram consolidados;
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` permanecem comandos/intenção de core puro;
- Agenda permanece intenção/tarefa futura;
- Evento permanece fato histórico executado;
- fechamento administrativo permanece estado da intenção, sem virar histórico sanitário;
- `completed` sanitário depende de evento compatível;
- baixa de estoque depende de evento real;
- carência depende de produto executado e fonte técnica explícita;
- venda, abate e aptidão operacional seguem bloqueados sem fonte técnica explícita;
- persistência, sync, schema, RLS, UI, RPC, Edge Functions, Dexie e seed continuam fora do implementado na 11.5;
- riscos residuais para persistência real, fluxo legado de agenda, `status='concluido'`, replay/rollback/idempotência e RLS/multi-tenant foram documentados.
- 11.5I alinhou docs normativos e skills de agente aos contratos da Agenda Sanitária v2.
- 11.5J reordenou o roadmap técnico para aplicar a fundação sanitária antes de Compra/Venda, KPIs, financeiro e decisão assistida.

- 12E4 implementou base Dexie v25 e sync controlado para Agenda Sanitaria v2 em stores `ops_*`, com pull por `fazenda_id` na ordem agenda -> animais -> closures, push limitado a `sanitario_agenda_closures_v2`, conflito de closure duplicada rastreavel e sucesso parcial de closures, sem evento executado, estoque, carencia ativa, UI, migrations, seed ou protocolo estruturado;
- 12E5 implementou hardening offline/sync sanitario v2 com `sync_pull_cursors`, pull incremental por `updated_at`, tombstones preservados, replay seguro de closures, sucesso parcial rastreavel, bloqueio direto de push para `state_*`, catálogos pull-only preservados e gate 12F documentado;
- 12E3 implementou base Dexie v24 e pull remoto para o catalogo tecnico sanitario v2 ampliado em 7 stores `catalog_*`, com fonte tecnica global consultada por `scope='global'`/`fazenda_id is null`, fonte da fazenda por `scope='fazenda'`/`fazenda_id`, demais tabelas autorizadas sem filtro tenant artificial, preservando tombstones e sem implementar push, `queue_ops`, sync-batch, UI, migrations, seed, protocolo, agenda, evento ou carência ativa;
- 12E2 implementou pull remoto ProductClass v2 para Dexie local, com consulta global separada (`scope='global'`, `fazenda_id is null`) e consulta tenant separada (`scope='tenant'`, `fazenda_id` atual), preservando tombstones e sem implementar push, `queue_ops`, sync-batch ProductClass, UI, migrations, seed, protocolo, agenda, evento ou carência ativa;
- 12E1 criou a base Dexie local ProductClass v2 em stores `catalog_*`, com tipos locais mínimos, índices de consulta futura e testes de armazenamento global/tenant, sem pull, push, sync-batch, UI, migrations, seed, protocolo, agenda, evento ou carência ativa;
- 12E0 executou o diagnóstico técnico e contrato de implementação para o offline/sync, desenhando o mapeamento de 17 estruturas sanitárias v2 Supabase/Dexie, delineando estratégias para pull/push globais (pull-only) vs tenant (`scope = 'tenant'`), tombstones de soft-delete, idempotência por client_op_id e formalizando a progressão em subfases curtas (12E1 -> 12E2 -> 12E3 -> 12E4);
- 12D6 executou a criação do schema de banco de dados, RLS e tabelas para ProductClass, ProductClassGroup, memberships e regras default, com validações triggers BEFORE, grants mínimos, soft-delete RLS, e índices parciais separados para global/tenant;
- 12D5 executou a implementação pura em TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy, com validações de tempo de execução robustas para fixed_by_protocol, verificação de coerência profunda entre campos legados e o novo campo estruturado productRequirementRule, e versionamento semântico integrado;
- 12D4 executou rebaseline conceitual das matrizes: ProductClass como entidade central, ProductClassDefaultRule com can_validate_execution=false invariável, SanitaryProduct como exemplo/execução, enums canônicos (CurationStatus/AutomationStatus/ExecutionProductPolicy) aplicados, approved_for_seed substituído por approved_for_catalog, bulas corrigidas para produto-específicas;
- 12D3 executou extração curatorial de protocolos sanitários candidatos v2: 21 protocolos, 23 itens, 14 produtos/classes e 15 fontes técnicas extraídas em 4 matrizes revisáveis; nenhuma linha é seed final, nenhuma agenda foi criada, nenhuma carência foi liberada, bubalino não herdou autorização bovina, itens experimentais/alerta ficaram bloqueados; próxima fase segura é 12D4 — revisão técnico-veterinária das matrizes;
- 12D2 criou builders puros de `AgendaTechnicalSnapshot` e `EventTechnicalSnapshot` e adapter puro para payload técnico de `sanitario_agenda_v2`; produto planejado não vira produto executado; guideline isolado não libera campo crítico; testes sentinela dos builders passaram;
- contratos TypeScript puros v2 e validadores mínimos foram criados em `src/lib/sanitario/rules`;
- snapshots técnicos mínimos de agenda e evento foram tipados;
- testes sentinela v2 validam que guideline isolado não libera campo crítico, bubalino não herda autorização bovina, carência zero exige fonte forte, produto planejado não vira produto executado e agenda não carrega carência ativa;
- legados `produtos_veterinarios`, `protocolos_sanitarios`, `protocolos_sanitarios_itens` e catálogos oficiais seguem operacionais por dependência ativa, mas foram marcados como não-canônicos para v2;
- Dexie, sync-batch, UI, seed curatorial, agenda automática, evento, estoque, venda, abate, aptidão e rastreabilidade animal não foram alterados;
- 12D0 definiu o modelo canônico documental para fonte técnica, produto sanitário, regra de carência, protocolo versionado, item versionado, espécie bovino/bubalino e snapshots técnicos;
- o guideline curatorial de vacinação, imunização e controle parasitário foi localizado como Markdown em `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`; o PDF citado no prompt não existe no workspace;
- guideline foi usado como fonte de casos e validação estrutural, não como seed final, protocolo automático ou fonte única para dose, via, carência ou autorização de espécie;
- dose, via, carência, espécie autorizada e obrigatoriedade legal continuam exigindo fonte forte por campo;
- bubalino não herda autorização de bovino por padrão;
- itens experimentais/alerta não viram protocolo automático;
- próxima fase segura passou a ser 12D1 — contrato persistido/migration de produto, protocolo e fonte técnica, antes de offline/sync;
- 12C criou a fundação SQL/RLS da Agenda Sanitária v2;
- migration nova `20260606090000_sanitario_agenda_v2_clean_foundation.sql` criou `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`;
- enums v2 foram criados sem reutilizar `agenda_status_enum` e sem valor `concluido`;
- constraints mínimas impedem fechamento com/sem evento inválido, cancelamento/dispensa sem motivo, parcial sem distinção de executados/não executados, animal executado sem evento e animal não executado sem motivo;
- RLS e policies por membership foram criadas para as tabelas v2;
- `agenda_itens` sanitário legado foi resetado por soft-delete operacional e nova escrita sanitária legada em `agenda_itens` foi bloqueada por trigger;
- `sanitario_recompute_agenda_core` virou no-op com validação de membership para impedir repovoamento do legado;
- fatos executados em `eventos`, `eventos_sanitario` e `insumo_movimentacoes` não foram apagados nem alterados;
- Dexie, sync-batch, UI e seed funcional não foram conectados na 12C.
- 12B documentou a decisão clean/reset para a persistência sanitária v2;
- `agenda_itens` sanitário deixou de ser superfície sanitária alvo e foi classificado como legado descartável;
- modelo alvo definido com `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`;
- reset controlado autorizado para agenda sanitária antiga, `state_agenda_itens` sanitário, filas antigas incompatíveis, payload/dedup/status sanitário legado e seeds/demo sanitários obsoletos;
- `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, protocolos históricos e catálogos técnicos usados por eventos reais seguem preservação obrigatória;
- execução real continua exclusivamente em `eventos` + `eventos_sanitario`;
- fechamento administrativo não cria evento;
- baixa de estoque continua dependente de evento real;
- carência continua dependente de produto executado + fonte técnica explícita;
- nenhuma migration, RLS, Dexie, sync-batch, UI, seed ou regra funcional foi implementada.
- 12A documentou a auditoria do fluxo legado sanitário sem alterar código funcional;
- fluxo atual confirmado: `protocolos_sanitarios_itens -> sanitario_recompute_agenda_core -> agenda_itens/state_agenda_itens -> eventos/eventos_sanitario -> insumo_movimentacoes`;
- `status='concluido'` legado confirmado como ambíguo e insuficiente para `completed` sanitário v2;
- `source_evento_id` confirmado como vínculo factual quando há execução real;
- baixa de estoque permanece dependente de evento real;
- decisão recomendada de schema: criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória;
- dados factuais (`eventos`, `eventos_sanitario`, `insumo_movimentacoes`) não podem ser apagados em migration comum;
- dados antigos de agenda sanitária materializada por motor legado podem ser resetados/arquivados apenas em rollout controlado e documentado;
- testes sentinela futuros definidos para retry, replay, conflitos, RLS/FK, fechamento administrativo e preservação de dados factuais.

Próximo foco sugerido:

- preparar 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2;
- manter offline/sync da Agenda Sanitária v2 para fase posterior à estabilização dos builders/snapshots;
- manter UI ampla, carência ativa, venda, abate e aptidão fora do escopo até decisão explícita de implementação.

Realidade validada para o roadmap pós-Fase 9:

- Fase 5 Sanitário/Exceções/Reconciliação: concluída; só hardening residual.
- Fase 6 Robustez Sanitária/RLS/sync: hardening residual, não fase de produto nova.
- Fase 7 Compra/Venda/Sociedade: parcial; tratar lacunas e hardening, não criação do zero.
- Fase 8 Relatórios/Baseline: parcial; base para KPIs operacionais read-only ampliados.
- Fase 9A e 9B: concluídas localmente.
- Fase 9C: concluída localmente.
- 9D: executada.
- Fase 9: concluída localmente.

Sequência corrigida pós-Fase 9:

1. Fase 10 — UX Operacional dos Fluxos Centrais: concluída localmente.
2. Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado: concluída localmente.
3. Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente: fechada localmente pela 11.5H, reconciliada pela 11.5I e rebaselineada pela 11.5J.
4. Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout: 12A documental/diagnóstica, 12B modelagem clean/reset, 12C fundação SQL/RLS e 12D0 modelo canônico de protocolo/produto/fonte executadas; Dexie/sync/UI ainda não conectados.
5. Fase 13 — Reprodução Operacional v1.
6. Fase 14 — Compra/Venda Operacional: Hardening e Lacunas.
7. Fase 15 — Relatórios/KPIs Operacionais Read-only Ampliados.
8. Fase 16 — Financeiro Gerencial Explícito.
9. Fase 17 — Motor de Decisão Assistida.
10. Fase 18 — Beta Externo / SLC / Hardening de Produto.

---

## Produto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

Foco atual:

- produtor pequeno/médio;
- operação de campo;
- manejo prático;
- baixa fricção;
- funcionamento offline;
- sincronização confiável;
- gestão de rebanho, fazenda, agenda, eventos e rotinas.

Não é objetivo imediato virar ERP fiscal completo.

---

## Stack principal

- React;
- TypeScript;
- Vite;
- Dexie/IndexedDB;
- Supabase/Postgres/Auth/RLS;
- sync local-remoto por gestures/transações;
- Vitest/Testing Library;
- pnpm.

---

## Princípios técnicos atuais

- Offline-first.
- RLS como barreira real.
- Multi-tenant por `fazenda_id`.
- Operações idempotentes.
- Rollback determinístico quando aplicável.
- Separação entre UI, domínio, offline/sync e Supabase.
- Patches pequenos, reversíveis e testáveis.
- Não refatorar por conveniência.

---

## Contratos de domínio vigentes

- Agenda = intenção/tarefa futura.
- Evento = fato histórico executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Tags, sinais e insights = auxiliares de UX/consulta.
- Decisões críticas exigem fonte técnica explícita.

Detalhes:

- `docs/context/SOURCE_OF_TRUTH.md`
- `docs/context/KNOWN_GAPS.md`

---

## Áreas funcionais em foco

### Agenda

Papel:

- tarefas futuras;
- pendências;
- vencimentos;
- próximos manejos.

Risco principal:

- ser tratada indevidamente como histórico.

---

### Eventos

Papel:

- fatos executados;
- histórico;
- KPIs;
- auditoria.

Risco principal:

- evento sem detail suficiente ser tratado como resposta completa.

---

### Animais

Papel:

- cadastro;
- identidade;
- estado atual;
- origem/destino;
- status operacional.

Riscos principais:

- duplicidade de identidade;
- status atual sem evento/fonte adequada;
- inferência indevida de peso/venda/abate.

---

### Sanitário

Papel:

- agenda sanitária;
- registro operacional;
- produtos;
- protocolos;
- estoque/custo quando aplicável;
- compliance/regulatório como camada separada.

Riscos principais:

- protocolo como execução;
- agenda como histórico;
- carência inferida;
- compliance como bloqueio universal sem fonte explícita.

Estado validado em 2026-06-02:

- correção sanitária permanece append-only;
- replay corretivo usa `idempotency_key` determinístico;
- evento original não deve ser editado por correção;
- payload corretivo legado sem contrato completo fica parcial, com limitações explícitas.
