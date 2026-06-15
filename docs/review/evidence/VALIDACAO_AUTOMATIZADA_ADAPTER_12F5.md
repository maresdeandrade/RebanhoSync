# Validacao automatizada do adapter — 12F5

## Decisao

Validacao automatizada criada e executada com sucesso.

Script:

- `scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs`

Modo:

- somente leitura;
- sem conexao Supabase;
- sem seed/import;
- sem migration;
- sem alteracao de payload.

## Artefatos validados

- `docs/review/PLANO_FASE_12F4_ADAPTER_PAYLOADS_SCHEMA_REAL.md`;
- `docs/review/evidence/ADAPTER_PROTOCOLOS_V2_12F4.md`;
- `docs/review/evidence/ADAPTER_ITENS_PROTOCOLOS_V2_12F4.md`;
- `docs/review/evidence/ADAPTER_PRODUCT_CLASS_GROUPS_12F4.md`;
- `docs/review/evidence/ADAPTER_SOURCE_REFS_ROTATION_RULES_12F4.md`;
- `docs/review/evidence/REJEICOES_PAYLOADS_12F4.md`;
- `docs/review/evidence/PAYLOADS_ADAPTADOS_SCHEMA_REAL_12F4.md`;
- `docs/domain/SANITARIO.md`.

## Resultado

| Classe | Quantidade |
|---|---:|
| PASS | 300 |
| WARNING | 1 |
| FAIL | 0 |

## Status

`PASS`

Nao ha falha P0 bloqueando 12F6.
