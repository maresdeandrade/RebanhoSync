# F24.2A — Ordem recomendada de patches F24.2B+

Esta é uma recomendação diagnóstica. Nenhum patch funcional foi iniciado e F24.2 não está concluída.

## F24.2B — Identidade estável de comando e proveniência factual (P0)

- **Objetivo:** investigar e proteger `stable command identity`, `event provenance` e `idempotent fact creation` nos caminhos factuais genéricos, sem usar comparação heurística de conteúdo como prova de replay.
- **Arquivos prováveis:** a confirmar após inventário dirigido do schema e dos builders reais; candidatos de investigação incluem `src/lib/events/**`, envelopes offline e validação do `sync-batch`.
- **Invariante:** mesma execução/replay → um fato; execuções distintas com conteúdo igual → podem gerar fatos distintos. Evento continua append-only e correção continua novo Evento.
- **Teste necessário:** mesma identidade estável/proveniência reapresentada em dois devices produz um fato; reutilização conflitante da mesma identidade é rejeitada; identidades de execuções distintas permanecem fatos distintos mesmo com conteúdo igual.
- **Risco de regressão:** alto se identidade de comando for confundida com similaridade de conteúdo ou agrupar execuções legítimas.
- **Dependências:** análise do schema real, da proveniência disponível e das identidades já persistidas por domínio. Não definir campo, constraint, tabela ou migration antes dessa análise.

## F24.2C — Ack atômico e recovery de estados intermediários

- **Objetivo:** tornar remoção de `queue_ops`, auditoria e transição do gesto uma única transação; recuperar `SYNCING` interrompido com/sem ops.
- **Arquivos prováveis:** `src/lib/offline/syncWorker.ts`, `queueLifecycle.ts`, testes offline.
- **Invariante:** resposta aplicada nunca deixa gesto órfão; crash em qualquer ponto converge por replay.
- **Teste necessário:** fault injection antes/depois do delete e antes do DONE; restart com SYNCING+ops e SYNCING sem ops.
- **Risco de regressão:** médio; pode reabrir gestos já terminais se classifier for impreciso.
- **Dependências:** nenhuma migration remota.

## F24.2D — Retry/reconnect durável

- **Objetivo:** timeout explícito, backoff+jitter genérico, listener de online como wake-up e recovery de todos os 5xx/401/session-restored sem depender de restart.
- **Arquivos prováveis:** `syncWorker.ts`, possivelmente hook pequeno no `AppShell`; tipos de erro estruturados.
- **Invariante:** erro transitório não vira abandono permanente e não causa retry storm.
- **Teste necessário:** offline prolongado→online, fetch pendurado, 500/502/503/504, refresh falho→sessão restaurada.
- **Risco de regressão:** médio; temporização pode tornar testes flakey se não usar relógio fake.
- **Dependências:** F24.2C para state machine confiável.

## F24.2E — Ownership local de fila e troca de fazenda/usuário

- **Objetivo:** definir owner da fila (user/session) e impedir envio automático por outro usuário; tornar hydrate/replace farm-safe sem apagar projeção/pending de outra fazenda.
- **Arquivos prováveis:** `types.ts`, `db.ts` (possível nova versão Dexie), `ops.ts`, `syncWorker.ts`, `pull.ts`, `useAuth.tsx`.
- **Invariante:** logout/login e switch farm não transferem autoridade, não perdem pendências e não misturam tenant.
- **Teste necessário:** farm A pending→farm B; logout A→login B sem membership; usuários A/B membros da mesma fazenda; upgrade Dexie com filas antigas.
- **Risco de regressão:** alto por migração local e filas legadas; exigir estratégia conservadora de owner UNKNOWN.
- **Dependências:** F24.2C; decisão de compatibilidade para filas já persistidas.

## F24.2F — Conflito genérico por agregado

- **Objetivo:** adicionar revisão/compare-and-set somente nas superfícies mutáveis que hoje são last-write-wins.
- **Arquivos prováveis:** builders de operações, `types.ts`, `sync-batch/index.ts`, migrations/RPCs específicas por agregado.
- **Invariante:** alteração remota concorrente nunca é sobrescrita silenciosamente.
- **Teste necessário:** dois devices, mesma revisão; segundo writer recebe CONFLICT; retry idêntico permanece APPLIED.
- **Risco de regressão:** alto; não aplicar a Eventos append-only nem a read models como fonte.
- **Dependências:** matriz por agregado e autorização explícita de banco.

## F24.2G — Reconciliation/pull durável e recompute observável

- **Objetivo:** persistir trabalho de pull/recompute pendente após ack remoto e repetir até convergir; não retornar sucesso silencioso quando projeção remota obrigatória falha.
- **Arquivos prováveis:** `syncWorker.ts`, `pull.ts`, `sync-batch/index.ts`; eventual outbox remota somente se autorizada.
- **Invariante:** commit factual e projeções derivadas possuem estado de convergência observável; `state_*` nunca substitui o fato.
- **Teste necessário:** post-sync pull falha e recupera sem restart; recompute falha após mutações e é retomado; cursor não avança antecipadamente.
- **Risco de regressão:** médio/alto se transformar falha derivada em rollback de fato já aceito.
- **Dependências:** F24.2C/D; decisão sobre retry remoto do recompute.

## F24.2H — Observabilidade e gate final

- **Objetivo:** métricas estruturadas para idade da fila, SYNCING órfão, tentativas, resposta ambígua, reconcile pendente e ownership mismatch.
- **Arquivos prováveis:** `src/lib/telemetry/**`, `syncPresentation.ts`, `SyncHealthPanel.tsx`, testes/gates.
- **Invariante:** observabilidade não vira fonte de verdade nem autoriza operação.
- **Teste necessário:** classificação de health por fazenda/owner e alarmes sem payload sensível.
- **Risco de regressão:** baixo; risco principal é exposição de dados em logs.
- **Dependências:** estados finais definidos em F24.2C–G.

## Sequência mínima segura

```text
F24.2B (P0 identidade estável/proveniência factual)
→ F24.2C (ack/recovery)
→ F24.2D (retry/reconnect)
→ F24.2E (owner/farm isolation local)
→ F24.2F (conflito por agregado)
→ F24.2G (reconcile durável)
→ F24.2H (observabilidade/gate)
```

Cada etapa deve ser independente, com verification gate próprio. Migrations, RLS, RPCs, Dexie schema e rollout exigem autorização explícita nas fases correspondentes.
