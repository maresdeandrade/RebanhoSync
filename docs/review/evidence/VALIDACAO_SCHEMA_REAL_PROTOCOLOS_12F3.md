# Validacao schema real — Protocolos 12F3

## Decisao

`SEED_PROTOCOLOS_V2_CANDIDATA_12F2` nao e importavel diretamente em `sanitario_protocolos_v2`. O payload e valido como candidato curatorial, mas exige adapter para colunas, enums, JSONB e RLS.

## Schema real auditado

Tabela: `sanitario_protocolos_v2`.

Colunas principais:

- `id uuid`;
- `family_code text not null`;
- `name text not null`;
- `scope sanitario_protocol_scope_v2_enum not null`;
- `fazenda_id uuid`;
- `species_scope jsonb not null`;
- `jurisdiction_scope jsonb not null`;
- `legal_status sanitario_protocol_legal_status_v2_enum not null`;
- `version integer not null`;
- `status sanitario_protocol_status_v2_enum not null default 'draft'`;
- `source_refs_snapshot jsonb not null`;
- `approval_status sanitario_protocol_approval_status_v2_enum not null default 'draft'`;
- `metadata jsonb not null`;
- `created_at`, `updated_at`, `deleted_at`.

Enums reais:

- `scope`: `global`, `pack`, `fazenda`;
- `legal_status`: `obrigatorio_norma`, `recomendado_tecnico`, `condicional`, `estrategico`, `experimental_alerta`, `bloqueado`;
- `status`: `draft`, `active`, `retired`;
- `approval_status`: `draft`, `pending_review`, `approved`, `rejected`.

## Matriz de campos

| Payload | Coluna real | Status |
|---|---|---|
| `protocol_key` | `family_code` | compativel via adapter |
| `nome`/`name` | `name` | compativel |
| `target_species` | `species_scope` | adapter para JSONB array |
| `legal_status` | `legal_status` | incompatibilidades de enum |
| `version` textual | `version integer` | adapter obrigatorio |
| `curationStatus` | sem coluna | metadata |
| `automationStatus` | sem coluna | metadata |
| `approved_for_catalog` | `approval_status` | boolean deve virar enum |
| `agenda_allowed` | sem coluna | metadata, sempre false |
| `fieldSourceRefs` | `source_refs_snapshot` | adapter obrigatorio |
| `sourceGaps` | `metadata`/`source_refs_snapshot` | adapter obrigatorio |
| `restrictions` | `metadata` | adapter |

## Incompatibilidades bloqueantes

- `obrigatorio_norma_nacional` nao existe no enum SQL. Para B19, usar `obrigatorio_norma` e preservar `legal_scope = nacional` em `jurisdiction_scope`/`metadata`.
- `archived` nao existe em `legal_status`. Para aftosa, usar `legal_status = bloqueado`, `status = retired` e metadata de arquivamento.
- `recomendado_tecnico_regional` e `situacional_tecnico` nao existem no enum SQL. Adapter deve mapear para enum real e preservar o detalhe como metadata.
- `approved_for_catalog=false` nao e coluna; deve virar `approval_status='draft'` ou `pending_review`.

## RLS e constraints

- `scope='fazenda'` exige `fazenda_id`.
- `scope in ('global','pack')` exige `fazenda_id is null`.
- Escrita autenticada comum so e permitida para escopo `fazenda` com permissao de manager/owner.
- Seed/import global ou pack futuro exige caminho privilegiado controlado, fora da 12F3.

## B19

Preservar:

- regra nacional;
- especies `bovino` e `bubalino`;
- sexo `femea`;
- 3 a 8 meses;
- `agenda_allowed=false`;
- `approved_for_catalog=false`.

Ajuste obrigatorio:

- `legal_status` SQL: `obrigatorio_norma`;
- detalhe nacional em `jurisdiction_scope`/`metadata`.

## Aftosa

Preservar:

- `archived/blocked` no contrato curatorial;
- sem produto sugerido;
- `agenda_allowed=false`;
- `approved_for_catalog=false`.

Ajuste obrigatorio:

- SQL `legal_status = bloqueado`;
- `status = retired`;
- arquivamento/bloqueio em `metadata`.

