# Relatorio 12F9 - Payload JSON completo Protocolos Sanitarios v2

Data: 2026-06-15
Decisao: `FASE 12F9 CONCLUIDA COMO GERACAO JSON CANDIDATA NAO DESTRUTIVA`.

## Resultado

A 12F9 gerou payloads JSON completos candidatos para futura importacao controlada, ainda sem executar import real:

- 10 protocolos em `sanitario_protocolos_v2`;
- 19 itens em `sanitario_protocolo_itens_versions_v2`;
- 4 ProductClassGroups em `sanitario_product_class_groups_v2`;
- 16 ProductClassGroup members rejeitados por falta de `class_id` real.

Todos os artefatos mantem `execute_import=false`.

## Preservacoes

- B19 permanece nacional, para femeas bovinas/bubalinas de 3 a 8 meses, `manual_only`, sem agenda automatica e sem dependencia estadual.
- Febre aftosa permanece `archived/blocked`, `legal_status=bloqueado`, `status=retired`, `product_requirement_kind=none`, sem produto sugerido e sem agenda.
- Os 6 itens antiparasitarios usam `product_requirement_kind=product_class_group` e `product_class_group_id` por lookup documental de `group_key`.
- ProductClassGroup nao valida execucao, dose ou carencia; produto real continua obrigatorio no evento.
- Carencia ativa nao foi criada; withdrawal permanece em `source_refs_by_field`, `limitations`, `sourceGaps` e `sourcePolicy`, dependendo de evento executado + produto executado + snapshot.

## Bloqueios mantidos

Os 16 members de ProductClassGroup continuam bloqueados por:

`PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`

Nao foi criado `class_id`, ProductClass, member real, UUID artificial ou FK baseada em principio ativo.

## Nao executado

- seed/import real;
- insercao no banco;
- migration nova;
- alteracao de RLS/schema/runtime operacional;
- UI, Dexie, sync ou Edge Function;
- agenda, evento, estoque, carencia ativa ou liberacao operacional.

## Proxima fase

12G0 deve resolver o import controlado somente se existir uma decisao explicita para executar carga real, com dry-run/transacao/rollback e sem promover `agenda_allowed` ou `approved_for_catalog`.
