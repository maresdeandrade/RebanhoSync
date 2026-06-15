# Plano Fase 12F8 — Revalidacao Adapter ProductClassGroup

Atualizado em: 2026-06-15

## 1. Decisao executiva

Decisao: `FASE 12F8 CONCLUIDA COMO REVALIDACAO NAO DESTRUTIVA DO ADAPTER`.

A 12F8 revalidou o adapter 12F4/12F5 contra o schema atualizado pela 12F7 e adaptou documentalmente os 6 itens antiparasitarios antes rejeitados por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`.

Esta fase nao executa seed/import, nao cria migration nova e nao altera runtime operacional.

## 2. Escopo executado

Executado:

- validacao da migration 12F7;
- validacao de enum, coluna, FK, CHECK e trigger para `product_class_group`;
- criacao do script local `scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs`;
- geracao de payloads candidatos para os 6 itens ProductClassGroup;
- validacao de lookup documental `productClassGroupKey -> product_class_group_id`;
- preservacao das rejeicoes de 16 ProductClassGroup members sem `class_id`;
- atualizacao de docs vivos.

Nao executado:

- seed/import real;
- migration nova;
- insercao no banco;
- criacao de ProductClass ou ProductClassGroup;
- criacao de ProductClassGroup member;
- UUID artificial;
- UI, Dexie, sync ou Edge Function;
- agenda, evento, estoque ou carencia ativa;
- promocao de `agenda_allowed`, `allows_agenda_auto` ou `approved_for_catalog`.

## 3. Resultado do adapter

Antes da 12F8:

- protocolos adaptaveis: 10;
- itens adaptaveis: 13;
- itens rejeitados por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`: 6;
- ProductClassGroups adaptaveis: 4;
- ProductClassGroup members rejeitados: 16.

Depois da 12F8:

- protocolos adaptaveis: 10;
- itens adaptaveis: 19;
- itens rejeitados por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`: 0;
- ProductClassGroups adaptaveis: 4;
- ProductClassGroup members rejeitados: 16.

## 4. Condicao de lookup

Os 6 itens foram adaptados somente como payload documental candidato porque existe lookup logico inequivoco nos artefatos:

```txt
productClassGroupKey -> {{lookup sanitario_product_class_groups_v2.id by group_key=<key>}}
```

Nenhum UUID real foi inventado. A resolucao concreta do `id` deve ocorrer apenas em fase futura de payload JSON/import candidato, sem criar grupo novo por conveniencia.

## 5. Itens reavaliados

Adaptados:

- `recria_maio`;
- `recria_julho`;
- `recria_setembro`;
- `pre_desmama_situacional`;
- `pre_confinamento_dose_unica`;
- `matrizes_pre_parto_antiparasitario`.

Todos usam:

- `action_type = vermifugacao`;
- `product_requirement_kind = product_class_group`;
- `product_class_group_id` por lookup;
- `product_id = null`;
- `product_class = null`;
- `allows_agenda_auto = false`;
- `status = draft`;
- produto real obrigatorio na execucao.

## 6. Invariantes preservados

- ProductClassGroup nao valida execucao.
- ProductClassGroup nao valida dose.
- ProductClassGroup nao valida carencia.
- Produto real continua obrigatorio na execucao.
- Carencia ativa continua dependente de evento + produto executado + snapshot tecnico.
- B19 permanece nacional para femeas bovinas/bubalinas de 3 a 8 meses.
- Aftosa permanece archived/blocked, sem produto sugerido e sem agenda.
- SourceGaps e SourcePolicy nao entram em `source_refs_by_field`.

## 7. Validacao

Comando principal:

```bash
node scripts/codex/validate-sanitario-adapter-payloads-12f8.mjs
```

Resultado registrado em:

- `docs/review/evidence/RESULTADO_VALIDACAO_12F8.md`.

## 8. Proxima fase

Como a 12F8 passou com 19 itens adaptaveis:

`12F9 — Gerar payload JSON completo importavel candidato para protocolos/itens/grupos, ainda sem executar import`.
