# F24.3 — Closeout e planejamento F24.4–F24.6

Atualizado em: 2026-09-23

Baseline auditada para o closeout: `main@ddd1ba3c2a5fb8055027723c0b9b3c83abe449d5`

PRs/subfases integrados: `#157`, `#159`, `#160`, `#161` e `#162`

## Decisão

```ini
F24.3 = CLOSED
NEXT = F24.4A_CONFLICT_INVENTORY_CHARACTERIZATION

PRODUCTION_PROMOTION = NOT_AUTHORIZED
SANITARIO_V2 = EXTERNAL_BLOCKED
```

O fechamento é sustentado pelo código e pelos testes integrados em `main`, incluindo a suíte
focada reexecutada no baseline acima. Ele não autoriza iniciar F24.4, rollout, deploy,
migration remota ou promoção de ambiente.

## Objetivo original

Fechar os gaps de continuidade do modelo offline-first em jornadas prolongadas: alternância
de fazenda, reconciliação de fazenda não ativa, ownership legado `UNKNOWN`, reconnect, retry
genérico/HTTP 429, reabertura lógica da base local e filas heterogêneas multi-farm, sem
reabrir as garantias de identidade, ACK, replay e reconciliação encerradas na F24.2.

## Evidências integradas

| Subfase | Evidência principal | Resultado |
| --- | --- | --- |
| F24.3A | `F24_3A_OFFLINE_RECOVERY_CHARACTERIZATION.md` | gaps caracterizados; documento preservado como histórico |
| F24.3B1 | `farmSwitchReplace.characterization.test.ts`, `pull.ts`, `syncWorker.ts` | replace da fazenda ativa, merge da inativa e pending multi-farm protegidos |
| F24.3B2 | `F24_3B2_LEGACY_OWNERSHIP_UNKNOWN_RECOVERY_DECISION.md`, `ownership.test.ts` | proveniência ambígua; auto-adoption proibida; `UNKNOWN` fail-closed |
| F24.3B2.1 | `unknownOwnershipRecovery.test.ts`, `LocalOwnershipBoundary.test.tsx`, `useAuth.ownershipRecovery.test.tsx` | reset destrutivo somente após confirmação explícita; bootstrap canônico apenas em base nova |
| F24.3B3 | `genericRetry.test.ts`, `syncWorkerGenericRetry.test.ts`, `syncWorkerHttp429.characterization.test.ts`, `longOfflineReconnect.characterization.test.ts` | retry durável, `Retry-After`, backoff exponencial com jitter/cap e reconnect elegível |
| F24.3C | `crashRestartCertification.test.ts` | reabertura lógica, fila heterogênea/multi-farm, identidades, obligations e ownership certificados |

Commits factuais principais: `bfc6e05` (farm-aware replace/reconciliation), `b9d19f2`
(decisão UNKNOWN), `106c4c9` (reset explícito), `dffbb49`/`0274b1a` (retry genérico) e
`ad7c0a2` (certificação crash/restart lógico e fila heterogênea).

## O que foi comprovado

- offline prolongado e reconnect preservam trabalho elegível e identidades persistidas;
- hydrate da fazenda ativa usa replace farm-aware; reconciliação da fazenda não ativa usa
  merge e não limpa o cache ativo;
- pending work de múltiplas fazendas permanece protegido;
- ownership legado sem proveniência suficiente permanece `UNKNOWN` e fail-closed;
- sessão atual, fazenda, membership, `client_id` e payload não provam owner legado;
- o reset de `UNKNOWN` exige autorização destrutiva explícita, remove a base não verificável
  e permite reconstrução canônica em base nova, sem auto-adoption;
- erros de rede e HTTP `500/502/503/504` usam retry genérico durável; HTTP 429 respeita
  `Retry-After`; HTTP 403 permanece terminal e 401 conserva o recovery de sessão existente;
- backoff exponencial, jitter e cap calculam `next_attempt_at`, persistido como gate de
  elegibilidade; reconnect não antecipa um prazo válido;
- reabertura Dexie preserva `PENDING`, recupera `SYNCING` interrompido e `ERROR` recuperável,
  mantém retry/429 e drena reconciliação uma vez pelo mesmo `generation_id`;
- fila heterogênea com falha parcial não corrompe progresso, identidade ou outra fazenda;
- `client_tx_id`, `client_op_id`, `domain_op_id` e `generation_id` permanecem as identidades
  aplicáveis; falso `DONE` e replay duplicado não foram observados nos cenários certificados.

## O que mudou

### Runtime

- seleção `replace` para hydrate/reconciliação da fazenda ativa e `merge` para fazenda não
  ativa;
- política genérica de retry para rede e HTTP transitório, com tratamento explícito de 429;
- boundary global para recovery de ownership `UNKNOWN` por reset confirmado.

### Persistência

- `next_attempt_at` e `retry_count` controlam elegibilidade e sobrevivem à reabertura;
- fila, projeções pendentes e obligations permanecem isoladas por fazenda;
- nenhuma nova store ou migration Dexie foi necessária para o closeout.

### Recovery

- reconnect pode reativar erro de conectividade elegível sem ignorar atraso persistido;
- `UNKNOWN` continua bloqueando leitura/sync até reset destrutivo explícito;
- a reconstrução de ownership acontece somente no bootstrap canônico da base nova.

### Testes

- cobertura focada para farm switch, inactive-farm merge, ownership legado, reset explícito,
  retry/429/reconnect e certificação lógica de restart com fila heterogênea multi-farm.

### Governança

- gaps da characterization foram reconciliados com as correções posteriores;
- a limitação de processo real foi separada da certificação lógica/local.

## O que não mudou

- nenhuma fonte de verdade paralela foi criada;
- Agenda continua intenção, Evento continua fato, `state_*` continua estado atual/read model e
  Protocolo continua regra/configuração;
- o modelo offline-first e a compatibilidade local-remota foram preservados;
- consistência não depende de execução contínua em background;
- não houve alteração de migration Supabase, RLS, policy, grant, RPC ou schema remoto por causa
  da F24.3;
- telemetria não virou fonte de verdade do domínio.

## Matriz final F24.3

```ini
F24.3 = CLOSED

FARM_AWARE_REPLACE = SAFE
NON_ACTIVE_FARM_RECONCILIATION = SAFE

LEGACY_OWNER_PROVENANCE = AMBIGUOUS
SAFE_AUTO_ADOPTION = NO
EXPLICIT_UNKNOWN_RESET = SAFE

GENERIC_RETRY = SAFE
HTTP_429_POLICY = SAFE
RETRY_AFTER_SUPPORT = SAFE
ONLINE_RECONNECT_RECOVERY = SAFE

PENDING_RESTART = SAFE
SYNCING_INTERRUPTION_RECOVERY = SAFE
ERROR_RESTART_RECOVERY = SAFE
GENERIC_RETRY_RESTART = SAFE
HTTP_429_RESTART = SAFE
RECONCILIATION_RESTART = SAFE

HETEROGENEOUS_QUEUE_CORRECTNESS = SAFE
MULTI_FARM_QUEUE = SAFE

IDENTITY_PRESERVATION = SAFE
PENDING_WORK_PRESERVATION = SAFE
DURABLE_RETRY_PRESERVATION = SAFE
DURABLE_RECONCILIATION = SAFE
FARM_ISOLATION = SAFE
OWNERSHIP_ISOLATION = SAFE

FALSE_DONE = NOT_OBSERVED
DUPLICATE_REPLAY = NOT_OBSERVED

REAL_PROCESS_KILL = NOT_PROVEN
```

`SAFE` nesta matriz significa que o contrato enumerado foi observado no código e na suíte
focada local. Não significa certificação de processo/browser real nem benchmark de escala.

## Limitação residual

```ini
LOGICAL_RESTART_DEXIE_REOPEN = CERTIFIED
REAL_PROCESS_KILL = NOT_PROVEN
```

O harness atual fecha e reabre Dexie no mesmo processo. Ele não certifica a combinação de kill
real do browser/processo, restart real, mesmo perfil persistente e IndexedDB sobrevivente, nem
falha real simultânea de rede/processo. Essa dívida E2E não bloqueia o closeout da F24.3 e não
autoriza criar infraestrutura Playwright nesta execução.

## Planejamento F24.4 — Multi-device / Conflict Resolution

Objetivo: certificar e endurecer operações concorrentes de dois ou mais dispositivos, com
offline independente e reconnect em momentos distintos, preservando Evento, Agenda,
`state_*` e Protocolo em seus papéis canônicos. Timestamp do cliente não será autoridade sem
contrato explícito; conflito histórico não será resolvido apenas pelo estado atual.

### F24.4A — Conflict Inventory / Characterization

- objetivo: mapear identidade cross-device, concorrência, stale writes, ordenação,
  idempotência, detecção/merge e convergência por classe de operação;
- escopo: writers, envelopes, ledgers, revisions, pull/reconcile e read models diretamente
  envolvidos, sem patch funcional;
- riscos: last-write-wins implícito, relógio cliente como autoridade e conflito oculto em
  `state_*`;
- evidência necessária: matriz por operação/agregado/dispositivo, testes de characterization e
  classificação `SAFE`, `PARTIAL`, `GAP` ou `NOT_PROVEN`;
- critério de fechamento: inventário completo, prioridades e fronteiras de ownership/fazenda
  confirmadas sem iniciar F24.4B;
- dependências: F24.3 fechada; acesso a harnesses locais existentes.

### F24.4B — Concurrent Event Writes

- objetivo: provar que Eventos concorrentes legítimos não são perdidos ou duplicados;
- escopo: identidade causal, ledger idempotente, dependências e detalhes factuais;
- riscos: duplicação de fato, colisão de identidade, ordem fabricada e ACK perdido;
- evidência necessária: dois clientes independentes escrevendo fatos iguais e distintos, com
  replay, sucesso parcial e reconnect invertido;
- critério de fechamento: fatos preservados, duplicação impedida por identidade canônica e
  conflitos divergentes explícitos;
- dependências: F24.4A e contrato factual de cada domínio testado.

### F24.4C — State Projection Conflicts

- objetivo: impedir regressão de `state_*` quando projeções concorrentes chegam fora de ordem;
- escopo: revisions, materialização, pull/merge e rebuild a partir de fatos quando aplicável;
- riscos: stale write sobrescrever estado recente e read model competir com histórico;
- evidência necessária: sequências fora de ordem, tombstones, rebuild e comparação
  local/remota;
- critério de fechamento: convergência determinística sem apagar fato histórico nem promover
  timestamp cliente a autoridade;
- dependências: F24.4A e resultados de F24.4B.

### F24.4D — Cross-device Offline / Reconnect

- objetivo: certificar dispositivos com filas e janelas offline independentes;
- escopo: dois perfis/contextos, reconnect alternado, ACK perdido, pull concorrente e troca de
  fazenda;
- riscos: condições de corrida dependentes de timing e falsa equivalência entre reopen lógico e
  processo real;
- evidência necessária: cenários repetíveis com storage persistente independente e inspeção de
  fila, remoto e read models após cada reconnect;
- critério de fechamento: convergência observada nos dois clientes e no remoto, com limitações
  de processo real explicitadas;
- dependências: F24.4B–F24.4C; decisão específica antes de incorporar `REAL_PROCESS_KILL`.

### F24.4E — Conflict Resolution Contract

- objetivo: formalizar quando rejeitar, reconciliar, fazer merge ou exigir intervenção;
- escopo: classes de conflito, precedência factual, revisão, mensagens e recovery;
- riscos: política genérica apagar semântica de domínio ou UI virar barreira de autorização;
- evidência necessária: tabela de decisão por classe e testes executáveis correspondentes;
- critério de fechamento: contrato único, fail-closed nos casos ambíguos e ADR caso mude
  ordenação, deduplicação ou fonte de verdade;
- dependências: evidências F24.4A–F24.4D.

### F24.4F — Integrated Certification

- objetivo: executar a matriz integrada de concorrência e convergência;
- escopo: browser/cliente, API, persistência remota, pull/reconcile e resposta final;
- riscos: cobertura parcial ser declarada como certificação transversal;
- evidência necessária: matriz versionada, resultados observados, cleanup e limitações;
- critério de fechamento: todos os cenários críticos classificados, sem falso sucesso,
  duplicação ou vazamento cross-tenant;
- dependências: F24.4B–F24.4E concluídas.

## Planejamento F24.5 — Observability

Objetivo: tornar sync/recovery auditável sem depender de logs efêmeros e sem transformar
telemetria em fato de domínio.

### F24.5A — Observability Inventory

- objetivo/escopo: mapear sinais locais e remotos de fila, tentativa, ACK, reconcile,
  ownership e fazenda;
- riscos: lacunas de correlação e coleta de dado sensível;
- evidência/fechamento: catálogo com origem, retenção, cardinalidade, tenant e gaps;
- dependências: classes de falha da F24.4A quando disponíveis.

### F24.5B — Structured Sync Diagnostics

- objetivo/escopo: definir envelope diagnóstico estruturado e correlação entre
  `client_tx_id`, `client_op_id`, `domain_op_id`, attempt e reconcile;
- riscos: duplicar estado da fila ou criar identificador de dispositivo inseguro;
- evidência/fechamento: schema versionado, redaction e isolamento por `fazenda_id` testados;
- dependências: F24.5A e decisão de privacidade.

### F24.5C — Failure / Retry Telemetry

- objetivo/escopo: expor classes de falha, retry agendado, `Retry-After`, terminalidade e
  outcome de reconcile;
- riscos: volume, loops de telemetria offline e vazamento de payload;
- evidência/fechamento: cenários de rede/429/5xx/auth/conflito correlacionados sem payload
  tenant-sensitive;
- dependências: F24.5B.

### F24.5D — Operational Health Views

- objetivo/escopo: apresentar saúde de fila/reconcile e recovery acionável para operação;
- riscos: painel virar fonte de verdade ou oferecer ação destrutiva sem confirmação;
- evidência/fechamento: estados vazio/parcial/bloqueado, autorização e drill-down testados;
- dependências: F24.5B–F24.5C.

### F24.5E — Certification

- objetivo/escopo: provar diagnóstico ponta a ponta sob falha, retry, ACK perdido e reconcile;
- riscos: logs locais mascararem ausência de persistência/correlação remota;
- evidência/fechamento: matriz aprovada de correlação, retenção, redaction, volume e isolamento;
- dependências: F24.5B–F24.5D.

Decisão de desenho obrigatória antes de implementar: separar diagnóstico efêmero local,
diagnóstico local persistido e telemetria enviada ao backend, definindo privacidade, retenção,
volume e RLS/multi-tenant para cada classe.

## Planejamento F24.6 — Performance / Scale

Objetivo: medir e endurecer volume realista com budgets explícitos. Nenhuma otimização será
aceita sem baseline reproduzível.

### F24.6A — Baseline Metrics

- objetivo/escopo: definir hardware, navegador, datasets, métricas e budgets de startup,
  memória, CPU, IndexedDB e throughput;
- riscos: números não comparáveis ou workload artificial;
- evidência/fechamento: protocolo reproduzível e baseline versionada;
- dependências: cenários funcionais estáveis da F24.3.

### F24.6B — Large Local Dataset

- objetivo/escopo: medir hydrate, consultas e materialização com base local grande e
  multi-farm;
- riscos: bloqueio de main thread, transações longas e índices insuficientes;
- evidência/fechamento: curvas por volume e gargalos localizados contra os budgets;
- dependências: F24.6A.

### F24.6C — Large Pending Queue

- objetivo/escopo: medir fila heterogênea grande, seleção, persistência e recovery;
- riscos: starvation, memória, retry storm e operação já aplicada reprocessada;
- evidência/fechamento: throughput e correção funcional preservados sob volumes declarados;
- dependências: F24.6A e matriz heterogênea F24.3C.

### F24.6D — Reconnect Burst

- objetivo/escopo: medir rajada de reconnect, backoff/jitter, 429 e sucesso parcial;
- riscos: thundering herd, violação de `Retry-After` e saturação do backend;
- evidência/fechamento: carga, latência, taxa de erro e recuperação dentro dos budgets;
- dependências: F24.6C e ambiente de teste controlado.

### F24.6E — Reconciliation Scale

- objetivo/escopo: medir obligations, pulls merge/replace e materialização por domínio/fazenda;
- riscos: transações IndexedDB longas, cursor incorreto e starvation entre fazendas;
- evidência/fechamento: throughput e convergência sem perda de pending nem isolamento;
- dependências: F24.6B–F24.6D.

### F24.6F — Mobile-oriented Constraints

- objetivo/escopo: avaliar suspensão, kill/restart, memória, armazenamento e reconnect sob
  limites móveis, preservando React/TypeScript, Capacitor e Dexie inicialmente;
- riscos: depender de background contínuo ou introduzir storage paralelo;
- evidência/fechamento: matriz Android/iOS-alvo com budgets e recovery observado;
- dependências: F24.6A–F24.6E e decisão explícita de plataforma/harness.

### F24.6G — Performance Certification

- objetivo/escopo: consolidar limites suportados, regressões e ações focais;
- riscos: declarar escala sem hardware, dataset e percentis reproduzíveis;
- evidência/fechamento: relatório com budgets, percentis, limites certificados e gaps
  remanescentes;
- dependências: F24.6B–F24.6F.

## Trilhas paralelas

| Trilha | Atividade comprovada agora | Classificação | Justificativa |
| --- | --- | --- | --- |
| Sanitário v2 | `EXTERNAL_BLOCKED`; rollout desligado | `BLOCKED` | A recertificação depende de a plataforma devolver o conflito remoto; não autoriza workaround, rollout ou mudança de RPC. |
| UX/UI | nenhuma nova trilha ativa; Trilha D está encerrada | `PARALLEL_SAFE` apenas para demanda nova e isolada | Trabalho apresentacional que não toque writers/sync pode ocorrer em paralelo após escopo próprio; não há iniciativa ativa assumida neste plano. |
| Mobile preparation | nenhuma trilha ativa comprovada | `DEPENDENT` | Se tocar offline/sync, depende dos contratos F24.4; budgets e kill/restart reais pertencem a F24.6F. |
| Comercial/produtivo | fases existentes encerradas; nenhum incremento ativo comprovado | `DEPENDENT` | Read-only isolado pode ser paralelo, mas novos writers ou fatos concorrentes devem aguardar a characterization F24.4A. |

## Priorização

```text
AGORA
→ F24.3 CLOSEOUT — CLOSED

DEPOIS
→ F24.4A — Conflict Inventory / Characterization

EM PARALELO
→ somente demandas independentes comprovadas e com escopo próprio

POSTERIORMENTE
→ F24.5 — Observability
→ F24.6 — Performance / Scale
```

F24.5A pode iniciar após F24.4A estabilizar a taxonomia de falhas. F24.6A pode preparar o
protocolo de medição sem otimizar código, mas a certificação integrada deve usar os contratos
de conflito consolidados pela F24.4.

## Validação do closeout

- suíte focada F24.3: 12 arquivos, 62 testes, aprovada em 2026-09-23;
- `git diff --check`: obrigatório no patch documental;
- `pnpm run gates:docs`: obrigatório no patch documental;
- regressão global, build, Supabase completo e E2E completo: não requeridos por este patch
  exclusivamente documental.
