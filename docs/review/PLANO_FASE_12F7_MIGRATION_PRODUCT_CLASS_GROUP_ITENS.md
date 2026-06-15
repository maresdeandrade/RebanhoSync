# Plano Fase 12F7 — Migration ProductClassGroup em Itens

Atualizado em: 2026-06-15

## 1. Decisao executiva

Decisao: `FASE 12F7 CONCLUIDA COMO MIGRATION CONTROLADA`.

A 12F7 implementou suporte estrutural a `product_class_group` em `sanitario_protocolo_itens_versions_v2`, sem aplicar seed/import real e sem ativar protocolos.

## 2. Escopo executado

Implementado:

- migration SQL pequena e controlada;
- enum SQL aceita `product_class_group`;
- coluna `product_class_group_id uuid null`;
- FK para `sanitario_product_class_groups_v2(id)` com `on delete restrict`;
- CHECK de requisito de produto com exatamente uma modalidade coerente;
- trigger de validacao de ProductClassGroup ativo, status e escopo;
- contrato TypeScript do item passou a representar `productClassGroupId`;
- testes focados de contrato sanitario atualizados.

Nao implementado:

- seed/import real;
- protocolo ativo;
- `approved_for_catalog`;
- `agenda_allowed`;
- agenda;
- evento;
- estoque;
- carencia ativa;
- UI;
- Dexie;
- sync;
- Edge Function;
- ProductClass novo;
- `class_id` inventado.

## 3. Migration criada

Arquivo:

- `supabase/migrations/20260615120000_sanitario_protocol_item_product_class_group_v2.sql`

Principais estruturas:

- `alter type ... add value if not exists 'product_class_group'`;
- `product_class_group_id uuid null`;
- FK `sanitario_item_product_class_group_id_fkey`;
- CHECK `sanitario_protocolo_itens_versions_v2_product_req_chk`;
- indice parcial `idx_sanitario_protocolo_itens_versions_v2_product_class_group`;
- trigger `trg_validate_protocol_item_product_class_group_v2`;
- funcao `fn_validate_protocol_item_product_class_group_v2`.

## 4. Regras garantidas pelo CHECK

| kind | Regra |
|---|---|
| `specific_product` | exige `product_id`; bloqueia `product_class` e `product_class_group_id`. |
| `product_class` | exige `product_class` nao vazio; bloqueia `product_id` e `product_class_group_id`. |
| `product_class_group` | exige `product_class_group_id`; bloqueia `product_id` e `product_class`. |
| `none` | exige `product_id`, `product_class` e `product_class_group_id` nulos. |

## 5. Regras garantidas pela trigger

A trigger bloqueia:

- protocolo inexistente ou deletado;
- ProductClassGroup inexistente ou deletado;
- protocolo `global`/`pack` apontando para grupo `tenant`;
- protocolo `fazenda` apontando para grupo `tenant` de outra fazenda;
- `allows_agenda_auto=true` quando o grupo esta `blocked`, `archived` ou com `automation_status='blocked'`.

## 6. Contrato TypeScript

`SanitaryProtocolItemVersionV2` passou a ter:

```ts
productClassGroupId?: string | null;
```

O validador puro agora bloqueia:

- `product_class_group` sem `productClassGroupId`;
- `product_class_group` com `productId` ou `productClass`;
- `specific_product`, `product_class` e `none` com `productClassGroupId`.

`requiresNewProtocolItemVersionV2` passou a considerar mudanca de `productClassGroupId` como mudanca semantica.

## 7. RLS, offline e sync

RLS nao foi reescrita.

O item continua governado pelas policies existentes de protocolo. O ProductClassGroup continua governado pelas policies existentes de ProductClass v2.

Dexie, sync e UI nao foram alterados. Esta fase muda somente a capacidade estrutural do banco e do contrato TS de representar o requisito.

## 8. Invariantes preservados

- Agenda = intencao futura.
- Evento = fato executado.
- Protocolo = regra/configuracao.
- ProductClassGroup nao valida execucao.
- ProductClassGroup nao valida dose.
- ProductClassGroup nao valida carencia.
- Produto real continua obrigatorio na execucao.
- Carencia ativa nasce somente de evento + produto executado + snapshot.
- Bubalino exige fonte explicita.
- B19 permanece nacional.
- Aftosa permanece archived/blocked.

## 9. Validacoes executadas

- `pnpm test -- src/lib/sanitario/rules`;
- `supabase db reset`;
- `pnpm test -- supabase/functions/sync-batch`;
- `pnpm run lint`;
- `pnpm run build`;
- `git diff --check`;
- `git status --short --untracked-files=all`.

## 10. Proxima fase

Proxima fase segura:

- `12F8 — Revalidar adapter 12F4/12F5 contra schema atualizado e tentar adaptar os 6 itens antiparasitarios antes rejeitados, ainda sem seed/import real`.
