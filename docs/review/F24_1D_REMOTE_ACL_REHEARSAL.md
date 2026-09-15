# F24.1D — Remote ACL Rehearsal

Atualizado em: 2026-09-14
Baseline: `main@93c3d1dd8401488139454c69c2a6595ae46abaa5`
Decisão: **CLOSED — ACL REMOTE REHEARSAL PASS**

## Ambiente e autorização

```ini
REMOTE_ENVIRONMENT = zqloazqzhwauamcejmuz
REMOTE_ENVIRONMENT_CLASS = DISPOSABLE_INTEGRATION
REMOTE_RESET_ALLOWED = true
PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
ENVIRONMENT_ISOLATION = NOT_REQUIRED_PRE_PRODUCTION
F24.1C_STAGING_CREATION = DEFERRED
F24.2 = READY_NOT_STARTED
```

O nome `Production` no Vercel identifica somente o canal atual de deployment. Não existe
produção operacional. Nenhum segundo projeto Supabase e nenhum ambiente produtivo foram
criados. O reset remoto foi autorizado pela premissa de dados descartáveis.

## Reconstrução e migration history

Foi criado um worktree temporário destacado de
`main@93c3d1dd8401488139454c69c2a6595ae46abaa5`. Ele continha exatamente 49 migrations,
de `00000000000000` a `20260908070000`. O primeiro reset remoto aplicou essas 49 migrations
e `supabase/seed.sql`; os repairs remotos históricos `20260901192728` e `20260901192731`
foram removidos do histórico efetivo.

Depois foram materializadas no worktree temporário somente as candidatas:

- `20260913232253_f24_acl_forward_only_reconciliation.sql` — SHA-256
  `43d4f6b3ef1c4d72ac2ac65549709e6f41fadb7d7494006b1776566ad3d1ab33`;
- `20260914014309_f24_1a1_sanitario_reconcile_backend_wrapper.sql` — SHA-256
  `d1238d854d6e53a2130b33f3c373335f70d0c6afa17d761ea98b065e6e39fe12`.

O dry-run listou apenas essas duas migrations. O push aplicou somente as versões
`20260913232253` e `20260914014309`. Dois resets completos posteriores reaplicaram, em ordem,
as mesmas 51 migrations e o seed. O histórico final contém exatamente 51 versões canônicas,
sem os dois repairs históricos.

```ini
REMOTE_INTEGRATION_BASELINE = VERIFIED
REMOTE_REBUILD_FROM_REPO = PASS
MIGRATION_HISTORY = 51_CANONICAL
HISTORICAL_REMOTE_REPAIRS = ABSENT_AFTER_RESET
```

## Fingerprints de convergência

A mesma consulta determinística SHA-256 foi executada após duas reconstruções consecutivas.

| Superfície | Linhas A/B | Fingerprint A | Fingerprint B | Resultado |
| --- | ---: | --- | --- | --- |
| table/view grants | 690 / 690 | `ecd4d660ad924df906e516743ff768e992a9853378f2e8a40254445c50eea19e` | `ecd4d660ad924df906e516743ff768e992a9853378f2e8a40254445c50eea19e` | PASS |
| function grants | 107 / 107 | `a533013eb4d0a6b42ee9e73a4852cc92cc54b577e7bc19e4210265674c1b9b00` | `a533013eb4d0a6b42ee9e73a4852cc92cc54b577e7bc19e4210265674c1b9b00` | PASS |
| default privileges | 264 / 264 | `f353d468f26928802a5e481c0395e1831604f6071e569f067ae2c16a2aa573c9` | `f353d468f26928802a5e481c0395e1831604f6071e569f067ae2c16a2aa573c9` | PASS |
| policies | 148 / 148 | `cc69cb866190a8c49c7fbdfdfed8857bdb915440da4dfe3558f8a4094ce44648` | `cc69cb866190a8c49c7fbdfdfed8857bdb915440da4dfe3558f8a4094ce44648` | PASS |
| RLS | 62 / 62 | `765c84c3d820137c9625914c08f182ed16593bdb933eda495ba563a8ead78011` | `765c84c3d820137c9625914c08f182ed16593bdb933eda495ba563a8ead78011` | PASS |
| SECURITY DEFINER | 35 / 35 | `4d701165710845c3da643346b2aa774637c4d3ce562ccc3174575ef381d003f2` | `4d701165710845c3da643346b2aa774637c4d3ce562ccc3174575ef381d003f2` | PASS |

## ACL final e testes por role

Grants de tabela/view relevantes:

| Role | DELETE | INSERT | SELECT | UPDATE |
| --- | ---: | ---: | ---: | ---: |
| `anon` | 0 | 0 | 0 | 0 |
| `authenticated` | 0 | 31 | 61 | 18 |
| `service_role` | 2 | 8 | 22 | 4 |

Grants de função: `anon = 2`, `authenticated = 26`, `service_role = 18`, `PUBLIC = 0`.
As duas funções anônimas são `get_invite_preview(uuid)` e `reject_invite(uuid)`.

O teste transacional final comprovou:

- `SET LOCAL ROLE service_role` +
  `internal_sanitario_recompute_agenda_for_fazenda(uuid,date)` retorna `0`;
- `anon` na mesma assinatura recebe SQLSTATE `42501`;
- `authenticated` membro retorna `0` no wrapper público;
- `authenticated` cross-farm recebe `P0001`;
- `service_role` com fazenda inexistente recebe `P0002`;
- `PUBLIC`, `anon`, `authenticated` e `service_role` não executam diretamente o core interno;
- replay sob `service_role` retorna o mesmo resultado.

As fixtures SQL foram executadas transacionalmente ou removidas explicitamente.

## Edge Functions e E2E

Foram implantadas no ambiente descartável as fontes do repo para o rehearsal, sem prune:

- `sync-batch` v26, `verify_jwt=true`;
- `sanitario-reconcile` v4, `verify_jwt=true`, bundle SHA-256
  `e3add605bd7a5a252c7d932b955529c163e60f79ccfa23364b38aa36d61d5940`.

O E2E remoto do `sync-batch` passou: primeiro envio `APPLIED`, replay `APPLIED`, exatamente um
registro persistido, usuário cross-farm `403` e chamada sem autenticação `401`.

O diagnóstico F24.1D.1 classificou o `403` como `FUNCTION_HANDLER`. No request
`dd214e63-c810-4643-9d10-00b5b7ce6de4`, o gateway registrou JWTs `apikey` e
`Authorization` com `role=service_role`, algoritmo `HS256`, e ainda assim o deployment v2
respondeu `403`; portanto a plataforma havia autenticado e invocado o handler. A causa foi a
comparação literal do header `Authorization` com `SUPABASE_SERVICE_ROLE_KEY`: o gateway pode
substituir o token original antes da execução.

O patch mantém `verify_jwt=true` e autoriza somente quando o claim `role` do JWT já verificado
pelo gateway é `service_role`. O handler não confia na mera presença de `apikey`. A matriz
pós-patch comprovou: sem credencial `401`; usuário `authenticated`, chave legada `anon` e
publishable `403`; JWT legado `service_role` `200`; chave inválida `401`. A secret key
`sb_secret_*` listada pela Management API está mascarada/irrecuperável e foi classificada,
mas não usada como credencial válida.

No E2E, a primeira chamada encontrou exatamente uma fazenda elegível, retornou
`reconciled=1`, `failed=0`, `total=1` e `inserted=0`. O replay imediato retornou `total=0`
por causa do cooldown, sem duplicação. A fixture, o animal, a agenda e o config criado por
`sanitario_reconcile_touch` foram removidos; todos os contadores finais ficaram em zero. O
request `d6a86b7b-bc62-40da-9e15-1e138ff18290` confirma deployment v4, HTTP 200,
`Authorization.role=service_role`, `apikey.role=service_role`, execution id
`d6c7b8ee-86bd-480f-88d0-d71cbf8014d5` e execução em `sa-east-1`.

```ini
SYNC_BATCH_REMOTE_E2E = PASS
SYNC_REPLAY_IDEMPOTENCE = PASS
SYNC_CROSS_FARM = DENIED_403
SYNC_NO_AUTH = DENIED_401
SANITARIO_NO_AUTH = DENIED_401
SANITARIO_AUTHENTICATED = DENIED_403
SANITARIO_SERVICE_ROLE = PASS_200
SANITARIO_REMOTE_E2E = PASS_1_OF_1
SANITARIO_REPLAY_IDEMPOTENCE = PASS
SANITARIO_FIXTURE_CLEANUP = PASS
ACL_REMOTE_REHEARSAL = PASS
```

O Advisor remoto reportou somente exposições já classificadas pelo contrato: duas tabelas
internas sanitárias com RLS e zero policies e RPCs `SECURITY DEFINER` intencionalmente
executáveis pelas roles explicitamente listadas. A matriz ACL/fingerprints não apresentou
drift entre reconstruções.

## Gates locais e higiene

| Comando | Resultado |
| --- | --- |
| `node scripts/codex/validate-security-definer-exposure.mjs` | PASS — 35 funções, zero `PUBLIC EXECUTE` |
| `node scripts/codex/validate-sanitario-reconcile-auth-contract.mjs` | PASS |
| `node scripts/codex/validate-supabase-baseline-functional.mjs` com confirmação de DB local descartável | PASS — 5/5 |
| `node scripts/codex/validate-superadmin-security-gate.mjs` | PASS |
| `pnpm test -- --run` | PASS — 390 arquivos, 3.019 testes |
| `pnpm run lint` | PASS |
| `pnpm run build` | PASS — warnings não bloqueantes de chunk/import dinâmico |
| `pnpm run gates:docs` | PASS |
| `git diff --check` | PASS |
| `pnpm run gates:scope` | PASS em F24.1E — allowlist explícita do closeout, sem liberar `docs/**` ou `supabase/**` genericamente |

O reset remoto final deixou zero usuários, fazendas e pastos das fixtures F24. O worktree e o
runner temporários usados no rehearsal foram removidos após a validação.

## Estado de saída

```ini
F24.1C_STAGING_CREATION = DEFERRED
REMOTE_INTEGRATION_BASELINE = VERIFIED
ACL_DATABASE_REHEARSAL = PASS
ACL_REMOTE_REHEARSAL = PASS
PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
F24.1_TECHNICAL = CLOSED
F24.1_REPOSITORY_CLOSEOUT = PR_READY_FOR_REVIEW
F24.2 = READY_NOT_STARTED
```

F24.1D.1 alterou somente o contrato HTTP do handler e seu teste; não houve migration, DDL,
RLS, policy, grant ou mudança de semântica do domínio. F24.2 pode ser iniciada apenas por uma
tarefa nova e explicitamente autorizada.
