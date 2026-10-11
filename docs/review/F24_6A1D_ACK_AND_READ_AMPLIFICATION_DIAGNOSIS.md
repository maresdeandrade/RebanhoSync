# F24.6A1-D — ACK Failure & Read Amplification Diagnosis

Atualizado em: 2026-10-10

`F24_6A1_ACK_DIAGNOSIS = PARTIAL / BLOCKED_WITH_REASON`

`ACK_FAILURE_CLASSIFICATION = LIMIT_NOT_PROVEN`; causa do quinto run original continua UNKNOWN. A reprodução única não apresentou falha de ACK: foi interrompida pelo orçamento previamente definido após 836 gestos DONE. `READ_AMPLIFICATION = BOTTLENECK_CONFIRMED`, agora com duração, bytes e equivalência por linha observados. F24.6A1 continua PARTIAL; nenhum avanço para 10k nem otimização.

## Git e escopo

Fetch/prune executado antes da alteração. Branch `codex/f24-6a0-benchmark`; HEAD e origin/main `3b3bc96db331c2917167cf8370024332f505d9f7`. Worktree dedicado `C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro`. Staged vazio; harness/documentos anteriores não commitados e worktrees concorrentes preservados.

Modificados nesta execução: `scripts/codex/performance-baseline.mjs`, `performance-browser.ts`, `performance-isolated-backend.mjs`; adicionados `performance-diagnostics.mjs`, `performance-diagnostic-report.mjs`, `tests/codex/performance-diagnostics.test.mjs`, este relatório. Os cinco snapshots canônicos receberam apenas continuidade documental. Os demais arquivos A0/A0-B/A1 preexistentes foram preservados.

Nenhum arquivo de produto, migration, RLS, RPC, índice, configuração funcional ou lockfile foi alterado. Não houve push, merge, deploy ou operação remota. A captura funciona somente no harness e no código servido em memória pelo Vite; fontes em src permanecem intactas. O caminho sem diagnóstico mantém o fluxo anterior.

## Captura e limites

Provas na mesma instância independente: controle de 10 gestos, 10 instrumentados, falha de transporte intencional de 10 e reprodução única de 1k. Instrumentação captura identidades sintéticas tx/op, status HTTP, código de transporte, falha de leitura/parse observacional, envelope de resultado sanitizado, instalação transacional do ACK, diagnóstico persistido existente, status terminal, retry agendado, backlog/obrigações, spans de pull e instalação IndexedDB. Não exporta headers, tokens, senhas ou payloads de domínio. Receipt significa envelope técnico sync-batch; o UPDATE genérico não exige propriedade factual `receipt` por operação.

Os spans usam performance.now. Respostas HTTP são observadas via Playwright, sem modificar o corpo consumido pelo produto. Snapshots/linhas são comparados por SHA256 em memória, exportando apenas hashes/contagens. Tempos de callbacks/leituras adicionais do observador são medidos separadamente. Durabilidade/identidade/semântica do ACK e do pull foram preservadas.

Limites publicados antes da reprodução: 240s de execução, 4000 requests, 600 MiB recebidos, 512 MiB de heap JS observado; guard externo anterior de 300s inalterado. Checks de duração/heap ocorrem entre gestos; limites de tráfego são sinalizados após resposta e checados antes do próximo gesto, portanto podem ultrapassar o limiar por um gesto. Heap JS não representa memória total de Chromium/Docker, nem pico; o run parcial não exportou série de heap. Sem mudança em timeout, retry, batching ou scheduler do produto.

A primeira inicialização (`f24-6a0b-c77295da`) foi bloqueada antes do artifact do controle: o Supabase CLI atualizou `supabase/.temp/cli-latest` de v2.115.0 para v2.120.0 e o guard interpretou cache de aviso como código funcional. `HARNESS_DEFECT_CONFIRMED` exclusivamente para esse gate de inicialização, sem relação demonstrada com o ACK antigo. Correção mínima: excluir somente esse cache gerado da comparação funcional. Cache gerado foi preservado em artifact e devolvido aos bytes anteriores após encerrar as próprias CLIs, sem reset de Git ou alteração de banco. A tentativa bloqueada e seu cleanup permanecem registrados.

## Provas observadas

| Prova | Resultado | ACK / backlog / reconciliação | Cleanup |
|---|---|---|---|
| Controle 10, diagnóstico desligado | PASS; 6053.2 ms | 10 gestos, backlog 0, obrigações 0, EXPECTED=ACTUAL, isolamento | VERIFIED |
| 10 instrumentados | PASS; 2695.6 ms | 10 resultados APPLIED, 10 ACKs, 14 pulls, 36 respostas, backlog/obrigações 0, isolamento | VERIFIED |
| Falha controlada | Captura verificada; ACK_NOT_CONFIRMED esperado | ERR_CONNECTION_RESET; sem resposta/receipt/ACK; PENDING, retry 1 agendado; 10 ops, obrigações 0 | VERIFIED |
| Reprodução única 1k | DIAGNOSTIC_RESOURCE_LIMIT; prefixo observado 240123.6 ms | 836 APPLIED/DONE/ACKs; 164 pendentes/ops e 2 obrigações no último snapshot; sem convergência final | VERIFIED |

Na falha controlada, tx `9a2100df-bbb8-43d9-8349-d3db57faa445`, op `4bee8ed2-2ffb-4326-8487-bff4df141434`, a classificação persistida foi NETWORK_FAILURE. O worker manteve a identidade e agendou retry; o harness não o executou. Essa prova demonstra que ACK_NOT_CONFIRMED agrega situações distintas, sem provar a causa do run original. Recebimento remoto, instalação local e convergência não são equivalentes.

Na reprodução, o último gesto DONE foi observado em 240123.6 ms; a próxima iteração parou no guard. Foram observados 2508 requests, 543400 bytes enviados, 361455701 recebidos, 418000 linhas de animais, errors=0, timeouts=0 e repeated_operation_submissions=0. Os 836 envelopes tiveram APPLIED e os spans de instalação transacional registraram ACK cometido. Não atribuir integridade/convergência de 1k completo ao prefixo. Os dados remotos das fixtures foram removidos no cleanup; não há recertificação pós-run de 1k completo.

## Perfil quantitativo por etapa

Tempos acumulados em segundos. Spans contêm etapas internas e se sobrepõem: não somar as linhas como partição do tempo total. A reprodução mede somente o prefixo de 836 gestos.

| Etapa | Prova 10 | Prefixo 836 |
|---|---:|---:|
| Tempo total observado | 2.696 | 240.124 |
| processGesture + observação terminal básica | 2.400 | 237.452 |
| Batch: request → headers observados | 1.403 | 80.038 |
| Batch: request → corpo observado | 1.457 | 82.439 |
| Instalação transacional de ACK | 0.132 | 6.418 |
| Pull inline após ACK | 0.574 | 131.405 |
| Todos os pulls | 0.695 | 131.405 |
| Instalação IndexedDB dentro dos pulls | 0.048 | 56.387 |
| HTTP dos pulls: request → corpo observado | 0.621 | 67.099 |
| Drain final de reconciliação | 0.196 | NÃO EXECUTADO |
| Custo observado no coletor Node | 0.015 | 9.579 |
| Custo observado no coletor browser | 0.031 | 2.548 |

Edge processing isolado não foi medido: batch request→headers/corpo inclui transporte, Kong, Edge, RPC/PostgreSQL e leitura observacional. Não apresentar esse intervalo como CPU/tempo exclusivo da Edge. ACK receipt é a chegada observada do envelope, não ACK físico. Coleta Node/browser ocorre em processos distintos e pode se sobrepor; os custos não devem ser subtraídos do wall time como correção causal. Controle mais lento que a prova instrumentada não prova custo negativo: são amostras únicas com aquecimento e variação ambiental. Nenhum SLO, percentile de cauda ou capacidade geral derivado.

## Amplificação comprovada

No prefixo: **836 chamadas inline de pull, duas consultas por gesto** (`animais` e `agenda_itens`), 1672 respostas de pull e 361317761 bytes (~344.58 MiB) de pull. Foram recebidas 500 linhas de animais para cada UPDATE de um animal: 418000 linhas.

Das 834 respostas comparáveis de animais, **499 de 500 linhas (99.8%)** permaneceram byte-equivalentes por hash ao snapshot anterior da mesma fazenda. Contando os dois primeiros snapshots sem anterior, 416166/418000 linhas (99.56%) repetiram conteúdo. Houve 1834 linhas novas/alteradas, incluindo as 1000 linhas dos primeiros snapshots. Nenhum snapshot completo de animais foi idêntico no prefixo: cada UPDATE alterou uma linha. A prova pequena mostrou quatro snapshots finais exatamente repetidos, provenientes de drain/final pull, separados do inline.

O inline consumiu **131.405s / 240.124s = 54.72%** do intervalo observado. A instalação IndexedDB consumiu 56.387s dentro desses pulls. Os custos medidos do observador demonstram perturbação da medição; o perfil não deve ser tratado como benchmark não instrumentado nem como economia garantida de uma futura otimização.

Origem confirmada: `src/lib/offline/syncWorker.ts`, caminho allApplied, adiciona animais e agenda_itens a refreshTables e chama pullDataForFarm após instalação do ACK (linha 2040). `src/lib/offline/pull.ts:655` consulta cada tabela por fazenda sem observations nesse caller; instalação em transação na linha 716. O drain final e o pull explícito do harness explicam as quatro chamadas adicionais da prova pequena; não ocorreram no prefixo interrompido.

## Menor intervenção candidata, sem patch funcional

Avaliar refresh dirigido dos animais tocados no caller allApplied, preservando revisão CAS, merge seguro, pending e obrigações de reconciliação. A simples inclusão de filtro por ID no pull atual não é segura por si: applyFarmPull usa replace para a fazenda ativa e remove linhas não retornadas; não autorizar essa troca sem definir cobertura de snapshot/parcial e testar farm ativa/inativa, clientes antigos, stale/CAS, retry/replay e fatos derivados/agenda. Não suprimir o refresh pós-ACK nem limpar obrigação antecipadamente. Nenhuma dessas mudanças foi implementada ou aprovada nesta execução.

## Evidência, ambiente e riscos

Instância `f24-6a0b-bc616f02`, API 55321/DB 55322, mesma identidade em todas as provas; 60 migrations canônicas e validator schema/RLS/Auth/PostgREST/Edge aprovados antes de executar. Recursos próprios removidos, fixtures/IndexedDB/usuários sintéticos excluídos; fingerprints e inventário compartilhados preservados. Primeira instância bloqueada também removida. Artifacts: `test-results/f24-6/f24-6a0b-bc616f02/certification.json`, `reconnect-warm-1791619231754.json`, `f24-6a1-d-analysis.json`, manifests e runs pequenos referenciados na certificação. Script de análise: `node scripts/codex/performance-diagnostic-report.mjs test-results/f24-6/f24-6a0b-bc616f02/certification.json`.

`reconnect-warm-1791597655102.json` e `f24-6a1-analysis.json` originais preservados byte a byte; SHA256 antes/depois conferido no manifest `f24-6a1-d-preserved-manifest.json`. Sem substituir amostra por retry e sem 10k. Artifacts são locais ignorados e precisam acompanhar a evidência ao transportar o trabalho.

Riscos/pendências: causa original não reproduzida; limite de duração impede prova completa de 1k/reconciliação; tempo interno Edge e custos completos/peak de memória continuam não isolados. Classificação da reprodução é limite do experimento, não defeito de produto nem ENVIRONMENT_LIMITATION causal comprovada. Diagnóstico original permanece LIMIT_NOT_PROVEN. Próxima execução deve definir captura incremental e orçamento explícito com base neste perfil antes de decidir nova reprodução; não ampliar duração ou alterar produto por conveniência.

## Validação e gate do harness

Seis testes focados de contrato/instrumentação PASS; lint do escopo PASS; node --check dos quatro MJS alterados/novos PASS; transformação dos dois módulos reais via esbuild do Vite PASS; checagem dirigida de 836 flags committed + diagnósticos persistidos ack_installed_at PASS; gates documentais PASS; git diff --check PASS; scan dirigido de scripts/documento/certificação/artifact de análise sem padrões de segredos. Diff src/supabase/config/lockfiles vazio; staged vazio. Hashes dos arquivos de instrumentação e hashes preservados em manifests locais. Inventário final contém apenas recursos preexistentes.

Verification gate do harness: READY WITH CAVEAT, limitado às provas pequenas aprovadas e à captura do prefixo. Não declara completa a série de 1k nem a causa original. Não houve regressão global/build/stress remoto ou nova reprodução após o limite. Custos do observador, ausência de tempo exclusivo Edge e memória total/peak não medida são ressalvas explícitas.
