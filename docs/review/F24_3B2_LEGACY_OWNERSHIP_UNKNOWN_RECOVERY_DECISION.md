# F24.3B2 — Legacy Ownership Unknown Recovery Decision

Atualizado em: 2026-09-23

Status: **DECISION PRESERVED — EXPLICIT UNKNOWN RESET IMPLEMENTED**

> Status posterior: F24.3B2.1 implementou o caminho seguro recomendado neste documento.
> `UNKNOWN` continua fail-closed e sem auto-adoption; somente confirmação destrutiva explícita
> remove a base local não verificável, e o ownership canônico é estabelecido no bootstrap da
> base nova. Evidências e matriz final: [closeout F24.3](./F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md).

Baseline auditada: `origin/main@a19f1476a25dfb32363cef832fb919a174d020c8`

Branch: `codex/f24-3b2-legacy-ownership-recovery`

Status: **READY_FOR_REVIEW**

## Decisão

```ini
LEGACY_V30_TO_V31_UNKNOWN = CONFIRMED

QUEUE_GESTURE_USER_ID = ABSENT
QUEUE_OP_USER_ID = ABSENT
QUEUE_REJECTION_USER_ID = ABSENT

QUEUE_USER_PROVENANCE = ABSENT_IN_ENVELOPE_UNSAFE_IN_ARBITRARY_PAYLOAD
DOMAIN_USER_PROVENANCE = AMBIGUOUS
LOCALSTORAGE_USER_PROVENANCE = CORROBORATING_ONLY
SUPABASE_SESSION_PROVENANCE = CORROBORATING_ONLY
FARM_MEMBERSHIP_PROVENANCE = AMBIGUOUS
CLIENT_ID_PROVENANCE = UNSAFE

DOMAIN_RECORD_USER_ID_CAN_PROVE_DB_OWNER = NO
CLIENT_ID_AS_OWNER_PROOF = UNSAFE
PERSISTED_SUPABASE_SESSION_EXISTS = IMPLEMENTATION_DEPENDENT
PERSISTED_SESSION_PROVES_LEGACY_DB_OWNER = NO

LEGACY_OWNER_PROVENANCE = AMBIGUOUS
SAFE_AUTO_ADOPTION = NO

CURRENT_SESSION_ALONE_SUFFICIENT = NO
FARM_MEMBERSHIP_ALONE_SUFFICIENT = NO

CROSS_USER_ISOLATION = PRESERVED
PENDING_WORK_IDENTITY = PRESERVED
NEW_DEXIE_MIGRATION = NO
RUNTIME_OWNERSHIP_MUTATION = NO
REMOTE_CHANGE = 0
PRODUCTION_CHANGE = 0
```

Não existe fonte anterior à v31 com semântica explícita de proprietário do banco local. Há
UUIDs canônicos em sessão, chaves de UI, memberships e alguns registros, mas eles representam
identidade autenticada corrente, escopo de UI, membro, autor, ator ou objeto do payload. Esses
valores podem coexistir para usuários diferentes no mesmo banco e não satisfazem o padrão
`LEGACY_DB_OWNER_USER_ID == CURRENT_SUPABASE_SESSION_USER_ID` com semântica inequívoca.

Consequentemente, `UNKNOWN -> OWNED` automático permanece proibido.

## FATO CONFIRMADO

1. A v31 cria `local_ownership` e grava `owner_user_id = null` durante upgrade de banco
   legado. `establishLocalOwnership` não substitui esse `null` pela sessão atual.
2. Antes da v31, `queue_gestures`, `queue_ops` e `queue_rejections` não possuíam campo de
   usuário no envelope. Seus vínculos estáveis são de client/operação/transação e fazenda.
3. `queue_ops.record` usa shape genérico e `queue_rejections.payload` é arbitrário. Um
   `user_id`, `created_by` ou `invited_by` ali pode identificar o objeto manipulado, outro
   membro ou qualquer valor produzido pelo payload; não autentica o banco.
4. `client_id` é criado localmente como `browser:<crypto.randomUUID()>`, persiste na chave
   `gestao_agro_client_id` e é reutilizado como identidade de cliente/dispositivo. Não existe
   binding persistido entre ele e `Supabase session.user.id`.
5. `UserFazenda`, `UserSettings` e `UserProfile` existem como tipos/contratos, mas não há
   store Dexie v30 dedicada para eles. Membership e settings são consultados remotamente por
   `useAuth`; operações genéricas ainda podem carregar esses shapes na fila.
6. Campos `created_by` e `closed_by` encontrados em dados locais significam autoria/ator.
   Catálogos podem vir do servidor, closures podem ser executados por membros distintos e
   payloads de domínio podem conter UUIDs de terceiros.
7. `active_fazenda_id` guarda apenas fazenda. Dois usuários podem ter membership válida na
   mesma fazenda, e um único usuário pode possuir dados locais de várias fazendas.
8. `createClient(url, publishableKey)` usa no browser `persistSession: true` e a chave padrão
   `sb-<project-ref>-auth-token`. A presença dessa sessão é dependente do estado do browser;
   `signOut` remove a sessão e outro login a substitui. A sessão identifica o usuário atual,
   não o criador/proprietário histórico do IndexedDB.
9. Os gates de leitura, escrita, pull, replay, recovery e reconcile continuam exigindo
   ownership `OWNED`. Nenhum gate foi alterado nesta fase.

## INFERÊNCIA

- Um UUID igual ao usuário atual pode aparecer em agenda UI, membership, autoria, fechamento
  ou payload porque esse usuário usou alguma parte da aplicação. Isso corrobora uso, mas não
  prova ownership exclusivo do banco.
- A ausência de fila não reduz o risco: cache local e fatos continuam tenant-sensitive.
- A presença de vários UUIDs válidos é comportamento compatível com fazenda compartilhada e
  torna a proveniência legada ambígua, não recuperável por votação, frequência ou interseção.

## Matriz de proveniência

| Fonte | Existia antes v31? | Persiste localmente? | Contém UUID usuário? | Semântica real | Classificação |
| --- | ---: | ---: | ---: | --- | --- |
| `local_ownership.owner_user_id` | Não | Sim, desde v31 | Sim ou `null` | Proprietário explícito da base local | `ABSENT` para legado |
| `queue_gestures` | Sim | Dexie | Não | Gesture por fazenda/client/transação | `ABSENT` |
| `queue_ops` (envelope) | Sim | Dexie | Não | Operação idempotente por op/transação | `ABSENT` |
| `queue_ops.record` | Sim | Dexie | Pode conter | Payload genérico e fabricável do domínio | `UNSAFE` |
| `queue_rejections` (envelope) | Sim | Dexie | Não | Evidência técnica de rejeição | `ABSENT` |
| `queue_rejections.payload` | Sim | Dexie | Pode conter | Payload arbitrário/auditável da rejeição | `UNSAFE` |
| `client_id` / `gestao_agro_client_id` | Sim | Dexie + localStorage | Não é user UUID | Identidade de browser/cliente, regenerável e compartilhável | `UNSAFE` |
| `created_by`, `closed_by`, `invited_by`, `user_id` em domínio | Sim, conforme store/payload | Dexie em registros/payloads | Pode conter | Autor, ator, convidador, membro ou objeto da operação | `AMBIGUOUS` |
| `user_fazendas` / role | Contrato remoto pré-v31 | Não como store dedicada; pode aparecer em fila | Sim | Membership de uma fazenda compartilhável | `AMBIGUOUS` |
| `gestao_agro_active_fazenda_id` | Sim | localStorage | Não | Fazenda ativa de UI | `AMBIGUOUS` |
| `gestao_agro_agenda_ui_v1:<user>:<farm>` | Sim | localStorage | Sim, na chave | Preferência de UI escopada; várias chaves podem coexistir | `CORROBORATING_ONLY` |
| `sb-<project-ref>-auth-token` | Sim, por default do SDK | localStorage quando disponível e autenticado | Sim | Sessão autenticada atual/mais recente | `CORROBORATING_ONLY` |
| cursor de telemetria | Sim | localStorage | Não | Cursor por fazenda | `ABSENT` |
| dedup de lembrete sanitário | Sim | localStorage | Não | Fazenda/data/dedup de notificação | `ABSENT` |
| timestamp de purge de rejeições | Sim | localStorage | Não | Manutenção global da fila | `ABSENT` |
| flag sanitária v2 | Sim | localStorage | Não | Project ref de staging/feature flag | `ABSENT` |

Nenhuma linha anterior à v31 é `AUTHORITATIVE`.

## Auditoria das stores Dexie até v30

Foram inspecionadas as famílias `state_*`, `event_*`, `queue_*`, `sync_*`, `metrics_events`,
`catalog_*` e `ops_sanitario_*` declaradas por `OfflineDB` até a versão 30.

- `state_*`: estado/read model e cache por fazenda; não é histórico nem ownership.
- `event_*`: fato e detalhes factuais; podem conter ações de usuários diferentes.
- `queue_*`: preservam identidade de retry/replay, mas não user binding.
- `sync_*`: cursor, cutover e obrigação de reconcile por fazenda/escopo; não usuário.
- `metrics_events`: telemetria por fazenda; não usuário.
- `catalog_*`: pull-only/global ou tenant; autoria de catálogo não é proprietário local.
- `ops_sanitario_*`: agenda operacional e closure; `closed_by` é ator do fechamento.

## Cenários C1–C7

| Cenário | Evidência observada | Resultado seguro |
| --- | --- | --- |
| C1 — A retorna após upgrade | Sessão A pode coincidir com autores/chaves, mas não há binding do banco | `UNKNOWN`; sem adoção automática |
| C2 — B entra no dispositivo de A | Sessão Supabase pode ser substituída por B e active farm pode mudar | B permanece bloqueado |
| C3 — A e B na mesma fazenda | Membership comprova acesso remoto à fazenda, não criação do IndexedDB | `same farm != ownership` |
| C4 — várias fazendas | Stores e filas são escopadas por fazenda, mas ownership v31 é por usuário | Não derivar owner por fazenda |
| C5 — `created_by = B` | B pode ser autor de um registro dentro do banco de A | Não adotar por `created_by` |
| C6 — fila vazia | Cache, fatos e read models continuam sensíveis | Gate continua fechado |
| C7 — fila pendente | IDs e estados PENDING/ERROR/SYNCING sobrevivem ao upgrade | Bloquear sem descartar ou regenerar IDs |

## Characterization executável

Os testes de ownership agora registram explicitamente que:

- v30 -> v31 grava `owner_user_id = null` e preserva dado legado;
- sessão atual A ou B, isoladamente, não altera `UNKNOWN`;
- `client_id`, mesma `fazenda_id`, payload de membership e campos de fila não provam owner;
- `created_by` e `closed_by` de domínio não provam owner;
- usuário diferente continua sem leitura local;
- fila, `client_tx_id` e `client_op_id` permanecem preservados.

Os testes de pending work já caracterizam preservação de `PENDING`, `ERROR`, `SYNCING`,
reconciliation obligations, `generation_id`, `client_tx_id` e `client_op_id` no upgrade.

## RISCO

1. Adotar pela sessão atual permite que B herde cache e fila de A no cenário de troca de conta.
2. Adotar por fazenda/membership permite vazamento entre membros legítimos da mesma fazenda.
3. Adotar por payload, autoria ou client ID permite influência por dado arbitrário, importado,
   remoto ou produzido por outro ator.

## Recovery recomendado para fase posterior

Prioridade segura:

1. oferecer reset local explícito, com aviso de que cache e trabalho pendente serão removidos;
2. exigir ação confirmatória do usuário antes de qualquer purge destrutivo;
3. antes do reset, avaliar um export opaco de pending work para suporte/manual recovery que
   preserve integralmente `client_tx_id`, `client_op_id`, `domain_op_id` e `generation_id` e
   não exponha dados tenant-sensitive ao usuário autenticado não comprovado;
4. manter `UNKNOWN` fail-closed enquanto o usuário não escolher um fluxo explícito.

O export só é seguro se for cifrado/opaco, auditável e tratado em um canal capaz de confirmar
o titular original. Sem esse desenho, a implementação posterior deve limitar-se a reset/purge
explícito. Membership remota não pode desbloquear a leitura nem assinar uma adoção retroativa.

Para bancos criados após uma futura mudança, uma proveniência autoritativa deverá ser gravada
no momento da criação, a partir de `session.user.id`, com semântica explícita de owner local.
Isso não recupera bancos v30 já existentes e não autoriza migration retroativa inferencial.

## Alterações desta fase

- `src/lib/offline/__tests__/ownership.test.ts`: characterization de falsos candidatos de
  provenance e preservação do fail-closed.
- `docs/review/F24_3B2_LEGACY_OWNERSHIP_UNKNOWN_RECOVERY_DECISION.md`: matriz, cenários e
  decisão de recovery.

Não houve alteração de runtime, schema Dexie, migration, worker, UI, Supabase, RLS ou RPC.

## Validações

Executadas e aprovadas:

- `pnpm test -- src/lib/offline/__tests__/ownership.test.ts`: 11/11 testes;
- `pnpm test -- src/lib/offline/__tests__/ownership.test.ts src/lib/offline/__tests__/pendingWork.upgrade.characterization.test.ts src/lib/offline/__tests__/syncWorkerInitialPull.test.ts src/lib/offline/__tests__/syncWorkerAuth.test.ts`: 28/28 testes em 4 arquivos;
- `pnpm run lint`: exit code 0;
- `pnpm exec fallow audit --gate new-only`: nenhum achado nos 2 arquivos alterados;
- `pnpm run gates:docs`: todos os gates documentais aprovados;
- `git diff --check`: aprovado.

O fallow registrou 5 achados de dependências herdados e os excluiu do gate `new-only`. Também
emitiu warning de `node_modules` não encontrado durante sua análise, embora as dependências
estejam instaladas e os comandos pnpm tenham executado normalmente. Nenhum desses avisos foi
atribuído ao patch.

Não executados por proporcionalidade:

- suíte global, build e E2E: esta fase altera somente testes e documentação, sem runtime;
- validação Supabase funcional: não houve alteração de Supabase, RLS, RPC ou `sync-batch`;
- migration remota, deploy, push, merge e produção: fora do escopo e não autorizados.
