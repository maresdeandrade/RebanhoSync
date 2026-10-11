# F24.6A1-E1 — Post-ACK Refresh restrito

Atualizado em: 2026-10-10

`F24_6A1_E1 = PARTIAL / BLOCKED_WITH_REASON`.

Patch restrito implementado e gates funcionais exercitados; benchmark final
incompleto: 1/5 runs originais e 2/5 otimizados concluídos. Original run 2 falhou
durante seed, antes de executar os gestos, com BROWSER_OPERATION_FAILURE; subtipo
descartado pelo wrapper existente. LIMIT_NOT_PROVEN para a causa. Não substituir
a amostra por retry ou pelos resultados da versão anterior. Gate da entrega:
NOT READY para aprovação final, por ausência das cinco amostras por variante.

## Baseline e diff funcional

Fetch/prune no preflight; branch `codex/f24-6a0-benchmark`; HEAD e origin/main
`3b3bc96db331c2917167cf8370024332f505d9f7`. Worktree
`C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro`; staged vazio.
Documentos/harness anteriores, artifacts e worktrees concorrentes preservados.

Somente dois arquivos funcionais:

- `src/lib/offline/syncWorker.ts`: seletor fechado de uma única operação/resultado,
  usando todas as operações originalmente carregadas do gesto, inclusive deferred
  ou rejected. Só UPDATE animais/observacoes, APPLIED, identidade/farm/metadados e
  expected_revision válidos. Demais operações/resultados/shapes usam o caminho
  integral. Seleção ocorre depois do commit do ACK; sua transação permanece intacta.
- `src/lib/offline/pull.ts`: modos resolvidos por tabela antes de consultar,
  proibição de replace filtrado, cobertura bruta do único ID/farm/revision antes de
  escrever, modos correspondentes na proteção de pending e instalação conjunta.
  Preserva o retorno antecipado da coleta de pending quando não existe replace.

O único pull mantém todas as tabelas derivadas: animais por ID+fazenda e merge;
agenda_itens completa no modo original (replace ativo, merge inativo). Todas as
respostas são obtidas antes de qualquer escrita; a instalação continua em uma
transação Dexie. Tombstone entra no snapshot; resposta vazia/incompleta aborta.
Receipt não é representação de estado e snapshot parcial não conclui obrigação
integral nem cursor completo. Sem mudanças em ops, schema, scheduler, retries,
batching, SQL, Edge, RLS, índices ou política de conflito.

## Testes e limites das provas

148 testes PASS em 14 arquivos focados: postAckSelector (36), postAckPull (12),
reconciliationObligations (29), syncWorkerAtomicAck (3), syncWorkerRecovery (6),
farmSwitchReplace (2), syncWorkerConcurrency (11), syncWorkerGenericRetry (7),
pull (3), commercialPurchasePull (5), commercialPurchaseSyncWorker (10),
movementOffline (10), reproductionSyncWorker (5), sanitarioV2Worker (9).
Os 13 arquivos que carregaram na bateria ampliada totalizaram 138; movementOffline não carregou
na primeira tentativa por ausência de VITE_SUPABASE_URL. Reexecução desse único
arquivo com configuração sintética local sem backend: 10/10 PASS. Não houve
mudança em testes preexistentes, timeout de produto ou configuração real.

Os testes novos exercitam o seletor/allowlist e fallback, modos ativo/inativo,
query ID+farm, pending em duas fazendas/agenda, CAS capturado, tombstone,
ausência/duplicidade/revisão inválida, falha de fetch e falha dentro da segunda
store com rollback real da primeira e da deleção. A última prova usa hook de
erro e fake-indexeddb, não kill físico durante commit de disco. Testes existentes
cobrem ACK atômico, quota, replay, recuperação e gerações concorrentes.

Prova adicional do harness usa dois contextos Chromium independentes com sessões
Auth normais do mesmo usuário sintético, módulos reais, IndexedDB real e
Auth/Edge/PostgREST/PostgreSQL local isolado. Não equivale a dois dispositivos
físicos, mobile ou startup completo da UI. Reabertura usa Auth/ownership sem pull
de aquecimento; recuperação usa o drain explícito existente, sem novo scheduler.

## Harness e reprodução

Harnesse existente modificado: performance-baseline.mjs e
performance-isolated-backend.mjs. Adicionados performance-post-ack-proof.mjs,
performance-post-ack-proof.ts e performance-post-ack-report.mjs. Dois testes
novos em src/lib/offline/__tests__; documentação técnica e snapshots atualizados.

O guard continua exigindo baseline integrado e nenhum diff funcional fora dos
dois arquivos permitidos, nenhum untracked em produto fora dos dois testes e
hashes idênticos ao manifest local congelado. Variante original usa git show dos
dois arquivos do baseline em transformação Vite em memória; variante otimizada
usa o worktree. Não há reset/checkout ou alteração de fontes para o controle.
Mesma transformação diagnóstica, fixture shape, duas fazendas, um gesto/animal,
versões e backend dentro da série. Ordem alternada e sequencial; contexto/fixture
novos por run, backend quente compartilhado entre variantes. Seed/cleanup fora
da duração medida. Não estimar percentis de cauda com cinco amostras.

Parâmetros finais: 100 gestos, cinco runs por variante; limites existentes de
240s/4000 requests/600MiB recebidos/512MiB heap aproximado na instrumentação;
guard externo de processo 300s. Não alterados após resultados. Não houve 1k/10k,
staging, produção, migration remota, commit, push, merge ou deploy.

Artifacts preservados:

- projeto `f24-6a0b-3560a169`: primeira versão, 10/10 runs de 100 íntegros, cleanup
  e compartilhado preservados; `f24-6a1-e1-analysis-v1.json` e manifest-v1. Essa
  versão foi substituída para remover a leitura adicional da fila introduzida no
  caso totalmente merge. Seus números não certificam o patch final.
- projeto `f24-6a0b-5bcefa2a`: patch final; provas pequenas aprovadas; prova de
  fechamento da página falhou em CRASH_INSTALLED_UNOBSERVED_SNAPSHOT antes das
  séries de 100. Causa do harness: reabertura chamava seed(reconnect), fazendo
  pull completo antes da checagem. HARNESS_DEFECT_CONFIRMED; corrigido somente no
  harness para reabertura sem warm-up. Amostra/erro preservados, cleanup e
  compartilhado verificados. Sem retry da operação falha ou falha de ACK inferida.
- projeto `f24-6a0b-4bbcab61`: patch final e harness corrigido. Provas pequenas e
  sete checks com dois clientes PASS, inclusive fechamento real da página durante
  o GET pós-ACK e reabertura sem aquecimento. Três runs de 100 completos; original
  run 2 falhou durante seed. Originais 3–5 e otimizados 3–5 não executados por esse
  gate. O erro não prova falha de ACK, defeito do produto ou causa ambiental.
  Artifact: reconnect-warm-1791686555091.json; cleanup do IndexedDB, fixtures e
  usuário confirmado. Não há diagnóstico de requests do workload nessa amostra,
  pois a captura só se inicia depois do seed.

## Evidência final quantitativa e funcional

Fonte: test-results/f24-6/f24-6a0b-4bbcab61/certification.json e
f24-6a1-e1-analysis.json, com parâmetros, hashes e artifacts individuais.
PostgreSQL 17.6; Chromium 153.0.8010.12; Dexie 4.3.0; Vite 6.4.2;
Playwright 1.63.0. Sessões reais Auth; 60 migrations executadas sem história fictícia.

| Variante/run (100 gestos) | Duração s | Recebido bytes | Animais recebidos | Requests | Heap final bytes | Erros |
|---|---:|---:|---:|---:|---:|---:|
| Original 1 | 17.2555 | 4549773 | 5200 | 306 | 16531204 | 0 |
| Otimizado 1 | 14.7146 | 287642 | 300 | 306 | 22327508 | 0 |
| Otimizado 2 | 14.4878 | 287627 | 300 | 306 | 36087168 | 0 |
| Original 2 | não medido; seed falhou | não medido | não medido | não medido | não medido | BROWSER_OPERATION_FAILURE |

Nas três amostras completas: 100 receipts APPLIED, 100 commits de ACK, 100 pulls
inline + 4 finais, 206 respostas de pull, 65000 bytes enviados, zero retries,
replay/timeouts/erros, expected=actual, isolamento verificado, backlog e obrigações
finais zero e cleanup completo. Cada inline otimizado traz um animal; drains/pull
final explicam os outros 200 registros recebidos. Agenda integral continua sendo
consultada (vazia nessas fixtures). Redução de bytes/linhas observada neste envelope;
requests e número de pulls não foram reduzidos.

| Métrica, mediana descritiva | Original n=1 | Otimizado n=2 |
|---|---:|---:|
| Total/convergência s | 17.2555 | 14.6012 |
| Min–max total s | amostra única | 14.4878–14.7146 |
| MAD total s | não estimável | 0.1134 |
| ACK upper bound s, inclui inline | 17.0245 | 14.3768 |
| Commit ACK acumulado s | 0.3633 | 0.3120 |
| Pull acumulado s | 4.0310 | 2.9714 |
| Instalação IndexedDB acumulada s | 0.5741 | 0.3106 |
| Reconciliação final s | 0.1779 | 0.1469 |
| CPU TaskDuration cliente s | 2.0105 | 1.5632 |
| Heap final MiB | 15.77 | 27.85 (21.29–34.42) |
| Bytes recebidos | 4549773 | 287634.5 (287627–287642) |
| Observador Node ms | 97.8096 | 26.7574 |
| Observador browser ms | 159.6000 | 134.0000 |

Não concluir ganho geral de latência, estabilidade ou memória com essas amostras.
Não misturar a série v1 completa com o patch final nem comparar com o prefixo de
836 gestos. Faltam seis runs não executados e uma amostra original falha; não há
cinco runs completos por variante. Percentis permanecem não estimados.

| Gate funcional | Evidência observada / conclusão limitada |
|---|---|
| ACK_DURABILITY | Transação original preservada; testes de rollback/quota; DONE e obrigação antes do GET real; PRESERVED |
| NO_PARTIAL_REPLACE / ATOMIC_INSTALL | Modos pré-validados; testes de query/agenda, fetch failure e hook abortando instalação conjunta; VERIFIED |
| PENDING_PROTECTION | Target/agenda/outra farm em Dexie e dois gestos reais do mesmo animal; VERIFIED |
| CAS_CONFLICT_POLICY | Próxima intenção observa revision atual; duas já offline mantêm versão capturada e segunda recebe CONFLICT; PRESERVED |
| CROSS_FARM_ISOLATION | RLS local certificado, filtro farm+ID, provas ativa/inativa e A→B→A; VERIFIED |
| RECONCILIATION_RECOVERY | Obrigação integral sobrevive partial/reabertura/GET interrompido; drain explícito converge alvo e outro ID; VERIFIED |
| OLD_CLIENT_COMPATIBILITY | Envelope/schema/retry não mudam; shape legado/desconhecido usa fallback; validação server-side mantida; PRESERVED |
| BENCHMARK_5_RUNS_PER_VARIANT | NOT_PROVEN; interrompido durante seed de original 2 |

Todos os três ambientes criados nesta execução foram removidos: em cada um,
seis containers, dois volumes e uma rede próprios. Portas 55320/21/22/23/24/25/
27/29/83 exclusivas. Inventários preexistentes e fingerprint do schema/history
compartilhado iguais antes/depois em cada certificação. Shared permaneceu com 54
migrations; nenhum reset/migration/cleanup contra esse backend. Artifacts antigos
reconnect-warm-1791597655102.json e f24-6a1-analysis.json preservados por SHA256.

Pendência de entrega: capturar subtipo/etapa sanitizados do erro de seed e
diagnosticar a preparação; então completar uma comparação final controlada,
preservando esta falha. Não ampliar volume, retries, duração ou patch funcional
para contornar a falta de evidência. 1k/10k seguem não executados nesta etapa.

## Verificação da entrega

Lint dos dois módulos, dois testes novos e helper browser: PASS. Node --check dos
quatro MJS do escopo: PASS. Seis testes de contrato/instrumentação do harness:
PASS. Gates documentais: PASS pelo comando nativo exato de gates:docs,
`node scripts/antigravity/run_bash.mjs scripts/antigravity/docs_gates.sh`.
`pnpm run gates:docs` foi bloqueado por ERR_PNPM_UNSAFE_MODULES_DIR, pois o
node_modules do worktree resolve para o checkout compartilhado. Nenhuma instalação,
remoção de dependências ou alteração de junction/lockfile foi feita para contornar.
git diff --check: PASS; staged vazio; diff de supabase/package/lockfiles vazio.

Cache CLI gerado durante os starts foi restaurado byte a byte ao valor anterior
v2.115.0 após o último CLI. Hashes dos dois módulos/dois testes conferidos contra
o manifest usado na série final. Diff funcional preservado em
test-results/f24-6/f24-6a1-e1-functional.patch; hashes da entrega no manifest E1.
Sem regressão global/build/E2E por rotina, load remoto ou operações externas.

Verification gate = NOT READY para aprovação final da entrega E1, exclusivamente
pela comparação quantitativa incompleta e causa do seed não comprovada. A
documentação explicita os gates funcionais aprovados e o que ainda não é evidência.

Comando reproduzível, após congelar o manifest de hashes dos dois módulos e dois
testes em test-results/f24-6/f24-6a1-e1-patch-manifest.json:

```powershell
$e1Files = @('src/lib/offline/pull.ts','src/lib/offline/syncWorker.ts','src/lib/offline/__tests__/postAckPull.test.ts','src/lib/offline/__tests__/postAckSelector.test.ts')
$e1Hashes = [ordered]@{}
foreach ($e1File in $e1Files) { $e1Hashes[$e1File] = (Get-FileHash -LiteralPath $e1File -Algorithm SHA256).Hash.ToLower() }
$e1Manifest = @{ baseline='3b3bc96db331c2917167cf8370024332f505d9f7'; files=$e1Hashes }
[IO.File]::WriteAllText((Join-Path (Get-Location) 'test-results/f24-6/f24-6a1-e1-patch-manifest.json'), ($e1Manifest | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
$env:REBANHOSYNC_SUPABASE_CLI='C:/apps/supabase/current/supabase.exe'
node scripts/codex/performance-isolated-backend.mjs --post-ack-comparison
node scripts/codex/performance-post-ack-report.mjs test-results/f24-6/<project>/certification.json
```

Provisionador mantém 60 migrations reais, volumes/portas/projeto próprios;
comparações de schema/history e inventários antes/depois do compartilhado. Remove
somente seus recursos e fixtures. Credenciais/JWTs ficam em memória, não nos
artifacts. Hashes dos scripts/config/migrations e versões nos manifests/receipts.
Artifacts ignorados precisam acompanhar esta documentação ao transportar a prova.

## Riscos residuais

1. Envelope restrito a observacoes. Shapes futuros/desconhecidos mantêm fallback;
   agenda, outros writers e drains integrais ainda têm seu custo. Dados de agenda
   das fixtures quantitativas são vazios; comportamento replace/pending é testado
   separadamente. Não há capacidade geral ou SLO estabelecido.
2. Medição instrumentada; CPU TaskDuration e heap antes/depois são do Chromium,
   não CPU exclusiva Edge/PG, pico de memória total ou latência física de ACK.
   Timings por etapa se sobrepõem; não subtrair custos observacionais do wall time.
   removed_rows do observador em snapshots parciais indica troca de subconjunto,
   não deleção; não é usado como prova de tombstone/convergência.
3. Frescor de outros IDs depende do drain integral; farm inativa do atendimento
   existente. RECONNECT_1K continua NOT_CERTIFIED e a causa do ACK original segue
   LIMIT_NOT_PROVEN. Nenhuma dessas lacunas foi convertida em PASS pela E1.
