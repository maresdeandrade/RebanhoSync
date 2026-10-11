# F24.6A1-E2 — Seed Diagnosis & A/B Benchmark Completion

Atualizado em: 2026-10-11
Decisão: **F24_6A1_E2 = READY_FOR_REVIEW** no envelope de 100 gestos; nenhuma aprovação de merge ou certificação de reconnect 1k.

## Baseline e preservação

Branch codex/f24-6a0-benchmark; HEAD e origin/main = 3b3bc96db331c2917167cf8370024332f505d9f7 após fetch/prune. Worktree C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro; staged vazio. Alterações e worktrees concorrentes preservados. Não houve commit, push, merge, deploy, migration remota ou alteração funcional nesta execução.

Na checagem final, origin/main havia avançado por trabalho concorrente para 35df487c2b21b3e98fc27fdd255cf82b80748140 (PRs #193/#194). Inspeção do intervalo desde a baseline: somente RegistrarComercialSection.tsx e RegistrarStickyActionBar.tsx, layouts mobile. Nenhuma alteração em sync/persistência/backend/dependências; a aplicação UI nem é carregada pelo harness. HEAD/benchmark continuam fixos em 3b3bc96db331c2917167cf8370024332f505d9f7, sem atualização/rebase implícito. Essa evidência caracteriza a baseline explícita, não todo o último main.

Os quatro hashes do manifest final E1 (dois módulos funcionais e dois testes) permanecem idênticos. Preservados 93 arquivos anteriores, incluindo artifacts, manifests, patches e F24_6A1E1_POST_ACK_REFRESH_IMPLEMENTATION.md, com SHA-256 verificado. Manifest de preservação: test-results/f24-6/f24-6a1-e2-preserved-manifest.json. E1 conserva sua decisão histórica PARTIAL; E2 fornece uma nova série, sem reclassificar nem substituir as falhas antigas.

## Diagnóstico do seed

Artefato original: test-results/f24-6/reconnect-warm-1791686555091.json. A execução parou na fase seed, sem resultados, com BROWSER_OPERATION_FAILURE; processo saiu com código 1 e signal null. Cleanup de IndexedDB, fazendas e usuário foi confirmado. Não existem mensagem, stack, subtipo, etapa interna ou HTTP nesse artifact. O wrapper retornava error_type mas descartava esse campo e relançava apenas o código agregado. **HARNESS_DEFECT_CONFIRMED** para a perda de diagnóstico; **LIMIT_NOT_PROVEN** para a causa da falha original. Não há evidência para atribuí-la ao produto, IndexedDB/quota, browser, Auth ou sync.

Instrumentação nova exclusivamente no harness: importação do módulo, abertura IndexedDB, importação Auth, login, ownership, importação worker/pull, pull inicial e contagens; relógio monotônico e trilha de etapas. Captura tipo/código/mensagem/stack sanitizados, eventos pageerror/crash/close, fechamento do contexto/browser, endpoints sem query e status HTTP, erro de transporte e duração até a falha. Tokens, senhas, emails, URLs e objetos/literais sensíveis são removidos; nenhum header/body Auth é exportado. DOMException pode não fornecer stack: a ausência é preservada, sem inventar frames. Não se altera timeout nem retry do produto.

Antes da série, uma prova de dois animais/duas fazendas executou seed normal e lançou DOMException artificial no harness, após seed e antes de enqueue. Captura observada: etapa controlled_after_seed, QuotaExceededError, código 22, categoria INDEXEDDB_QUOTA, cleanup completo. Isso comprova a captura do tipo/código; **não comprova quota real nem reproduz a causa original**. Probes pequenos reais de pull/reconnect e os sete checks pós-ACK com dois contextos passaram. A falha antiga não foi explicada, portanto a série abaixo é independente e explicitamente identificada.

## Comparabilidade e limites prévios

Série F24_6A1_E2-f24-6a0b-04307ea2; ambiente único e estável f24-6a0b-04307ea2. Config SHA-256 7cac51d8280aaf0ec688711c69d83e7cb0cf0fe07023dd4eaba949c078aab7ce; harness medido SHA-256 4ccae94d6a557a3aa304862f2cce47cb14b5e631b8f39162099f2154c1475945. Original: git show do baseline para somente pull.ts e syncWorker.ts, em transformação Vite em memória. Otimizado: somente o patch final C+D já aprovado no escopo E1, com hashes congelados. Sem checkout/reset das fontes. Demais arquivos funcionais são baseline; transform diagnóstica e instrumentação idênticas. Hashes efetivos de cada variante, configuração e ordem constam em f24-6a1-e2-analysis.json; verificador rejeita mistura de harness/configuração, amostra duplicada, rótulo errado e drift de variante.

Cada run: 100 animais/100 gestos UPDATE observacoes, uma operação por gesto, duas fazendas com 50 animais cada, UUIDs novos, mesmo shape e distribuição round-robin; agenda vazia e sem fixture factual de eventos. O parâmetro events=1000 é default não consumido por reconnect, não representa 1000 eventos inseridos. Contexto Chromium/IndexedDB, usuário normal e fixtures novos por run; limpeza dirigida antes do próximo. Backend quente, execução serial e ordem contrabalançada: original:1, optimized:1, optimized:2, original:2, original:3, optimized:3, optimized:4, original:4, original:5, optimized:5. Nenhuma amostra E1/E1-v1 foi misturada. Inventário de tooling durante a série encontrou apenas provisionador e seu runner, sem outro runner de testes identificado; não é host físico exclusivo.

Limites definidos antes de executar: 100 gestos, cinco runs por variante; guard externo 300s/child; guard de workload 240s, 4000 requests, 600MiB recebidos e 512MiB de heap aproximado. Primeiro erro encerra a série, sem substituir amostra por retry. 1k/10k não executados. Seed, importações, Auth e cleanup ficam fora da duração de workload. Observadores de seed são removidos antes da medição; custo Node do seed é registrado separadamente. Os callbacks diagnósticos de workload têm custo registrado, mas não estimam todo o overhead da instrumentação.

Versões iguais nos dez runs: Node v22.15.0, pnpm 11.23.0, Chromium 153.0.8010.12, Dexie 4.3.0, Vite 6.4.2, Playwright 1.63.0, PostgreSQL 17.6; CLI 2.117.0. Imagens do mesmo backend: PostgreSQL 17.6.1.167, PostgREST v16.2, Auth/GoTrue v2.196.0, Edge v1.74.3, Kong 2.8.1, Mailpit v1.30.2. Digests em f24-6a1-e2-backend-images.json. Histórico exato das 60 migrations, schema/RLS/ACL/RPCs e Auth/PostgREST/Edge verificados pelo provisionador reutilizado.

## Resultados individuais

Tempos em ms. ACK observado = último evento de ACK instalado/committed, contado desde início diagnóstico; seu relógio inicia ligeiramente antes do workload. ACK upper = limite superior de processGesture, que inclui refresh inline. Nenhum deles mede latência física do ACK. Convergência é o tempo total até drain e verificação dos valores locais. CPU é TaskDuration do Chromium via CDP, não CPU do Edge/PostgreSQL. Instalação = soma dos spans IndexedDB, contidos nos pulls; não somar spans sobrepostos ao tempo total.

| Variante/run | Seed fora do workload | Total | ACK observado | ACK upper | Convergência | Instalação IDB | CPU Task |
|---|---:|---:|---:|---:|---:|---:|---:|
| original/1 | 10860.83 | 23430.30 | 22647 | 22677.60 | 23430.30 | 1581.00 | 3420.92 |
| optimized/1 | 13988.74 | 16097 | 15605.70 | 15636.50 | 16097 | 581.30 | 2398.30 |
| optimized/2 | 12333.81 | 22869.90 | 22539 | 22573.10 | 22869.90 | 581.70 | 2878.05 |
| original/2 | 9153.54 | 16327.80 | 15975.10 | 16006.60 | 16327.80 | 826.40 | 2860.89 |
| original/3 | 14568.13 | 21526.30 | 21147.30 | 21179.80 | 21526.30 | 1105.60 | 3050.54 |
| optimized/3 | 7421.30 | 16593.70 | 16096 | 16133.70 | 16593.70 | 485.60 | 2534.91 |
| optimized/4 | 10215.43 | 15070.10 | 14708.90 | 14737.50 | 15070.10 | 487.20 | 2439.06 |
| original/4 | 7699.92 | 16174.10 | 15777.30 | 15798.70 | 16174.10 | 1007.90 | 2830.35 |
| original/5 | 10021.95 | 16825.40 | 16444.60 | 16476.10 | 16825.40 | 923.30 | 2816.68 |
| optimized/5 | 7738.48 | 15155.50 | 14785.50 | 14811.30 | 15155.50 | 555.50 | 2434.83 |

Bodies em bytes; heap JS via CDP em MiB (antes/depois), sem pico de memória ou GC controlado.

| Variante/run | Requests | Pulls | Enviado | Recebido | Linhas | Heap antes | Heap depois | Artifact |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| original/1 | 306 | 104 | 65000 | 4550063 | 5200 | 12.01 | 22.74 | reconnect-warm-1791690347719.json |
| optimized/1 | 306 | 104 | 65000 | 287639 | 300 | 11.89 | 21.42 | reconnect-warm-1791690391204.json |
| optimized/2 | 306 | 104 | 65000 | 287621 | 300 | 11.89 | 21.38 | reconnect-warm-1791690432009.json |
| original/2 | 306 | 104 | 65000 | 4550298 | 5200 | 11.87 | 29.19 | reconnect-warm-1791690477242.json |
| original/3 | 306 | 104 | 65000 | 4550194 | 5200 | 12.03 | 32.20 | reconnect-warm-1791690511146.json |
| optimized/3 | 306 | 104 | 65000 | 287636 | 300 | 11.89 | 34.52 | reconnect-warm-1791690557018.json |
| optimized/4 | 306 | 104 | 65000 | 287618 | 300 | 11.93 | 30.76 | reconnect-warm-1791690591911.json |
| original/4 | 306 | 104 | 65000 | 4549877 | 5200 | 11.96 | 15.89 | reconnect-warm-1791690626385.json |
| original/5 | 306 | 104 | 65000 | 4550315 | 5200 | 11.93 | 15.68 | reconnect-warm-1791690661498.json |
| optimized/5 | 306 | 104 | 65000 | 287054 | 300 | 11.87 | 21.36 | reconnect-warm-1791690698518.json |

## Estatísticas por variante

Cinco amostras por variante. MAD = mediana dos desvios absolutos à mediana; não calcular p95/p99 com N=5 (campos null nos artifacts). Campos _ms em milissegundos, _bytes em bytes, demais em contagens.

| Métrica | Original mediana | mín | máx | MAD | Otimizado mediana | mín | máx | MAD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| seed_duration_ms | 10021.95 | 7699.92 | 14568.13 | 868.41 | 10215.43 | 7421.30 | 13988.74 | 2476.95 |
| seed_observer_node_ms | 0.10 | 0.07 | 0.15 | 0.02 | 0.08 | 0.07 | 0.43 | 0.01 |
| ack_installed_observed_from_diagnostic_start_ms | 16444.60 | 15777.30 | 22647 | 667.30 | 15605.70 | 14708.90 | 22539 | 820.20 |
| duration_ms | 16825.40 | 16174.10 | 23430.30 | 651.30 | 16097 | 15070.10 | 22869.90 | 941.50 |
| ack_upper_bound_ms | 16476.10 | 15798.70 | 22677.60 | 677.40 | 15636.50 | 14737.50 | 22573.10 | 825.20 |
| convergence_ms | 16825.40 | 16174.10 | 23430.30 | 651.30 | 16097 | 15070.10 | 22869.90 | 941.50 |
| requests | 306 | 306 | 306 | 0 | 306 | 306 | 306 | 0 |
| sent_bytes | 65000 | 65000 | 65000 | 0 | 65000 | 65000 | 65000 | 0 |
| received_bytes | 4550194 | 4549877 | 4550315 | 121 | 287621 | 287054 | 287639 | 15 |
| animal_rows_received | 5200 | 5200 | 5200 | 0 | 300 | 300 | 300 | 0 |
| all_pull_rows | 5200 | 5200 | 5200 | 0 | 300 | 300 | 300 | 0 |
| pull_calls | 104 | 104 | 104 | 0 | 104 | 104 | 104 | 0 |
| inline_pulls | 100 | 100 | 100 | 0 | 100 | 100 | 100 | 0 |
| pull_responses | 206 | 206 | 206 | 0 | 206 | 206 | 206 | 0 |
| pull_bytes | 4533694 | 4533377 | 4533815 | 121 | 271121 | 270554 | 271139 | 15 |
| pull_duration_ms | 4676.30 | 4332.20 | 6830.60 | 344.10 | 3601.90 | 3320.20 | 5702.40 | 281.70 |
| ack_installation_ms | 679.20 | 522.80 | 1306.50 | 129.40 | 616.70 | 502.70 | 1017.90 | 114.00 |
| installation_ms | 1007.90 | 826.40 | 1581.00 | 97.70 | 555.50 | 485.60 | 581.70 | 26.20 |
| reconciliation_ms | 272.60 | 233.20 | 569.60 | 20.60 | 255.40 | 221.30 | 390.30 | 34.10 |
| observed_receipts | 100 | 100 | 100 | 0 | 100 | 100 | 100 | 0 |
| committed_acks | 100 | 100 | 100 | 0 | 100 | 100 | 100 | 0 |
| operations | 100 | 100 | 100 | 0 | 100 | 100 | 100 | 0 |
| heap_before_bytes | 12544788 | 12442608 | 12617692 | 45040 | 12467044 | 12445476 | 12507096 | 1452 |
| heap_after_bytes | 23841744 | 16439660 | 33768944 | 7179756 | 22459112 | 22393324 | 36199204 | 65788 |
| cpu_task_ms | 2860.89 | 2816.68 | 3420.92 | 44.20 | 2439.06 | 2398.30 | 2878.05 | 40.76 |
| observer_node_ms | 140.98 | 131.38 | 148.16 | 3.63 | 38.48 | 36.77 | 43.45 | 1.70 |
| observer_browser_ms | 239.30 | 237.30 | 486.90 | 2.00 | 299.60 | 226.20 | 475.00 | 64.80 |
| timeouts | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| errors | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| retries | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| backlog_after | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| obligations_after | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Interpretação e integridade

FATOS CONFIRMADOS: redução de 93.68% nos bodies recebidos e 94.23% nas linhas; mediana da instalação IndexedDB reduzida em 44.89% e CPU Task em 14.74% nesta série instrumentada. Mediana total 16825.40→16097ms (4.33% menor). Original varia 16174.10–23430.30ms; otimizado 15070.10–22869.90ms, com sobreposição ampla. Não afirmar ganho geral, significância estatística, SLO ou capacidade do produto. Primeiro original e segundo otimizado são amostras altas preservadas, não descartadas.

Requests permanecem 306/run: 100 Edge e 206 respostas PostgREST; 104 pulls = 100 inline, dois drains integrais e dois pulls finais do harness. Enviado = 65000 bytes/run. Baseline inline recebe 50 animais/gesto (5000 linhas), otimizado recebe um (100 linhas); 200 linhas dos pulls integrais finais são preservadas, resultando 5200→300. Agenda integral vazia nesta fixture; não generalizar a agendas volumosas. Headers, compressão e tráfego físico não medidos. Observar menos bytes não significa eliminar chamadas de pull.

Heap final mediano 22.74→21.42MiB, com grande variação: original 15.68–32.20MiB e otimizado 21.36–34.52MiB. Não demonstrado ganho geral de memória nem redução de pico. Observação de snapshots Node custa aproximadamente 140.98→38.48ms; esse custo também varia com o volume recebido e integra o benchmark. Não subtrair esses spans do tempo de parede como se fossem exclusivos.

Todos os dez runs: 100 resultados APPLIED HTTP 200, 100 ACKs locais committed, 100 gestos DONE, uma operação por gesto; EXPECTED=ACTUAL (50 linhas da fazenda alvo e todos os 100 valores verificados), CROSS_FARM_ISOLATION=VERIFIED, BACKLOG_FINAL=0, operações restantes=0, RECONCILIATION_OBLIGATIONS=0, erros/retries/replays/timeouts=0 e cleanup completo de IndexedDB/fazendas/usuário. Preservação da segunda fazenda e recuperação também exercitadas nos checks reais de farm-switch/multi-device. Não transforma receipt em prova de convergência: contagens, valores e obrigações são gates separados.

## Alterações desta execução e validação

Modificados no harness: performance-baseline.mjs (captura seed, proveniência), performance-browser.ts (etapas de seed), performance-isolated-backend.mjs (flag --seed-ab-comparison, prova controlada e série independente com guard de hash), performance-post-ack-report.mjs (output E2 separado, equivalência, métricas e preservação). Adicionados performance-seed-diagnostics.mjs e performance-ab-equivalence.mjs; dois testes Node correspondentes. Nenhuma alteração desta execução em syncWorker.ts, pull.ts, schema, Edge, SQL/RLS, scheduler, batching ou retries. Relatório E1 preservado; snapshots de status/roadmap/plano/handoff/review atualizados com estado E2.

Comandos observados: node --test nos quatro arquivos performance-{contract,diagnostics,seed-diagnostics,ab-equivalence}.test.mjs = 10/10 PASS; node --check nos cinco módulos mjs afetados = PASS; ESLint focado em performance-browser.ts = PASS. Provisionador --seed-ab-comparison = PASS, incluindo prova controlada de erro, probes pequenos, sete checks pós-ACK e dez runs quantitativos. Analyzer = complete true, 10 linhas, zero failures e equivalência verificada. Os 148 testes de produto do E1 não foram repetidos: fontes funcionais continuam com os mesmos hashes e esta execução só modifica harness. Sem regressão global/build/E2E de UI. Gates documentais via node scripts/antigravity/run_bash.mjs scripts/antigravity/docs_gates.sh = PASS (headers, continuidade e data contract); git diff --check = PASS; scan de padrões de segredos em 15 artifacts/documento = PASS. Verificação final: nove fontes do harness medido mantêm os hashes da certificação; 93 arquivos anteriores inalterados; nenhum recurso do projeto permanece, nem processos próprios amostrados.

Reprodução (PowerShell, no worktree dedicado e com o manifest E1 preservado):

```powershell
$env:REBANHOSYNC_SUPABASE_CLI='C:/apps/supabase/current/supabase.exe'
node scripts/codex/performance-isolated-backend.mjs --seed-ab-comparison
# Usar o certification.json do NOVO projeto impresso pelo comando acima:
node scripts/codex/performance-post-ack-report.mjs <caminho-do-novo-certification.json>
```

O relatório E2 tem nome estável; preservar seu artifact antes de nova execução de análise. Os artifacts individuais e certificates usam identificadores novos e não substituem amostras antigas. Supabase cli-latest é cache gerado; foi restaurado aos bytes originais de HEAD após os comandos CLI, sem tocar configurações ou outros arquivos.

## Ambiente e cleanup

Criados e removidos somente os seis containers f24-6a0b-04307ea2 (db, kong, auth, rest, inbucket, edge_runtime), dois volumes supabase_db_f24-6a0b-04307ea2/supabase_edge_runtime_f24-6a0b-04307ea2 e rede supabase_network_f24-6a0b-04307ea2; processos de runner/browser/servidor/Edge próprios encerrados. Diretório com certificação, configuração, hashes de migrations e artifacts preservado para reprodução; não é backend ativo. Portas reservadas: 55320/21/22/23/24/25/27/29 e 55383. Cleanup verificado; inventários preexistentes idênticos antes/depois; fingerprint de schema/history/RLS/ACL do backend compartilhado idêntico. Compartilhado mantém 54 migrations, sem reset, DDL ou limpeza. Certificação: test-results/f24-6/f24-6a0b-04307ea2/certification.json; análise: test-results/f24-6/f24-6a1-e2-analysis.json.

## Riscos e pendências reais

1. Causa antiga de seed permanece LIMIT_NOT_PROVEN; captura agora disponível, mas não houve reprodução real. Falha controlada não é evidência de quota ambiental.
2. N=5 instrumentado e ambiente local compartilhando o host; latência e heap variam. Agenda vazia e somente UPDATE observacoes único: não generalizar para domínio, mobile ou cenários volumosos.
3. RECONNECT_1K continua NOT_CERTIFIED; 10k não executado. E2 autoriza apenas revisão desta entrega, sem otimização adicional ou integração automática.
