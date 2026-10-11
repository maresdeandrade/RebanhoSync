# F24.6A1 — P0 Local Store / Queue / Reconnect

Atualizado em: 2026-10-10

`F24_6A1 = PARTIAL / BLOCKED_WITH_REASON`. Foram concluídos 69 de 70 runs tentados: IndexedDB e fila 60/60; reconnect 100 gestos 5/5; reconnect 1k 4/5. O quinto run de 1k terminou em `ACK_NOT_CONFIRMED`; 10k não foi executado pelo gate de progressão. A falha permanece na evidência e não foi substituída por retry. F24.6 continua ACTIVE; F24.6A0_BACKEND permanece READY_FOR_P0_BENCHMARKS. Nenhuma otimização autorizada ou implementada.

## Baseline e método

- Branch `codex/f24-6a0-benchmark`; HEAD e origin/main `3b3bc96db331c2917167cf8370024332f505d9f7`. Worktree `C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro`. Staged vazio; alterações documentais e harness não commitados preservados. Checkout original e worktrees concorrentes preservados.
- Execução sequencial, cinco runs por ponto nativo. Reconnect: cinco subprocessos por nível, mesmo backend durante toda a série, interrupção no primeiro erro. Seed, autenticação inicial e cleanup fora da duração medida. Guard de subprocesso existente de 300s preservado; não foi disparado.
- Windows 11 10.0.26300, i7-14700HX, 28 CPUs lógicas; memória visível 16474168 KiB, livre 1350016 KiB no preflight. Node 22.15.0, pnpm 11.23.0, Chromium 153.0.8010.12, Playwright 1.63.0, Dexie 4.3.0, Vite 6.4.2. Tooling próprio sem concorrência relevante durante medição; serviços preexistentes continuaram ativos. Não há isolamento de hardware nem prova de causa por pressão de memória.
- IndexedDB usa registros sintéticos e leitura indexada por fazenda, sem histórico/UI real. Volumes são totais nas duas fazendas; linhas lidas representam a fazenda selecionada. Cold significa fechar/reabrir Dexie após seed, sem esvaziar cache de OS/dispositivo. Warm tem aquecimento excluído.
- Queue usa uma operação por gesto, distribuída em duas ou cinco fazendas. Seleção/ordenação inclui leitura das operações dos gestos selecionados; a duração total também inclui leitura auxiliar de 1k animais/10k eventos e serialização. Não mede throughput de sync.
- Reconnect usa UPDATE real de animais via worker/Edge, ACK observado e pull/reconciliação reais. Warm significa módulos, Auth e pull inicial preparados. ACK é limite superior de observação local, nunca latência física de ACK. Payload representa corpos observados, não bytes físicos da conexão/compressão.
- Heap são snapshots antes/depois, não pico nem memória total do processo. CPU é TaskDuration do navegador. GC pode reduzir heap após o run. Mediana, min–max e MAD usam apenas runs completos; não foram criados SLOs nem percentis de cauda com amostra pequena.

## Integridade e backend

Projeto independente `f24-6a0b-b5e1a733`, provisionador Supabase CLI 2.117.0, API 55321/DB 55322, identidade estável durante a série. As 60 migrations canônicas foram aplicadas sem entradas extras. Schema, funções, triggers, índices, RLS, ACL/RPC, Auth, PostgREST e Edge foram certificados antes dos flows pelo provisionador e validator focado. Manifesto de migrations/configuração e fingerprints estão no artifact de certificação. Credenciais permaneceram em memória.

Cada run completo comprovou EXPECTED=ACTUAL, isolamento e exclusão de IndexedDB. Reconnect completo também comprovou backlog final zero, obrigações de reconciliação zero, contagens remotas/locais corretas e cleanup das fazendas/usuário sintéticos. Não atribuir esses resultados finais ao run interrompido.

Seis containers, dois volumes e uma rede próprios foram removidos. `cleanup_verified`, `preexisting_resources_unchanged` e `shared_schema_history_unchanged` observados como true. Containers/volumes/rede e schema/histórico do backend compartilhado preservados. O finally do run interrompido não reportou FAILED_CLEANUP, mas seu artifact não exporta os flags individuais de cleanup; a remoção completa do backend é comprovada pelo provisionador. O fallback de encerramento de browsers filhos por timeout não foi exercitado.

## Falha preservada e classificação

Artifact `test-results/f24-6/reconnect-warm-1791597655102.json`: exit 1, sem signal, `ACK_NOT_CONFIRMED`, seed 1000 animais/gestos/operações. Últimos contadores: 2766 requests; 599950 bytes enviados; 399529856 bytes recebidos; 460500 linhas recebidas; errors=3; timeouts=0; repeated_operation_submissions=0. Sem duração final, ACK/convergência finais, backlog final ou estado terminal detalhado do gesto.

`errors` agrega HTTP >=400, falha de request e falha de leitura do corpo da resposta. Não foram preservados status HTTP, tipos individuais ou razão terminal do gesto. Causa não determinada: falha de produto, transporte ou ambiente ainda precisam de diagnóstico dirigido. Não classificar como defeito de produto confirmado, limitação ambiental comprovada ou três erros HTTP. Contador de retry terminal pode zerar em DONE; reenvios de client_op_id observados são evidência mais direta, sem demonstrar todo comportamento de retry.

Amplificação de leitura confirmada no envelope: 5200→502000 linhas e aproximadamente 4.3→416.7 MiB recebidos ao passar de 100 para 1000 gestos; requests 306→3006. Em `src/lib/offline/syncWorker.ts`, o caminho allApplied inclui animais em refreshTables para UPDATE e chama pullDataForFarm após ACK (linha 2040). `src/lib/offline/pull.ts:655` consulta a tabela por fazenda, sem observations nesse caller. O mecanismo explica a repetição de snapshots da fazenda nesse workload. Classificação transversal: `BOTTLENECK_CONFIRMED` para amplificação de leitura; participação causal na duração e na falha exige perfil/diagnóstico, sem capacidade geral ou SLO declarado. Nenhuma mudança em batching/pull/índices.

Pontos nativos e reconnect 100: PROVEN_OK somente para integridade e envelope sintético exercitado. Reconnect 1k: LIMIT_NOT_PROVEN para série de cinco runs; 10k: LIMIT_NOT_PROVEN, não executado porque o nível anterior não concluiu. UI/histórico real, mobile, limites gerais, concorrência de sync, WAL/autovacuum e stress remoto não foram medidos nesta etapa.

## Reprodutibilidade e arquivos

Comandos executados: `node scripts/codex/performance-p0-series.mjs`; com REBANHOSYNC_SUPABASE_CLI apontando para o binário local certificado, `node scripts/codex/performance-isolated-backend.mjs --p0-reconnect`; depois `node scripts/codex/performance-p0-report.mjs <native.json> <certification.json>`.

Artifacts locais ignorados preservados em `test-results/f24-6/`: `p0-native-597420ca-477b-437f-9f45-a5c42e8551f4.json`, `f24-6a0b-b5e1a733/certification.json`, runs individuais referenciados, `f24-6a1-host.json`, `f24-6a1-analysis.json` e `f24-6a1-tables.md`. Analysis registra hashes SHA256 dos dois manifests; runs registram parâmetros/versões/hashes do harness. Os 12 pontos nativos usaram hash `b8595bbbbdf8b1fb64bcdc1002fef66eaa17cceba581791e7a83b173617eaec3`. Todos os reconnects usaram hash `4ec83355c81c8905f4b7c0a01ae8058ac1a86802553b48a20d9a4c07ef941c74`. Esses artifacts locais devem ser preservados ao transportar a evidência.

Escopo alterado nesta etapa: harness performance-baseline, performance-browser, performance-local-fixture e performance-isolated-backend; novos performance-p0-series e performance-p0-report; este relatório e os cinco snapshots canônicos. Arquivos de produto, migrations, configuração funcional e lockfiles preservados. Documentos/harness de A0/A0-B já existentes não foram descartados. Sem commit, push, merge, deploy ou alteração remota.

## Resultados quantitativos

F = fazendas; IDB = animais/eventos totais; Queue = gestos totais. Gestos/ops na tabela são os selecionados no ponto nativo e os processados no reconnect. Erros completos+falha separa amostras válidas do run interrompido.

| Ponto | completos/tentados | mediana ms | min–max ms | MAD ms | tx/seleção ms | heap antes→depois MiB | linhas / gestos / ops selecionados | erros completos+falha | classe |
|---|---:|---:|---:|---:|---:|---|---|---|---|
| IDB 1000/10000 F2 cold | 5/5 | 112.7 | 110.5–163.0 | 2.2 | 112.7 | 19.1→13.1 | 5500.0 / 0.0 / 0.0 | 0.0 + 0 | PROVEN_OK |
| IDB 1000/10000 F2 warm | 5/5 | 112.5 | 110.3–134.4 | 1.9 | 112.5 | 12.1→15.7 | 5500.0 / 0.0 / 0.0 | 0.0 + 0 | PROVEN_OK |
| IDB 10000/100000 F2 cold | 5/5 | 1084.8 | 1065.1–4995.8 | 19.7 | 1084.8 | 27.6→12.5 | 55000.0 / 0.0 / 0.0 | 0.0 + 0 | PROVEN_OK |
| IDB 10000/100000 F2 warm | 5/5 | 1067.2 | 1047.9–1102.1 | 19.3 | 1067.2 | 12.5→34.0 | 55000.0 / 0.0 / 0.0 | 0.0 + 0 | PROVEN_OK |
| IDB 50000/500000 F2 cold | 5/5 | 4612.4 | 3372.6–6670.2 | 1197.4 | 4612.4 | 110.2→232.7 | 275000.0 / 0.0 / 0.0 | 0.0 + 0 | PROVEN_OK |
| IDB 50000/500000 F2 warm | 5/5 | 3311.5 | 3238.3–3395.1 | 66.9 | 3311.5 | 129.3→236.0 | 275000.0 / 0.0 / 0.0 | 0.0 + 0 | PROVEN_OK |
| Queue 100 F2 warm | 5/5 | 72.6 | 71.0–120.2 | 1.3 | 5.5 | 13.4→17.4 | 5500.0 / 50.0 / 50.0 | 0.0 + 0 | PROVEN_OK |
| Queue 100 F5 warm | 5/5 | 33.4 | 33.0–53.4 | 0.4 | 3.7 | 10.9→12.6 | 2200.0 / 20.0 / 20.0 | 0.0 + 0 | PROVEN_OK |
| Queue 1000 F2 warm | 5/5 | 115.9 | 111.6–208.8 | 3.2 | 45.3 | 18.7→19.8 | 5500.0 / 500.0 / 500.0 | 0.0 + 0 | PROVEN_OK |
| Queue 1000 F5 warm | 5/5 | 55.9 | 53.4–105.2 | 2.5 | 25.7 | 14.6→18.3 | 2200.0 / 200.0 / 200.0 | 0.0 + 0 | PROVEN_OK |
| Queue 10000 F2 warm | 5/5 | 515.1 | 496.4–558.5 | 11.3 | 411.6 | 41.9→12.6 | 5500.0 / 5000.0 / 5000.0 | 0.0 + 0 | PROVEN_OK |
| Queue 10000 F5 warm | 5/5 | 251.2 | 244.6–261.6 | 6.6 | 217.5 | 32.6→39.0 | 2200.0 / 2000.0 / 2000.0 | 0.0 + 0 | PROVEN_OK |
| Reconnect 100 F2 warm | 5/5 | 9195.8 | 8798.6–16065.2 | 397.2 | — | 11.8→33.5 | 50.0 / 100.0 / 100.0 | 0.0 + 0 | PROVEN_OK |
| Reconnect 1000 F2 warm | 4/5 | 148958.2 | 133250.1–158073.6 | 5839.9 | — | 42.2→23.1 | 500.0 / 1000.0 / 1000.0 | 0.0 + 3 | LIMIT_NOT_PROVEN |
| Reconnect 10000 F2 warm | 0/0 | — | — | — | — | —→— | — / — / — | — + 0 | LIMIT_NOT_PROVEN |

| Reconnect | ACK upper bound mediana ms | convergência mediana ms | requests/run | enviado/recebido MiB mediana | linhas recebidas/run | reenvios | backlog final / obrigações |
|---|---:|---:|---:|---|---:|---:|---|
| Reconnect 100 F2 warm | 9070.5 | 9195.8 | 306.0 | 0.1 / 4.3 | 5200.0 | 0.0 | 0.0 / 0.0 |
| Reconnect 1000 F2 warm | 147921.1 | 148958.2 | 3006.0 | 0.6 / 416.7 | 502000.0 | 0.0 | 0.0 / 0.0 |
| Reconnect 10000 F2 warm | — | — | — | — / — | — | — | — / — |

### Queue: bytes e CPU

| Ponto | ops/gesto | bytes selecionados | CPU mediana ms |
|---|---:|---:|---:|
| Queue 100 F2 warm | 1 | 28001 | 25.5 |
| Queue 100 F5 warm | 1 | 11201 | 13.5 |
| Queue 1000 F2 warm | 1 | 280001 | 53.9 |
| Queue 1000 F5 warm | 1 | 112001 | 25.4 |
| Queue 10000 F2 warm | 1 | 2800001 | 353.6 |
| Queue 10000 F5 warm | 1 | 1120001 | 155.1 |

## Validação focada e pendências

Observado: três testes de performance-contract aprovados; node --check dos sete scripts performance MJS aprovado; ESLint dos sete MJS e performance-browser.ts aprovado; gates documentais aprovados; git diff --check aprovado; scan dirigido de padrões de segredos sem achados nos arquivos do escopo e artifacts utilizados. Diff tracked/staged em src, supabase, package.json e pnpm-lock.yaml vazio. Nenhuma regressão global, build completo, stress remoto ou novo retry do benchmark executado. Análise quantitativa validou integridade de todos os runs completos.

Pendências reais: diagnosticar ACK_NOT_CONFIRMED com detalhe de transporte/resultado terminal preservado; quantificar participação de pull repetido na duração sem alterar contratos; somente retomar progressão 1k→10k após evidência correta do nível anterior. Histórico/UI real e envelope de produção continuam LIMIT_NOT_PROVEN.
