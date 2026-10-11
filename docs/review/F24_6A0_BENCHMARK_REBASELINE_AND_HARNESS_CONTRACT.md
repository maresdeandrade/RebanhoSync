# F24.6A0 — Benchmark Rebaseline + Harness Contract

Atualizado em: 2026-10-09
Status: F24_6A0_BACKEND = READY_FOR_P0_BENCHMARKS — backend isolado certificado pela F24.6A0-B; P0 volumoso pendente

## Baseline e autorização

`F24_6_BENCHMARK_BASELINE_SHA = 3b3bc96db331c2917167cf8370024332f505d9f7`.
Fetch confirmou avanço após `4b1c466`: PR #191, commit `d6fd31b`, apresentação
de peso/ECC e testes do AnimalDetalhe. Delta inspecionado; nenhuma mudança
de offline/sync, telemetry, schema ou RLS nesse avanço.

Worktree dedicado: `C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro`;
branch `codex/f24-6a0-benchmark`, criada sobre origin/main integrada, inicialmente limpa.
Checkout anterior e outros sete worktrees preservados. Main local anterior permaneceu
em `f4c90e8`; nenhum reset, rebase, overwrite, commit, push, merge ou deploy.

F24.5 CLOSED / INTEGRATED pelo PR #190, merge `4b1c466`, apoiada na
[certificação F24.5E](./F24_5E_INTEGRATED_OBSERVABILITY_CERTIFICATION.md).
Snapshots gerais de 06/10 estavam em drift e foram reconciliados nos cinco documentos
autorizados. Relatos históricos preservados como SUPERSEDED; nenhum contrato normativo,
manual, arquivo de archive ou ADR alterado. F24.6 ACTIVE; F24.6A PERFORMANCE / SCALE BASELINE.

Esta etapa prepara infraestrutura, sem declarar capacidade/throughput ou otimizar produto.
Os contratos de domínio, conflitos, writers, retenção, RLS e sync permanecem os existentes.

## Harness mínimo

- `scripts/codex/performance-baseline.mjs`: runner Node/Playwright, Vite apenas para
  transformar módulos reais; página vazia, sem bootstrap do app ou scheduler periódico.
- `performance-browser.ts`: IndexedDB nativo e schema OfflineDB real; seed,
  execução e cleanup em funções separadas. Read-only storage workloads usam banco novo.
- `performance-local-fixture.mjs`: Auth/PostgreSQL local para pull/reconnect;
  farms e usuário novos por repetição, dados sintéticos e cleanup restrito aos IDs criados.
- `performance-contract.mjs`: baseline, envelope P0, guards e estatística.
- `tests/codex/performance-contract.test.mjs`: rejeição de destinos remotos,
  parâmetros inválidos e percentis sem amostras suficientes.

Sem dependência nova. Neste worktree, node_modules é junction para as dependências
já instaladas do checkout original; o runner registra versões efetivas. pnpm exec
tentou auto-install e recusou o junction; não remover/resetar o diretório compartilhado.
Lint/gates usam os entrypoints Node existentes como fallback. Para worktree independente,
instalar pelo lockfile em diretório próprio antes de medir.

Resultados em `test-results/f24-6/*.json` (ignorado pelo Git): git_sha, baseline SHA,
hash SHA256 dos quatro arquivos do harness, ambiente, browser/version, Node, pnpm,
versões de dependências, dataset, farm_count, run_number, cold/warm e estado
de telemetry/logging. Flows também registram versão PostgreSQL e histórico local
de migrations observado, sem presumir equivalência remota. Nenhum segredo, sessão,
corpo de request, URL com credenciais ou email/senha de fixture é exportado.

## Separação de fases e medição

1. Gerar/instalar fixtures, importar módulos, autenticar quando necessário e fazer
   preparação/warm-up. Fora de duration_ms; seed_and_preparation_ms separado.
2. Medir apenas o workload no browser com performance.now(). Controles anteriores
   e posteriores são verificados sem misturar geração/cleanup na duração.
3. Excluir o banco exclusivo, fechar BrowserContext e remover apenas fixtures locais
   criadas pelo runner. Cleanup tem duração própria; falha impede PROOF_PASSED.

Cada repetição usa contexto/banco/fixtures novos. Cold em IndexedDB significa reabrir
conexão após seed; não significa cache de disco/OS frio. Warm em IndexedDB/queue/pull
executa uma passagem excluída antes da amostra. Reconnect aquece módulos/pull na preparação,
cria gestos reais com browser offline e drena manualmente após reconexão. Não mede
startup/login UI, scheduler completo, mobile ou kill físico. Não executar runners em paralelo
para uma série de benchmark. Nenhum limite/SLO foi aprovado por estes números.

## Workloads P0 preparados

| Workload | Envelope | Caminho e verificação |
| --- | --- | --- |
| IndexedDB | 1k/10k/50k animais; 10k/100k/500k eventos | Leitura indexada por fazenda em transação read-only; registros locais sintéticos, sem execução de domínio |
| Queue | 100/1k/10k gestos | Seleção/ordenação de pending; operações por client_tx_id dos gestos da fazenda; uma operação sintética por gesto, bytes JSON efetivos |
| Pull | volumes de animais do envelope | pullDataForFarm real, sessão normal, tabela animais; expected/received/installed precisam coincidir |
| Reconnect | 100/1k/10k gestos | createGesture/processGesture reais, um UPDATE de observação por animal distinto; ACK confirmado, fila vazia e snapshot remoto convergente |

Native fixtures são de armazenamento e não substituem builders/writers factuais.
Eventos sintéticos não incluem details: não certificam histórico/UI de domínio.
Fila sintética não é enviada; reconnect usa gestos criados pelo writer existente.
Cada flow exige pelo menos duas fazendas. Pull verifica que a fazenda controle não mudou;
reconnect verifica convergência de cada animal na respectiva fazenda.
Não altera batching, ordem, timeout, retry, flags ou policies do produto.

## Métricas e limites

Disponíveis: duration_ms, sample_count, operações/gestos, queue_serialized_bytes,
requests, bytes de body enviado/recebido (sem headers/TLS), expected/received/installed,
backlog antes/depois, idade máxima observada, duração de transação read-only IndexedDB,
ACK observado após retorno de processGesture e convergência, heap CDP antes/depois,
TaskDuration CDP e contagem de console/erros de rede/timeouts identificáveis.

ACK é limite superior observado: processGesture pode fazer refresh inline antes de retornar.
Não equivale à latência server-side ou ACK físico. Received total no reconnect pode incluir
leituras repetidas; rows_received é comparação estrita apenas no workload pull.
Nos workloads nativos, rows_installed são registros presentes após seed; não há instalação
remota durante a leitura. Bytes da fila são diferentes de payload HTTP.
Backlog age usa tempo de calendário; apenas duração usa relógio monotônico.

Cada run inteiro é uma amostra. Resultados individuais, mediana, mínimo, máximo,
amplitude e desvio absoluto mediano são preservados. p95 exige >=200 runs e p99 >=1000
(pelo menos dez observações esperadas na cauda). Poucas repetições produzem null,
sem transformar linhas/operações dentro de um run em amostras independentes.

Gaps: long tasks, CPU de processo/servidor, pico de memória/GC, write latency nativa,
eventos/details reais, outras tabelas de pull, scheduler/app completo, WAN, dispositivos,
planos/índices PostgreSQL, WAL/autovacuum e capacidade sustentável de telemetry/retention.
Sem stress em staging, migrations, alteração de produção ou cleanup remoto.

## Comandos reproduzíveis

Executar no worktree adotado, um runner por vez:

```powershell
node --test tests/codex/performance-contract.test.mjs
node scripts/codex/performance-baseline.mjs --workload indexeddb --animals 100 --events 1000 --farms 2 --runs 3 --mode cold
node scripts/codex/performance-baseline.mjs --workload queue --animals 101 --events 1001 --gestures 101 --farms 3 --runs 3 --mode warm
```

Exemplo P0 posterior (não executado em A0): usar --purpose benchmark. Native
workloads podem iniciar; flows são bloqueados quando o histórico local diverge.

```powershell
node scripts/codex/performance-baseline.mjs --workload indexeddb --animals 1000 --events 10000 --farms 2 --runs 5 --mode cold --purpose benchmark
node scripts/codex/performance-baseline.mjs --workload queue --animals 1000 --events 10000 --gestures 1000 --farms 2 --runs 5 --mode warm --purpose benchmark
```

Flows requerem Supabase local descartável ativo, schema/migrations inspecionados,
Auth/PostgREST e, para reconnect, sync-batch local com JWT verificado.
`supabase status -o env` é capturado exclusivamente em memória pelo runner.
Não usar --linked, staging, arquivo env remoto ou service_role no browser.

```powershell
$env:REBANHOSYNC_DISPOSABLE_LOCAL_DB = '1'
node scripts/codex/performance-baseline.mjs --workload pull --animals 10 --events 10 --gestures 10 --farms 2 --runs 1 --mode cold
node scripts/codex/performance-baseline.mjs --workload reconnect --animals 2 --events 2 --gestures 2 --farms 2 --runs 1 --mode warm
```

O guard exige produto/config/lockfile idênticos ao baseline e recusa patches
tracked/staged/untracked nesses caminhos. Commits posteriores exclusivamente
de harness/docs são permitidos; mudança de produto exige rebaseline explícito.

## Evidência A0

Provas preliminares observadas: IndexedDB 100 animais/1.000 eventos, duas fazendas,
três runs; fila 101 gestos/101 operações, três fazendas, três runs; pull autenticado
com 10 animais, duas fazendas, expected=received=installed=5 na fazenda alvo.
Contagens/isolamento/cleanup passaram. Uma tentativa de reconnect sem Edge Runtime
ativo falhou com ACK_NOT_CONFIRMED; não classificada como regressão de produto.
Prova final e gates registrados abaixo.

### Prova observada e limitação do backend

Chromium 153.0.8010.12, Node v22.15.0, pnpm 11.23.0; IndexedDB nativo.
Prova final IndexedDB: 100 animais/1.000 eventos, duas fazendas, três repetições
com contextos novos; 550 registros esperados/lidos por run na fazenda alvo.
Durations individuais: 15,4 / 13,6 / 13,6 ms (arredondados); mediana 13,6 ms,
mínimo 13,6, máximo 15,4; p95/p99 null. Artefato:
`test-results/f24-6/indexeddb-cold-1791566695862.json`.
Seed/preparação e cleanup com tempos separados; isolation_verified e
indexeddb_deleted true nos três runs. Resultados preliminares da fila:
34 gestos/34 operações lidos na fazenda alvo, 101/101 no dataset, 3 fazendas;
contagens e controles preservados. Não houve workload máximo.

Após revisão do shape real de queue_ops (fazenda em record, sem coluna indexada
top-level preenchida pelo writer), o harness passou a ler operações por client_tx_id,
como o worker. Nova prova de três runs confirmou 34/34 gestos/operações no alvo,
368 animais/eventos lidos, isolamento e cleanup. Artefato
`test-results/f24-6/queue-warm-1791567255281.json`; leitura nativa correta, sem
presumir índice de fazenda operacional. Variação de duração nesse probe impede
interpretação de capacidade; provas de mecânica podem ter atividade de tooling
concorrente, e não compõem série de benchmark publicável.

Pull local: expected=received=installed=5, um request, 4.178 bytes recebidos,
278,9 ms; cleanup de farms/usuário/IndexedDB observado. Reconnect após iniciar
Edge local: dois gestos criados offline, dois UPDATEs, 12 requests, 1.300 bytes
enviados/5.735 recebidos; backlog 2→0, obrigações vazias e valores convergentes
por animal/fazenda. ACK upper bound 3.128,6 ms; convergência 3.459,8 ms. Artefato:
`test-results/f24-6/reconnect-warm-1791566395164.json`.
Execuções pequenas comprovam infraestrutura; não são certificação de escala.

Prova final de pull após adicionar guard de histórico e verificar ausência do
usuário Auth via SQL: `test-results/f24-6/pull-cold-1791567277818.json`,
expected=received=installed=5, isolation_verified e três flags de cleanup true,
340,8 ms, migration_history_match=false explicitamente registrado em purpose=proof.
Esse resultado substitui a prova preliminar do helper de fixture, sem promover
o ambiente a baseline de escala.

O último flow registrou PostgreSQL 17.6 e **54 migrations locais**, contra
**60 arquivos canônicos** no baseline. Versões ausentes no histórico local:
20261002005751, 20261003120000, 20261004210000, 20261005175412,
20261008202000, 20261008202024. Isso confirma divergência de histórico;
schema-equivalence não foi presumida nem descartada apenas por esse histórico.
Nenhuma migration/repair aplicada ao banco local compartilhado ou remotamente.

O propósito default é proof: permite testar a mecânica e registra
migration_history_match=false quando aplicável. --purpose benchmark exige
histórico idêntico antes de criar usuário/farms; prova negativa real executada
com pull retornou LOCAL_MIGRATION_BASELINE_NOT_ALIGNED, exit 1, como esperado.
Teste unitário cobre missing/extra entries e ordenação. Identidade de histórico
é pré-condição, não prova isolada da igualdade de schema/RLS.

Edge Runtime 1.74.3 / Deno 2.1.4 foi iniciado somente localmente, com env vazio,
JWT verification padrão e código deste worktree. Processo/container iniciados
para a prova foram encerrados ao final; serviços Supabase preexistentes preservados.
Fixtures locais dos probes passaram pelo cleanup dirigido, sem limpeza geral.

Decisão histórica anterior à F24.6A0-B: **F24_6A0 = BLOCKED_WITH_REASON** para liberar o conjunto P0 completo.
Harness de IndexedDB/queue e mecânica de flows comprovados; benchmark de
pull/reconnect requer ambiente local descartável equivalente ao baseline integrado,
com inventário de schema/RLS e histórico alinhado. Não corrigir isso no banco
compartilhado por reflexo; planejar provisionamento/reconstrução local isolada.
F24.6 permanece ACTIVE; nenhuma fase anterior reaberta.

Validação proporcional: node --test performance-contract (3/3), node --check
nos três módulos MJS, ESLint focado no browser harness, gates documentais e
git diff --check. Sem build, regressão global, stress staging ou validação remota.

## F24.6A0-B — desbloqueio do backend local

A [certificação isolada](./F24_6A0B_ISOLATED_LOCAL_BACKEND_CERTIFICATION.md)
substitui o blocker de ambiente: 60 migrations sem extras, schema/RLS/ACL/RPCs
e Auth/PostgREST/Edge verificados, pull/reconnect pequenos com isolamento e
convergência, cleanup observado e recursos compartilhados preservados.

Provisionador: `scripts/codex/performance-isolated-backend.mjs`.
O runner aceita `REBANHOSYNC_BENCHMARK_SUPABASE_WORKDIR` para escolher
explicitamente o projeto local. O ciclo pequeno certifica e descarta o backend;
séries P0 volumosas exigem lifecycle isolado próprio, sem usar o compartilhado.
Não há alteração de produto, otimização ou capacidade de escala declarada.
