# Plano Fase 12F9 - Payload JSON completo Protocolos Sanitarios v2

Status: concluido localmente como geracao documental/candidata, sem seed/import.
Data: 2026-06-15

## Escopo

Gerar payloads JSON completos candidatos para:

- `sanitario_protocolos_v2`;
- `sanitario_protocolo_itens_versions_v2`;
- `sanitario_product_class_groups_v2`;
- rejeicoes remanescentes de `sanitario_product_class_group_members_v2`.

## Fora do escopo

- aplicar seed/import;
- inserir dados no banco;
- criar migration nova;
- criar ProductClass, ProductClassGroup, member, `class_id` ou UUID artificial;
- alterar UI, Dexie, sync, Edge Function ou runtime operacional;
- criar agenda, evento, estoque, carencia ativa ou liberacao operacional.

## Criterios

- 10 protocolos candidatos;
- 19 itens candidatos;
- 4 ProductClassGroups candidatos;
- 16 ProductClassGroup members rejeitados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`;
- B19 nacional, femeas bovinas/bubalinas, 3-8 meses, manual only e sem agenda automatica;
- aftosa archived/blocked, `status=retired`, sem produto e sem agenda;
- ProductClassGroup usado apenas por `product_class_group_id` via lookup documental;
- carencia ativa continua dependente de evento executado + produto executado + snapshot.

## Saidas

- `docs/review/evidence/PAYLOAD_JSON_PROTOCOLOS_V2_12F9.json`;
- `docs/review/evidence/PAYLOAD_JSON_ITENS_PROTOCOLOS_V2_12F9.json`;
- `docs/review/evidence/PAYLOAD_JSON_PRODUCT_CLASS_GROUPS_12F9.json`;
- `docs/review/evidence/REJEICOES_PAYLOAD_JSON_12F9.json`;
- `docs/review/evidence/RELATORIO_12F9_PAYLOAD_JSON_COMPLETO.md`;
- `docs/review/evidence/RESULTADO_VALIDACAO_PAYLOAD_JSON_12F9.md`;
- `scripts/codex/validate-sanitario-complete-payloads-12f9.mjs`.

## Decisao

12F9 fica apta como pacote JSON candidato para uma futura fase de import controlado, mas ainda nao executa import nem libera catalogo, agenda ou operacao.
