# F24.1B — Environment Isolation & Promotion Topology Gate

Atualizado em: 2026-09-14
Baseline: `main@93c3d1dd8401488139454c69c2a6595ae46abaa5`
Decisão atual: **SUPERSEDED — REMOTE RECLASSIFIED AS DISPOSABLE INTEGRATION**

## Reclassificação autoritativa — 2026-09-14

A classificação original deste gate inferiu produção operacional a partir do canal Vercel
`Production`. A premissa autoritativa posterior confirmou que esse canal não comprova um
backend produtivo nem dados produtivos. As evidências observadas abaixo são preservadas como
histórico; suas conclusões de topologia foram superadas.

```ini
REMOTE_ENVIRONMENT = zqloazqzhwauamcejmuz
REMOTE_ENVIRONMENT_CLASS = DISPOSABLE_INTEGRATION
REMOTE_RESET_ALLOWED = true
PRODUCTION_BACKEND = NOT_PROVISIONED
PRODUCTION_DATA = NONE
ENVIRONMENT_ISOLATION = NOT_REQUIRED_PRE_PRODUCTION
F24.1C_STAGING_CREATION = DEFERRED
F24.2 = NOT_STARTED
```

Nenhum segundo projeto Supabase deve ser criado nesta fase. O rehearsal autorizado passou a
ser executado no ambiente de integração existente e está registrado em
[F24_1D_REMOTE_ACL_REHEARSAL.md](./F24_1D_REMOTE_ACL_REHEARSAL.md).

## Registro histórico preservado

## Escopo e limites

Esta etapa foi exclusivamente read-only no Supabase e no Vercel. Nenhuma migration foi
aplicada, nenhum projeto foi criado ou alterado, nenhum secret ou environment variable foi
modificado e nenhum deploy foi executado. F24.2 não foi iniciada.

## Fato confirmado

- `zqloazqzhwauamcejmuz` é o backend consumido pelo deployment Vercel Production e também o
  projeto historicamente tratado como staging. Portanto, ele é produção compartilhada, não
  staging isolado.
- O projeto pertence à organização `zrcfplrzfpmihemqaemj`, está ativo em `sa-east-1` e usa
  PostgreSQL `17.6` (`17.6.1.063`). Sua URL pública é
  `https://zqloazqzhwauamcejmuz.supabase.co`.
- O histórico remoto contém 49 migrations canônicas até `20260908070000` e os repairs
  históricos remotos `20260901192728` e `20260901192731`. As candidatas `20260913232253` e
  `20260914014309` permanecem somente locais.
- Não há Supabase Branches no projeto. Os demais projetos visíveis estão inativos e não foram
  validados quanto a propriedade funcional, ausência de dados produtivos ou autorização para
  reset; nenhum deles é candidato automático a staging.
- As Edge Functions remotas ativas são `sync-batch` v25, `test-auth` v5,
  `telemetry-ingest` v2 e `sanitario-reconcile` v1. A comparação read-only do conteúdo remoto
  com o repositório encontrou delta em `sanitario-reconcile/index.ts`,
  `sync-batch/index.ts`, `sync-batch/rules.ts` e `supabase/functions/deno.json`; os demais
  módulos auxiliares inspecionados coincidem.
- Os secrets gerenciados `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
  `SUPABASE_SERVICE_ROLE_KEY` existem remotamente. O código também lê `APP_ORIGIN`, que não
  aparece na lista remota. Somente nomes e digests foram consultados; nenhum valor secreto foi
  recuperado ou registrado.
- O projeto não possui custom domain habilitado. `pg_cron` e `pg_net` não estão instalados,
  não há buckets de Storage e não há tabelas da aplicação publicadas em
  `supabase_realtime`.
- O frontend exige `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e
  `VITE_SUPABASE_FUNCTIONS_URL`. No Vercel, as três variáveis existem de forma criptografada
  para Development, Preview e Production. Seus valores não foram lidos nem alterados.
- O código de perfil usa o bucket público `avatars`, mas migrations, seed e `config.toml` não
  o provisionam. A baseline local de Auth em `config.toml` não comprova a configuração Auth
  hospedada. Não existe workflow no repositório que promova migrations ou Edge Functions
  remotamente.

## Inventário reprodutível

| Item | Estado observado | Classificação |
| --- | --- | --- |
| PostgreSQL e região | PG 17.6 em `sa-east-1`; repo fixa major 17 | `CONFIG_ONLY` |
| Schema, RLS, policies, grants e RPCs | definidos pelas migrations locais | `REPRODUCIBLE_FROM_REPO` |
| Histórico produtivo de migrations | 49 canônicas + 2 repairs remotos históricos | `PLATFORM_MANAGED` |
| Repairs `20260901192728` / `20260901192731` | evidência histórica, não migrations canônicas | `PLATFORM_MANAGED` |
| Edge Functions | fontes no repo; versões/deploys são estado da plataforma | `REPRODUCIBLE_FROM_REPO` |
| Auth hospedado | baseline local conhecida; configuração remota não certificada | `UNKNOWN` |
| Secrets nativos do Supabase | provisionados por projeto | `PLATFORM_MANAGED` |
| `APP_ORIGIN` | necessário para allowlist; ausente no inventário remoto | `CONFIG_ONLY` |
| URLs Supabase e Functions | derivadas do novo `project_ref` | `CONFIG_ONLY` |
| Frontend Vite | três variáveis públicas por ambiente | `CONFIG_ONLY` |
| Chaves de cada ambiente | devem ser provisionadas sem cópia entre projetos | `SECRET_REQUIRED` |
| Storage `avatars` | usado pelo frontend, sem baseline declarativa | `UNKNOWN` |
| Cron | não usado/instalado no backend atual | `PLATFORM_MANAGED` |
| Realtime | serviço disponível; zero tabelas publicadas | `PLATFORM_MANAGED` |
| Seed sanitário | `supabase/seed.sql`, habilitado e idempotente | `REPRODUCIBLE_FROM_REPO` |
| Feature flags | fontes/configuração no repo; rollout continua fail-closed | `REPRODUCIBLE_FROM_REPO` |
| Promoção CI/CD | automação remota ausente | `UNKNOWN` |

## Inferência

- Development e Preview podem apontar para o mesmo projeto produtivo, pois o Vercel registra
  as mesmas chaves nos três targets e seus valores permanecem criptografados. Isso não foi
  comprovado e deve ser tratado como isolamento não verificado.
- Um staging vazio ainda não pode ser reconstruído exclusivamente do repo com equivalência
  integral: banco, ACL, RLS, RPCs, seed e fontes Edge são declarativos, mas Auth hospedado,
  bucket `avatars`, `APP_ORIGIN`, secrets e roteamento Vercel exigem configuração explícita.
- Supabase Branching não oferece nesta situação a evidência de isolamento operacional exigida
  para Auth, Edge Functions, Storage e resets completos. Um projeto dedicado é a opção de
  menor ambiguidade.

## Recomendação de topologia

Criar, somente após autorização explícita, um novo projeto Supabase dedicado a staging na
organização correta, em `sa-east-1`, com PostgreSQL major 17. Antes do primeiro reset, registrar
proprietário, finalidade exclusiva, ausência de dados/usuários produtivos, autorização de
rebuild e responsáveis por secrets e custo. Não reutilizar projeto inativo sem essa mesma
certificação.

```text
Local
  -> Supabase local

Vercel Preview/Staging
  -> novo Supabase staging dedicado

Vercel Production
  -> zqloazqzhwauamcejmuz (produção; sem rehearsal)
```

Até a criação autorizada:

```ini
STAGING_BACKEND = NOT_AVAILABLE
STAGING_PRODUCTION_ISOLATION = BLOCKED
```

## Matriz Vercel/frontend

| Ambiente frontend | Supabase ref | Classificação |
| --- | --- | --- |
| Development | `UNKNOWN` (valor criptografado) | `ISOLATION_UNVERIFIED` |
| Preview | `UNKNOWN` (valor criptografado) | `ISOLATION_UNVERIFIED` |
| Production | `zqloazqzhwauamcejmuz` | `PRODUCTION_BACKEND_CONFIRMED` |

Objetivo futuro: Development/Preview devem receber exclusivamente as credenciais públicas do
novo staging; Production deve continuar apontando exclusivamente para produção. Essa troca
exige tarefa separada, autorização explícita e validação sem expor valores.

## Plano de rehearsal remoto ACL

Após o staging dedicado existir e ser certificado:

1. capturar o inventário vazio e confirmar PG 17, região, Auth, Storage e secrets esperados;
2. aplicar as 49 migrations canônicas na ordem, sem converter os dois repairs remotos em
   migrations canônicas;
3. aplicar `20260913232253_f24_acl_forward_only_reconciliation.sql` e depois
   `20260914014309_f24_1a1_sanitario_reconcile_backend_wrapper.sql`;
4. capturar fingerprints de table/view grants, function grants, default privileges, policies,
   RLS e funções `SECURITY DEFINER`;
5. validar grants finais, as duas RPCs públicas intencionais, zero `PUBLIC EXECUTE`, acesso
   mínimo de `service_role`, contratos de `authenticated`, cross-farm e wrapper sanitário;
6. implantar no staging a versão do repo de `sanitario-reconcile` somente depois das
   migrations e executar o fluxo Edge real, retry/idempotência e falhas de autorização;
7. executar E2E e soak no staging, comparar novamente os fingerprints e produzir decisão de
   promoção separada.

O plano está pronto, mas sua execução permanece bloqueada pela ausência do staging e não
autoriza aplicação em produção.

## Recovery forward-only

Antes de cada promoção futura, exportar em ordem estável e versionar como artefato de
rehearsal os snapshots de table/view grants, function grants, default privileges, RLS,
policies e inventário `SECURITY DEFINER`, com fingerprints reproduzíveis.

Não existe rollback destrutivo automático. Qualquer restauração de contrato deve ser uma nova
migration corretiva forward-only, explícita, revisada contra os snapshots e novamente
submetida aos gates. A migration já aplicada nunca deve ser editada.

## Matriz final

```ini
PRODUCTION_BACKEND = zqloazqzhwauamcejmuz / ACTIVE_PRODUCTION
STAGING_BACKEND = NOT_AVAILABLE

STAGING_PRODUCTION_ISOLATION = BLOCKED
STAGING_BASELINE_REPRODUCIBLE = PARTIAL

AUTH_CONFIG_DELTA = PARTIAL
EDGE_FUNCTION_DELTA = KNOWN
SECRETS_CONFIG_DELTA = KNOWN

ACL_REMOTE_REHEARSAL_PLAN = READY
SCOPE_GATE = OPEN_GOVERNANCE_DEBT

REMOTE_APPLICATION = NOT_AUTHORIZED
PRODUCTION_PROMOTION = NOT_AUTHORIZED

F24.1B = CLOSED
F24.1C = READY
F24.2 = NOT_STARTED
```

`F24.1C = READY` significa apenas que a próxima tarefa pode solicitar e, se autorizada,
provisionar o staging dedicado seguindo este contrato. Não autoriza criação, configuração,
migration, deploy ou promoção por esta etapa.
