# Sanitario Protocols v2 - Decision Record 12F10

Data: 2026-06-15
Decisao: `12F10_CONSOLIDAR_ARTEFATOS_CANONICOS_ANTES_DE_12G0`

## Decisoes finais

- A fonte final de payload candidato passa a ser `SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`.
- Os JSONs 12F9 permanecem como evidencia de origem, nao como fonte preferencial para 12G0.
- O pacote canonico preserva 10 protocolos, 19 itens, 4 ProductClassGroups e 16 rejeicoes de members.
- `execute_import=false` permanece obrigatorio ate fase explicita de dry-run/import.
- ProductClassGroup continua como `product_class_group` no item, com `product_class_group_id` por lookup, sem conversao para `product_class`, `specific_product` ou `none`.
- Members continuam bloqueados ate existir `class_id` real.
- `agenda_allowed` e `approved_for_catalog` permanecem falsos.

## Nao decidido

- Nenhum import real foi autorizado.
- Nenhum protocolo foi aprovado para catalogo operacional.
- Nenhuma agenda automatica foi autorizada.
- Nenhum member foi resolvido para `class_id`.

## Fonte final para execucao futura

12G0, se autorizada, deve consumir somente:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`
