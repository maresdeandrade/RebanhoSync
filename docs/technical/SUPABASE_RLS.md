```md
# Supabase RLS — RebanhoSync

Atualizado em: 2026-10-19

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

- Backend anteriormente chamado staging: `zqloazqzhwauamcejmuz`,
  confirmado como consumidor do frontend de produção; não é homologação isolada.
- Nenhum projeto exclusivo de homologação foi comprovado entre os projetos acessíveis.
- Frontend publicado: sem novo deploy nesta execução.
- Gate sanitário remoto: desligado e fail-closed.
- Feature flag local: `false`; não é fronteira de autorização.
- Rollout para usuários: não autorizado.
- R01 aplicada ao backend existente de testes em 19/10/2026: 63 migrations, curadoria/plano/reagendamento
  instalados, catálogo vazio e gates OFF. Recuperação lógica, compatibilidade e
  efeito auxiliar de login da CLI: [evidência R01](../review/evidence/SANITARIO_V2_R01_APLICADA_20261019.md).
- R02 publicada em 19/10/2026: `sync-batch` v27 → v28, `verify_jwt=true`, 14 arquivos
  conferidos após download e secrets preservados por digest. Gates OFF e catálogo vazio.
  Smoke remoto autenticado não certificado por ausência de sessão acessível:
  [evidência R02](../review/evidence/SANITARIO_V2_R02_EXECUCAO_20261019.md).
  R03 preparada localmente; R03–R05 sem autorização remota.

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

### Curadoria global sanitária V2

`20261017080447_sanitario_catalog_review_v2.sql` acrescenta `sanitario_catalog_review_preview_v2` e `sanitario_catalog_decide_v2`. Somente `authenticated` pode chamá-las; ambas exigem `auth.uid()` e `is_app_admin()`. A decisão bloqueia a associação em `app_superadmins` durante a transação. Os helpers internos não são executáveis pelas roles de API. Os grants/RLS de escrita direta no catálogo global permanecem restritos.

O servidor define ator, timestamp e referência auditável; o cliente não fornece identidade ou assinatura. Hash SHA-256 inclui protocolo, itens, fontes, coberturas e produtos registrados. A RPC recusa versões divergentes/obsoletas, fontes insuficientes e restrições permanentes. Locks de protocolo, itens e evidências impedem publicação sobre conteúdo concorrente; o ID da intenção serializa retries. O mesmo pedido/ator retorna o recibo imutável existente, e reutilização divergente é conflito.

A promoção e a inserção em `app_admin_audit_events` pertencem à mesma transação: falha na auditoria reverte estados e permissões. Nenhuma nova tabela é fonte de aprovação. A mudança é aditiva e preserva IDs históricos. Intenção pendente no browser não escreve catálogo offline; retomada exige nova chamada autenticada. Clientes anteriores não reconhecem a decisão regional por campo e mantêm a automação correspondente bloqueada. Gates de sync não são habilitados por esta migration. Evidências: [aprovação e homologação](../review/evidence/SANITARIO_V2_APROVACAO_ELETRONICA_20261017.md).

### Plano e Agenda sanitários V2

`20261017195545_sanitario_planning_convergence_v2.sql` acrescenta as RPCs privadas
`internal_sanitario_sync_v2_set_automation_plan` e
`internal_sanitario_sync_v2_reschedule_agenda`. Somente service-role pode executá-las;
o Edge autentica a sessão, e a autorização interna revalida owner/manager, farm,
contrato e gate. Não há grant novo para escrita direta pela role authenticated.

O plano usa CAS de revisão/conteúdo e o ledger sanitário existente. Um trigger recusa
alterar seu campo JSON pelo writer genérico ou por perfil obsoleto. Criação automática
de Agenda revalida a versão publicada e selecionada no plano, além de deduplicar
intenções entre dispositivos. Cancelamento continua no fechamento canônico existente.
RLS e FKs de fazenda permanecem; planejamento não concede aprovação global nem gera
fatos. A migration não ativa gates nem importa catálogo.
Validado somente em ambientes locais descartáveis:
[evidências e procedimento](../review/evidence/SANITARIO_V2_HOMOLOGACAO_20261019.md).

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
