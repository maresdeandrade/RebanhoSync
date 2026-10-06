# F24.5B — Structured Diagnostics

Data: 2026-10-06. Entrega local para revisão; sem commit, push, PR ou merge.

## Decisão e baseline real

Tornar reconstruível a sequência operacional crítica com IDs existentes e
metadados opcionais nos registros locais. Nenhuma fonte factual nova.

| Campo | Evidência |
| --- | --- |
| Branch inicial | `codex/f24-5a-doc-closeout` |
| HEAD inicial | `389e42446634091a5e3a740288293a461fc5693c` |
| origin/main após fetch | `32f629df9f49c7f1a14253a771c5f206e7b8982d` |
| F24.5A integrada | Merge PR #182, SHA `32f629df9f49c7f1a14253a771c5f206e7b8982d` |
| Branch de implementação | `codex/f24-5b-structured-diagnostics` |
| HEAD da implementação | `32f629df9f49c7f1a14253a771c5f206e7b8982d` |
| Worktree de entrada | Limpo; nenhum trabalho local transportado |

O [baseline A](./F24_5A_OBSERVABILITY_BASELINE.md) e a
[proposta B](./F24_5B_STRUCTURED_DIAGNOSTICS_PLAN.md) permanecem preservados.

## Persistência e shape efetivo

`NEW_STORE = NO`; `DEXIE_VERSION_CHANGE = NO`. A versão permanece 32; db.ts,
stores, chaves, índices e upgrades não mudaram. IndexedDB admite propriedades
opcionais não indexadas; nenhuma migration ou backfill é necessário.

`queue_gestures.diagnostics?`:

```text
client_op_ids?: string[]
last_attempt_started_at?: ISO timestamp
result_received_at?: ISO timestamp
ack_installed_at?: ISO timestamp
blocked?: { code: AUTH_UNAVAILABLE, observed_at }
reconciliation?: [{ key, scope, generation_id, required_at, completed_at? }]
```

`sync_reconcile_obligations.diagnostics?`:

```text
origins: [{ client_tx_id, client_op_ids: string[] }]
drain_attempts?: number
last_attempt_at?: ISO timestamp
last_error_at?: ISO timestamp
last_error?: { code, message }
```

Não há ID novo. `client_tx_id`, `client_op_id`, farm, key, scope e generation
continuam sendo as identidades existentes. Origens são unidas por tx/op,
preservando múltiplos ACKs, tabelas e o mecanismo funcional de geração.

## G01 — marcos e correlação

A tentativa é observada após claim; op IDs vêm das operações prontas. Um
envelope de resultados reconhecido registra recebimento antes da instalação.
O ACK diagnóstico é gravado em transação separada, somente após o commit do
resultado local. Falha/abort desse commit não produz `ack_installed_at`.

Os caminhos genérico, parcial, sanitário e movement vinculam origens às
obligations. ACK significa instalação de resultado local, inclusive resultado
rejeitado; não significa convergência concluída. Os links da gesture mantêm a
conclusão após remoção da obligation. Movement registra conclusão após o commit
da instalação que já faz a exclusão funcional dentro da transação existente.

Uma geração modificada durante pull não recebe conclusão do snapshot antigo.
O teste usa drain G1 suspenso e ACK G2 real: G2, origens e tabelas sobrevivem;
somente o drain estável posterior registra conclusão. A política conservadora
pode adiar a observação de conclusão das origens antigas até esse drain.

## G02 — falha persistida e sanitização

Cada drain observado atualiza contador e horário da tentativa. A falha atualiza
horário e classificação com mensagem fixa: HTTP permitido, rede, interrupção
ou falha genérica. A mensagem original, stack, URL, token, cookie e payload
não são persistidos/exportados por esse caminho. O console do drain também
recebe apenas código e mensagem controlados.

O teste injeta mensagem com dados sintéticos sensíveis, fecha/reabre Dexie,
verifica a classificação sanitizada, drena com sucesso e fecha/reabre novamente
para observar a conclusão na gesture após deletion. Não há histórico completo
de erros nem mudança de backoff/exhaustion.

## G06/G08 — contexto, export e baseline

G06 tem cobertura parcial: falha real de autenticação após processamento registra
`AUTH_UNAVAILABLE`; gates de sessão/ownership anteriores à tentativa continuam
fail-closed, preservando a fila e sem fabricar erro de operação ou tentativa.
Não se registra um histórico global de pausas ou decisões de ownership.

`exportSyncDiagnostics(fazendaId, opts)` reutiliza rejections.ts e o contrato
Blob/filename da exportação local. É API explícita, sem botão/UI adicional,
upload ou automação. Usa filtro por farm, whitelist de campos e dupla validação
de acesso/ownership, antes e depois da leitura assíncrona. Gestures respeitam
a janela de criação; obligations pendentes incluem todas as idades da farm.
O envelope informa filtros e limites de cobertura. Exclui record, before_snapshot,
payload, headers e mensagens funcionais brutas. Baseline default é `UNKNOWN`,
inclusive na exportação existente de rejeições; valor explícito deve vir de
metadado real do chamador, não é inferido do SHA desta execução.

G08 cobre o export diagnóstico minimizado e o default correto. O export legado
de rejeições mantém seu contrato de conteúdo; não se afirma sanitização global
de todos os logs ou exports existentes.

## Retenção, restart, legado, ownership e multi-farm

- Metadados herdam o ciclo de vida de gesture/obligation. Sem nova TTL, limpeza
  ou índice; último marco/erro substitui o anterior. Origens acumulam somente
  identidades agregadas à obligation pendente; links por key na gesture.
- Registros antigos sem diagnostics continuam válidos. Nenhum backfill ou
  inferência retroativa de ACK é feito. Restart testado é lógico: close/open
  do mesmo banco fake-indexeddb. Não comprova dispositivo físico ou perda de storage.
- Diagnóstico auxiliar não decide retry, replay, recovery, seleção ou deletion.
  Escritas auxiliares falham sem bloquear o resultado funcional. Origem é
  metadado no put da obligation já exigido pelo ACK; sua durabilidade funcional
  e os guards existentes permanecem intactos.
- Com B ativa, ACK/drain de A gravam no farm original. O teste verifica conclusão
  em A e uma gesture pendente real de B inalterada. Export exclui outra farm;
  mismatch de owner bloqueia a saída, sem adotar trabalho pendente.

## Arquivos

- Runtime: types.ts, reconciliationTypes.ts, reconciliationObligations.ts,
  syncDiagnostics.ts, syncWorker.ts, movementReconciliation.ts e rejections.ts,
  todos em src/lib/offline/.
- Testes: reconciliationObligations.test.ts, movementClosureReview.test.ts,
  syncWorkerAuth.test.ts e rejections.test.ts, em src/lib/offline/__tests__/.
- Documentação: esta evidência e nota de continuidade na proposta B.

## Validação observada

1. `pnpm exec vitest run` com reconciliationObligations, rejections,
   syncPartialBatch, syncWorkerAtomicAck, syncWorkerAuth, sanitarioAgendaV2Sync,
   movementOffline e movementClosureReview: **8 arquivos, 82 testes aprovados**.
2. Após fortalecer assertions de ownership/multi-farm, repetição somente de
   reconciliationObligations, syncWorkerAuth e movementClosureReview:
   **3 arquivos, 42 testes aprovados**.
3. `pnpm exec eslint` nos onze arquivos TypeScript alterados: exit 0.
4. `pnpm run gates:docs`: headers, continuidade e contrato documental aprovados,
   exit 0. `git diff --check`: exit 0, sem erros de whitespace.
5. Gate final: diff tracked e os dois arquivos untracked inspecionados;
   staged vazio. Treze arquivos no patch, sem db.ts, dependências, supabase/**
   ou e2e/**. Nenhum bloqueador identificado no escopo revisado.

Mocks simulam backend/auth e falhas esperadas geram logs de teste. Stores locais
são reais via Dexie/fake-indexeddb nos casos de ACK, drain e restart; não foi
executado runner remoto. Sem suíte global, build, Playwright, E2E, Supabase ou
migrations, conforme escopo solicitado.

## Limites e gaps deferidos

G03/G04/G07 permanecem para F24.5C; G05 para F24.5D; G09/G10 continuam
`NOT_PROVEN`. Não houve correção de telemetria, backlog ou health UI, probes
novos, SDK, endpoint, dashboard, alteração de RPC/RLS/Edge ou banco remoto.

O diagnóstico é best-effort: falha da escrita auxiliar ou crash entre commit
funcional e escrita diagnóstica pode deixar marcos ausentes. Não é trilha completa
de retries nem fonte de recovery. Ausência de metadado não comprova ausência
de execução; timestamps não são relógio causal global. Os testes não certificam
servidor real, concorrência física de múltiplas abas ou ambiente mobile.

Classificação do patch: `READY` para revisão no escopo local validado.

```ini
NEW_STORE = NO
DEXIE_VERSION_CHANGE = NO
F24_5B = READY_FOR_REVIEW
```

Não é declaração de integração nem certificação de ambiente real. Nenhuma ação
Git de publicação foi executada; os treze arquivos permanecem no worktree.

## Correção pontual do review — persistência diagnóstica da obligation

Finding MEDIUM: `PIPELINE_SAFETY = ISSUE`. Origens diagnósticas eram parte do
put obrigatório no ACK; o registro enriquecido podia falhar por quota mesmo
quando a obligation funcional mínima caberia, abortando a transação do ACK.

Patch somente em reconciliationObligations.ts: construir o shape funcional
antes do enriquecimento. Construção de metadados é best-effort; quota/clone
na escrita enriquecida permitem fallback sem diagnostics, dentro da mesma
transação. O fallback reutiliza key, farm, scope, generation, tables e timestamps;
não regenera a identidade. Outras falhas de persistência são propagadas. Se o
put funcional mínimo também falhar, o ACK continua abortando com segurança.
Perder origens e outros metadados nessa recuperação é um limite best-effort.

Testes novos em reconciliationObligations.test.ts:

- Criação e atualização: rejeitar especificamente o put com diagnostics por
  quota; verificar fallback mínimo, mesma generation, união das tables, ACK
  DONE/APPLIED, remoção de ops e ausência de retry/next_attempt_at.
- Negativo: falha também no put mínimo mantém ops, não grava ACK diagnóstico,
  não declara DONE e segue o tratamento funcional de falha existente.
- Erro DataCloneError real via put Dexie/fake-indexeddb: fallback ainda conclui
  o ACK dentro da transação, sem depender somente de Promise mockada.

Antes do patch, os três casos iniciais falharam (25 testes antigos aprovados).
Após a correção, `pnpm exec vitest run
src/lib/offline/__tests__/reconciliationObligations.test.ts`: **29/29 aprovados**.
Quota é injetada condicionalmente; não se afirma exaustão de storage físico.
Não se alterou nem adicionou teste da lógica de generation/conditional delete.

`PIPELINE_SAFETY = OK`: falha recuperável exclusiva do enriquecimento não
derruba ACK; falha da persistência funcional permanece falha. `NEW_STORE = NO`,
`DEXIE_VERSION_CHANGE = NO`; generation e retry/replay preservados.

## Correção local do CI — PR #183 / Fallow new-only

Baseline: branch codex/f24-5b-structured-diagnostics, HEAD
`20270ebfa6132f75d0591e107f56ebda4dddb3b4`; origin/main permaneceu em
`32f629df9f49c7f1a14253a771c5f206e7b8982d`; worktree inicialmente limpa.
O run 37453525169 falhou no Fallow. O audit local sem base explícita comparou
HEAD ao upstream da própria branch e analisou zero arquivos; esse resultado
não foi usado para certificar o PR. A reprodução fixou `FALLOW_AUDIT_BASE=origin/main`.

| Blocker novo confirmado no audit | Correção |
| --- | --- |
| upsertReconciliationObligations: complexidade | Extrair construção diagnóstica e persistência com fallback; mesma transação/geração/tabelas e propagação de erros |
| recordAcknowledgement: callback complexo | Extrair construção do link, preservando a condição de completion por generation |
| recordDrainCompletion: callback complexo | Extrair predicado equivalente de generation |
| reconcileGenericOperationResults: complexidade acrescida pelo guard diagnóstico | Encapsular somente o guard pós-commit em recordAcknowledgementIfCommitted; usar chamada simples nos quatro caminhos existentes |
| Teste G1/G2: callback complexo | Extrair leitura e assertions locais, mantendo cenário e todas as verificações |
| Drain attempt/failure: clone novo | Unificar apenas a transação diagnóstica e seu guard em updateDrainDiagnostic |

Não houve suppression. Complexity herdada de processSanitarioCanonicalResults,
callbacks antigos do worker, dependências e clones históricos foi excluída
pelo próprio new-only e permaneceu fora do patch. Não houve mudança de retry,
terminalidade, seleção, writers, autorização, stores ou schema Dexie v32.

Validação local após as extrações:

- `FALLOW_AUDIT_BASE=origin/main pnpm exec fallow audit --gate new-only`: exit 0;
  13 arquivos do delta PR analisados, 11 findings herdados excluídos.
- `pnpm exec vitest run src/lib/offline/__tests__/reconciliationObligations.test.ts`:
  29/29 aprovados, incluindo fallback positivo/negativo, clone real e race.
- ESLint dos quatro TypeScript alterados: exit 0; `git diff --check`: exit 0.

O audit inicial registrou warning de node_modules ausente no snapshot temporário
usado na atribuição; a reprodução com base explícita identificou os mesmos
blockers do CI. Não se mudou configuração, threshold ou baseline para ocultá-los.
Entrega somente local: `PR_183_FIX = READY_FOR_REVIEW`; sem commit/push/merge.
O run remoto falho não foi reexecutado nesta correção local.
