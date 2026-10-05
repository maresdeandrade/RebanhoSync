```md
# Supabase RLS — RebanhoSync

Atualizado em: 2026-07-30

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

## Ambiente atual do Sync Sanitário v2

- Supabase staging: `zqloazqzhwauamcejmuz`.
- Produção: não alterada.
- Gate sanitário remoto: desligado e fail-closed.
- Feature flag local: `false`; não é fronteira de autorização.
- Rollout para usuários: não autorizado.

A fundação de RLS e isolamento multi-tenant/fazenda do Sync Sanitário v2 está tecnicamente concluída. Isso não conclui o sync nem autoriza rollout.

O `sync-batch` autentica e valida membership antes da execução server-side. As funções internas revalidam tenant, `fazenda_id`, revisão, estado e idempotência. `service_role` não é exposto no cliente.

`SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED` em 05/10/2026 após PT409, PostgREST 14.18 e E2E remoto stale de `replace_agenda_animals`. Historicamente, `40001` não retornava pelo transporte antes do timeout. Ver [evidência canônica](../context/PROJECT_STATUS.md#recertificação-remota-stale-sanitário-v2--05102026). Gate remoto `OFF`, flag `false`, rollout e importação real não autorizados; outras RPCs não foram recertificadas.

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
