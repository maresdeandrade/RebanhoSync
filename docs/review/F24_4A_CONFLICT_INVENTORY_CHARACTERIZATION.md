# F24.4A — Multi-device conflict inventory / characterization

Atualizado em: 2026-09-23

## Decisão

```ini
F24_4A = READY_FOR_REVIEW
F24_4 = IN_PROGRESS

RUNTIME_CHANGE = 0
SCHEMA_CHANGE = 0
REMOTE_CHANGE = 0
PRODUCTION_CHANGE = 0

NEXT = F24_4B_CONCURRENT_EVENT_WRITES
```

O inventário encontrou proteções diferentes por trilho. Replay da mesma identidade, isolamento
por fazenda, ownership local, ACK e reconciliação durável continuam preservados. O caminho
genérico, porém, não possui revisão/CAS para `UPDATE` ou `DELETE`: o servidor aplica por chave
primária + `fazenda_id`, e a ordem de chegada decide o estado remoto. Isso permite lost update e
regressão silenciosa de estado quando dois devices alteram o mesmo agregado.

Nenhuma política nova de resolução de conflitos foi implementada. F24.4 não está concluída.

## Baseline

```text
branch: main
HEAD: fd746a2b73946f5609afd1b23575a94e4346d115
origin/main: fd746a2b73946f5609afd1b23575a94e4346d115
worktree inicial: limpa
```

Últimos merges relevantes:

- `fd746a2` — merge do closeout F24.3;
- `ddd1ba3` — merge de CI com seleção de testes por risco;
- `045e35d` — merge da certificação F24.3C de crash/restart lógico.

## Escopo e contratos preservados

- Agenda permanece intenção/tarefa futura.
- Evento permanece fato histórico e append-only.
- `state_*` permanece estado atual/read model.
- Protocolo permanece regra/configuração.
- `EVENT_IDENTITY`, `IDEMPOTENT_REPLAY`, `ATOMIC_ACK`, `ATOMIC_CLAIM`,
  `SYNCING_RECOVERY`, `STALE_WORKER_PROTECTION`, `DURABLE_RECONCILIATION`,
  `GENERATION_GUARD`, `LOCAL_USER_OWNERSHIP` e `FARM_AWARE_REPLACE` não foram reabertos.

## Arquitetura observada

```text
writer local
→ createGesture
→ queue_gestures + queue_ops + mutação otimista Dexie na mesma transação
→ syncWorker (claim local exclusivo)
→ sync-batch
→ caminho genérico ou RPC especializada
→ resultado por operação
→ ACK atômico + obligation com generation_id
→ pull replace/merge com proteção de pending
```

### Identidade

| Identidade               | Geração/escopo                                    | Uso atual                                                   |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| `client_id`              | `localStorage`, por perfil de browser             | origem do cliente; não é owner                              |
| `client_tx_id`           | UUID no `createGesture` ou pré-gerado pelo writer | gesto e retry/replay local                                  |
| `client_op_id`           | UUID por operação ou pré-gerado                   | identidade remota da mutação; unique na maioria das tabelas |
| `event_id` / `evento_id` | UUID do writer                                    | identidade do fato e detalhe                                |
| `domain_op_id`           | comandos especializados                           | identidade de domínio sanitária/estoque                     |
| `operation_id`           | comercial v2                                      | identidade do comando transacional                          |
| `source_task_id`         | Agenda de origem                                  | impede segunda execução factual da mesma Agenda ativa       |
| `generation_id`          | obligation local                                  | impede drain antigo de apagar reconciliação nova            |

Replay só é reconhecido quando a identidade persistida coincide. Mesma PK com outra operação é
conflito. Payload de negócio igual com IDs independentes não é identidade causal compartilhada.

### Fila, ACK e reconciliation

- `queue_gestures` é chaveada por `client_tx_id`; `queue_ops`, por `client_op_id`.
- `createGesture` persiste gesto, operações e aplicação local em uma transação Dexie.
- O worker serializa trabalho local e impede dois workers da mesma base de enviarem o mesmo gesto.
- O ACK remove operações, encerra o gesto e grava obligations de reconciliação atomicamente.
- Obligations são isoladas por `(fazenda_id, scope)`; cada novo ACK troca `generation_id`.
- `pullDataForFarm` busca tudo antes de gravar; `replace` é usado para a fazenda ativa e `merge`
  para reconciliação de fazenda não ativa.
- Rows com operação pendente são protegidas contra row remoto, ausência remota e tombstone.
- Após consumir a fila, o remoto volta a ser canônico para o pull.

### Caminho remoto genérico

- `INSERT`: insert direto; replay pré-consulta PK e exige `client_op_id` + `client_tx_id` iguais.
- `UPDATE`: `update(record).match({ PK, fazenda_id })`.
- `DELETE`: soft-delete com `deleted_at = server now`, por `{ PK, fazenda_id }`.
- Não há `expected_revision`, versão, comparação de `updated_at`, predicado `deleted_at is null`
  ou CAS no caminho genérico.
- Triggers substituem `updated_at` por `now()` no servidor; o timestamp registra a aplicação, mas
  não prova que o writer partiu do estado mais recente.

### Caminhos especializados

- Sanitário v2: ledger por fazenda + `client_op_id` e por tipo + `domain_op_id`, fingerprint,
  `expected_revision` e conflito explícito `40001`.
- Comercial v2/compra individual: RPC transacional, locks e fingerprint/replay; conflito de
  composição/estado é explícito.
- Reprodução: fato append-only, validação de dependências e comparação de conteúdo para replay
  da mesma identidade; ramificação de correção é conflito.
- Estoque sanitário: identidade por `client_op_id`, `domain_op_id` e chave lógica
  `(source_evento_id, insumo_lote_id, tipo)`.

## Inventário de writers

Os writers abaixo cobrem todas as superfícies encontradas que geram fatos, estado, Agenda ou
configuração pela fila compartilhada. Funções de leitura e catálogos pull-only não são writers.

| Writer real                                                   | Domínio / tipo                                                                                                          | Local → remoto                                           | Identidade e escopo                                               | Replay / concorrência atual                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `createGesture`                                               | infraestrutura                                                                                                          | `queue_*` + store mapeada → `sync-batch`                 | tx/op UUID, `fazenda_id`, owner local                             | replay igual é no-op; updates concorrentes genéricos não têm CAS                                    |
| `buildEventGesture`                                           | pesagem, movimento, reprodução, sanitário legado, nutrição, pastagem, financeiro, comercial, óbito, ECC / EVENT + STATE | `event_eventos` + detail + states → tabelas homônimas    | `eventId`, tx/op, fazenda; `source_task_id` quando há Agenda      | mesma identidade protegida; IDs independentes coexistem; state acoplado pode sofrer LWW por chegada |
| `commercialOperationCommand` / `commercialOperationSync`      | compra/venda / EVENT + STATE                                                                                            | envelope `commercial_operation_v2` → RPC                 | `operation_id`, tx/op, fazenda, snapshot de animais               | fingerprint/lock; concorrência unitária coberta, PostgreSQL real não executado nesta auditoria      |
| `animalPurchaseSync`                                          | compra individual / EVENT + STATE                                                                                       | animal + Evento + detalhe → RPC                          | operação, tx, IDs factuais e fazenda                              | transacional e idempotente por identidade; sem prova cross-device remota nesta execução             |
| `registerReproductionEvent` e `buildEventGesture` reprodutivo | reprodução / EVENT + STATE + AGENDA                                                                                     | Evento, detail, cria, Agenda → caminho genérico validado | evento/episódio/birth event, tx/op, fazenda                       | replay por identidade/conteúdo; fatos distintos coexistem; projeção ordena por `occurred_at`        |
| `sanitaryCorrections` / execução sanitária v2                 | sanitário / EVENT + STATE                                                                                               | envelope `sanitario_v2` → RPCs                           | `domain_op_id`, tx/op, agenda + revision                          | ledger/fingerprint/CAS; divergência explícita                                                       |
| `Financeiro` / `transactions` / `corrections`                 | financeiro / STATE + EVENT                                                                                              | `finance_transactions`, categorias e Eventos             | UUID, `source_event_id`, `reverses_transaction_id`, tx/op/fazenda | insert/replay protegido; update genérico continua sem revision                                      |
| `consumoGesture` e tela `Insumos`                             | inventário / STATE                                                                                                      | insumos, lotes, apresentações, movimentações             | UUID; consumo sanitário também usa source/domain op               | consumo especializado tem chave lógica; demais updates são LWW por chegada                          |
| `pastoOcupacoes` e manejo                                     | pastagem/movimentação / EVENT + STATE                                                                                   | ocupação, lote/pasto/animal e Evento                     | UUID/evento/tx/op/fazenda                                         | eventos coexistem; estado final genérico depende da ordem de aplicação                              |
| CRUD `Animal*`, `Lote*`, `Pasto*`, `Contrapartes`             | cadastro / STATE                                                                                                        | `state_*` → tabelas base                                 | PK + tx/op/fazenda                                                | insert por identidade; update/delete sem CAS                                                        |
| `animalSocietyRegistration` e `RegistrarSociedadeSection`     | sociedade / STATE + EVENT                                                                                               | sociedades, vínculos, animal e peso factual              | UUID + tx/op/fazenda                                              | constraints evitam algumas duplicatas; updates sem revision                                         |
| `FarmProtocolManager`, `officialCatalog`, `customization`     | protocolo/config / CONFIG                                                                                               | protocolos, itens, config da fazenda                     | PK + tx/op/fazenda                                                | unique protege identidade; edição concorrente sem revision                                          |
| Agenda controllers, reprodução e biossegurança                | Agenda / AGENDA                                                                                                         | `state_agenda_itens` → `agenda_itens`                    | ID, `dedup_key`, source tx/op/evento                              | dedup ativa e origem factual protegem alguns duplicados; updates sem revision                       |
| `importV2`                                                    | cadastro em lote / STATE                                                                                                | animais, lotes e pastos                                  | IDs/chunks/op persistidos, fazenda                                | replay do mesmo chunk preserva identidade; colisão de outro device é por PK/constraint              |

## Matriz canônica por operação/agregado

| Domínio / writer           | Fonte              | Mesmo fato A+B                                                      | Fatos distintos A+B                                            | Ordem invertida / stale                                                   | Delete/tombstone                                                             | Proteção                                  | Convergência                                    | Classificação |
| -------------------------- | ------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- | ------------- |
| Eventos genéricos          | EVENT              | mesma identidade: um; IDs distintos: dois                           | coexistem                                                      | append-only; read models podem ordenar por relógio cliente                | soft-delete permitido, business update bloqueado                             | PK, unique op, source Agenda, append-only | fatos convergem; semântica de duplicata parcial | PARTIAL       |
| Pesagem/ECC                | EVENT              | conteúdo igual + IDs distintos produz dois fatos                    | coexistem                                                      | “último” usa `occurred_at`; empate usa regra local/ID conforme selector   | tombstone chega por pull                                                     | PK/op; sem dedup semântica                | histórica sim; latest depende do timestamp      | PARTIAL       |
| Movimentação               | EVENT + STATE      | Evento por ID; mesma origem não é universal                         | ambos os Eventos persistem                                     | `animal.lote_id`/`lote.pasto_id` vence por chegada, não por ordem factual | stale update pode ser ACK em row tombstonada                                 | anti-teleporte no batch, FK, append-only  | fato preservado; state pode regredir            | GAP_CONFIRMED |
| Reprodução                 | EVENT + read model | replay idêntico é no-op; identidade divergente conflita             | fatos válidos coexistem                                        | projeção reconstrói por `occurred_at` + ID                                | correção append-only; delete factual não é fluxo normal                      | validação causal/branch                   | parcial; relógio ainda participa                | PARTIAL       |
| Sanitário v2 Agenda        | AGENDA/STATE       | ledger deduplica                                                    | comandos distintos sujeitos a revision                         | CAS por `expected_revision`                                               | closures/tombstones controlados                                              | ledger, fingerprint, revision, gate       | unitariamente comprovada; remoto bloqueado      | PARTIAL       |
| Sanitário factual v2       | EVENT              | domain op/fingerprint deduplica                                     | fatos legítimos coexistem                                      | append-only; agenda fecha sob revision                                    | tombstone conservador no pull                                                | ledger + domain op + constraints          | local comprovada                                | PARTIAL       |
| Comercial v2               | EVENT + STATE      | mesma operação/fingerprint: replay                                  | operações distintas serializam estado elegível                 | lock/estado atual rejeita venda repetida                                  | estado de animal protegido pela RPC                                          | RPC transacional + locks                  | unitária comprovada; teste PG skipped           | PARTIAL       |
| Estoque                    | STATE/ledger       | consumo especializado deduplica                                     | movimentos distintos coexistem                                 | saldo é aplicado transacionalmente; cadastro/edição genérica é LWW        | update/delete genérico sem revision                                          | checks, source event, chaves lógicas      | mista                                           | PARTIAL       |
| Cadastro animal/lote/pasto | STATE              | mesma PK e identidade: replay; outra identidade em INSERT: conflito | updates em campos distintos podem se sobrescrever parcialmente | último request aceito vence; sem stale detection                          | update stale pode ser aceito após tombstone; ressurreição depende do payload | PK, farm, RLS, server `updated_at`        | remoto converge, intenção pode ser perdida      | GAP_CONFIRMED |
| Agenda genérica            | AGENDA             | dedup ativa/`source_task_id` cobre origens conhecidas               | itens distintos coexistem                                      | status concorrente é LWW genérico                                         | soft-delete vs update sem CAS                                                | unique dedup/source event                 | parcial                                         | PARTIAL       |
| Protocolo/config           | CONFIG             | PK/op protegem replay                                               | edições distintas na mesma row conflitam silenciosamente       | LWW por chegada                                                           | delete/update sem CAS                                                        | PK, RLS, alguns uniques                   | remoto converge com lost update possível        | GAP_CONFIRMED |

## Classes de conflito obrigatórias

| Classe                              | Comportamento observado                                                                                                                                | Resultado                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| A — mesmo fato lógico               | mesma identidade converge para um; conteúdo igual com identidades independentes produz dois Eventos; Agenda/domain op podem fornecer causalidade extra | PARTIAL                                    |
| B — fatos distintos                 | IDs factuais distintos coexistem; constraints especializadas podem rejeitar fatos semanticamente incompatíveis                                         | SAFE para preservação, PARTIAL transversal |
| C — mesmo `state_*`                 | update remoto só casa PK + fazenda; não há revision/CAS genérico                                                                                       | GAP_CONFIRMED                              |
| D — evento + projeção fora de ordem | Eventos permanecem; state genérico acompanha chegada e pode divergir da ordem de `occurred_at`                                                         | GAP_CONFIRMED                              |
| E — offline prolongado A/B          | pending local é preservado no pull; state remoto ainda aceita stale writer depois                                                                      | PARTIAL                                    |
| F — reconnect invertido             | em writers genéricos, A→B e B→A podem terminar com estados finais diferentes                                                                           | GAP_CONFIRMED                              |
| G — delete/tombstone vs update      | pending local é protegido antes do ACK; remoto não tem revision nem `deleted_at is null` no update genérico                                            | GAP_CONFIRMED                              |
| H — cross-farm                      | queue, match remoto, pull, obligations, RLS e testes mantêm `fazenda_id`                                                                               | SAFE no escopo executado                   |
| I — ownership/session               | mesmo owner permitido; owner diferente, `UNKNOWN` e ausência de owner falham fechados                                                                  | SAFE no escopo executado                   |

## Eventos factuais e identidade cross-device

Para Eventos genéricos, “mesmo fato” técnico significa a mesma PK factual acompanhada da mesma
identidade de operação/gesto. Dois devices geram `client_id`, tx/op e `eventId` independentes.
Sem `source_task_id`, `domain_op_id`, `operation_id` ou outra causa compartilhada, o sistema não
consegue distinguir duplicidade humana de dois fatos legítimos apenas pelo conteúdo.

Não é seguro deduplicar por animal, data aproximada, descrição, peso ou hash de payload: esses
campos também podem representar fatos legítimos distintos. A F24.4B deve definir identidade
causal por classe factual, sem apagar fatos válidos.

## `state_*` / read models

```ini
STATE_STALE_WRITE_PROTECTION = GAP_CONFIRMED
STATE_OUT_OF_ORDER_PROTECTION = GAP_CONFIRMED
STATE_REBUILDABILITY = PARTIAL
STATE_FACTUAL_TRACEABILITY = PARTIAL
```

- Estado genérico não tem versionamento e não é reconstruído universalmente a partir de fatos.
- Reprodução e alguns read models de métricas são reconstruíveis do histórico ordenado.
- Movimento grava Evento + state no mesmo gesto local, mas o servidor processa operações com
  resultados por op; dois gestos de devices distintos não formam uma transação conjunta.
- Pull garante convergência com o remoto e protege pending, mas não detecta que o remoto aceitou
  um writer stale.

## Timestamps e ordenação

| Campo                                                | Autoridade observada                                                                           | Uso                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `client_recorded_at`                                 | CLIENT_GENERATED                                                                               | auditoria da captura e metadado do gesto           |
| `queue_gestures.created_at` / `queue_ops.created_at` | CLIENT_GENERATED                                                                               | ordem da fila local                                |
| `occurred_at`                                        | CLIENT_GENERATED ou informado pelo usuário                                                     | tempo factual e ordenação de projeções/read models |
| `created_at` remoto                                  | SERVER_GENERATED por default, salvo superfícies especializadas que materializam snapshot local | criação/auditoria                                  |
| `updated_at` remoto                                  | SERVER_GENERATED por trigger                                                                   | cursor de pull e última aplicação remota           |
| `server_received_at`                                 | SERVER_GENERATED                                                                               | auditoria de recebimento                           |
| `revision` sanitária                                 | SERVER_GENERATED                                                                               | CAS explícito                                      |
| `generation_id`                                      | CLIENT_GENERATED local                                                                         | guarda de obligation, não ordem de domínio         |

`buildEventGesture` usa `new Date().toISOString()` quando o instante não é informado. Diversos
read models escolhem o fato mais recente por `occurred_at`; reprodução desempata instantes iguais
por ID. Portanto o relógio do device pode participar da precedência factual sem sequência de
servidor ou detecção de skew.

```ini
CLIENT_CLOCK_AUTHORITY = GAP_CONFIRMED
SERVER_ORDERING_AUTHORITY = PARTIAL
CLOCK_AUTHORITY_RISK = GAP_CONFIRMED
```

O `updated_at` servidor ordena pulls, mas não resolve precedência semântica entre writes.

## Banco / Supabase

Proteções confirmadas:

- RLS/membership e escopo por `fazenda_id` no `sync-batch` e policies;
- PKs, FKs compostas relevantes, checks e unique `client_op_id`;
- Eventos base/detalhes protegidos contra business update por trigger append-only;
- unique de Evento por `source_task_id` ativo;
- ledger/fingerprint/domain op e revision sanitários;
- RPCs comerciais transacionais com locks e validação do snapshot atual;
- timestamps `updated_at` gerados no servidor.

Lacunas confirmadas:

- updates/deletes genéricos não possuem revision/CAS;
- o handler não exige row ativa (`deleted_at is null`) para update;
- sucesso do update genérico não classifica stale write ou delete/update como conflito;
- duas escritas individualmente válidas podem, juntas, perder intenção de estado sem violar
  constraint, especialmente cadastro, configuração e projeções de movimento.

## Evidência multi-client

```ini
MULTI_CLIENT_LOGICAL = PROVEN
REAL_MULTI_DEVICE = NOT_PROVEN
REAL_POSTGRES_CONCURRENCY = NOT_PROVEN_THIS_RUN
```

Os testes usam instâncias lógicas e mocks/IndexedDB no mesmo processo. Existe teste PostgreSQL
com duas conexões para comercial v2, mas ele ficou `skipped` nesta execução por ausência de
`REBANHOSYNC_TEST_DB_URL`. O harness Playwright existe; não foi ampliado. F24.4D deverá usar dois
`BrowserContext`/perfis e storages independentes, com reconnect controlado.

## Gaps confirmados

| ID        | Severidade | Cenário/evidência                                                                                           | Impacto                                                                                                        |
| --------- | ---------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F24.4A-G1 | P1         | dois devices atualizam a mesma row; match remoto contém apenas PK + fazenda                                 | lost update/stale state silencioso; reconnect invertido muda o vencedor                                        |
| F24.4A-G2 | P1         | Evento de movimento e state chegam em ordens distintas; Eventos coexistem, state genérico é LWW por chegada | `state_*` pode contradizer a ordem factual e regredir operacionalmente                                         |
| F24.4A-G3 | P1         | update genérico não exige `deleted_at is null` nem revision                                                 | update stale pode ser ACK em row tombstonada; perda silenciosa e ressurreição não são universalmente impedidas |
| F24.4A-G4 | P1         | `occurred_at` pode nascer do relógio cliente e define “mais recente” em projeções                           | clock skew pode alterar estado/read model e vínculo causal                                                     |

## Limitações / NOT_PROVEN

- concorrência PostgreSQL real do comercial v2 não rodou nesta sessão;
- dois browsers/processos e IndexedDB independentes não foram executados;
- reconexões A→B e B→A não foram observadas ponta a ponta contra backend real;
- ressurreição por payload concreto de writer atual não foi reproduzida; a ausência de guarda
  remota foi confirmada, por isso a proteção transversal permanece insuficiente;
- nem todo domínio possui identidade semântica capaz de definir “mesmo fato”; não se inferiu
  deduplicação por conteúdo;
- rollout sanitário v2 continua externamente bloqueado, logo CAS remoto não foi recertificado.

## Testes executados

| Arquivo/grupo                                                                                  | Cenário                                                                       | Resultado observado               |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------- |
| 6 arquivos offline: identidade, farm-switch, financeiro, delete, movimento e cutover sanitário | identidade distinta, pending/tombstone, multi-farm, pull idempotente/ordenado | 34/34 PASS                        |
| `ownership.test.ts`                                                                            | mesmo owner, MISMATCH, UNKNOWN, logout e leitura tenant                       | 11/11 PASS                        |
| `rules.test.ts`                                                                                | replay persistido, PK + fazenda, constraints, anti-teleporte                  | PASS dentro do grupo de 81 testes |
| `sanitario-v2.test.ts`                                                                         | revision, ledger/replay, conflito e cross-farm                                | PASS dentro do grupo de 81 testes |
| `commercial-operation-v2.test.ts`                                                              | envelope, conflito de estado e response-lost replay                           | PASS dentro do grupo de 81 testes |
| `commercialOperationV2Concurrency.test.ts`                                                     | duas conexões PostgreSQL                                                      | 4 SKIPPED; não conta como PASS    |

Total efetivamente executado e aprovado: `10` arquivos, `115` testes. Um arquivo adicional e
seus `4` testes foram skipped.

## Matriz final F24.4A

```ini
EVENT_CONCURRENT_WRITE = PARTIAL
EVENT_DUPLICATE_CROSS_DEVICE = PARTIAL

STATE_STALE_WRITE_PROTECTION = GAP_CONFIRMED
STATE_OUT_OF_ORDER_PROTECTION = GAP_CONFIRMED
STATE_REBUILDABILITY = PARTIAL
STATE_FACTUAL_TRACEABILITY = PARTIAL

DELETE_UPDATE_CONFLICT = GAP_CONFIRMED
TOMBSTONE_RESURRECTION_PROTECTION = PARTIAL

CLIENT_CLOCK_AUTHORITY = GAP_CONFIRMED
SERVER_ORDERING_AUTHORITY = PARTIAL

CROSS_DEVICE_IDEMPOTENCY = PARTIAL
CROSS_DEVICE_CONVERGENCE = PARTIAL
MULTI_FARM_CONFLICT_ISOLATION = SAFE
OWNERSHIP_CONFLICT_ISOLATION = SAFE

MULTI_CLIENT_LOGICAL = PROVEN
REAL_MULTI_DEVICE = NOT_PROVEN

DATA_LOSS_RISK = P1_STATE_INTENT_LOSS
SILENT_CONFLICT_RISK = P1_CONFIRMED
```

## Recomendação de sequenciamento

1. **F24.4B — Concurrent Event Writes:** definir e testar identidade causal por classe factual,
   começando por movimentação/pesagem e distinguindo replay, duplicidade humana e fatos legítimos.
2. **F24.4C — State Projection Conflicts:** introduzir contrato de revision/CAS e precedência
   factual para state, incluindo delete/update e rebuild; somente após a identidade factual.
3. **F24.4D — Cross-device Offline/Reconnect:** dois storages independentes, reconnect invertido,
   ACK perdido, pull e comparação local A/local B/remoto.
4. **F24.4E — Conflict Resolution Contract:** tabela por domínio para rejeitar, mergear,
   reconciliar ou exigir intervenção, sem política genérica destrutiva.
5. **F24.4F — Integrated Certification:** repetir a matriz no browser/API/Postgres, incluindo
   cross-farm, ownership, tombstone e relógios divergentes.

A primeira subfase a atacar deve ser **F24.4B**, porque a política de state da F24.4C depende de
saber quais fatos concorrentes são independentes, duplicados ou causalmente incompatíveis.
