# F24.1 — Production Migration Delta & Provenance

Atualizado em: 2026-09-14

Baseline auditada: `main@93c3d1dd8401488139454c69c2a6595ae46abaa5`

Status atual: **CLOSED — REMOTE DATABASE AND SANITARIO EDGE VERIFIED**

## Rebaseline autoritativo — 2026-09-14

A inferência histórica de produção compartilhada foi superada. O deployment Vercel chamado
`Production` é apenas o canal atual; não existe produção operacional nem dado produtivo a
preservar. O texto histórico deste relatório permanece abaixo para rastreabilidade.

```ini
REMOTE_ENVIRONMENT = zqloazqzhwauamcejmuz
REMOTE_ENVIRONMENT_CLASS = DISPOSABLE_INTEGRATION
REMOTE_RESET_ALLOWED = true
PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
ENVIRONMENT_ISOLATION = NOT_REQUIRED_PRE_PRODUCTION
F24.1C_STAGING_CREATION = DEFERRED
REMOTE_INTEGRATION_BASELINE = VERIFIED
ACL_REMOTE_REHEARSAL = PASS
F24.1 = CLOSED
F24.1_REPOSITORY_CLOSEOUT = PR_READY_FOR_REVIEW
F24.2 = READY
```

A reconstrução remota, fingerprints e testes estão em
[F24_1D_REMOTE_ACL_REHEARSAL.md](./F24_1D_REMOTE_ACL_REHEARSAL.md). Banco, ACL SQL,
RLS/policies/default privileges, `SECURITY DEFINER`, `sync-batch` e o E2E remoto de
`sanitario-reconcile` passaram. A F24.1D.1 corrigiu a autorização HTTP do handler sem alterar
o banco: `verify_jwt=true` permanece ativo e somente o claim verificado
`role=service_role` chega ao cliente backend. A F24.1 está fechada; F24.2 está pronta, mas
não foi iniciada.

## Registro histórico preservado

## Reentrada controlada — resultado de engenharia

A reentrada preservou staging e produção em modo read-only e criou somente a migration
canônica `20260913232253_f24_acl_forward_only_reconciliation.sql` no worktree local.

```ini
PRODUCTION_DISCOVERY = BLOCKED
PRODUCTION_MIGRATION_HISTORY = BLOCKED
STAGING_ACL_DRIFT = EXPLAINED
ACL_MISSING_SERVICE_ROLE_EXECUTE = FIXED
SERVICE_ROLE_RECONCILE_TEST = PASS
ACL_CANONICAL_CONTRACT = VERIFIED
ACL_FORWARD_ONLY_MIGRATION = READY_FOR_REVIEW
ACL_REHEARSAL_A = PASS
ACL_REHEARSAL_B = PASS
ACL_REHEARSAL_CONVERGENCE = PASS
PRODUCTION_REPO_DELTA = NOT_TESTED
MIGRATION_PRODUCTION_DELTA = BLOCKED
STAGING_PROJECT_REF = zqloazqzhwauamcejmuz
PRODUCTION_PROJECT_REF = zqloazqzhwauamcejmuz
STAGING_PRODUCTION_BACKEND = SHARED
ENVIRONMENT_ISOLATION = BLOCKED
REMOTE_ACL_PROMOTION = NOT_AUTHORIZED
PRODUCTION_PROMOTION = NOT_AUTHORIZED
F24.1 = READY_WITH_CAVEAT
F24.2 = NOT_STARTED
```

### Produção

**Fato confirmado:** `STAGING_PROJECT_REF` e `PRODUCTION_PROJECT_REF` apontam ambos para
`zqloazqzhwauamcejmuz`. Esse backend é compartilhado com produção e não pode ser chamado de
staging isolado.

**Conclusão:** `STAGING_PRODUCTION_BACKEND = SHARED` e
`ENVIRONMENT_ISOLATION = BLOCKED`. Nenhum rehearsal, grant, migration, deploy ou promoção
remota foi executado, pois qualquer escrita nesse projeto atingiria o backend usado por
produção. `REMOTE_ACL_PROMOTION` e `PRODUCTION_PROMOTION` permanecem `NOT_AUTHORIZED`.

### Contrato canônico de ACL

| Superfície | `anon` | `authenticated` | `service_role` | Motivo |
|---|---|---|---|---|
| tabelas/views | nenhum privilégio por padrão | matriz explícita de leitura/escrita usada pelo cliente; três views sanitárias somente leitura | somente objetos lidos/escritos pelo backend sanitário e superfícies SuperAdmin | GRANT limita chegada ao objeto; RLS continua limitando linhas |
| sequences | nenhum | nenhum | nenhum | IDs atuais são UUID; não há sequence pública de aplicação |
| funções/RPCs | somente `get_invite_preview(uuid)` e `reject_invite(uuid)` | 26 assinaturas de domínio/admin/RLS explicitamente listadas | 18 assinaturas backend explicitamente listadas | `PUBLIC EXECUTE` e grants implícitos são revogados |
| defaults de `postgres` em `public` | deny | deny | deny | futuras migrations devem conceder sua superfície explicitamente |

Todos os 62 tables e 6 views atuais em `public`, assim como as 61 funções, pertencem a
`postgres`. Defaults de `supabase_admin` são administrados pela plataforma e não podem ser
alterados pelo papel de migration local; nenhum objeto de aplicação atual em `public` usa
esse owner. Essa ACL default permanece dívida de plataforma observável, não fonte do
contrato canônico de aplicação.

### RPCs anônimas

- `get_invite_preview(uuid)`: `SECURITY DEFINER`, `STABLE`, `search_path=public`; retorna
  somente o preview necessário para validar um token de convite, sem grant direto nas
  tabelas subjacentes;
- `reject_invite(uuid)`: `SECURITY DEFINER`, `search_path=public`; rejeita apenas convite
  pendente identificado pelo token;
- ambas têm `EXECUTE` explícito para `anon` e `authenticated`; nenhuma terceira função é
  executável por `anon` após a migration.

### Migration forward-only e impacto

A migration candidata revoga ACLs atuais de relações, sequences e funções antes de reaplicar
listas explícitas. A correção F24.1A.1 adiciona a migration forward-only separada
`20260914014309_f24_1a1_sanitario_reconcile_backend_wrapper.sql`, que separa o wrapper de
usuário autenticado do wrapper backend e mantém o core de recompute inacessível diretamente.
Ela não altera RLS, policies, dados ou schema funcional. Para
objetos futuros de owner `postgres`, `ALTER DEFAULT PRIVILEGES` remove grants automáticos de
tabelas, sequences e funções. Correção posterior, se necessária, deve ser uma nova migration
forward-only; não existe rollback destrutivo automático.

O `sanitario-reconcile` agora chama exclusivamente
`internal_sanitario_recompute_agenda_for_fazenda(uuid,date)`, concedida somente a
`service_role`. O wrapper valida a role efetiva e a existência da fazenda antes de chamar o
core interno no-op do cutover Agenda Sanitária v2. O wrapper de usuário continua validando
membership; `anon`, cross-farm e execução direta dos cores permanecem negados.

### Rehearsal A/B e fingerprints

| Superfície | Contagem final | SHA-256 final A = B |
|---|---:|---|
| table/view grants | 146 | `f9d3b27e2b0e93b3eacacb3dbfb9d29a1a249e49e1854a6cdf3e71f58ce6b00c` |
| function grants | 46 | `349fdf406d94ab454d237bd7216cf554a37f196eb6aec99d8e30dbb7ee2b717f` |
| default ACL | 36 | `a15b8c4439a1b766d3a9faf69180dabb090d51aa49ce17ebab5ea7134aafc423` |
| policies | 148 | `897e6bb5ab4b18f731320a253d097bcf833560e93c0eec0977511a933464809d` |
| RLS | 62 | `15f674dd4e0d4625d807bee19fee1ed5102cb793f442ff107764cad5526f8d07` |
| `SECURITY DEFINER` exposure | 35 | `0346cceb5e226780413ec17e95939872276dc79e0e7cbc8cdb06a56cd1399813` |

Cenário A aplicou 49 migrations canônicas + F24.1 + F24.1A.1. Cenário B aplicou as 49,
materializou o efeito ainda relevante do hotfix `20260901192728` e então aplicou F24.1 +
F24.1A.1. Os fingerprints comparam linhas ordenadas contendo role, privilégio, schema,
objeto e assinatura; não apenas quantidades. O repair `20260901192731` não foi reaplicado
após C3 porque seu efeito final já está integralmente superseded.

Staging e produção permaneceram exclusivamente read-only. Nenhuma migration, DDL, DML,
policy, grant, histórico remoto, Edge Function, secret ou configuração remota foi alterada;
as escritas desta reentrada ficaram restritas ao worktree e ao banco local descartável.

### Validações da reentrada

| Comando / gate | Exit code | Resultado |
|---|---:|---|
| `supabase db reset --local --yes` | 0 | PASS; 49 migrations canônicas + F24.1 + F24.1A.1 |
| reaplicação direta de `20260913232253` sobre o estado reconciliado | 0 | PASS; idempotência operacional confirmada |
| `validate-security-definer-exposure.mjs` | 0 | PASS; 35 funções, `PUBLIC=0`, `anon=2` |
| `validate-sanitario-reconcile-auth-contract.mjs` | 0 | PASS; service, member, cross-farm, anon, cores, invalid farm e replay |
| fluxo Edge local `sanitario-reconcile → RPC → recompute` | 0 | PASS; 1/1 reconciliada, 0 falhas, fixture removida |
| `validate-supabase-baseline-functional.mjs` com sentinel local descartável | 0 | PASS; 5/5 cenários |
| `validate-superadmin-security-gate.mjs` | 0 | PASS |
| `pnpm test -- --run` | 0 | PASS; 390 arquivos e 3.019 testes |
| `pnpm run lint` | 0 | PASS |
| `pnpm run build` | 0 | PASS com warnings conhecidos de Browserslist/chunks |
| `pnpm run gates:docs`, `gates:headers`, `gates:derivation` | 0 | PASS |
| `pnpm run gates:scope` | 1 | FAIL esperado: allowlist exclusiva de docs não admite os relatórios F24, a migration SQL nem dirty files preexistentes |
| `git diff --check` | 0 | PASS |

## Decisão da auditoria investigativa anterior

```ini
PRODUCTION_MIGRATION_HISTORY = BLOCKED
STAGING_REPO_DELTA = UNRESOLVED
PRODUCTION_REPO_DELTA = NOT_TESTED
STAGING_REPAIR_PROVENANCE = VERIFIED
MIGRATION_PRODUCTION_DELTA = BLOCKED
PRODUCTION_PROMOTION = NOT_AUTHORIZED
```

**Fato confirmado:** as 49 versões canônicas do repositório estão registradas no staging,
na mesma ordem, acompanhadas de duas migrations adicionais. Os dois SQLs adicionais foram
recuperados e tiveram sua proveniência verificada.

**Fato confirmado naquela inspeção:** não apareceu um segundo projeto RebanhoSync. A
governança posterior esclareceu que `zqloazqzhwauamcejmuz` é também o backend usado por
produção; a ausência de segundo project ref representa ambiente compartilhado, não staging
isolado nem produção desconhecida.

**Fato confirmado:** há drift material de ACL entre o estado local observado e staging. Em
staging, `anon` conserva `SELECT`, `INSERT`, `UPDATE` e `DELETE` em 58 relações públicas e
`EXECUTE` em 18 funções; no local observado, `anon` possui somente os dois `EXECUTE`
intencionais em funções `SECURITY DEFINER` e não possui grants operacionais de tabela.

**Inferência controlada:** RLS pode impedir exploração de parte dos grants excedentes, mas
isso não torna os grants equivalentes nem comprova ausência de exposição. A avaliação
comportamental pertence ao gate F24.2; a divergência de catálogo já basta para impedir um
caminho determinístico de promoção.

## Preflight

| Item | Resultado |
|---|---|
| Branch | `main` |
| HEAD | `93c3d1dd8401488139454c69c2a6595ae46abaa5` |
| `origin/main` após `git fetch --all --prune` | `93c3d1dd8401488139454c69c2a6595ae46abaa5` |
| Ahead / behind | `0 / 0` |
| Diff check de entrada | PASS |
| Worktree preexistente | patch documental F24.0 ainda não commitado e `supabase/.temp/cli-latest` modificado |

`supabase/.temp/cli-latest` permaneceu intocado.

## Histórico de migrations — repositório

Existem 49 arquivos SQL canônicos ativos. A lista abaixo é ordenada por versão; “objetos”
resume os objetos principais e não substitui o SQL como fonte de verdade.
A coluna “Arquivo” omite somente o prefixo `<versão>_`; o filename completo é a concatenação
da coluna “Versão”, `_` e o valor exibido em “Arquivo”.

| Versão | Arquivo | Descrição resumida | Objetos principais | Dependência relevante |
|---|---|---|---|---|
| `00000000000000` | `rebuild_base_schema_sanitario.sql` | reconstrói o baseline remoto | tipos, tabelas, views, RLS, policies, funções, triggers e índices base | extensões/roles Supabase |
| `20260508003000` | `pasto_ocupacoes.sql` | cria ocupações de pasto | `pasto_ocupacoes`, índices, policies, trigger | `fazendas`, `pastos`, `lotes`, `eventos` |
| `20260508004000` | `pastos_forrageira_manejo.sql` | amplia manejo/forrageira | colunas de `pastos` | baseline de `pastos` |
| `20260508005000` | `eventos_pasto_avaliacao.sql` | adiciona avaliação factual de pasto | `eventos_pasto_avaliacao`, policies, índices, triggers | `eventos`, `pastos`, `lotes`, `pasto_ocupacoes` |
| `20260511000000` | `sanitario_complete_agenda_idempotency.sql` | endurece conclusão sanitária idempotente | RPC `sanitario_complete_agenda_with_event` | agenda e eventos sanitários base |
| `20260514000000` | `fix_create_fazenda_primary_membership.sql` | corrige membership primária | RPC `create_fazenda` | `fazendas`, `user_fazendas` |
| `20260524000000` | `dry_cow_therapy_agenda_recompute.sql` | recompõe agenda de vaca seca | funções de recompute sanitário | protocolos, agenda e eventos sanitários |
| `20260525000000` | `insumos_inventory.sql` | cria estoque de insumos | `insumos`, apresentações, lotes, movimentações, policies e triggers | fazenda, animal, lote, pasto e produtos |
| `20260526000000` | `anti_zombie_agenda.sql` | impede agendas sanitárias zumbis | `sanitario_recompute_agenda_core` | agenda, protocolo e eventos sanitários |
| `20260526000100` | `recompute_on_animal_mutation.sql` | liga recompute a mutações do animal | trigger de `animais` | função de recompute anterior |
| `20260526000200` | `reconcile_support_rpcs.sql` | adiciona suporte a reconcile | RPCs `sanitario_reconcile_*` | agenda e configuração sanitária |
| `20260526000300` | `vw_animais_peso_atual.sql` | projeta peso atual | view `vw_animais_peso_atual` | eventos e detalhes de pesagem |
| `20260526000400` | `vw_animais_carencia_ativa.sql` | projeta carência ativa | view `vw_animais_carencia_ativa` | eventos sanitários |
| `20260526000500` | `idx_sanitary_completion_key.sql` | indexa chave de conclusão | índice sanitário parcial | eventos sanitários |
| `20260526000600` | `idx_eventos_unique_source_task.sql` | deduplica evento por tarefa-fonte | índice unique de `eventos` | contrato de agenda/evento |
| `20260528000001` | `add_eventos_ecc.sql` | adiciona detalhe factual de ECC | `eventos_ecc`, policy `user_fazenda_access`, índices | `eventos`, `user_fazendas` |
| `20260529000000` | `insumos_campos_custo_carencia.sql` | amplia custo e carência de insumos | colunas em insumos/lotes/movimentações | estoque de insumos |
| `20260529000100` | `update_vw_animais_carencia_ativa.sql` | atualiza projeção de carência | view `vw_animais_carencia_ativa` | novos campos de insumos |
| `20260529000200` | `financeiro_gerencial.sql` | cria financeiro gerencial | categorias, transações, policies, triggers e seed | fazenda e contrapartes |
| `20260529000300` | `comercial_operations.sql` | cria eventos comerciais | `eventos_comercial`, policies, triggers e índices | eventos, financeiro e lotes |
| `20260529000400` | `sociedade_pecuaria.sql` | cria sociedade pecuária | `sociedades_pecuarias`, `sociedade_animais`, policies e índices | animais, fazendas e contrapartes |
| `20260530000000` | `sociedade_pecuaria_sync_metadata.sql` | adiciona metadados de sync | colunas/índices `client_tx_id` | sociedade pecuária |
| `20260530000100` | `sociedade_pecuaria_status_retirado.sql` | amplia status do animal | enum `animal_status_enum` | baseline de animais |
| `20260531000000` | `protocolos_sanitarios_itens_immutable_versions.sql` | versiona itens imutáveis | protocolo, snapshots, índices e triggers | agenda/eventos sanitários |
| `20260531001000` | `protocolos_sanitarios_drop_legacy_protocol_item_id.sql` | remove identificador legado | `protocolos_sanitarios_itens` | versionamento anterior |
| `20260531002000` | `eventos_sanitario_operational_traceability.sql` | adiciona rastreabilidade operacional | evento sanitário, insumo/produto, índices e view | estoque e carência |
| `20260601000000` | `financeiro_estorno_categorias.sql` | suporta categorias/estorno determinísticos | funções e `finance_transactions` | financeiro gerencial, `pgcrypto` |
| `20260604090000` | `insumo_movimentacoes_consumo_nutricao_idempotency.sql` | endurece idempotência nutricional | índice/constraint em movimentações de insumo | estoque de insumos |
| `20260606090000` | `sanitario_agenda_v2_clean_foundation.sql` | cria fundação de agenda sanitária v2 | agenda, animais, closures, enums, policies e triggers | baseline sanitário |
| `20260608090000` | `sanitario_protocol_product_source_v2.sql` | cria catálogo técnico v2 | produtos, fontes, doses, carências, protocolos, policies e índices | agenda v2 e fazendas |
| `20260610203500` | `sanitario_product_class_v2.sql` | cria classes/grupos de produto | tabelas, validators, policies, índices e triggers | catálogo técnico v2 |
| `20260615120000` | `sanitario_protocol_item_product_class_group_v2.sql` | vincula item a grupo de classe | coluna, FK, validator, índice e trigger | protocolos/classes v2 |
| `20260722102038` | `sanitario_sync_v2_expand_foundation.sql` | expande sync sanitário v2 | ledger, gates, evento-animal, funções internas, triggers e índices | agenda/produto v2, eventos e estoque |
| `20260808120000` | `individual_animal_purchase_sync.sql` | cria operação idempotente de compra individual | RPC `apply_individual_animal_purchase` e fingerprint | animais, eventos e comercial |
| `20260813134853` | `commercial_operation_v2.sql` | cria operação comercial transacional v2 | RPC `apply_commercial_operation_v2` | compra, animais, eventos e financeiro |
| `20260813152618` | `harden_individual_animal_purchase_grants.sql` | restringe RPC de compra | ACL da RPC de compra | migration de compra individual |
| `20260821000000` | `fix_pgcrypto_digest_search_path.sql` | qualifica digest do pgcrypto | função financeira determinística | `pgcrypto`, financeiro |
| `20260824100000` | `app_superadmin_foundation.sql` | cria fundação SuperAdmin | `app_superadmins`, auditoria, policies e trigger | auth e perfis |
| `20260824110000` | `app_superadmin_read_rpcs.sql` | cria leitura administrativa | cinco RPCs administrativas | fundação SuperAdmin |
| `20260824120000` | `harden_admin_invites_rpc.sql` | endurece leitura de convites | RPC `admin_list_platform_invites` | RPCs administrativas |
| `20260825080000` | `app_superadmin_can_create_farm_mutation.sql` | controla criação de fazenda | RPC `admin_set_can_create_farm` | SuperAdmin e perfis |
| `20260826230107` | `reconcile_authenticated_table_privileges.sql` | declara grants do cliente autenticado | ACLs de tabelas operacionais | todas as tabelas anteriores |
| `20260827100000` | `harden_internal_and_trigger_function_privileges.sql` | restringe funções internas/triggers | ACLs de sete funções internas | funções sanitárias, estoque e seed |
| `20260827110000` | `harden_domain_and_farm_admin_rpc_privileges.sql` | restringe RPCs de domínio/admin | ACLs de RPCs públicas | RPCs acumuladas |
| `20260827120000` | `harden_get_user_emails_rpc.sql` | endurece emails por tenant | RPC `get_user_emails` | membership e perfis |
| `20260829193636` | `c2_search_path_hardening.sql` | fixa `search_path` | dez funções/validators | funções acumuladas |
| `20260908050000` | `c3_auth_rls_initplan_hardening.sql` | otimiza oito policies auth | policies de fazenda, perfis, membership, SuperAdmin e ECC | policies existentes; absorve repair `192731` |
| `20260908060000` | `c4_1a_exact_permissive_cleanup.sql` | remove policies permissivas duplicadas | agenda, animais e casos sanitários | policies base |
| `20260908070000` | `c4_1b_subsumed_operational_cleanup.sql` | remove policies operacionais subsumidas | policies de 13 superfícies operacionais | C4.1a e policies base |

## Histórico de migrations — staging

O projeto `zqloazqzhwauamcejmuz` está `ACTIVE_HEALTHY`, PostgreSQL 17, região
`sa-east-1`. `supabase migration list --linked` e a API Supabase confirmaram 51 entradas:

- 49 versões canônicas, na ordem do repositório;
- `20260901192728_pre_c3_reconcile_table_grants` após C2 e antes de C3;
- `20260901192731_fix_eventos_ecc_removed_membership` imediatamente após o repair anterior.

As três versões canônicas finais (`20260908050000`, `20260908060000` e
`20260908070000`) têm versão registrada no remoto, mas o campo `name` está vazio no histórico
consultado. Os arquivos locais fornecem os nomes canônicos; a ausência de nome não altera a
ordem nem a presença da versão.

## Histórico de migrations — produção

```ini
PRODUCTION_MIGRATION_HISTORY = BLOCKED
```

**Fato confirmado:** `zqloazqzhwauamcejmuz` é simultaneamente o project ref de staging e de
produção. Não existe isolamento ambiental para executar um rehearsal remoto seguro.

**Conduta:** criar/identificar um backend de staging isolado antes de reabrir promoção ACL.
Não usar `migration repair`, `db push`, `db reset` ou qualquer DDL remoto neste projeto
compartilhado.

## Reparos de staging

### `20260901192728_pre_c3_reconcile_table_grants`

```ini
STATUS = STAGING_ONLY_HOTFIX
CANONICAL_REPLACEMENT = NONE
ACTION = BLOCK_PROMOTION_UNTIL_FORWARD_ONLY_REMEDIATION_IS_DEFINED
```

**Fatos confirmados:**

- o SQL remoto revoga todos os privilégios de `public`, `anon`, `authenticated` e
  `service_role` sobre `fazendas`, `user_profiles`, `user_settings`, `user_fazendas`,
  `eventos_ecc` e `app_superadmins`;
- em seguida concede somente a matriz mínima esperada para essas seis tabelas;
- o conteúdo remoto corresponde ao arquivo homônimo preservado no commit
  `8f2031d9e51930b509f954fed77694b48a59ebe6`;
- SHA-256 normalizado em ambos: `4f3d123d724615882f14a7f13f20eb2b4e2e26a8e49198f5be19ed50b7cf8908`;
- o commit é o terceiro pai de `refs/stash` (`88b3b5b...`), criado em
  `security/pre-c3-baseline-reconciliation` antes de D3;
- nenhuma branch atual contém esse commit;
- `20260826230107` concede privilégios esperados, mas não contém o `REVOKE` corretivo;
- o estado efetivo dessas seis tabelas no staging coincide com a matriz mínima observada
  localmente.

**Inferência controlada:** o repair foi criado para neutralizar grants herdados/preexistentes
em seis superfícies antes da C3. Ele é complementar, não equivalente à migration canônica de
grants, porque o efeito de revogação não é reproduzido por `20260826230107`.

### `20260901192731_fix_eventos_ecc_removed_membership`

```ini
STATUS = SUPERSEDED
CANONICAL_REPLACEMENT = 20260908050000_c3_auth_rls_initplan_hardening.sql
ACTION = NONE_ON_DATABASE; KEEP_PROVENANCE_DOCUMENTED
```

**Fatos confirmados:**

- o SQL adiciona `uf.deleted_at is null` à policy `user_fazenda_access` de `eventos_ecc`;
- o conteúdo remoto corresponde ao arquivo preservado no mesmo commit órfão/stash;
- SHA-256 normalizado em ambos: `f097935b404d9ab979251556e950f389956913e0b0ca18d331e4f9ae670dd277`;
- a migration canônica C3 altera novamente a mesma policy, preserva o filtro de membership
  removida e aplica `(select auth.uid())`;
- a definição efetiva da policy no staging coincide com a definição observada localmente.

**Inferência controlada:** C3 absorveu integralmente o efeito material desse repair; o
timestamp remoto extra continua necessário como proveniência histórica, mas não representa
drift residual da policy.

## Matriz repo × staging × produção

As 49 linhas canônicas compartilham a mesma classificação. A repetição explícita permite
reconstruir a comparação sem inferir presença por contagem.

| Migration | Repo | Staging | Produção | Proveniência | Equivalência | Risco | Ação futura |
|---|---|---|---|---|---|---|---|
| `00000000000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260508003000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260508004000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | baixo | obter histórico produtivo |
| `20260508005000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260511000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260514000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260524000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260525000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260526000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260526000100` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260526000200` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260526000300` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | baixo | obter histórico produtivo |
| `20260526000400` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260526000500` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | baixo | obter histórico produtivo |
| `20260526000600` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260528000001` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | SUPERSEDED parcialmente por repair/C3 | alto | manter C3 no caminho futuro |
| `20260529000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260529000100` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260529000200` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260529000300` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260529000400` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260530000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260530000100` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260531000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260531001000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | ensaiar upgrade produtivo |
| `20260531002000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260601000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260604090000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260606090000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260608090000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260610203500` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260615120000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260722102038` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260808120000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260813134853` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260813152618` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260821000000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | médio | obter histórico produtivo |
| `20260824100000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260824110000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260824120000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260825080000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260826230107` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | NOT EQUIVALENT ao repair `192728` | alto | formalizar revokes forward-only |
| `20260827100000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | reconciliar ACL residual |
| `20260827110000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | reconciliar ACL residual |
| `20260827120000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260829193636` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260901192728` | ABSENT | EXTRA | NOT_TESTED | refs/stash + remoto | STAGING_ONLY_HOTFIX | crítico | bloquear e criar plano forward-only separado |
| `20260901192731` | ABSENT | EXTRA | NOT_TESTED | refs/stash + remoto | SUPERSEDED | baixo residual | manter proveniência |
| `20260908050000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT; absorve `192731` | alto | obter histórico produtivo |
| `20260908060000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |
| `20260908070000` | PRESENT | PRESENT | NOT_TESTED | Git + remoto | EQUIVALENT* | alto | obter histórico produtivo |

`EQUIVALENT*` significa equivalência dos objetos efetivos inspecionados, exceto ACLs, cujo
drift é transversal e descrito abaixo. É uma classificação do efeito estrutural final da
sequência completa, não uma alegação de igualdade byte a byte de cada SQL nem equivalência
de produção.

### Deltas direcionais

- `repo -> staging`: `UNRESOLVED`; duas versões extras explicadas, uma delas ainda sem
  substituto canônico, e ACLs materiais divergentes;
- `repo -> produção`: `NOT_TESTED`; projeto/histórico produtivo não identificado;
- `staging -> produção`: `NOT_TESTED`; não há segunda ponta auditável para comparação.

## Comparação de objetos efetivos

Foram calculados fingerprints determinísticos do catálogo `public` no banco local observado
e no staging. O banco local atualmente também registra os dois repairs na tabela de histórico;
por isso ele é evidência de paridade efetiva, não uma reconstrução limpa das 49 migrations.

| Categoria | Local | Staging | Resultado |
|---|---:|---:|---|
| colunas | 1.125 / `618e0f...7330` | 1.125 / `618e0f...7330` | EQUIVALENT |
| constraints | 450 / `59129d...a509` | 450 / `59129d...a509` | EQUIVALENT |
| enums | 233 / `da64c4...dc93` | 233 / `da64c4...dc93` | EQUIVALENT |
| funções/RPCs e definições | 59 / `fd6d9d...3299` | 59 / `fd6d9d...3299` | EQUIVALENT |
| índices | 306 / `f99b94...1f2e` | 306 / `f99b94...1f2e` | EQUIVALENT |
| policies | 148 / `b8a829...0cc8` | 148 / `b8a829...0cc8` | EQUIVALENT |
| relações/opções | 68 / `3fa1c6...1ea7` | 68 / `3fa1c6...1ea7` | EQUIVALENT |
| RLS habilitada/forçada | 62 / `f07ede...58f4` | 62 / `f07ede...58f4` | EQUIVALENT |
| triggers | 76 / `9c63d7...761e` | 76 / `9c63d7...761e` | EQUIVALENT |
| views/definições/opções | 6 / `0479b5...b73d` | 6 / `0479b5...b73d` | EQUIVALENT |
| schema ACL | 3 / `bf467a...9bfd` | 3 / `bf467a...9bfd` | EQUIVALENT |
| table grants | 672 / `e3c0db...0649` | 1.267 / `6fb477...7c0` | DRIFT |
| function ACL | 46 / `6eeabe...50906d` | 120 / `007ea7...9f46` | DRIFT |
| default ACL | 51 / `258c2b...608` | 72 / `f0a6f3...508` | DRIFT |

Extensões comuns (`pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault` e
`uuid-ossp`) têm a mesma versão. `pg_graphql 1.5.11` existe apenas no stack local e não é
criado pelas migrations ativas; foi classificado como diferença ambiental, não como delta
canônico de migration.

## Drifts materiais

### Grants de tabelas

- staging: `anon` possui os quatro privilégios operacionais em 58 relações;
- local observado: `anon` não possui `SELECT`, `INSERT`, `UPDATE` ou `DELETE` de tabela;
- staging: `authenticated` possui `DELETE` em 59, `INSERT` em 62, `UPDATE` em 62 e
  `SELECT` em 66 relações;
- local observado: `authenticated` possui `SELECT` em 58, `INSERT` em 41 e `UPDATE` em
  28, sem `DELETE`;
- as seis tabelas do repair `192728` coincidem com a matriz mínima nos dois ambientes;
- o excesso residual abrange fatos, estoque, financeiro, catálogos, sanitário v2 e views.

### ACLs de funções

- staging: `anon EXECUTE` em 18 funções, sendo duas `SECURITY DEFINER` intencionais e 16
  funções invoker/internas adicionais;
- local observado: somente `get_invite_preview` e `reject_invite` para `anon`;
- staging: `authenticated EXECUTE` em 43 funções; local observado: 27;
- definições, assinaturas, `SECURITY DEFINER` e `search_path` das funções coincidem; o drift
  está na ACL.

### Default privileges

No staging, os defaults do owner `postgres` ainda concedem operações amplas de tabela,
sequência e função para `anon`, `authenticated` e `service_role`. No local observado, os
defaults de `postgres` para tabelas não incluem operações DML e não concedem `EXECUTE` em
funções. Assim, objetos futuros podem nascer com ACL diferente conforme o ambiente.

## Proveniência

| Evidência | Resultado |
|---|---|
| histórico remoto `supabase_migrations.schema_migrations` | nomes, ordem e statements dos dois repairs confirmados |
| `refs/stash` | preserva os dois arquivos e o validador pre-C3 |
| commit de untracked do stash | `8f2031d9e51930b509f954fed77694b48a59ebe6` |
| branch/base indicada pelo stash | `security/pre-c3-baseline-reconciliation` em `7d36df0` |
| hash de conteúdo repair `192728` | remoto = Git órfão |
| hash de conteúdo repair `192731` | remoto = Git órfão |
| commit canônico de grants | `705d4cd1...`, anterior e sem revogação equivalente |
| commit canônico C3 | `9e56cab4...`, substitui a policy corrigida por `192731` |

Não foi encontrada referência local que associe os repairs a um PR mergeado. A dívida de
proveniência está agora documentada, mas o repair de grants continua ausente do caminho
canônico forward-only.

## Riscos de promoção

1. Produção pode ter migrations ausentes/extras ou ordem diferente; seu project ref e
   histórico não foram identificados.
2. Copiar apenas as 49 migrations não reproduz de forma determinística o repair de grants
   aplicado em staging, e as default ACLs variam por ambiente.
3. Grants excedentes no staging ampliam a superfície concedida a `anon` e `authenticated`;
   RLS reduz risco de linha, mas não substitui least privilege nem valida views/RPCs.

## Ação futura segura

1. Obter identificação inequívoca e acesso read-only à produção.
2. Abrir uma reentrada F24.1 para inventariar o histórico produtivo.
3. Definir, em tarefa explícita de schema/RLS, uma migration **nova e forward-only** que
   reconcilie ACLs de tabelas, funções e default privileges de modo idempotente.
4. Ensaiar o caminho em ambiente descartável/branch autorizado antes de qualquer produção.

Isso não autoriza criar ou aplicar a migration recomendada nesta execução.

## Validações desta auditoria

| Comando/operação | Resultado | Observação |
|---|---|---|
| `git fetch --all --prune` e preflight Git completo | PASS | HEAD igual a `origin/main` |
| `supabase projects list` / API `list_projects` | PASS | nenhum projeto produtivo RebanhoSync identificado |
| `supabase migration list --linked` | PASS COM DELTA | 49 canônicas + 2 extras |
| `supabase migration list --local` | PASS COM CAVEAT | banco local observado também registra os dois repairs |
| consulta SELECT dos statements remotos | PASS | conteúdo dos dois repairs recuperado |
| comparação SHA-256 remoto × refs/stash | PASS | hashes idênticos |
| fingerprints de schema efetivo | PASS COM DRIFT | equivalência estrutural; divergência em ACLs/defaults |
| inspeção de Git, stash e commits | PASS | proveniência verificada |

## Gate da auditoria investigativa anterior

F24.1 encerra a recertificação local pronta com ressalva e não abre F24.2 automaticamente.

```ini
F24.1 = READY_WITH_CAVEAT
F24.2 = NOT_STARTED
STAGING_PRODUCTION_BACKEND = SHARED
ENVIRONMENT_ISOLATION = BLOCKED
PRODUCTION_MIGRATION_HISTORY = BLOCKED
STAGING_REPO_DELTA = UNRESOLVED
PRODUCTION_REPO_DELTA = NOT_TESTED
STAGING_REPAIR_PROVENANCE = VERIFIED
MIGRATION_PRODUCTION_DELTA = BLOCKED
PRODUCTION_PROMOTION = NOT_AUTHORIZED
```
