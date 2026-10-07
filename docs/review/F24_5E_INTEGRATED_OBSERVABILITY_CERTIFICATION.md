# F24.5E — Integrated Observability Certification

Atualizado em: 2026-10-07
Modo principal: VERIFICATION. Status atual: `F24_5E = PARTIAL`;
`F24_5E1 = READY_FOR_REVIEW`. E1 corrigido no escopo real recertificado abaixo.

O registro original abaixo preserva a certificação BEFORE. A subetapa corretiva
F24.5E1 está registrada separadamente no fim deste documento; seu resultado
posterior não altera retroativamente as execuções nem os limites G09 originais.

## Decisão

FATO CONFIRMADO: persistência de pending, ERROR, obligation e diagnostics passou
por kill real da árvore de processos Chromium e reabertura do mesmo perfil.
O checkpoint confirmado de telemetria não sobreviveu ao kill imediato: três IDs
já confirmados foram reenviados. Falha reproduzida em três execuções.
Não recomendar READY_FOR_REVIEW nem fechamento da F24.5.

G09 permanece PARTIAL: contrato implantado inspecionado, delivery/replay remoto
e isolamento com usuários distintos NOT_PROVEN. Retenção não configurada nos
mecanismos de banco/Edge inspecionados; automações externas NOT_PROVEN.
G10 é PARTIAL, com `REAL_RESTART_TELEMETRY_CHECKPOINT = GAP_CONFIRMED`.

## Baseline real

| Campo | Evidência observada |
| --- | --- |
| Rebaseline | fetch --prune, checkout main, pull --ff-only executados |
| MAIN_SHA_REAL / HEAD / origin/main | `b02b03d4de40d27f424a3f586efe329a06135b2f` |
| Branch própria | `codex/f24-5e-integrated-observability-certification` |
| Worktree | `C:/Users/mares/dyad-apps/GestaoAgro` |
| Estado inicial | Tracked, staged e untracked limpos |
| Merge F24.5D | PR #186, `b02b03d`, inclui `743693b037f5eae054902790c9cc7136fbd61fa1` |
| Intervalo pré-D → main real | Apenas commit D e merge #186; nenhum commit concorrente adicional |

Worktrees preservados: animal-detail-v2-a (`f3d0e3f`), b2e5 detached (`0179784`),
c464 detached (`79d2a8f`), visual-v2-animals-pilot (`f3d0e3f`, branch
codex/f24-5d-sync-reconcile-health), .kilo/worktrees/healthy-syrup (`e731b3c`).
Nenhum removido ou alterado. Main estava disponível.

Lidos A/B/C/D atuais: F24_5A_OBSERVABILITY_BASELINE,
F24_5B_STRUCTURED_DIAGNOSTICS, F24_5C_FAILURE_RETRY_TELEMETRY e
F24_5D_SYNC_RECONCILE_HEALTH_VIEWS. Conclusões anteriores serviram para localizar
fontes; testes selecionados foram executados novamente no baseline integrado.
PROJECT_STATUS ainda descreve B como próxima etapa; Git confirma integração B/C/D.
O status global não foi alterado nesta certificação.

## Environment

| Superfície | Ambiente / limite |
| --- | --- |
| Local | Windows, Node 22.15.0, pnpm 11.23.0, Corepack 0.32.0 |
| Browser | Playwright 1.63.0, Chromium 153.0.8010.12 headless, perfil temporário persistente |
| Frontend | Vite development em http://127.0.0.1:4173 |
| Backend dos testes locais | Auth e pull simulados; fetch interceptado em endpoint localhost; requests para outras origens abortados |
| Remoto inspecionado | Staging `zqloazqzhwauamcejmuz`, conforme SUPABASE_RLS; inventário MCP confirma projeto RebanhoSync ativo |
| Endpoint publicado | https://zqloazqzhwauamcejmuz.supabase.co/functions/v1/telemetry-ingest |
| Runtime remoto | Edge v2 ACTIVE, verify_jwt=true; Postgres 17.11.0.002; import Supabase JS 2.45.0 no deno.json publicado |

Não houve escrita remota, leitura de registros de usuários, autenticação real,
deploy, migration, reset, bypass, merge, commit, push ou PR.
Não foram fornecidas duas sessões de fixtures tenant-scoped para delivery real.
Nenhum token real foi procurado, impresso ou incorporado ao harness.

## Matriz planejada de certificação

Matriz de execução: I1 rede → diagnóstico → recovery → health; I2 limite de
retry → ERROR → restart; I3 ACK → obrigação → falha drain → restart → conclusão;
I4 fazendas separadas; I5 rejeição de snapshot stale e testes UI existentes;
I6 auth existente somente no que os testes simulados demonstram.
G09 usa inventário remoto read-only. G10 usa perfil persistente e kill forçado,
com comparação antes/depois e flush após reabertura.

O harness não carrega o aplicativo autenticado nem inicia scheduler contínuo:
importa módulos de produto num documento vazio servido no mesmo origin. Usa
createGesture, processGesture, drainReconciliationObligations, diagnostics,
trackPilotMetric, flushPilotMetrics, loadFarmSyncSummary e getFarmSyncHealth reais.
Auth/pull são substituídos apenas no browser de teste, sem patch de produto.
O pull simulado certifica lifecycle da obligation, não instalação de dados remotos.

## G09 — deployed contract / delivery / retention

FATO CONFIRMADO por list_edge_functions e get_edge_function:

- telemetry-ingest v2, SHA-256 do bundle
  `003e31e62f80dd2953327a1e5a0af9d78907320d55402800b7b0bf4b89f37bc8`.
- JWT obrigatório; getUser valida usuário; escrita usa JWT do usuário, sem service-role.
- Batch máximo 100; destino public.metrics_events; upsert onConflict=id,
  ignoreDuplicates=true; receipt success=true/inserted; erro de insert HTTP 500.
- Fonte publicada corresponde ao contrato de receipt esperado pelo cliente C.
  Isso não prova execução do endpoint, persistência real nem replay remoto.

FATO CONFIRMADO por consultas aos catálogos (sem dados de usuários):

- metrics_events com RLS=true, force_rls=false; PK id; FK fazenda_id → fazendas
  ON DELETE CASCADE; status limitado a info/success/error.
- metrics_select_member SELECT USING has_membership(fazenda_id);
  metrics_insert_member INSERT WITH CHECK has_membership(fazenda_id).
- authenticated tem INSERT e SELECT; has_membership exige user_fazendas.user_id
  = auth.uid(), farm correspondente e deleted_at IS NULL.
- pg_cron/pg_partman ausentes; nenhum trigger customizado em metrics_events;
  nenhuma função em public/private contendo metrics_events e DELETE/TRUNCATE
  encontrada pela busca catalogada. Código ativo/Edge não configura TTL.
  Cascade ao excluir fazenda não é política temporal de retenção.

Consultas reproduzíveis: pg_policies filtrado em public.metrics_events;
pg_class.relrowsecurity; information_schema.role_table_grants;
pg_get_functiondef(has_membership); pg_get_constraintdef;
pg_extension (pg_cron/pg_partman); pg_trigger; pg_proc/prosrc.
A busca de funções é limitada a referências literais e schemas public/private;
jobs externos e SQL dinâmico não são excluídos por essa evidência.

| Critério | Resultado | Limite |
| --- | --- | --- |
| REMOTE_TELEMETRY_DELIVERY | NOT_PROVEN | Endpoint não invocado com fixture autenticada; persistência remota não lida |
| REMOTE_TELEMETRY_REPLAY | NOT_PROVEN | Upsert implantado inspecionado; replay/lost ACK real não executado |
| REMOTE_TENANT_ISOLATION | PARTIAL | RLS/grants/membership implantados confirmados; usuários de tenants distintos não exercitados |
| REMOTE_RETENTION | GAP_CONFIRMED | Ausência de política nos mecanismos inspecionados; automação externa NOT_PROVEN |
| G09_RETENTION | GAP_CONFIRMED | Não inventar TTL; não implementar retenção nesta certificação |
| G09 agregado | PARTIAL | Delivery/replay dependem de ambiente e fixtures disponíveis: ENVIRONMENT_LIMITATION |

Falha de ingest preserva checkpoint anterior e elegibilidade nos testes existentes
de pilotMetrics; browser real preserva o registro sem ACK. Nenhuma falha do
endpoint real foi induzida. Não confundir esse resultado local com G09 remoto.

## G10 — real process restart

Passos reproduzíveis:

1. `pnpm exec playwright test e2e/f24-5e-observability-restart.spec.ts --project chromium --workers 1`.
2. Helper filho lança Chromium com launchPersistentContext em mkdtemp isolado.
3. Cria três gestures via createGesture para farms pending/error/reconcile.
   Fixture de insumo_movimentacoes exercita refresh factual existente; sem escrita remota.
4. Interrompe fetch de push para pending; para ERROR arranja retry_count=3
   antes da falha real do request interceptado. Não muda política/MAX_RETRIES.
5. Resposta APPLIED simulada cria ACK/obligation; pull/drain falha; telemetry flush
   confirma três métricas, grava checkpoint; uma quarta métrica recebe falha de delivery.
6. Captura estado e executa taskkill /PID <helper isolado> /T /F; aguarda exit.
   Não chama close, não exporta/importa storageState, não usa reload como restart.
7. Novo helper/Chromium reabre exatamente o mesmo perfil. Lê estado antes de recovery,
   executa flush e recovery controlado pelo processGesture/drain reais.
8. Guarda JSON em outputPath do Playwright e como attachment; remove só o perfil
   criado pela fixture, após verificar seu parent=tmpdir.

Última execução: helper seed PID 59228; helper reopen PID 64828. Saída taskkill
confirma encerramento do browser PID 45444 e descendentes, além do helper.
Restaurados três gestures, duas operações e uma obligation. Snapshot de gestures,
ops, obligations, metrics e projeção health igual ao anterior; cursors diferem.
Health antes/reabertura: pending,error,reconcile,healthy. Após recovery:
healthy,error,healthy,healthy. Obligation removida pelo drain real; completion
diagnóstico persistido; sync_success da farm recuperada registrado.

| Critério | Resultado | Evidência / escopo |
| --- | --- | --- |
| REAL_RESTART_PENDING | PROVEN | Pending e operações/identidades sobrevivem kill/reopen; recovery controlado conclui |
| REAL_RESTART_ERROR | PROVEN | ERROR, RETRY_EXHAUSTED/NETWORK_FAILURE sobrevivem; health error antes e após recovery de outra farm |
| REAL_RESTART_RECONCILIATION | PROVEN | Geração/origens/erro sobrevivem; health reconcile; drain real com pull simulado conclui |
| REAL_RESTART_DIAGNOSTICS | PROVEN | Snapshot diagnóstico igual após kill; erro/marcos/origens preservados |
| REAL_RESTART_TELEMETRY_CHECKPOINT | GAP_CONFIRMED | Três checkpoints confirmados passam a null; três IDs confirmados reenviados |
| Registro sem delivery confirmado | PROVEN | Métrica no IndexedDB permanece e é enviada após reopen |
| G10 agregado | PARTIAL | Critério de checkpoint falhou; storage eviction/mobile/power loss fora da evidência |

PROVEN é limitado ao perfil preservado, browser/OS testados e snapshot antes de
scheduler/startup automático. Auth é simulada. Não generaliza para login real,
expiração remota, mobile, corrupção/eviction de storage ou falta de energia.

## Finding E1 — checkpoint após crash

Classificação: FUNCTIONAL_BUG / OBSERVABILITY_GAP; impacto MEDIUM na telemetria,
bloqueante para o critério de aceite G10 e closeout desta fase.
Alvo: src/lib/telemetry/pilotMetrics.ts, readTelemetryFlushCursor,
writeTelemetryFlushCursor e flushTelemetryForFarm.

FATO: após receipt aceito e setItem visível, kill imediato da árvore Chromium
perdeu as três chaves localStorage nas três execuções da fixture correta.
Os respectivos registros IndexedDB sobreviveram. loadTelemetryBatch sem cursor
selecionou os três IDs já confirmados, mais um realmente não confirmado.

INFERÊNCIA: setItem torna o checkpoint visível à página sem garantir flush em
disco antes de encerramento forçado. O harness demonstra perda, não mede o
intervalo interno de flush nem prova perda em todo browser/restart.
Impacto: reenvio redundante; crash repetido pode repetir delivery. Duplicação
factual remota não foi observada nem presumida; ingest publicado usa upsert por ID.
Nenhum fato de domínio, retry funcional ou obrigação foi perdido nesse caso.

RECOMENDAÇÃO: definir checkpoint com persistência durável e compatibilidade
com cursores legados, usando uma única autoridade de ACK. Não usar sleep como
correção, não adulterar a assertion nem reutilizar cursor de pull de domínio.
Não executar mudança de storage/schema por conveniência nesta certificação.
Patch runtime NONE: mecanismo de durabilidade demanda decisão específica de
persistência/compatibilidade; sem refatoração transversal automática.

## Integrated matrix B+C+D

| Cenário / critério | Resultado | Evidência observada |
| --- | --- | --- |
| I1 / INTEGRATED_FAILURE_TO_HEALTH | PARTIAL | Worker real produz NETWORK_FAILURE + sync_error, health pending; após kill e resposta APPLIED/pull simulados health saudável |
| I2 retry exhaustion | PROVEN no limite local testado | Request interceptado falha em retry_count=3; ERROR/RETRY_EXHAUSTED e health error persistem; algoritmo completo de retry coberto também pela suíte existente |
| I3 / INTEGRATED_RECONCILE_TO_HEALTH | PARTIAL | ACK real cria obligation; drain falha/diagnostica; kill preserva; drain posterior conclui e health converge; backend/pull simulados |
| I4 / MULTI_FARM_OBSERVABILITY | PROVEN local | Quatro farms têm pending/error/reconcile/healthy independentes; diagnostics, origins e métricas atribuídos ao gesto; recovery de uma não limpa ERROR da outra |
| I5 / FARM_SWITCH_OBSERVABILITY | PARTIAL | selectFarmSyncSummary rejeita snapshot de outra farm; SyncHealthViews/Home existentes passam no baseline; selector autenticado real A→B→A com backend não executado |
| I6 auth/session | PARTIAL | Oito testes syncWorkerAuth passaram; expiração real/ownership/browser restart autenticado não certificados |

Observabilidade não controla o sistema: nos caminhos revisados B/C/D, worker
usa status/op/retry/ownership e gera diagnostics após decisões funcionais;
getFarmSyncHealth lê gestures/rejections/obligations; métricas não alimentam health.
Reconciliation generation_id continua guard funcional preexistente, não metadado
diagnóstico. recordDrainCompletion escreve apenas diagnóstico; deletion usa generation.
Inspeção dirigida de genericRetry, syncReconciliation, ownership, localReadBoundary,
syncWorker, movementReconciliation, reconciliationObligations, syncDiagnostics,
syncQueries/syncPresentation e pilotMetrics. Não houve auditoria global de todo domínio.
Testes ACK rollback/fallback enriquecido/generation race passaram; diagnostics
continuam best-effort, sem garantia de trilha completa de toda tentativa.

## G06

G06 = PARTIAL / NOT_PROVEN para sessão expirada real, UNKNOWN/MISMATCH em browser
reiniciado e contexto de health atual correlacionado ao bloqueio auth.
Não inferir owner, não adotar fila, não alterar fail-closed. A fixture estabelece
owner sintético em banco novo e preserva esse owner entre processos.

## Patches e validações

Arquivos novos: este relatório; e2e/f24-5e-observability-restart.spec.ts;
e2e/support/f24-5e-restart.mjs. Nenhum runtime/schema/dependência/RLS alterado.
Harness mínimo reutiliza Playwright/Vite existentes. Assertions soft mantêm
falha de checkpoint visível e permitem observar os critérios restantes.

| Comando / cenário | Resultado observado |
| --- | --- |
| pnpm exec vitest run com os 13 arquivos abaixo | 107/107 testes passaram; exit 0 |
| Playwright acima, primeira execução | Timeout do helper no primeiro start; TEST_HARNESS_GAP, sem conclusão de produto |
| Playwright, segunda execução | Fixture lote não exigia obligation; TEST_HARNESS_GAP corrigido com fixture que exige refresh factual |
| Playwright, três execuções seguintes | Falha reproduzida em checkpoint; final exit 1, duas assertions soft falham; demais assertions de restart/recovery executadas |
| pnpm exec eslint nos dois arquivos novos de harness | Exit 0 após corrigir any/pattern vazio da primeira tentativa |
| node --check e2e/support/f24-5e-restart.mjs | Exit 0 |
| pnpm run gates:docs | Exit 0; headers, continuidade e contrato documental aprovados |
| git diff --check | Sem mensagens de whitespace; tracked sem delta |
| git diff --no-index --check -- NUL, para cada arquivo novo | Sem mensagens de whitespace; no-index retorna 1 pela diferença de arquivo novo |
| status/diff tracked/staged/untracked e leitura dos novos arquivos | Somente os três arquivos declarados; tracked/staged vazios; nenhum arquivo desconhecido |

Arquivos Vitest selecionados (caminhos relativos à raiz):

- src/lib/telemetry/__tests__/pilotMetrics.test.ts
- src/lib/offline/__tests__/syncWorkerGenericRetry.test.ts
- src/lib/offline/__tests__/reconciliationObligations.test.ts
- src/lib/offline/__tests__/syncWorkerAtomicAck.test.ts
- src/lib/offline/__tests__/syncWorkerAuth.test.ts
- src/lib/offline/__tests__/syncWorkerTimeout.test.ts
- src/lib/offline/__tests__/syncWorkerHttp500.test.ts
- src/lib/offline/__tests__/syncWorkerHttp403.test.ts
- src/lib/offline/__tests__/syncWorkerHttp429.characterization.test.ts
- src/lib/offline/__tests__/syncQueries.test.ts
- src/lib/offline/__tests__/syncPresentation.test.ts
- src/components/offline/__tests__/SyncHealthViews.test.tsx
- src/pages/__tests__/Home.test.tsx

Artifact local reproduzível:
test-results/f24-5e-observability-resta-37007--observability-and-recovery-chromium/process-restart-evidence.json.
Arquivo ignorado pelo Git; snapshot contém somente fixtures sintéticas, sem JWT/header.
Saída do Playwright e attachment preservam a falha; rerun substitui test-results.
Warnings: NO_COLOR/FORCE_COLOR, Browserslist antigo, flags futuras React Router
e logs de falhas simuladas. Nenhuma atualização de dependência para esses avisos.

Não executados: build, lint global, suíte global/closeout, backend E2E autenticado,
Capacitor/dispositivo, probes de delivery/replay remoto. Não há proposta de fechar
F24.5; executar bateria global não resolveria o critério já reprovado.

## Refatoration gate / riscos / veredito

REFACTORATION_GATE = NOT_REQUIRED. SyncWorker não refatorado.
E1 exige decidir persistência do checkpoint, não refatorar transversalmente o worker.
Limites classificados: ENVIRONMENT_LIMITATION em G09 autenticado/G06; gap de
retenção nos mecanismos inspecionados; TEST_HARNESS_GAP inicial corrigido.

1. Checkpoint perdido/reenvio confirmado após kill bloqueia G10 e closeout.
2. Delivery/replay/isolamento remoto exercitado e retenção externa não comprovados.
3. Auth/pull simulados e recovery controlado não certificam app autenticado,
   startup automático, mobile ou instalação de snapshots reais.

VEREDITO: `F24_5E = BLOCKED`. G09/G10 agregados PARTIAL; não READY_FOR_REVIEW,
não CLOSED. Nenhuma publicação ou integração autorizada nesta execução.

Verification gate: NOT READY. Escopo documental/harness preservado e lint/gates
passaram, mas a validação relevante de checkpoint está falhando. A falha é
evidência de certificação, não resultado convertido em aprovação do patch/fase.

## F24.5E1 — Durable Telemetry Checkpoint

Atualizado em: 2026-10-07. IMPLEMENTATION exclusivamente do blocker E1.
Baseline após fetch: branch codex/f24-5e-integrated-observability-certification,
HEAD/origin/main b02b03d4de40d27f424a3f586efe329a06135b2f. Os três arquivos
untracked originais da certificação foram preservados e atualizados no escopo
autorizado. Nenhum trabalho de outro worktree foi transportado.

### E1 BEFORE / FIX / storage decision

BEFORE: checkpoint localStorage visível, perdido após kill; três IDs confirmados
reenviados, em três execuções. Buffer IndexedDB permaneceu íntegro.

FIX: nova store local telemetry_flush_cursors, chave primária fazenda_id,
campos fazenda_id/created_at/ids_at_cursor/updated_at. Somente metadados de ACK;
nenhum JWT/header/body/erro bruto/payload. Dexie v32 → v33 exclusivamente aditiva,
sem backfill. Nenhuma outra store reutilizada; sync_pull_cursors permanece separado.

Dexie é a única autoridade atual. Leitura/escrita exigem requireTenantSensitiveAccess;
nova store classificada tenant-sensitive. Flush valida receipt e depois aguarda
commit de transação rw antes de considerar batch confirmado localmente. Falha
de gravação propaga erro, preserva cursor anterior e eventos, permitindo replay
at-least-once com IDs estáveis. Endpoint não alterado; exactly-once não implementado.
Timestamp igual acumula IDs; transação mescla concorrência entre cursores da mesma
farm e impede regressão para timestamp anterior. Nenhum controle funcional de sync
passa a depender de telemetry.

### Migration compatibility / legacy cursor compatibility

Importação lazy e autenticada: durable existe → ignora legado. Caso contrário,
legacy criado em formato ISO válido + array de IDs string não vazios é persistido
em Dexie; somente após commit o legado é removido. Ausente/ilegível/malformado não
gera checkpoint. Falha de import preserva legado e deixa checkpoint não confirmado.
Uma corrida de import/flush reconsulta durable dentro da transação e mantém seu
valor. Falha de remoção de localStorage não substitui autoridade durable.
Não há dual-write. Cursores históricos sem ACK indevidamente avançados por versões
anteriores à C não são reconstruídos nem recertificados por esta correção.

Teste explícito cria banco v32 com schema completo, pending, ERROR, operação,
rejection, obligation/generation/origens/erro, diagnostics, metric, owner e pull
cursor; abre OfflineDB v33 e compara registros integralmente. Dois casos: owner
conhecido e owner=null. Nova store vazia e legado intocado pelo upgrade: nenhum
ACK fabricado, retry alterado ou owner adotado. Migração lazy é exercitada à parte.

Dexie 4.3 instalado reabriu o schema aditivo com a declaração antiga v32 e
preservou os registros funcionais e o checkpoint v33 em teste fake IndexedDB.
O código da biblioteca faz fallback de VersionError para abertura sem versão
explícita. Não foi encontrado contrato específico de downgrade no caminho
ativo consultado; não foi criado mecanismo de downgrade nem certificado rolling
upgrade de abas antigas em browser real. Cliente antigo ainda pode fazer reenvio
redundante via seu mecanismo legado; a autoridade do novo cliente permanece Dexie.

resetOfflineFarmData inclui a store nova, acompanhando a remoção de metrics da
mesma farm; teste comprova que reset de A preserva B. Reset UNKNOWN já deleta o
banco inteiro; não foi modificado.

### Unit validation / harness

`pnpm exec vitest run` com pilotMetrics, telemetryFlushCursors.upgrade,
ownership, pendingWork.upgrade.characterization e reconciliationObligations.upgrade:
5 arquivos / 42 testes passaram (exit 0).
Cobertura: receipt válido, sete classes de falha de delivery, persistência falha
com/sem cursor anterior, replay inserted=0, 101 IDs mesmo timestamp e ID posterior
na mesma data, isolamento/reset por farm, import único, durable vence legado,
import falha, legado ausente/malformado, UNKNOWN/MISMATCH, merge concorrente,
upgrade preservando registros e reabertura com declaração antiga.

Primeiro run: 40/41 passaram; assertion nova esperava IDs de timestamps anteriores
no cursor atual. Corrigida para exigir somente IDs no último timestamp; 42/42 no
patch posterior. A implementação não foi alterada para satisfazer essa assertion.

Fallow inicial reprovou complexidade de validação legada e helper de browser não
alcançável estaticamente. Validação de timestamp/IDs foi separada em predicados
pequenos; spec importa o caminho real do helper, cuja execução é protegida para
ocorrer somente no processo filho. Fixture modules separados do route handler.
Nenhum suppress/config/threshold/baseline alterado; nenhum segundo harness criado.
Fallow posterior: exit 0, verdict pass, contra origin/main@b02b03d.

O mesmo harness de E agora captura cursors da store Dexie. Mantém kill /T /F,
perfil persistente, três métricas confirmadas + uma sem ACK, assertions funcionais
e de checkpoint, sem sleep/close normal/storageState ou mudança de auth/pull.

### Kill/restart evidence / resultado

Comando: `pnpm exec playwright test e2e/f24-5e-observability-restart.spec.ts --project chromium --workers 1 --repeat-each 3`.
Resultado observado: **3/3 passaram**, exit 0, 32.1 segundos no conjunto.
Chromium 153.0.8010.12. Cada repetição cria perfil independente e mata helper +
browser/descendentes antes de reabrir o mesmo perfil, sem sleep nem close normal.

| Repetição | Helper seed → reopen | Cursores confirmados preservados | IDs confirmados reenviados | ID sem ACK enviado |
| --- | --- | --- | --- | --- |
| Run 1 | 55536 → 63136 | 3 | 0 | 1 |
| Run 2 | 35204 → 65260 | 3 | 0 | 1 |
| Run 3 | 30176 → 29360 | 3 | 0 | 1 |

Artifacts process-restart-evidence.json em test-results nos diretórios chromium,
chromium-repeat1 e chromium-repeat2 do teste F24.5E. Cada artifact inclui snapshots
antes/depois, deliveries/replay e saída taskkill confirmando processos terminados.
Somente fixtures sintéticas; arquivos ignorados pelo Git, substituídos por rerun.
test-results/.last-run.json: status passed, failedTests vazio.

Em todas as repetições: health antes/reabertura pending,error,reconcile,healthy;
após recovery healthy,error,healthy,healthy. Mesmo estado IndexedDB e diagnostics
antes/reabertura; cursor durable igual; registro sem ACK recuperável. Obligation
concluída pelo drain real com pull simulado; ERROR da outra farm permanece visível.

| G10 criterion | Estado após E1 | Escopo |
| --- | --- | --- |
| REAL_RESTART_PENDING | PROVEN | Dados e identidade preservados; recovery controlado |
| REAL_RESTART_ERROR | PROVEN | ERROR/exhaustion/health continuam observáveis |
| REAL_RESTART_RECONCILIATION | PROVEN | Obligation/generation/origens preservadas; drain posterior conclui |
| REAL_RESTART_DIAGNOSTICS | PROVEN | Snapshot igual através de kill/reopen |
| REAL_RESTART_TELEMETRY_CHECKPOINT | PROVEN | Três execuções reais; 0 confirmados reenviados, 1 não confirmado elegível |

G10 recertificado nesses critérios, no browser/OS/perfil preservado testados.
Auth/pull continuam simulados e scheduler controlado. Não certifica eviction,
power loss, mobile, startup autenticado automático ou delivery remoto real.

### Patch / validação final / contratos

Arquivos tracked alterados: src/lib/offline/types.ts, db.ts, localReadBoundary.ts,
reset.ts, __tests__/ownership.test.ts; src/lib/telemetry/pilotMetrics.ts e
__tests__/pilotMetrics.test.ts. Novos: src/lib/telemetry/telemetryFlushCursor.ts,
src/lib/offline/__tests__/telemetryFlushCursors.upgrade.test.ts. Três arquivos
untracked da E atualizados: este relatório e os dois arquivos do harness original.
Total: 12 arquivos, staged vazio, sem alterações preexistentes fora da E.

| Validação | Resultado observado |
| --- | --- |
| Vitest 5 arquivos focados listados acima | 42/42 passaram, exit 0 |
| ESLint 11 arquivos TS/MJS tocados | Exit 0 |
| node --check helper | Exit 0 |
| Fallow audit --gate new-only (final JSON em TEMP/f24-5e1-fallow-final.json) | Exit 0; verdict pass; base origin/main@b02b03d; achados herdados não convertidos em novos |
| pnpm run gates:docs | Exit 0; headers, continuidade e contratos passaram |
| git diff --check | Exit 0; sem erros de whitespace |
| Playwright --repeat-each 3 | 3/3 passaram, exit 0 |

Inspeção do diff tracked/staged e conteúdo dos cinco untracked realizada.
Verification gate: READY no escopo corretivo E1. Nenhum blocker remanescente
conhecido no checkpoint recertificado. Sem refatoração de worker/retry/reconcile/
health, sem dependência nova, sem mudança de endpoint ou banco remoto.

PRESERVED: buffer append-only, stable metric IDs, receipt validation, retries de
delivery existentes, at-least-once/lost ACK, timestamp ties, farm isolation,
ownership fail-closed, queue/ACK/replay/reconciliation de domínio, RLS/remoto.
CHANGED: autoridade/persistência do checkpoint (localStorage → store Dexie v33),
importação legada lazy e cleanup farm-scoped da store nova.

Não executados: build/suíte global/CI remoto; validação proporcional ao patch
local aditivo. Avisos de Browserslist/NO_COLOR e Fallow node_modules em snapshots
temporários permanecem sem alteração de configuração ou dependências.

### G09 / riscos residuais / veredito

G09 permanece:
REMOTE_TELEMETRY_DELIVERY=NOT_PROVEN; REMOTE_TELEMETRY_REPLAY=NOT_PROVEN;
REMOTE_TENANT_ISOLATION=PARTIAL; REMOTE_RETENTION=GAP_CONFIRMED no escopo original.
Nenhuma chamada ou escrita remota na E1. F24.5 não está CLOSED.

1. Legado válido é importado conforme contrato autorizado; ACKs incorretamente
   avançados antes da C não são reconstruídos. Quota/falha de commit causam replay,
   não perda de evento; idempotência factual depende do ingest remoto por ID.
2. Compatibilidade com declaração v32 observada em fake IndexedDB/Dexie instalado;
   abas antigas concorrentes/rolling upgrade físico não certificados.
3. G09/autenticação/pull reais, mobile e perda/eviction de storage não fechados.

`E1 = FIXED_IN_CERTIFIED_SCOPE`; `REAL_RESTART_TELEMETRY_CHECKPOINT = PROVEN`;
`F24_5E1 = READY_FOR_REVIEW`. F24_5E permanece PARTIAL devido aos limites de G09
e integração real registrados, sem recomendação de CLOSED. Sem commit, push, PR,
merge, deploy ou migration remota.
