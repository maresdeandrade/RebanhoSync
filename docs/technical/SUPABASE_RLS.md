```md
# Supabase RLS — RebanhoSync

## Objetivo

Definir o contrato técnico para Supabase, RLS, isolamento multi-tenant, RPCs, policies e migrations.

---

## Princípios

- `fazenda_id` é fronteira de isolamento.
- RLS é obrigatória para dados tenant-scoped.
- UI não é fronteira de autorização.
- Client não pode expor `service_role`.
- Relações sensíveis devem impedir vínculo cross-tenant.
- RPC privilegiada exige validação explícita.
- Migrations ativas são fonte técnica superior a docs.

---

## Fonte de verdade

1. Migrations ativas.
2. Código que consome o contrato.
3. `docs/context/PROJECT_STATUS.md`.
4. Docs normativos ativos.
5. Docs derivados.
6. Histórico/archive.

---

## Regras de RLS

Cada tabela tenant-scoped deve avaliar:

- RLS habilitada;
- policy de select;
- policy de insert;
- policy de update;
- policy de delete, se aplicável;
- vínculo com usuário/fazenda;
- papel do usuário;
- comportamento para outsider.

---

## `fazenda_id`

Quando aplicável:

- tabela deve conter `fazenda_id`;
- FKs devem preservar `fazenda_id`;
- relação entre entidades não deve cruzar fazendas;
- payload client não pode forçar acesso a outra fazenda.

---

## FKs compostas

Preferir FK composta com `fazenda_id` quando a relação envolver entidades tenant-scoped.

Exemplo conceitual:

```txt
(fazenda_id, animal_id) → animais(fazenda_id, id)

```

---

## RPCs

RPCs devem validar:

* usuário autenticado;
* membership;
* papel/permissão;
* fazenda_id;
* ownership operacional;
* payload;
* search_path.

> ⚠️ RPC com privilégio elevado deve ter justificativa explícita.

---

## Functions/triggers

Functions/triggers devem:

* evitar bypass involuntário de RLS;
* manter search_path controlado;
* preservar auditabilidade;
* não executar regra crítica sem fonte explícita;
* não criar efeitos colaterais invisíveis.

---

## Proibido

* expor service_role no client;
* abrir policy ampla com true sem justificativa;
* permitir cross-tenant por FK incompleta;
* confiar apenas em filtro de UI;
* dar escrita direta indevida em tabela de membership;
* criar RPC que aceita fazenda_id sem validar vínculo;
* alterar migration ativa sem tarefa explícita.

---

## Validação Supabase

Quando tocar RLS, RPC, migration, sync-batch ou baseline:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

Também validar, conforme escopo:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

---

## Checklist

* [ ] RLS preservada.
* [ ] fazenda_id preservado.
* [ ] Sem cross-tenant.
* [ ] RPC valida usuário, papel e fazenda.
* [ ] search_path controlado quando aplicável.
* [ ] Nenhum service_role no client.
* [ ] Baseline Supabase validada se houve alteração relevante.

```

```