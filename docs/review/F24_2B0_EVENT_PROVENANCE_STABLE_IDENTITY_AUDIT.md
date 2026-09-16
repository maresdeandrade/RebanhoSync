# F24.2B0 — Event provenance and stable identity audit

## Decision

```text
F24.2B0 = CLOSED
P0_STATUS = NOT_CONFIRMED
ROOT_CAUSE_CLASSIFICATION = G — P0 não confirmado
F24.2B1 = READY_FOR_REVIEW
F24.2B = READY_FOR_CLOSEOUT
F24.2 = IN_PROGRESS
```

Esta conclusão vale para `main@b3e5ed170bafd81c451d9d916502b26fe49e8392`. A auditoria foi diagnóstica: nenhum writer, worker, schema Dexie, RPC, Edge Function ou migration foi alterado.

## Baseline

| Item | Resultado |
| --- | --- |
| branch | `main` |
| HEAD | `b3e5ed170bafd81c451d9d916502b26fe49e8392` |
| origin/main | `b3e5ed170bafd81c451d9d916502b26fe49e8392` |
| ahead/behind | `0/0` |
| worktree antes da auditoria | clean |

## Conclusão executiva

- **CONFIRMED:** `createGesture` cria UUIDs distintos para transação e operações, mas os persiste atomicamente com a mutação local. Retry e restart reutilizam esses IDs; não há regeneração no worker.
- **CONFIRMED:** o `event_id` é identidade do registro factual. `client_tx_id` identifica o gesto e `client_op_id` identifica cada mutação enfileirada. Nenhum deles deve ser inferido por similaridade do conteúdo do Evento.
- **CONFIRMED:** o backend genérico considera replay somente quando a PK já existe e `client_op_id` e `client_tx_id` armazenados coincidem. A mesma PK com outra identidade é conflito, não replay.
- **CONFIRMED:** Agenda, sanitário v2 e comercial v2 acrescentam proveniência causal própria (`source_task_id`, `domain_op_id`/ledger ou `operation_id`) e enforcement transacional.
- **CONFIRMED:** duas invocações independentes do writer genérico, sem IDs fornecidos, criam duas identidades e podem criar dois fatos de conteúdo igual. Isso é necessário para permitir execuções causalmente distintas.
- **NOT CONFIRMED:** não foi encontrado caminho técnico de retry, response-lost, restart ou replay que pegue **a mesma execução causal já persistida** e a reconstrua com novos IDs. Logo, não há sequência concreta que prove `DUPLICATE_EVENT` como P0 nesta baseline.
- **UNKNOWN:** não existe, no código inspecionado, identidade causal compartilhável entre dispositivos para um fato ad hoc sem Agenda ou operação especializada. Sem uma origem causal comum, não é possível distinguir automaticamente replay cross-device de duas ações legítimas; criar deduplicação por conteúdo violaria o domínio.

## Inventário de writers de Evento

Legenda: todos os itens desta tabela são **CONFIRMED** por código, migration ou teste, exceto quando marcados `UNKNOWN`.

| Domínio / writer | Arquivo e função | Origem e persistência | Identidades e proveniência | Backend / enforcement | Restart, retry e multi-device | Testes / P0 |
| --- | --- | --- | --- | --- | --- | --- |
| Writer factual genérico: sanitário legado, alerta sanitário, conformidade, comercial legado, pesagem, movimentação, nutrição, pastagem, financeiro, reprodução, ECC e óbito | `src/lib/events/buildEventGesture.ts`, `buildEventGesture` | Ações de Registrar, Eventos, detalhe/transições do animal, pastos, manejo e overlay regulatório. Cria `event_eventos` e detalhe em Dexie via `createGesture`; envia por `queue_gestures`/`queue_ops` | `event_id`: UUID criado pelo builder ou fornecido; `client_tx_id` e um `client_op_id` por op: criados/persistidos por `createGesture`; `source_task_id` somente quando fornecido. O builder genérico não preenche `source_tx_id`, `source_client_op_id` ou `domain_op_id` | `sync-batch` insere usando a PK do registro, persiste metadados de operação e aceita replay apenas com PK + op + tx iguais. PK, índices únicos de `client_op_id`; Agenda acrescenta unique `(fazenda_id, source_task_id)` | A transação Dexie inclui fato, detalhes, gesto e ops. Worker reenvia os IDs persistidos. Entre dispositivos só há proteção compartilhada quando existe `source_task_id` ou outro contrato especializado | `buildEventGesture`, `syncPartialBatch`, `rules`. **P0 não confirmado:** duas chamadas novas são dois comandos; nenhum replay técnico com regeneração foi encontrado |
| Transação financeira e pesagens auxiliares | `src/lib/finance/transactions.ts`, `buildFinancialTransaction` | Writer composto baseado em `buildEventGesture`, posteriormente persistido por `createGesture` | IDs factuais distintos para fato financeiro e fatos de pesagem; identidade operacional adicionada por `createGesture` | Mesmo contrato genérico de PK/op/tx | IDs sobrevivem à fila; não há causal key cross-device adicional no builder | Cobertura de construção financeira existe fora do conjunto focado; **P0 não confirmado** pela mesma razão do writer genérico |
| Peso de entrada da sociedade | `src/pages/Registrar/components/RegistrarSociedadeSection.tsx` | Monta diretamente operações `eventos` + `eventos_pesagem`, com `pesoEventoId`, e chama `createGesture` | `event_id` UUID próprio; op/tx do gesto; sem `source_task_id` | Contrato genérico | Persistência atômica por `createGesture`; sem identidade causal cross-device adicional | `UNKNOWN`: não foi localizado teste dedicado de replay desse caller. Gap de cobertura, não prova de duplicação |
| Operação comercial v2 | `src/lib/comercial/commercialOperationCommand.ts`, `buildCommercialOperationGesture`; `src/lib/comercial/commercialOperationSync.ts` | Cria snapshot congelado e envelope `commercial_operation_v2`; fila local | `operationId` é também `event_id` e `domain_op_id`; envelope preserva `client_op_id`/`client_tx_id` | RPC em `20260813134853_commercial_operation_v2.sql` serializa por advisory lock, consulta por `operation_id`, devolve replay para a mesma operação completa e conflito para divergência | Retry/response-lost reenvia a mesma operação. Multi-device só compartilha causalidade se compartilhar `operationId` | `commercial-operation-v2.test.ts`. **Não vulnerável ao P0 no replay coberto** |
| Compra individual | `src/lib/finance/transactions.ts` e envelope de compra tratado pelo `sync-batch` | Cria animal, Evento comercial e detalhe com IDs congelados; enfileira envelope atômico | IDs de animal/evento e client op/tx são preservados no envelope | `apply_individual_animal_purchase` em `20260808120000_individual_animal_purchase_sync.sql` verifica os registros pela identidade fixa, compara fingerprint apenas após colisão de identidade e aplica tudo na transação | Replay da mesma identidade retorna sucesso; identidade divergente não é convertida em replay semântico | `commercial-purchase.test.ts`. **Não vulnerável ao P0 no replay coberto** |
| Reprodução, parto, aborto e jornadas vinculadas | `src/lib/reproduction/register.ts`, `buildReproductionGesture`, `prepareReproductionGesture`, `registerReproductionGesture`; callers em `postPartum.ts` e `calfJourney.ts` | Evento, detalhe, cria/estado e agendas vinculadas são um gesto Dexie | `event_id` explícito pode ser reutilizado; relações apontam para o Evento; op/tx são persistidos. `resolveExistingOperation` só compara conteúdo depois de localizar a mesma identidade | `sync-batch` usa PK/op/tx e valida dependências reprodutivas | Retry com o mesmo `eventId` é idempotente; falha intermediária faz rollback integral. Cross-device sem ID causal comum permanece ação independente | `register.test.ts` cobre retry, conflito, parto gemelar, aborto e rollback. **Não vulnerável no replay coberto** |
| Agenda sanitária legada → Evento | `src/lib/sanitario/infrastructure/service.ts`; RPC `sanitario_complete_agenda_with_event` em `20260511000000_sanitario_complete_agenda_idempotency.sql` | Conclusão executada remotamente; o RPC cria Evento/detalhe e conclui Agenda na mesma transação | `source_task_id = agenda.id`; source op/tx registrados | Lock da Agenda; se já concluída retorna o Evento existente. Unique parcial `(fazenda_id, source_task_id)` em `20260526000600_idx_eventos_unique_source_task.sql` | Response-lost não autoriza fallback cego; nova chamada encontra a mesma Agenda concluída | `sanitaryRpc.effect.test.ts`, controllers de Agenda. **Protegido pela origem causal da Agenda** |
| Agenda sanitária v2 → execução factual | `src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts`, `executeSanitaryAgendaV2`/batch | Evento, detalhe, animais, estoque, Agenda e fila em uma transação Dexie quando sync está ativo | `event_id` deriva do `clientOpId` no modo sync; Evento guarda `source_task_id`, `source_client_op_id`, `source_sanitario_agenda_v2_id` e `domain_op_id` | Migration `20260722102038_sanitario_sync_v2_expand_foundation.sql`: unique por fazenda para `domain_op_id` e origem de Agenda; ledger `sanitario_sync_v2_operations` por `(fazenda_id, client_op_id)` e `(fazenda_id, operation_kind, domain_op_id)` | Local lookup reconhece execução existente; ledger/RPC distingue replay de divergência; IDs persistem na fila | `sanitaryAgendaExecutionV2.test.ts`, `sanitario-v2.test.ts`. **Não vulnerável no replay coberto** |
| Correção sanitária v2 | `src/lib/sanitario/reconciliation/sanitaryCorrectionV2.ts`, `createSanitaryCorrectionV2` | Novo Evento de correção e relações, atômico com fila | `correctionEventId` é chave explícita; request fingerprint valida divergência sob a mesma identidade; guarda `domain_op_id` | Contrato factual sanitário v2 e ledger | Reexecução da mesma correção é reconhecida; correção causalmente nova recebe nova identidade | Testes próprios existentes, não incluídos no comando focado. **Não vulnerável segundo o contrato inspecionado** |
| Histórico sanitário de entrada v2 | `src/lib/sanitario/history/sanitaryEntryHistoryV2.ts`, `createSanitaryEntryHistoryV2` | Cria Evento/detalhe/relação e operação factual em transação Dexie | Evento armazena source tx/op e `domain_op_id`; fila usa a mesma identidade | RPC/ledger factual sanitário v2 | Retry preserva a identidade da operação já enfileirada | Testes próprios existentes, não incluídos no comando focado. **Não vulnerável segundo o contrato inspecionado** |

### Buscas negativas relevantes

- **CONFIRMED:** a busca nas migrations ativas localizou inserts em `public.eventos` no RPC sanitário legado, no factual sanitário v2, na compra individual e na operação comercial v2.
- **CONFIRMED:** não foi encontrado trigger ativo cuja função seja criar um novo Evento; triggers relacionados preservam data/append-only/guards.
- **CONFIRMED:** imports inspecionados não introduzem um writer remoto paralelo de Evento; criação factual segue os writers acima.
- **INFERENCE:** a lista é completa para a baseline porque combina chamadas ao builder, operações com tabela `eventos`, inserts SQL e RPCs; uma extensão dinâmica fora do repositório seria `UNKNOWN`.

## Mapa de identidades

| Identidade | Quem cria | Persistência / escopo | Estabilidade | Função real |
| --- | --- | --- | --- | --- |
| `event_id` / `eventos.id` | Builder/caller ou contrato especializado | Dexie `event_eventos` e PK remota | Estável depois da gravação local | Identidade do registro factual, não prova universal de execução causal |
| `client_tx_id` / gesture id | `createGesture` ou writer especializado | PK de `queue_gestures`; metadado remoto; contém `fazenda_id` | Estável em restart/retry | Identidade do gesto local, agrupando operações |
| `client_op_id` / queue op id | `createGesture` ou writer especializado | PK de `queue_ops`; índice único remoto por tabela; request do worker | Estável em restart/retry | Identidade de uma mutação técnica |
| `client_id` | `getClientId` | `localStorage`, fila e remoto | Estável por perfil local até limpeza/troca de storage | Identidade da instalação/perfil do navegador, não da execução |
| `source_task_id` | Caller Agenda / backend de conclusão | Evento local/remoto; unique parcial `(fazenda_id, source_task_id)` | Estável enquanto a Agenda existir | Proveniência causal compartilhável da execução de uma intenção |
| `source_tx_id` / `source_client_op_id` | Writers/RPCs especializados | Evento remoto e alguns Eventos locais especializados | Estável quando fornecido | Proveniência técnica; o builder genérico não a preenche no record |
| `operation_id` comercial | Command builder comercial | Envelope, Evento e RPC | Estável | Identidade causal da operação comercial e identidade factual |
| `domain_op_id` sanitário/comercial | Writer especializado | Evento/detalhes/ledger; scoped por fazenda nos contratos v2 | Estável | Identidade de comando de domínio usada para idempotência |
| ledger key sanitária | RPC sanitário v2 | `(fazenda_id, client_op_id)` e `(fazenda_id, operation_kind, domain_op_id)` | Estável | Enforcement de replay e detecção de payload divergente |
| request HTTP | Worker/runtime | Não é a identidade factual | Pode mudar entre tentativas | Transporte; não deve deduplicar fatos |

### Rastreamento genérico fim a fim

1. **CONFIRMED:** o caller cria `event_id` em `buildEventGesture` (UUID, salvo quando recebe ID explícito).
2. **CONFIRMED:** `createGesture` cria ou recebe `client_tx_id`, cria/recebe um `client_op_id` para cada operação e rejeita reutilização incoerente de `client_tx_id`.
3. **CONFIRMED:** uma transação Dexie grava `queue_gestures`, `queue_ops`, Evento e detalhes. Uma falha intermediária aborta o conjunto.
4. **CONFIRMED:** após restart, o worker lê o gesto e as ops persistidos; `mapOperationForSync` serializa os mesmos IDs.
5. **CONFIRMED:** `sync-batch` valida membership da fazenda, força o `fazenda_id` confiável, resolve a PK e consulta o registro existente no mesmo escopo.
6. **CONFIRMED:** PK inexistente é inserida com metadados técnicos; PK existente com op+tx iguais é replay; PK igual com identidade diferente é conflito.
7. **CONFIRMED:** timeout/response-lost deixa a fila com os mesmos IDs; a tentativa seguinte não reconstrói o gesto.
8. **CONFIRMED:** o vínculo causal adicional só existe quando o caller dispõe de Agenda, operation/domain ID ou event ID estável especializado. No writer genérico ad hoc não existe outro token causal cross-device.

## Prova do P0

```text
P0_STATUS = NOT_CONFIRMED
```

Tentativa de sequência:

```text
ação local X
→ Evento E1 + gesto T1 + op O1 persistidos atomicamente
→ servidor aplica E1
→ resposta se perde
→ worker relê T1/O1
→ servidor encontra E1 com O1/T1
→ replay APPLIED, sem E2
```

Essa sequência é coberta por teste e não duplica o fato.

É possível chamar novamente o writer e obter `E2/T2/O2`, mesmo com payload igual. Contudo, a segunda chamada é uma nova execução técnica e, sem Agenda ou token causal compartilhado, não há evidência no repositório de que ela represente a **mesma** execução causal. Rejeitá-la por conteúdo criaria false dedup de fatos legítimos idênticos.

Portanto:

- writer que comprovadamente permite o P0: **nenhum localizado**;
- identidade que diverge em uma nova chamada: event/op/tx, porque é um novo comando;
- identidade que deveria ser compartilhada: **UNKNOWN sem uma origem causal real**;
- vínculo causal perdido por retry/restart: **nenhum localizado**;
- mecanismo que deixa passar o suposto replay: **não aplicável sem prova de que o segundo comando é replay**.

## Root cause classification

```text
G — P0 não confirmado
```

**Evidência:** todos os caminhos técnicos de retry/restart inspecionados reutilizam a fila durável; os caminhos especializados possuem origem causal/enforcement adicional; o único modo comprovado de obter duas PKs é criar dois comandos com identidades novas. Isso não prova duplicação da mesma execução.

As classificações A–F não se sustentam: a identidade técnica existe, persiste, não é regenerada no retry, chega ao backend, é armazenada e possui enforcement. A ausência de uma chave causal universal para ações ad hoc é uma limitação de modelagem cross-device, mas não prova um P0 existente.

## Proteções existentes

- **Genérico:** PK factual + `client_op_id` + `client_tx_id`, transação Dexie e replay estrito no `sync-batch`.
- **Agenda:** `source_task_id`, lock e conclusão transacional; unique parcial por fazenda para Evento ativo.
- **Sanitário v2:** Agenda/origem sanitária, `domain_op_id`, ledger, fingerprint sob identidade já colidida e RPC atômico.
- **Comercial v2:** `operation_id` estável, envelope congelado, lock/RPC atômico; fingerprint somente para detectar divergência da mesma operação.
- **Reprodução:** `event_id` explícito e relações dependentes; replay/conflito sob a mesma PK; rollback integral local.

O padrão reutilizável é: **uma origem causal real fornece uma identidade estável; o backend aplica unicidade no escopo da fazenda; comparação de conteúdo apenas detecta divergência sob a mesma identidade**. Agenda, sanitário e comercial têm causalidade específica. Generalizar `source_task_id`, `domain_op_id` ou um ledger único para todo Evento sem definir a origem de cada comando criaria acoplamento e false dedup.

## Multi-device

### A — replay técnico

Com a mesma identidade causal compartilhada (Agenda, `operation_id`, `domain_op_id` ou a mesma PK/op/tx), múltiplas submissões convergem para um Evento ou conflito explícito. Resultado esperado e coberto nos fluxos especializados: `1 Evento`.

### B — ações independentes

Dois dispositivos gerando comandos novos e payloads iguais têm IDs diferentes e podem produzir `2 Eventos`. Esse é o comportamento correto: conteúdo não é identidade causal.

Para um fato ad hoc, sem Agenda ou comando previamente compartilhado, distinguir A de B é **UNKNOWN**. Uma solução futura só pode tratar como replay o caso em que a mesma identidade causal nasce antes da execução e é efetivamente compartilhada/reutilizada. Não pode inferir replay por animal, tipo, data, timestamp aproximado, peso, procedimento ou hash semântico.

## Multi-tenant / fazenda

- **CONFIRMED:** gesto, op e records locais carregam `fazenda_id`; os stores Dexie de fila têm índice de fazenda.
- **CONFIRMED:** `sync-batch` valida membership do usuário na fazenda recebida e sobrescreve o `fazenda_id` do record com o escopo confiável.
- **CONFIRMED:** lookups de replay em tabelas tenant-scoped acrescentam filtro de fazenda; Agenda e ledgers especializados usam unicidade composta com `fazenda_id`.
- **CONFIRMED:** RLS de Eventos exige membership da fazenda para leitura/escrita.
- **RISCO DE DESENHO FUTURO:** uma chave causal nova jamais deve ser consultada ou tornada única globalmente se isso permitir colisão, leak de existência ou bloqueio cross-farm. O escopo mínimo é `(fazenda_id, causal_identity)`.

## Opções de patch (máximo 3)

### Opção 1 — corrigir a premissa e fixar o contrato por testes

- arquivos prováveis: testes de `buildEventGesture`, `createGesture`, worker e `sync-batch`; documentos F24.2A/B;
- migration/schema Dexie: não;
- offline/dados existentes: totalmente compatível;
- especializados/multi-tenant: sem alteração;
- false dedup: nenhum;
- regressão/complexidade: baixa;
- testes: mesma identidade reaplicada gera um fato; PK igual com identidade divergente conflita; IDs diferentes com conteúdo igual geram dois fatos; mesma Agenda com IDs distintos gera um fato/rejeição explícita; mesma chave de Agenda em fazendas distintas não colide.

### Opção 2 — exigir identidade causal explícita apenas em um workflow comprovadamente compartilhável

- arquivos prováveis: o writer/orquestrador específico, seus tipos, testes e enforcement remoto já existente ou dedicado;
- migration/schema Dexie: somente após prova de ausência no schema real; não definida nesta auditoria;
- offline/dados existentes: exige estratégia de compatibilidade e origem estável antes da primeira gravação;
- especializados: preservar, não substituir, Agenda/ledgers/RPCs atuais;
- multi-tenant: chave sempre composta com fazenda;
- false dedup: médio se a origem causal for mal definida;
- regressão/complexidade: média;
- testes: dois dispositivos com a mesma chave causal convergem; duas chaves distintas com conteúdo igual permanecem dois fatos.

### Opção 3 — ledger causal genérico para todo Evento

- arquivos prováveis: writers, tipos, Dexie, worker, `sync-batch`, schema/migration e RPCs;
- migration/schema Dexie: sim;
- offline/dados existentes: migração e compatibilidade complexas;
- especializados: alto risco de duplicar/substituir contratos válidos;
- multi-tenant: ledger obrigatoriamente por fazenda;
- false dedup/regressão/complexidade: altos;
- testes: matriz completa por domínio, retry, response-lost, upgrade, multi-device e tenant;
- avaliação: não recomendado sem um writer P0 reproduzível.

## Recommended minimal patch — futura F24.2B1

```text
Escolher a Opção 1.
Não criar campo, constraint, tabela, ledger ou migration.
```

Escopo exato recomendado:

1. adicionar testes de caracterização para o contrato `mesma identidade → um fato; identidades distintas → fatos distintos, mesmo com conteúdo igual`;
2. cobrir explicitamente o writer genérico, replay do `sync-batch`, Agenda por `source_task_id` e escopo por fazenda;
3. corrigir nos documentos F24.2A a classificação do cenário `DUPLICATE_EVENT` de P0 comprovado para `NOT_CONFIRMED`, preservando como `UNKNOWN` a causalidade ad hoc cross-device;
4. não alterar runtime; abrir investigação específica somente se um teste/reprodução futura identificar um caminho que regenere identidade da mesma execução causal.

Invariante:

```text
mesma execução/replay + mesma identidade causal → um fato
execuções distintas + identidades distintas → podem gerar fatos de conteúdo igual
```

## Cobertura de teste

Comando focado executado:

```text
pnpm test -- src/lib/events/__tests__/buildEventGesture.test.ts src/lib/offline/__tests__/syncPartialBatch.test.ts src/lib/offline/__tests__/syncWorkerRecovery.test.ts supabase/functions/sync-batch/rules.test.ts supabase/functions/sync-batch/sanitario-v2.test.ts supabase/functions/sync-batch/commercial-operation-v2.test.ts supabase/functions/sync-batch/commercial-purchase.test.ts src/lib/sanitario/execution/__tests__/sanitaryAgendaExecutionV2.test.ts src/lib/reproduction/__tests__/register.test.ts src/pages/Agenda/__tests__/createAgendaActionController.helper.test.ts src/pages/Registrar/__tests__/sanitaryRpc.effect.test.ts
```

Resultado: `11` arquivos e `171` testes passaram.

O conjunto prova:

- construção dos Eventos por domínio;
- atomicidade/rollback local em reprodução e execução sanitária;
- persistência dos mesmos IDs em reload, retry e timeout após commit remoto;
- replay estrito e unique violation não tratada automaticamente como sucesso;
- Agenda/origem, ledger sanitário, RPCs comerciais e erro ambíguo sanitário.

O conjunto não prova:

- execução contra Postgres real de todos os índices/RLS/RPCs (evidência desta parte é estática em migrations);
- causalidade cross-device para fato ad hoc sem token compartilhado;
- caracterização explícita, no mesmo teste, de dois comandos legítimos com payload idêntico e IDs distintos;
- teste dedicado do writer de peso da sociedade.

Essas ausências são gaps de cobertura/definição; não são prova de perda ou duplicação de fato.

## Evidências primárias principais

- `src/lib/offline/ops.ts`: geração/reuso de tx/op, transação Dexie e aplicação local.
- `src/lib/offline/db.ts`: PKs/índices de Evento, gesto e operação.
- `src/lib/offline/syncWorker.ts`: serialização e retry com ops persistidas.
- `src/lib/events/buildEventGesture.ts`: identidade factual e `source_task_id` opcional.
- `supabase/functions/sync-batch/index.ts` e `rules.ts`: escopo, replay e conflito.
- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`: schema factual e unique de `client_op_id`.
- `supabase/migrations/20260526000600_idx_eventos_unique_source_task.sql`: unicidade de Agenda por fazenda.
- `supabase/migrations/20260722102038_sanitario_sync_v2_expand_foundation.sql`: proveniência/ledger sanitário v2.
- `supabase/migrations/20260808120000_individual_animal_purchase_sync.sql`: compra individual atômica/idempotente.
- `supabase/migrations/20260813134853_commercial_operation_v2.sql`: operação comercial atômica/idempotente.

## Estado final

```text
F24.2B0 = CLOSED
F24.2B1 = READY_FOR_REVIEW
F24.2B = READY_FOR_CLOSEOUT
F24.2 = IN_PROGRESS
```
