# Plano Fase 12F6 — Decisao ProductClassGroup em Itens de Protocolo

Atualizado em: 2026-06-15

## 1. Decisao executiva

Decisao: `RECOMENDAR OPCAO A — SUPORTE DIRETO A PRODUCT_CLASS_GROUP NO ITEM`.

A 12F6 e uma fase documental de decisao estrutural. Nenhuma migration foi criada, nenhum enum foi alterado, nenhum schema foi aplicado e nenhum payload foi importado.

A recomendacao tecnica para a fase futura 12F7 e:

- adicionar `product_class_group` ao enum SQL `sanitario_product_requirement_kind_v2_enum`;
- adicionar `product_class_group_id uuid null` em `sanitario_protocolo_itens_versions_v2`;
- referenciar `sanitario_product_class_groups_v2(id)` por FK com `on delete restrict`;
- atualizar o CHECK de requisito de produto para exigir exatamente uma referencia entre produto especifico, classe tecnica, grupo de classes ou nenhuma;
- preservar lookup semantico `productClassGroupKey -> product_class_group_id` no adapter/import futuro;
- manter itens antiparasitarios bloqueados ate existir migration, adapter validado, RLS revisada e testes sentinela.

## 2. Escopo e nao escopo

Escopo executado:

- comparar opcoes estruturais A, B, C e D;
- reconciliar a decisao com schema SQL real, contratos TypeScript e artefatos 12F4/12F5;
- definir contrato de schema futuro;
- definir criterios para 12F7.

Nao escopo executado:

- migration;
- alteracao de enum SQL;
- alteracao de tabela, constraint, FK, RLS ou policy;
- alteracao de Dexie, sync, UI ou runtime funcional;
- seed/import real;
- agenda, evento, estoque, carencia ativa ou liberacao operacional.

## 3. Contexto confirmado

12F4 classificou 6 itens antiparasitarios como rejeitados por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`:

- `recria_maio`;
- `recria_julho`;
- `recria_setembro`;
- `pre_desmama_situacional`;
- `pre_confinamento_dose_unica`;
- `matrizes_pre_parto_antiparasitario`.

12F5 validou automaticamente que:

- existem 10 protocolos adaptaveis;
- existem 13 itens adaptaveis;
- existem 6 itens rejeitados;
- existem 4 ProductClassGroups adaptaveis parcialmente;
- existem 16 ProductClassGroup members bloqueados por ausencia de `class_id`;
- nao ha `agenda_allowed`;
- nao ha `approved_for_catalog`.

## 4. Diagnostico do schema real

Tabela de destino: `sanitario_protocolo_itens_versions_v2`.

Estado atual:

- `product_requirement_kind` usa enum SQL com `specific_product`, `product_class` e `none`;
- existe `product_id uuid`;
- existe `product_class text`;
- nao existe `product_class_group_id`;
- CHECK atual valida apenas os tres modos existentes;
- RLS de item e governada por visibilidade/escrita do protocolo.

Tabelas ProductClassGroup reais:

- `sanitario_product_class_groups_v2` possui `id`, `scope`, `fazenda_id`, `group_key`, `name`, status curatoriais e metadata;
- `sanitario_product_class_group_members_v2` exige `group_id` e `class_id`;
- members continuam bloqueados ate existir `class_id` real para cada ProductClass.

Contrato TypeScript:

- `SanitaryProductRequirementRuleV2` ja aceita `product_class_group`;
- o validador exige `productClassGroupKey`, classes permitidas e `executionProductPolicy` compativel;
- o contrato TS nao elimina a necessidade de suporte SQL real para import.

## 5. Opcoes avaliadas

| Opcao | Decisao | Resultado |
|---|---|---|
| A — enum + coluna direta `product_class_group_id` no item | Recomendada | Preserva semantica, simplifica adapter e permite FK clara. |
| B — tabela ponte item -> grupos | Nao recomendada para 12F7 | Mais flexivel, mas adiciona joins, RLS e sync mais complexos sem necessidade atual. |
| C — manter itens antiparasitarios fora do import | Aceitavel como fallback temporario | Conserva seguranca, mas deixa 6 itens bloqueados e nao resolve o contrato. |
| D — converter grupo em classe/produto/none | Rejeitada | Perda semantica e risco sanitario. |

## 6. Contrato futuro recomendado

Mudanca futura proposta, ainda nao aplicada:

```sql
alter type public.sanitario_product_requirement_kind_v2_enum
  add value if not exists 'product_class_group';

alter table public.sanitario_protocolo_itens_versions_v2
  add column if not exists product_class_group_id uuid null
    references public.sanitario_product_class_groups_v2(id) on delete restrict;
```

CHECK futuro esperado:

```txt
specific_product:
  product_id not null
  product_class is null
  product_class_group_id is null

product_class:
  product_id is null
  product_class not null
  product_class_group_id is null

product_class_group:
  product_id is null
  product_class is null
  product_class_group_id not null

none:
  product_id is null
  product_class is null
  product_class_group_id is null
```

## 7. Validacao de escopo e RLS futura

Como CHECK SQL nao cruza linhas/tabelas, a compatibilidade entre protocolo e grupo deve ser validada por trigger, RPC de import ou adapter privilegiado.

Regras futuras:

- protocolo `global` ou `pack` pode referenciar apenas grupo `global` enquanto nao houver contrato pack-scoped;
- protocolo `fazenda` pode referenciar grupo `global` ou grupo `tenant` da mesma `fazenda_id`;
- grupo referenciado deve ter `deleted_at is null`;
- grupo bloqueado/archived nao deve permitir agenda automatica;
- item segue `allows_agenda_auto=false` ate autorizacao explicita futura.

## 8. Impacto em adapter/import futuro

O adapter 12F7 deve:

- resolver `productClassGroupKey` para `product_class_group_id`;
- rejeitar chave ausente ou ambigua;
- nao inventar UUID;
- nao usar principios ativos como FK;
- nao converter `product_class_group` para `product_class`, `specific_product` ou `none`;
- preservar `rotationRule` em JSONB;
- preservar `sourceRefs`, `sourceGaps` e `sourcePolicy` separados.

## 9. Impacto em ProductClassGroup members

Members continuam com bloqueio separado.

Mesmo com `product_class_group_id` no item, os registros de `sanitario_product_class_group_members_v2` ainda exigem `class_id` real. A 12F7 pode liberar a FK do item para o grupo, mas nao deve liberar members sem reconciliar ProductClass reais.

## 10. Invariantes sanitarios preservados

- Agenda = intencao futura.
- Evento = fato executado.
- Protocolo = regra/configuracao.
- ProductClassGroup nao valida execucao.
- ProductClass nao valida dose ou carencia.
- Produto real continua obrigatorio na execucao quando houver vacina/antiparasitario.
- Dose exige peso e produto real quando aplicavel.
- Carencia ativa nasce somente de evento executado com produto real e snapshot tecnico.
- Leite, gestacao e lactacao exigem bula ou MV.
- Bubalino exige fonte explicita.
- Repetir classe antiparasitaria exige justificativa/MV.
- Combinacao exige bula propria.

## 11. Bloqueios preservados

P0 para seed/import real:

- itens `product_class_group` nao podem ser importados no schema atual;
- ProductClassGroup members nao podem ser importados sem `class_id`;
- nenhuma agenda automatica pode ser criada a partir desses itens;
- nenhum protocolo pode ser aprovado por esta decisao.

P1 para 12F7:

- definir migration idempotente e reversivel;
- validar enum, coluna, FK e CHECK;
- validar RLS e caminho privilegiado para catalogo global;
- atualizar adapter e validadores automatizados.

## 12. Criterios para 12F7

12F7 pode avancar apenas como migration controlada de schema se:

- mantiver zero seed/import real;
- alterar somente schema necessario para representar `product_class_group`;
- atualizar testes SQL/TS de requisito de produto;
- preservar `allows_agenda_auto=false`;
- preservar `approved_for_catalog=false`;
- bloquear qualquer item com grupo ausente, excluido, fora de escopo ou sem lookup unico;
- nao tocar UI, Dexie, sync ou runtime operacional sem fase propria.

## 13. Resultado da fase

Fase 12F6 concluida como decisao estrutural documental.

Proxima fase segura: `12F7 — Migration controlada para suportar ProductClassGroup em itens de protocolo sanitario v2`, ainda sem seed/import real e sem ativacao automatica.
