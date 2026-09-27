# F24.4B — Concurrent Event Writes / Cross-device Causal Identity

Atualizado em: 2026-09-24

## Decisão

```ini
F24_4A = CLOSED
F24_4B = CLOSED
F24_4 = IN_PROGRESS

RUNTIME_CHANGE = 0
SCHEMA_CHANGE = 0
MIGRATION_CHANGE = 0
REMOTE_CHANGE = 0
PRODUCTION_CHANGE = 0

ARCHITECTURAL_DECISION_REQUIRED = AD_HOC_CAUSAL_IDENTITY
NEXT = F24_4C_STATE_CONFLICT_POLICY
```

Replay técnico e causa factual são identidades distintas. O sistema preserva a mesma operação
persistida, reconhece causas compartilhadas já modeladas e mantém fatos legítimos semelhantes.
Para fatos ad hoc sem Agenda, `domain_op_id`, `operation_id` ou outra origem estável, dois devices
não conseguem distinguir duplicidade humana de dois fatos reais. A F24.4B não introduziu
deduplicação por conteúdo, animal, horário, peso, descrição ou janela temporal.

## Baseline

```text
branch: main
HEAD: dcece696deb1f7aa81cf5a0941aec9257239c317
origin/main: dcece696deb1f7aa81cf5a0941aec9257239c317
worktree inicial: limpa
merge relevante: #166 — F24.4A conflict characterization
```

## Objetivo e limites

Esta fase caracteriza concorrência de Eventos e identidade causal cross-device. Permaneceram
fora de escopo:

- revisão/CAS de `state_*`;
- stale write genérico;
- delete/update e tombstone;
- autoridade de relógio cliente;
- UI de conflito;
- certificação real com dois browsers/devices.

Quando um Evento também altera estado, somente o resultado factual foi avaliado:

```text
EVENT_RESULT = CHARACTERIZED
STATE_RESULT = DEFERRED_TO_F24.4C
CLOCK_DEPENDENCY = OBSERVED
CLOCK_AUTHORITY = DEFERRED_TO_F24.4D
```

## Modelo de identidade

| Identidade                       | Classe                    | Compartilhamento cross-device                | Papel confirmado                                                   |
| -------------------------------- | ------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `client_id`                      | `PER_DEVICE`              | `NOT_SHARED`                                 | origem técnica do perfil de browser; não é owner nem causa         |
| `client_tx_id`                   | `PER_GESTURE`             | `NOT_SHARED` por padrão                      | identidade persistida do gesto e do retry local                    |
| `client_op_id`                   | `PER_OPERATION`           | `NOT_SHARED` por padrão                      | identidade da mutação remota; não é causa genérica                 |
| `event_id` / `evento_id`         | `PER_FACT`                | somente se propagado explicitamente          | identidade do registro factual e dos detalhes                      |
| `source_task_id`                 | `PER_CAUSE`               | `SHARED_CROSS_DEVICE`                        | origem em Agenda; unique ativo por fazenda no remoto               |
| `domain_op_id`                   | `PER_CAUSE` especializada | compartilhável quando o comando é preservado | causa sanitária/estoque com ledger e fingerprint                   |
| `operation_id`                   | `PER_CAUSE` comercial     | compartilhável quando o comando é preservado | comando, Evento e lock transacional comercial                      |
| `episode_evento_id` / birth link | antecedente causal        | compartilhável como vínculo                  | episódio/ramo reprodutivo; não substitui a identidade do novo fato |

`client_tx_id` e `client_op_id` provam replay da mutação persistida. Eles não provam que duas
operações novas em devices diferentes representam o mesmo fato físico.

## Inventário factual

| Domínio                   | Writer                                              | Evento/tabela                      | Identidade factual/técnica                                 | Causa existente                                                                | Mesma causa A/B                                                  | Proteção remota                                      | Classificação                                               |
| ------------------------- | --------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Movimentação              | `buildEventGesture` e callers de manejo             | `eventos` + `eventos_movimentacao` | UUID de Evento + tx/op por gesto                           | `source_task_id` é suportado, mas writers manuais inspecionados não o fornecem | somente quando há Agenda explícita                               | PK/op; unique de `source_task_id`; anti-teleporte    | `GAP` para movimento manual; `PARTIAL` com Agenda           |
| Pesagem                   | `buildEventGesture` e peso societário               | `eventos` + `eventos_pesagem`      | UUID de Evento + tx/op                                     | `source_task_id` opcional                                                      | não para pesagem ad hoc                                          | PK/op; unique de Agenda quando presente              | `GAP` ad hoc; `PARTIAL` com Agenda                          |
| Reprodução                | `registerReproductionGesture` / `buildEventGesture` | `eventos` + `eventos_reproducao`   | `eventId`, tx/op e detalhes determinísticos                | episódio, birth event, branch e correção                                       | replay exige o mesmo `eventId`; antecedentes são compartilháveis | validação de dependência/conteúdo e conflito de ramo | `PARTIAL`                                                   |
| Sanitário                 | execução Agenda v2, legado, histórico e correção    | Evento, detalhe, ledger e estoque  | event ID, tx/op e `domain_op_id`                           | Agenda, origem sanitária e domain command                                      | sim quando Agenda/comando é preservado                           | unique por origem, ledger, fingerprint e revision    | `PARTIAL` global; `SAFE` nos fluxos especializados cobertos |
| Comercial                 | `buildCommercialOperationGesture` / RPC v2          | Evento + detalhe comercial         | `operation_id` também identifica o Evento e `domain_op_id` | comando comercial congelado                                                    | sim quando `operation_id` é compartilhado                        | advisory lock, fingerprint e RPC transacional        | `PARTIAL`; replay especializado `SAFE`                      |
| Financeiro                | `buildFinancialTransaction` / `buildEventGesture`   | Evento financeiro e transações     | UUID de Evento + tx/op                                     | Agenda opcional, `source_event_id` e reversão quando aplicável                 | somente em origens explicitamente vinculadas                     | PK/op, FK e unique de reversão                       | `PARTIAL`; fatos manuais permanecem ambíguos                |
| Estoque factual sanitário | `buildConsumoMovimentacaoOp`                        | `insumo_movimentacoes`             | UUID/op + `domain_op_id`                                   | Evento sanitário e lote de insumo                                              | sim sob a mesma execução sanitária                               | chave lógica, fingerprint e validação same-farm      | `SAFE` no consumo sanitário coberto                         |

## Taxonomia causal

### A — `REPLAY_SAME_IDENTITY`

Mesmo Evento, tx, ops e payload persistidos convergem sem duplicar. Conteúdo divergente sob a
mesma identidade é conflito, não replay.

Resultado: `NO_DUPLICATE`.

### B — `SAME_CAUSAL_EVENT_CROSS_DEVICE`

Uma Agenda fornece `source_task_id` compartilhável. Dois devices podem gerar IDs técnicos
diferentes, mas o índice remoto `(fazenda_id, source_task_id)` impede dois Eventos ativos. O
cliente local mantém ambos otimisticamente até o resultado remoto; a segunda inserção recebe
rejeição causal determinística, não replay técnico.

Sanitário e comercial também reconhecem uma causa compartilhada quando `domain_op_id` ou
`operation_id` é preservado. Sem essa propagação, IDs novos representam novos comandos.

Resultado: `PARTIAL`.

### C — `DISTINCT_VALID_EVENTS`

Conteúdo igual não é causa. Duas pesagens reais, tratamentos distintos ou movimentações
distintas permanecem como Eventos separados quando suas identidades causais/factuais diferem.

Resultado: `NO_FALSE_DEDUP`.

### D — `DUPLICATE_HUMAN_ACTION`

O mesmo fato físico lançado manualmente em dois devices sem causa compartilhada é
indistinguível de fatos legítimos semelhantes.

Resultado: `AMBIGUOUS`; `FAIL_CLOSED_ON_AUTOMATIC_DEDUP`.

### E — `CAUSALLY_INCOMPATIBLE_EVENTS`

- movimentações ad hoc: ambos os fatos são aceitos; incompatibilidade de estado é F24.4C;
- reprodução: vínculos de episódio/branch inválidos são rejeitados, mas IDs independentes ainda
  representam fatos independentes até regra causal explícita;
- sanitário: revision, origem de Agenda e ledger detectam divergência nos fluxos v2;
- comercial: locks e estado elegível rejeitam operações incompatíveis na RPC;
- pesagem e financeiro manual: não existe incompatibilidade genérica derivável somente do
  conteúdo.

## Characterization cross-device

O teste novo simula `device A` e `device B` com `client_id`, `client_tx_id`, `client_op_id` e
`event_id` independentes.

| Cenário                                            | Resultado observado                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| mesma identidade persistida                        | um fato, um gesto e duas ops de Evento/detalhe                                      |
| mesma `source_task_id`, IDs técnicos independentes | dois fatos otimistas locais; causa compartilhada preservada para enforcement remoto |
| payload igual, `source_task_id` distintas          | dois fatos preservados                                                              |
| fatos ad hoc iguais, sem causa                     | dois fatos preservados; nenhuma heurística aplicada                                 |
| movimentações recebidas em ordem invertida         | ambos os Eventos e detalhes preservados; state não envolvido                        |

O enforcement remoto da Agenda está no índice parcial
`idx_eventos_unique_source_task`. `normalizeDbError` converte a colisão em rejeição
`agenda_already_completed_by_event`; não mascara a segunda operação como replay.

## Resultados por domínio

### Movimentação

O Evento append-only é preservado mesmo com chegada invertida. Movimentos manuais não possuem
command ID compartilhado entre devices. Agenda pode fornecer `source_task_id`, mas não foi
encontrada como origem nos callers manuais de manejo inspecionados. Não foi criada heurística.

### Pesagem

Duas pesagens iguais podem ser fatos legítimos. Animal, peso e instante não são identidade
causal. Com Agenda, `source_task_id` fornece proteção; sem Agenda, duplicidade humana é ambígua.

### Reprodução

Replay do mesmo `eventId` é idempotente; conteúdo divergente conflita. Episódio, birth event e
branch preservam relações causais especializadas. Eles não autorizam dedup genérico de novos
Eventos com IDs independentes.

### Sanitário

Agenda legada/v2, `domain_op_id`, ledger, fingerprint e revision fornecem proteção explícita.
Histórico externo e correções preservam identidade própria. O contrato existente foi reutilizado;
nenhum fluxo sanitário foi reimplementado.

### Comercial

`operation_id` congela comando, Evento e detalhe. A RPC usa lock e fingerprint, e replay de
resposta perdida reutiliza a mesma identidade. Operações independentes não são deduplicadas por
preço, animais ou horário.

### Financeiro e outros fatos

O writer financeiro suporta `sourceTaskId`, vínculos a Eventos e reversão auditável, mas fatos
manuais não têm causa cross-device universal. Inventário sanitário possui causalidade mais forte
por Evento, lote e `domain_op_id`; CRUD puro de estado não pertence a esta fase.

## Gaps e decisão arquitetural

| Gap                                          | Severidade   | Decisão                                                                                            |
| -------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| movimento manual sem causal ID compartilhado | P2 / ambíguo | não deduplicar; eventual command ID exige ADR e compatibilidade                                    |
| pesagem ad hoc sem origem estável            | P2 / ambíguo | não usar animal+peso+timestamp; avaliar identidade de coleta/instrumento somente com contrato real |
| reprodução independente com IDs novos        | P2 / parcial | preservar contrato especializado; não generalizar episode como identidade do novo fato             |
| financeiro manual sem causa compartilhada    | P2 / ambíguo | usar Agenda/operação externa quando existir; nenhuma chave sintética criada                        |

Uma futura identidade causal ad hoc precisa de definição por domínio, persistência antes do
primeiro write local, propagação no envelope, constraint/ledger remoto e estratégia para clientes
antigos. Esta fase não autoriza esse desenho nem migration.

## Banco e compatibilidade

- nenhuma migration, coluna, constraint, RLS ou RPC foi alterada;
- clientes antigos continuam aceitos sem campo novo obrigatório;
- offline, restart, retry e replay mantêm as identidades já persistidas;
- multi-farm e ownership permanecem contratos fechados;
- `REBANHOSYNC_TEST_DB_URL` não estava disponível;
- `REAL_POSTGRES_CONCURRENCY = NOT_PROVEN`;
- `REAL_MULTI_DEVICE = NOT_PROVEN`.

## Testes

Caracterization inicial:

```text
pnpm exec vitest run \
  src/lib/offline/__tests__/crossDeviceCausalIdentity.characterization.test.ts \
  --reporter=verbose

1 arquivo; 5/5 testes aprovados
```

Matriz factual integrada:

```text
10 arquivos; 165/165 testes aprovados
```

Cobertura integrada: characterization cross-device, movimentação, reprodução, Agenda sanitária
v2, sync sanitário, comando/persistência comercial, RPC comercial, financeiro e regras do
`sync-batch`.

## Matriz final F24.4B

```ini
REPLAY_SAME_IDENTITY = SAFE
SAME_CAUSAL_EVENT_CROSS_DEVICE = PARTIAL
DISTINCT_VALID_EVENTS_PRESERVED = SAFE
FALSE_DEDUPLICATION = NOT_OBSERVED
DUPLICATE_HUMAN_ACTION_DETECTION = AMBIGUOUS

MOVEMENT_CAUSAL_IDENTITY = GAP
WEIGHT_CAUSAL_IDENTITY = GAP
REPRODUCTION_CAUSAL_IDENTITY = PARTIAL
SANITARY_CAUSAL_IDENTITY = PARTIAL
COMMERCIAL_CAUSAL_IDENTITY = PARTIAL
FINANCIAL_CAUSAL_IDENTITY = PARTIAL

CROSS_DEVICE_EVENT_IDEMPOTENCY = PARTIAL
EVENT_DATA_LOSS = NOT_OBSERVED
OLD_CLIENT_COMPATIBILITY = PRESERVED
MULTI_FARM_CONFLICT_ISOLATION = SAFE
OWNERSHIP_CONFLICT_ISOLATION = SAFE

STATE_CONFLICTS = DEFERRED_TO_F24.4C
CLOCK_AUTHORITY = DEFERRED_TO_F24.4D
REAL_POSTGRES_CONCURRENCY = NOT_PROVEN
REAL_MULTI_DEVICE = NOT_PROVEN
```

## Próxima recomendação

Iniciar F24.4C para política explícita de concorrência em `state_*`, sem reutilizar conteúdo de
Evento como chave de deduplicação. A decisão arquitetural sobre causalidade ad hoc deve ser
separada por domínio e só pode avançar com uma origem real, persistente, auditável e compatível
com clientes offline antigos.
