# Last Phase Result - RebanhoSync

Atualizado em: 2026-07-17

## Resultado mais recente

Fase 12I - Catalogo Sanitario v2 read-only offline-first, com execução sanitária explícita pós-12I - concluída localmente.

Decisão: catálogo sanitário continua read-only/pull-only; agenda permanece intenção e só vira evento por execução confirmada.

## Resultado

- Catálogo v2 continua disponível localmente/read-only em `/protocolos-sanitarios/catalogo-v2`, sem ler JSON em runtime.
- Criados stores Dexie v27 para `catalog_sanitario_protocolos_v2` e `catalog_sanitario_protocolo_itens_versions_v2`.
- Ampliados índices de `catalog_sanitario_product_class_groups_v2` para consulta local do catalogo de protocolos.
- Implementado pull remoto `pullSanitarioProtocolCatalogV2` para protocolos, itens e grupos globais.
- Implementadas funções locais read-only para listar protocolos, itens por protocolo, ProductClassGroups e resumo do catalogo v2.
- B19, aftosa e os 6 itens antiparasitarios com ProductClassGroup foram cobertos por testes locais.
- Execução sanitária foi adicionada exclusivamente a partir de agenda existente, válida e confirmada, por `executeSanitaryAgendaV2`.
- A execução cria evento sanitário, detalhe e vínculo dos animais afetados; o histórico executado da Central e do animal passa a ler esse fato, nunca a agenda futura.
- Produto real é selecionado de cadastro/insumo sanitário compatível. Sem lote de estoque, o evento é permitido e registra ausência de baixa; com lote, a baixa usa `source_evento_id`.
- Carência ativa só é criada para produto real com regra técnica explícita, aplicabilidade e snapshot suficientes. Não há liberação de venda, abate, leite ou aptidão operacional.
- Retry por `clientOpId + agendaId` não duplica evento, detalhe, movimento de estoque ou carência. Não foi criado `queue_ops` paralelo.
- Criado o relatorio unico `docs/review/evidence/RELATORIO_12I_CATALOGO_SANITARIO_V2_OFFLINE_READONLY.md`.

## Validacao

- Diagnostico inicial confirmou carga 12G aplicada: `--dry-run` com 0 `create`, 0 `update`, 33 `skip`, 16 `reject`.
- Testes focados de store, pull, cursor incremental e leitura local passaram.
- Testes focados de execução, histórico, Agenda e componentes sanitários passaram nas alterações pós-12I.

## Nao executado

- migration, schema, RLS, Edge Function ou import novo;
- execução direta de janela, preview ou pré-checagem;
- baixa sem evento, carência sem evento/produto/regra explícita ou liberação operacional;
- ProductClassGroup members;
- push/sync-batch de escrita para catalogos.

## Fonte final

Import futuro continua vinculado exclusivamente ao payload canonico:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`

Leitura 12I usa as tabelas reais importadas pela 12G e cache Dexie pull-only, nao o JSON.

Atualizacao posterior de saneamento sanitario v2:
- `/protocolos-sanitarios` passou a apontar apenas para o Catalogo Sanitario v2 read-only;
- Pack Oficial, Conformidade e Protocolos da fazenda foram ocultados da superficie principal;
- `raiva_herbivoros` permanece com 3 itens ativos sem duplicidade anual e `matrizes_pre_parto_lepto_reforco_situacional` foi tombstonado para evitar concorrencia com `leptospirose`; o catalogo passou a 20 itens ativos, mantendo `manual_only`, `draft` e `allows_agenda_auto=false`.

## Proximo passo possivel

Validar em runtime o fluxo agenda → execução confirmada → evento → histórico, com produto cadastrado, lote opcional e retry idempotente.
