# Mapa de ajustes dos payloads 12F3

## Decisao

Os payloads 12F2 devem seguir para 12F4 como entrada de adapter/normalizer. Nenhum payload deve ser aplicado diretamente como seed/import.

## Ajustes obrigatorios para 12F4

| Area | Ajuste | Severidade |
|---|---|---|
| Protocolos | `protocol_key` -> `family_code`; definir `scope`; converter `target_species` para `species_scope` | P1 |
| Protocolos | normalizar `legal_status` para enum SQL real | P0 |
| Protocolos | `approved_for_catalog=false` -> `approval_status='draft'` ou `pending_review` | P1 |
| Protocolos | mover `curationStatus`, `automationStatus`, `agenda_allowed`, `sourceGaps` e `restrictions` para JSONB apropriado | P1 |
| Itens | `protocol_key` -> `protocol_id` por lookup | P0 |
| Itens | `item_version` textual -> `version` inteiro | P0 |
| Itens | `product_class_group` sem suporte SQL | P0 |
| Itens | gerar `species_authorization` array com fonte explicita | P0 |
| Itens | converter `fieldSourceRefs` para `source_refs_by_field` sem misturar gaps/policy | P0 |
| ProductClassGroup | gerar `group_id` real ou lookup por `group_key` | P1 |
| Members | converter `class_key` para `class_id` real | P0 |
| Members | mover principios ativos para metadata, nao para tabela de members | P0 |
| RotationRules | manter documental ou embedar em JSONB | P1 |
| SourceRefs | manter documental ou embedar em JSONB real | P1 |

## Mapeamento de legal_status

| Payload | SQL proposto | Preservacao |
|---|---|---|
| `obrigatorio_norma_nacional` | `obrigatorio_norma` | `legal_scope=nacional` em `jurisdiction_scope`/`metadata` |
| `archived` | `bloqueado` | `status=retired` e `metadata.archived=true` |
| `recomendado_tecnico_regional` | `condicional` ou `recomendado_tecnico` | regionalidade em `jurisdiction_scope`/`metadata` |
| `situacional_tecnico` | `estrategico` ou `condicional` | contexto situacional em `metadata` |

## Mapeamento de ProductRequirement

| Payload | SQL atual | Decisao |
|---|---|---|
| `specific_product` | `specific_product` | permitido se `product_id` real existir |
| `product_class` | `product_class` | permitido se `product_class` real existir |
| `none` | `none` | permitido |
| `product_class_group` | sem suporte | bloquear ou exigir schema/adapter dedicado |

## Itens que exigem bloqueio por ProductClassGroup

Itens antiparasitarios devem permanecer sem import bruto enquanto o schema real nao suportar grupo em item ou enquanto nao houver adapter formal:

- controle parasitario estrategico recria;
- vermifugacao pre-desmama;
- vermifugacao pre-confinamento/pasto vedado;
- matrizes pre-parto quando incluir antiparasitario.

## B19

Manter:

- nacional;
- bovino e bubalino;
- femeas;
- 3 a 8 meses;
- dose unica;
- janela rigida;
- `agenda_allowed=false`;
- `approved_for_catalog=false`;
- bloqueios operacionais: MV habilitado/responsavel, registro oficial, marcacao quando aplicavel, produto real e snapshot.

Ajustar:

- `legal_status` SQL para `obrigatorio_norma`;
- `legal_scope=nacional` fora do enum.

## Aftosa

Manter:

- archived/blocked no contrato curatorial;
- `productRequirementKind=none`;
- sem rotina operacional;
- `agenda_allowed=false`;
- `approved_for_catalog=false`.

Ajustar:

- `legal_status` SQL para `bloqueado`;
- lifecycle em `status=retired` ou metadata, conforme adapter.

## Criterio de saida para 12F4

12F4 deve produzir payload adaptado sem escrever no banco e com relatorio de rejeicoes. Qualquer tentativa de criar agenda, evento, estoque, carencia ativa, venda, abate, leite, seed executada ou migration deve bloquear a fase.

