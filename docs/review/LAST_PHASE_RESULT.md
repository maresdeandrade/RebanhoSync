# Last Phase Result - RebanhoSync

Atualizado em: 2026-06-15

## Resultado mais recente

Fase 12I - Catalogo Sanitario v2 read-only offline-first - concluida localmente.

Decisao: `12I_CATALOGO_SANITARIO_V2_OFFLINE_READ_ONLY`.

## Resultado

- Avanco posterior: criada UI minima read-only em `/protocolos-sanitarios/catalogo-v2` para visualizar o catalogo local Dexie, sem ler JSON/Supabase direto e sem criar agenda, evento, estoque, carencia ativa ou automacao operacional.
- Criados stores Dexie v27 para `catalog_sanitario_protocolos_v2` e `catalog_sanitario_protocolo_itens_versions_v2`.
- Ampliados índices de `catalog_sanitario_product_class_groups_v2` para consulta local do catalogo de protocolos.
- Implementado pull remoto `pullSanitarioProtocolCatalogV2` para protocolos, itens e grupos globais.
- Implementadas funções locais read-only para listar protocolos, itens por protocolo, ProductClassGroups e resumo do catalogo v2.
- B19, aftosa e os 6 itens antiparasitarios com ProductClassGroup foram cobertos por testes locais.
- Nenhum caminho de push, `queue_ops`, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.
- Criado o relatorio unico `docs/review/evidence/RELATORIO_12I_CATALOGO_SANITARIO_V2_OFFLINE_READONLY.md`.

## Validacao

- Diagnostico inicial confirmou carga 12G aplicada: `--dry-run` com 0 `create`, 0 `update`, 33 `skip`, 16 `reject`.
- Testes focados de store, pull, cursor incremental e leitura local passaram.
- Teste focado da UI read-only do catalogo v2 passou.
- Validacoes finais da 12I registradas no relatorio.

## Nao executado

- migration, schema, RLS, UI ampla, Edge Function ou import novo;
- agenda, evento, estoque, carencia ativa ou liberacao operacional;
- ProductClassGroup members;
- push/sync-batch de escrita para catalogos.

## Fonte final

Import futuro continua vinculado exclusivamente ao payload canonico:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`

Leitura 12I usa as tabelas reais importadas pela 12G e cache Dexie pull-only, nao o JSON.

## Proximo passo possivel

Validar a tela read-only em runtime com Dexie local populado, sem agenda automatica.
