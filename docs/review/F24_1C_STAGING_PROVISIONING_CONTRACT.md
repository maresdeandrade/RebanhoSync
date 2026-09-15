# F24.1C — Isolated Staging Provisioning Contract

Atualizado em: 2026-09-14
Baseline: `main@93c3d1dd8401488139454c69c2a6595ae46abaa5`
Decisão atual: **DEFERRED — SECOND STAGING NOT REQUIRED PRE-PRODUCTION**

## Reclassificação autoritativa — 2026-09-14

Este contrato foi produzido sob a premissa histórica de que `zqloazqzhwauamcejmuz` continha
produção operacional. A premissa foi substituída: o projeto é integração remota descartável,
não há backend nem dados de produção. O contrato abaixo permanece como evidência histórica,
mas sua execução foi cancelada/deferida.

```ini
REMOTE_ENVIRONMENT = zqloazqzhwauamcejmuz
REMOTE_ENVIRONMENT_CLASS = DISPOSABLE_INTEGRATION
REMOTE_RESET_ALLOWED = true
PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
ENVIRONMENT_ISOLATION = NOT_REQUIRED_PRE_PRODUCTION
F24.1C_STAGING_CREATION = DEFERRED
F24.1C.1 = DEFERRED
F24.2 = NOT_STARTED
```

Nenhum segundo projeto Supabase foi criado. A continuação migrou para a F24.1D no ambiente
existente; veja [F24_1D_REMOTE_ACL_REHEARSAL.md](./F24_1D_REMOTE_ACL_REHEARSAL.md).

## Registro histórico preservado

## Escopo executado

Esta entrega encerra somente a F24.1C.0. Foi realizado preflight local e inventário remoto
read-only. Nenhum projeto foi criado, nenhuma migration ou seed foi aplicada, nenhuma Edge
Function foi implantada e nenhuma configuração de Auth, Storage, secret ou Vercel foi
alterada.

```ini
REGION = sa-east-1
POSTGRES_MAJOR = 17
ENVIRONMENT = staging
PRODUCTION_DATA = prohibited

PRODUCTION_PROJECT_REF = zqloazqzhwauamcejmuz
STAGING_PROJECT_REF = NOT_ASSIGNED
```

Qualquer comando futuro deve rejeitar explicitamente
`project_ref = zqloazqzhwauamcejmuz` e operar a partir de uma cópia temporária isolada. O
workspace não deve ser relinkado para evitar troca acidental do alvo produtivo.

## Fato confirmado

- O projeto `zqloazqzhwauamcejmuz` é produção e permaneceu inalterado.
- `main@93c3d1dd8401488139454c69c2a6595ae46abaa5` contém exatamente as 49 migrations
  canônicas, de `00000000000000` até `20260908070000`.
- Os repairs remotos `20260901192728` e `20260901192731` não pertencem ao baseline
  canônico e não podem ser aplicados como migrations independentes.
- As migrations `20260913232253` e `20260914014309` pertencem à F24.1D e não podem entrar
  na reconstrução pré-F24.1.
- O cliente usa somente email/senha. Não há chamada de OAuth, SMS, login anônimo ou provider
  externo no fluxo atual.
- `sync-batch` e `telemetry-ingest` leem `APP_ORIGIN`. `test-auth` e
  `sanitario-reconcile` não leem essa variável.
- O frontend usa o bucket `avatars` para upload opcional de foto e persiste a URL pública em
  `user_profiles.avatar_url`. Não há bucket ou policy de Storage declarada no repo.
- A versão do worktree de `sanitario-reconcile` chama
  `internal_sanitario_recompute_agenda_for_fazenda`, criada somente pela migration
  `20260914014309`. Ela não é compatível com a baseline pré-F24.1.

## Contrato de criação do projeto

A F24.1C.1 exige autorização explícita separada. Depois dela:

1. criar um projeto novo chamado de forma inequívoca como RebanhoSync staging, na organização
   autorizada, região `sa-east-1`, sem importação de dados ou usuários;
2. gerar e armazenar a senha do banco por canal secreto; nunca incluí-la em documento, commit,
   log ou argumento registrado;
3. registrar somente `project_ref`, região, versão PostgreSQL e `created_at`;
4. abortar se o novo `project_ref` coincidir com produção ou se o PostgreSQL não for major 17;
5. confirmar por dupla checagem que o projeto é descartável, exclusivo de staging e autorizado
   para reset/rebuild.

A CLI atual permite escolher `sa-east-1`, mas não expõe flag para escolher o major do
PostgreSQL. Portanto, `POSTGRES_MAJOR = 17` é um gate pós-criação obrigatório, não uma
suposição.

## Materialização imutável da baseline

Não usar o diretório de trabalho atual, pois ele contém as duas migrations candidatas e a
Edge Function candidata. A execução futura deve materializar em diretório temporário apenas o
conteúdo de `main@93c3d1dd8401488139454c69c2a6595ae46abaa5` e vinculá-lo exclusivamente ao
novo ref de staging.

Antes de qualquer push, validar no diretório temporário:

```ini
CANONICAL_MIGRATIONS = 49
FIRST_MIGRATION = 00000000000000_rebuild_base_schema_sanitario.sql
LAST_MIGRATION = 20260908070000_c4_1b_subsumed_operational_cleanup.sql
REPAIR_20260901192728 = ABSENT
REPAIR_20260901192731 = ABSENT
F24_1_MIGRATION = ABSENT
F24_1A1_MIGRATION = ABSENT
```

Aplicar primeiro migrations e depois o seed sanitário idempotente de `supabase/seed.sql`.
Nenhum dump, usuário, objeto de Storage ou dado produtivo pode ser importado.

## Baseline estrutural pré-F24.1 esperada

Os gates devem comparar catálogo ordenado e fingerprints, não apenas contagens. As contagens
de referência são:

| Superfície | Esperado |
| --- | ---: |
| migrations canônicas | 49 |
| relações públicas | 68 |
| tabelas públicas com RLS | 62/62 |
| views públicas | 6 |
| policies públicas | 148 |
| funções/RPCs públicas | 59 |
| funções públicas `SECURITY DEFINER` | 34 |
| triggers | 76 |
| colunas | 1.125 |
| constraints | 450 |
| índices | 306 |

Os 34 `SECURITY DEFINER` são a baseline anterior à F24.1A.1. A candidata adiciona duas
funções públicas, das quais uma é `SECURITY DEFINER`, levando o estado pós-F24.1A.1 a 61 e
35 respectivamente. Esse estado posterior não pode ser usado para aprovar a F24.1C.1.

Também devem ser capturados table/view grants, function grants, default privileges, RLS,
policies e inventário `SECURITY DEFINER`. A ausência conhecida de `service_role EXECUTE` no
recompute é parte da baseline pré-F24.1, não deve ser corrigida na C.1.

## Auth de staging

Contrato mínimo derivado do cliente e de `supabase/config.toml`:

```ini
AUTH_PROVIDER = email_password
EMAIL_SIGNUP = enabled
EMAIL_CONFIRMATIONS = disabled_for_controlled_staging_tests
ANONYMOUS_SIGN_IN = disabled
SMS_SIGNUP = disabled
EXTERNAL_OAUTH_PROVIDERS = disabled
JWT_EXPIRY_SECONDS = 3600
REFRESH_TOKEN_ROTATION = enabled
MINIMUM_PASSWORD_LENGTH = 6
PRODUCTION_USERS_IMPORT = prohibited
PRODUCTION_PROVIDER_CREDENTIALS_COPY = prohibited
```

`SITE_URL` deve ser a URL HTTPS fixa do deployment dedicado de staging. Redirect URLs devem
ser uma lista explícita contendo essa URL e apenas os callbacks de Preview realmente
necessários. `localhost` pode permanecer somente para testes locais e nunca deve ser o
`SITE_URL` hospedado. A URL literal deve ser registrada e revisada na F24.1C.1 antes de
qualquer `config push`; a configuração local não deve ser enviada sem um overlay de staging.

Usuários de teste devem ser sintéticos, sem emails, telefones ou memberships copiados de
produção.

## APP_ORIGIN

Consumidores:

- `supabase/functions/sync-batch/index.ts`;
- `supabase/functions/telemetry-ingest/index.ts`.

Quando ausente, o array recebe string vazia e o header CORS recua para
`http://localhost:5173`. O código também aceita qualquer origem terminada em `.vercel.app`.
Assim, `APP_ORIGIN` é configuração CORS, não autenticação nem fronteira de autorização.

O valor correto é exatamente o mesmo `STAGING_FRONTEND_ORIGIN` HTTPS usado como `SITE_URL`,
sem barra final. Na F24.1C.1, ele deve ser provisionado por arquivo temporário ignorado e com
permissão restrita usando `supabase secrets set --env-file`; não deve aparecer na linha de
comando, documentação ou logs. Os secrets nativos `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` devem ser os gerenciados pelo novo projeto, nunca cópias de
produção.

A aceitação ampla de `*.vercel.app` permanece caveat de código e deve ser tratada em tarefa
separada. Ela não pode ser apresentada como isolamento.

## Storage `avatars`

O bucket é necessário para a funcionalidade opcional de avatar; não é dependência do core de
sync ou da reconstrução do schema. Contrato mínimo:

```ini
BUCKET_ID = avatars
PUBLIC = true
FILE_SIZE_LIMIT = 5 MiB
ALLOWED_MIME_TYPES = image/jpeg,image/png,image/webp
OBJECT_PATH = <auth.uid()>/<timestamp>.<extension>
```

Policy mínima em `storage.objects`:

- `INSERT` somente para `authenticated`;
- `bucket_id = 'avatars'`;
- primeiro segmento do objeto igual a `(select auth.uid())::text`;
- nenhum `INSERT`, `UPDATE` ou `DELETE` para `anon`;
- nenhuma permissão ampla por `service_role` adicionada pela aplicação.

O bucket público satisfaz a leitura usada por `getPublicUrl`; não autoriza upload. O fluxo
atual cria nomes novos e não usa upsert, portanto `UPDATE` não é necessário. O botão de
remoção limpa apenas `avatar_url` e não exclui o objeto; objetos órfãos são risco conhecido e
não justificam ampliar grants nesta etapa.

Como bucket e policies não estão declarados no repo, a F24.1C.1 deve provisioná-los como
configuração explícita registrada no relatório do ambiente. Torná-los declarativos e
reproduzíveis no repo exige tarefa forward-only separada; não editar migration histórica nem
inserir uma migration posterior antes das candidatas F24.1.

## Edge Function baseline

A fonte canônica pré-F24.1 é o blob Git da baseline, não o deployment produtivo nem o
worktree sujo.

| Função/arquivo | Blob em `main@93c3d1dd…` | Produção observada | Ação autorizável na C.1 |
| --- | --- | --- | --- |
| `sync-batch/index.ts` | `1a5ca3e99ea2ca7760b3e0990774cefef207d873` | v25, delta conhecido | deploy do blob baseline, `verify_jwt=true` |
| `test-auth/index.ts` | `85f43bb80e05957f0635d2d0a76d5de011acd929` | v5, conteúdo equivalente | deploy somente staging, `verify_jwt=false` |
| `telemetry-ingest/index.ts` | `d029e0e353ec8eba7a92bba2841c8f6cefb7ea6b` | v2, conteúdo equivalente | deploy do blob baseline, `verify_jwt=true` |
| `sanitario-reconcile/index.ts` | `8749fa1f3778f4fd4a445ea02466b345ed2cfd1b` | v1, delta conhecido | **não fazer deploy na C.1** |
| `deno.json` | `674863da2297bb2675a84bec7fa35978df7043c9` | delta conhecido | usar o blob baseline |

`sanitario-reconcile` é exceção de segurança explícita. O blob pré-F24.1 aceita qualquer
header `Authorization` não vazio antes de operar com cliente `service_role`; a versão segura
do worktree (`b4780a997df45aa05b39002100d6520cb17be1b6`) exige o wrapper ainda ausente. Para não
expor a primeira nem implantar a segunda quebrada, a função fica ausente no staging durante a
C.1. Na F24.1D, após aplicar as duas migrations candidatas, implantar a versão candidata com
`verify_jwt=true` e executar o E2E real.

`test-auth` com `verify_jwt=false` é diagnóstico exclusivo de staging. Deve ser validada para
não retornar secrets e não faz parte de uma futura promoção produtiva automática.

## Frontend e feature flags

Development e Preview poderão apontar para staging somente depois de o ambiente passar os
gates. O conjunto é:

```ini
VITE_SUPABASE_URL = URL pública do novo staging
VITE_SUPABASE_ANON_KEY = chave pública do novo staging
VITE_SUPABASE_FUNCTIONS_URL = <staging-url>/functions/v1
```

Nenhuma variável `VITE_*` pode conter `service_role`. Production continua apontando para
`zqloazqzhwauamcejmuz` e não será alterada. Flags sanitárias permanecem fail-closed/off até
gate específico; configuração de frontend não substitui autorização server-side.

## Gates da futura F24.1C.1

1. novo ref diferente de produção, `sa-east-1`, PG major 17 e zero dados produtivos;
2. exatamente 49 migrations canônicas e nenhum repair/candidata no histórico;
3. catálogo estrutural, RLS, policies, RPCs, grants e defaults comparados à baseline;
4. Auth conforme contrato, com usuário sintético e isolamento de tenant;
5. `APP_ORIGIN` e URLs apontando somente para staging;
6. bucket `avatars` e policy de upload own-folder verificados com autorizado/outsider;
7. `sync-batch`, `telemetry-ingest` e `test-auth` implantadas dos blobs fixados;
8. `sanitario-reconcile` ausente até F24.1D;
9. varredura final confirma zero referência ao ref produtivo em config/runtime do staging;
10. snapshots pré-F24.1 armazenados sem credenciais.

## Inferência e pendências para autorização

- O novo `project_ref`, `created_at` e versão minor do PostgreSQL só existirão após criação.
- A URL HTTPS fixa do frontend de staging ainda não foi escolhida; ela deve ser fornecida ou
  criada na etapa autorizada antes de configurar Auth e `APP_ORIGIN`.
- Storage `avatars` continuará configuração não versionada até uma tarefa declarativa
  forward-only específica.

## Recomendação

Autorizar a F24.1C.1 somente junto da URL HTTPS fixa de staging e do responsável pelo novo
projeto. A execução deve seguir este contrato em materialização temporária da baseline,
registrar os gates sem secrets e parar novamente antes da F24.1D. Não criar o ambiente se o
origin permanecer indefinido ou se não for possível comprovar PG 17, finalidade exclusiva e
permissão de reset.

## Estado de saída da F24.1C.0

```ini
PRODUCTION_BACKEND = zqloazqzhwauamcejmuz / UNCHANGED
STAGING_BACKEND = NOT_AVAILABLE
STAGING_PRODUCTION_ISOLATION = BLOCKED

STAGING_PROVISIONING_CONTRACT = COMPLETE
STAGING_CREATION = REQUIRES_EXPLICIT_AUTHORIZATION
STAGING_PRE_F24_1_BASELINE = PLANNED

AUTH_STAGING_CONFIG = CONTRACT_DEFINED
APP_ORIGIN_STAGING = CONTRACT_DEFINED_VALUE_PENDING
AVATARS_STORAGE_CONTRACT = VERIFIED
EDGE_FUNCTION_BASELINE = VERIFIED_WITH_SANITARIO_HOLD

REMOTE_APPLICATION = NOT_AUTHORIZED
ACL_REMOTE_REHEARSAL = NOT_READY_STAGING_ABSENT
PRODUCTION_PROMOTION = NOT_AUTHORIZED

F24.1C.0 = CLOSED
F24.1C.1 = NOT_STARTED_REQUIRES_AUTHORIZATION
F24.1C = READY_PENDING_AUTHORIZATION
F24.1D = NOT_READY
F24.2 = NOT_STARTED
```

Próximo gate: autorização explícita para criar o novo projeto, acompanhada da definição do
`STAGING_FRONTEND_ORIGIN`. Essa autorização não inclui F24.1D nem produção.
