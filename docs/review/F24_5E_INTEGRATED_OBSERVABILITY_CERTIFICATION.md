# F24.5E — Integrated Observability Certification

Atualizado em: 2026-10-08
Modo principal: VERIFICATION. Status atual: `F24_5E = READY_FOR_COMMIT`;
`F24_5E1 = CLOSED / INTEGRATED`; `F24_5E3 = STAGING_CERTIFIED`; `G09 = PROVEN`.
Resultado vigente: closeout local aprovado no fim do documento;
`F24_5E_CLOSEOUT_REVIEW = APPROVED`. Certificação E3/E1/E2 preservada;
`F24_5 = READY_FOR_COMMIT`, ainda não CLOSED.

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

## F24.5E2 — Remote Telemetry Certification

Atualizado em: 2026-10-07. Modo: VERIFICATION; runtime patch = NONE.

### DECISÃO

`F24_5E2 = PARTIAL`, `G09 = PARTIAL`, `ENVIRONMENT_LIMITATION`.
FATO CONFIRMADO: inventário remoto e contrato publicado reinspecionados; chamada
sem autenticação rejeitada. Nenhuma sessão/fixture autenticada segura foi
disponibilizada nesta execução. Isso limita a certificação, sem comprovar que
fixtures não existam no ambiente. Não procurar tokens nem criar usuários ou
memberships para contornar a limitação. Nenhuma escrita remota foi realizada.

F24.5E1 está CLOSED / INTEGRATED pelo PR #187 no baseline abaixo.
`G10 = PROVEN` no escopo certificado da E1; não foi reaberto nem reexecutado.
As seções anteriores preservam os snapshots BEFORE/E1, não o veredito atual E2.

### BASELINE REAL

| Campo | Valor observado |
| --- | --- |
| branch | `codex/f24-5e2-remote-telemetry-certification` |
| HEAD | `f4c90e89a94b4a1b27032411c678569579b13dd1` |
| origin/main | `f4c90e89a94b4a1b27032411c678569579b13dd1` |
| worktree | `C:/Users/mares/dyad-apps/GestaoAgro` |
| Atualização | fetch origin --prune; checkout main; pull --ff-only; branch nova |
| Estado inicial | Tracked, staged e untracked limpos; main disponível |

Nenhum outro worktree foi removido ou alterado. Não houve commit, push ou PR.

### ENVIRONMENT

| Campo | Evidência |
| --- | --- |
| project | `zqloazqzhwauamcejmuz`, RebanhoSync, sa-east-1, ACTIVE_HEALTHY |
| endpoint | `https://zqloazqzhwauamcejmuz.supabase.co/functions/v1/telemetry-ingest` |
| Edge version | v2 ACTIVE; verify_jwt=true; Supabase JS 2.45.0 |
| Bundle SHA-256 | `003e31e62f80dd2953327a1e5a0af9d78907320d55402800b7b0bf4b89f37bc8` |
| Banco | Postgres 17.11.0.002 |
| staging confirmed | Identidade conferida por get_project; classificação de staging/integração descartável sustentada pela reclassificação autoritativa F24.1C/D e SUPABASE_RLS |

A indicação histórica de produção compartilhada em F24.1B foi explicitamente
substituída pela seção inicial de F24.1C e pelo rehearsal F24.1D:
PRODUCTION_BACKEND=NOT_PROVISIONED, PRODUCTION_DATA=NONE. A tarefa atual confirma
o mesmo alvo de staging. O nome do projeto no MCP isoladamente não prova classe
de ambiente. Não houve escrita nem reutilização da autorização histórica de reset.

### FIXTURES

| Fixture | Disponibilidade segura nesta execução |
| --- | --- |
| USER_A | Não disponibilizada |
| USER_B | Não disponibilizada |
| FARM_A | Não disponibilizada |
| FARM_B | Não disponibilizada |

Limitations: sessões autenticadas e IDs destinados explicitamente a teste não
foram fornecidos; memberships não puderam ser verificadas. Solicitado canal seguro
sem senhas/JWTs. Não consultados registros pessoais/Auth, arquivos de credenciais,
logs ou histórico do shell; não usada service-role ou simulação SQL de auth.uid().

### REMOTE DELIVERY

Request autenticado: não executado. Receipt: não observado. Persistence: não
observada; nenhum SELECT de dados de metrics_events foi executado.
`REMOTE_TELEMETRY_DELIVERY = NOT_PROVEN`.

Probe seguro de failure path: POST com body `{"events":[]}`, sem credenciais,
retornou HTTP 401 e `UNAUTHORIZED_NO_AUTH_HEADER / Missing authorization header`.
Não atribuir essa resposta ao handler: a camada de gateway pode rejeitar antes
dele. Não é evidência de delivery, receipt válido ou persistência.

### REMOTE REPLAY

Same ID: não enviado. Receipt: não observado. Remote row count: não consultada.
`REMOTE_TELEMETRY_REPLAY = NOT_PROVEN`.
`REMOTE_CONCURRENT_DUPLICATE = NOT_PROVEN`; requests concorrentes não executadas.

### LOST ACK

Method: não executado, nem descarte do ACK no harness nem perda física controlada.
Result: sem evidência remota. `REMOTE_LOST_ACK_REPLAY = NOT_PROVEN`.
O upsert inspecionado não substitui replay remoto real.

### TENANT ISOLATION

Cada célula registra expectativa / classificação observada. Nenhuma foi executada.

| Actor | FARM_A insert | FARM_A select | FARM_B insert | FARM_B select |
| --- | --- | --- | --- | --- |
| USER_A | Permitido / NOT_PROVEN | Permitido / NOT_PROVEN | Negado / NOT_PROVEN | Negado / NOT_PROVEN |
| USER_B | Negado / NOT_PROVEN | Negado / NOT_PROVEN | Permitido / NOT_PROVEN | Permitido / NOT_PROVEN |

FATO CONFIRMADO por catálogos remotos: RLS habilitada (force_rls=false), PK id,
FK fazenda_id com cascade, status info/success/error; authenticated tem INSERT
e SELECT. metrics_insert_member usa WITH CHECK has_membership(fazenda_id),
metrics_select_member usa USING has_membership(fazenda_id). has_membership
consulta user_fazendas por auth.uid(), fazenda e deleted_at IS NULL.
Isso mantém `REMOTE_TENANT_ISOLATION = PARTIAL` por inspeção, mas os critérios
de execução INSERT/SELECT permanecem NOT_PROVEN. Não houve violação observada;
não inferir isolamento executado nem ausência de defeito só por SQL.

### CLIENT_EDGE_CONTRACT

`CLIENT_EDGE_CONTRACT = MATCH` no escopo de comparação estática com a fonte
efetivamente publicada. get_edge_function retornou index.ts equivalente ao
arquivo integrado após normalização CRLF/LF. Não houve drift identificado.

| Contrato | Cliente integrado / Edge publicada |
| --- | --- |
| Batch max | Cliente envia até 100; Edge rejeita >100 com HTTP 400 |
| Shape | `{ events }`; id, fazenda_id, event_name, status, route, entity, quantity, reason_code, payload, created_at |
| Stable id / tenant | UUID persistido localmente e reenviado sem regenerar; Edge preserva id e fazenda_id |
| Defaults | Cliente e Edge usam status info, payload vazio e timestamp quando aplicável |
| Receipt success | Cliente exige success===true, não só HTTP 2xx; Edge retorna success=true no sucesso |
| Receipt inserted | Cliente exige inteiro entre 0 e tamanho do batch; Edge retorna quantidade de IDs inseridos, incluindo zero em replay |
| HTTP failures | Cliente não confirma delivery em não-2xx, JSON inválido, erro ou timeout; Edge possui caminhos 401/400/500 |
| Idempotência | Edge usa metrics_events.upsert, onConflict=id, ignoreDuplicates=true e select('id'); PK id confirmada remotamente |

Essa comparação não certifica o receipt produzido por request autenticado real.
Fontes locais: src/lib/telemetry/pilotMetrics.ts, telemetryFlushCursor.ts,
supabase/functions/telemetry-ingest/index.ts e supabase/functions/deno.json.
O deno.json é compartilhado em functions; não existe deno.json local na pasta
telemetry-ingest. Import remoto 2.45.0 coincide com o compartilhado local.

### CLIENT_REMOTE_CHECKPOINT

`CLIENT_REMOTE_CHECKPOINT_FLOW = PARTIAL`;
`CLIENT_TO_REMOTE_FULL_PATH = PARTIAL`; `REMOTE_ENDPOINT = NOT_PROVEN` para
delivery autenticado. Não executados flush real autenticado, leitura remota,
checkpoint após receipt nem segundo flush contra staging.

Inspeção: flushTelemetryForFarm escreve telemetry_flush_cursors somente após
flushTelemetryBatch validar receipt; Dexie v33 mantém autoridade local integrada
pela E1. A certificação local E1 permanece válida; não substitui integração remota.

### RETENTION

Mechanisms found: nenhum mecanismo temporal nos catálogos inspecionados.
pg_cron/pg_partman ausentes; sem relações nos schemas cron/partman, sem triggers
customizados em metrics_events, sem funções public/private que referenciem
literalmente metrics_events e DELETE/TRUNCATE. Inventário Edge contém sync-batch,
test-auth, telemetry-ingest e sanitario-reconcile; nenhum job de retenção explícito
identificado. Fonte publicada telemetry-ingest não configura TTL.

Policy: prazo canônico não localizado nas fontes dirigidas; não inventado TTL.
`REMOTE_RETENTION = GAP_CONFIRMED`; `RETENTION_POLICY_REQUIRED = YES`.
Decision required: definir política ou aceitar explicitamente/documentar o gap
antes do closeout. Impactos: custo/crescimento, privacidade, observabilidade
histórica e capacidade de investigação. O gap não impede certificar delivery/replay
isoladamente, mas não foi aceito para fechamento nesta execução.

Limites: busca literal de funções não cobre SQL dinâmico ou outros schemas;
inventário Edge não prova ausência de scheduler externo. Jobs externos/schedules
não acessíveis por essas ferramentas permanecem NOT_PROVEN. Cascade de fazenda
não equivale a retenção temporal.

Consultas somente a catálogos: pg_class/pg_namespace (RLS e relações cron/partman),
pg_policies, information_schema.role_table_grants (anon/authenticated),
pg_constraint/pg_get_constraintdef, pg_proc/pg_get_functiondef(has_membership),
pg_extension, pg_trigger (NOT tgisinternal) e pg_proc.prosrc em public/private
com ILIKE '%metrics_events%' e ('%delete%' ou '%truncate%').
Nenhuma linha de usuário foi lida e essas consultas administrativas não foram
usadas como prova de isolamento autenticado.

### G09 MATRIX

| criterion | status | evidence |
| --- | --- | --- |
| REMOTE_TELEMETRY_DELIVERY | NOT_PROVEN | Sem request autenticado/persistência observada |
| REMOTE_TELEMETRY_REPLAY | NOT_PROVEN | Sem replay/contagem remota |
| REMOTE_LOST_ACK_REPLAY | NOT_PROVEN | Nenhum método executado |
| REMOTE_TENANT_INSERT_ISOLATION | NOT_PROVEN | Matriz autenticada não executada |
| REMOTE_TENANT_SELECT_ISOLATION | NOT_PROVEN | Matriz autenticada não executada |
| CLIENT_EDGE_CONTRACT | PROVEN (MATCH estático) | Fonte publicada comparada com runtime integrado |
| CLIENT_REMOTE_CHECKPOINT_FLOW | PARTIAL | E1 local preservada; full path remoto não executado |
| REMOTE_RETENTION | GAP_CONFIRMED | Catálogos reinspecionados; decisão de política pendente |
| G09 agregado | PARTIAL | Fixtures ausentes nesta execução; retenção sem decisão de aceitação |

### PATCHES

Runtime: NONE. Apenas docs/review/F24_5E_INTEGRATED_OBSERVABILITY_CERTIFICATION.md
recebeu esta seção de evidência; sem harness novo, dependências, schema, migrations,
RLS ou Edge alterados. Registro histórico anterior preservado.

### VALIDATIONS

| operation | observed result |
| --- | --- |
| Git rebaseline / branch própria | Baseline E1 integrado confirmado; workspace inicialmente limpo |
| get_project / list_edge_functions / get_edge_function | Projeto ativo; telemetry-ingest v2; fonte publicada obtida |
| Comparação index.ts local/publicado ignorando CRLF/LF | true; conteúdo equivalente |
| Catálogos RLS/grants/constraints/has_membership | Contratos descritos acima observados |
| Catálogos de retenção | Quatro resultados vazios: extensions, custom triggers, literal retention functions, schedule relations |
| POST sem auth, body events vazio | HTTP 401; UNAUTHORIZED_NO_AUTH_HEADER |
| git diff --check | Exit 0; sem erros de whitespace |
| Diff tracked/staged/untracked | Apenas este relatório alterado; staged e untracked vazios; 225 linhas adicionadas antes deste registro final |

Não executados: probes autenticados D1–D5/D7, concorrência ou lost ACK;
dependem de fixtures e memberships autorizadas. Nenhuma suíte local/42 testes E1,
restart Playwright, build ou regressão global reexecutados: runtime não mudou.
Diff desta seção inspecionado; nenhum arquivo fora do escopo alterado.

### REMOTE TEST RECORDS

IDs created: nenhum. Nenhum registro remoto criado ou deixado para cleanup.
Nenhum DELETE/TRUNCATE/reset, deploy, migration, alteração de usuários/membership,
service-role, bypass, force-push, merge ou operação de produção.

### RISKS RESIDUALS

1. ENVIRONMENT_LIMITATION: disponibilizar sessões de fixtures USER_A/B e FARM_A/B
   e provar memberships antes de executar delivery/replay/isolamento.
2. Retenção exige política ou aceitação explícita do gap; automação externa não
   foi comprovada. Nenhum prazo foi inferido.
3. Full path cliente→staging→checkpoint e lost ACK remoto continuam sem execução.

### G06

Status unchanged: PARTIAL / NOT_PROVEN nos cenários reais pendentes. Nenhuma
evidência incidental de session expiry ou UNKNOWN/MISMATCH; ownership inalterado.

### VERDICT

`F24_5E2 = PARTIAL`; `F24_5E = PARTIAL`; `F24_5 = NOT_CLOSED`.
Não declarar READY_FOR_REVIEW nem CLOSED sem a certificação remota requerida.

## F24.5E2A — Staging Certification Fixtures

Atualizado em: 2026-10-07. Passagem DISCOVERY/read-only seguida de registro
documental; nenhum provisioning nem probe D1–D7 executado. Vereditos E2/E/G09,
retenção e G10 preservados.

### Baseline e ambiente

fetch origin --prune executado; branch
`codex/f24-5e2-remote-telemetry-certification`; HEAD/origin/main permanecem
`f4c90e89a94b4a1b27032411c678569579b13dd1`. Alteração documental E2 preservada.
get_project reconfirmou `zqloazqzhwauamcejmuz`, RebanhoSync, ACTIVE_HEALTHY;
classificação STAGING/DISPOSABLE_INTEGRATION conforme reclassificação autoritativa
F24.1C/D e tarefa atual. Nenhuma autorização histórica de reset reutilizada.

### Evidências materiais novas

- information_schema.columns, pg_constraint, pg_enum, pg_trigger e pg_proc reais
  inspecionados para auth.users, user_profiles, fazendas e user_fazendas.
- Não há trigger customizado de criação de perfil em auth.users no inventário
  observado. user_profiles exige user_id; display_name é opcional;
  can_create_farm tem default true. Campos técnicos obrigatórios têm defaults.
- fazendas exige nome; UUID, timezone, metadata, benfeitorias, client_id,
  client_op_id e timestamps têm defaults. created_by é FK para auth.users.
- user_fazendas exige user_id/fazenda_id; PK composta. Roles: cowboy, manager,
  owner. has_membership usa auth.uid(), fazenda e deleted_at IS NULL.
- RPC publicada create_fazenda aceita _nome e sete parâmetros opcionais;
  authenticated possui EXECUTE. Exige auth.uid() e can_create_farm(); define
  created_by=auth.uid(), cria owner com accepted_at=now() e primeira membership
  is_primary=true. Não inserir membership separadamente.
- Efeitos obrigatórios: create_fazenda cria fazenda_sanidade_config (defaults
  aptidao/sistema all se parâmetros opcionais ausentes); trigger
  trg_seed_default_finance_categories cria 12 categorias financeiras por fazenda.
  Portanto o caminho canônico não cria somente as duas linhas de fazendas.
- Policies de perfil permitem INSERT self; memberships têm SELECT, sem policy
  de INSERT direta. Farm deve ser criada pela RPC preservando invariantes.

### Fixtures existentes e mecanismo reutilizável

Nenhum usuário encontrado com chave funcional_fixture, dry_cow_ui_smoke=true
em raw_user_meta_data ou certification_fixture=f24-5e2a-telemetry-certification
em raw_app_meta_data. Consulta retornou apenas IDs/marcadores/run_id, sem email,
senha, token ou dados pessoais. Resultado limitado a esses marcadores: não prova
inexistência de fixtures com convenção diferente. EXISTING_FIXTURES=NOT_PROVEN;
nenhuma fixture apropriada identificada na busca dirigida.

scripts/codex/validate-supabase-baseline-functional.mjs demonstra Auth Admin
createUser(email/password sintéticos, email_confirm=true, marcador/run_id),
signInWithPassword normal e create_fazenda. É mecanismo LOCAL com guard de host,
não provisionador de staging; não executar nem relaxar guard. Outros validators
locais repetem essa convenção. seed.sql não apresentou referências às quatro
tabelas pesquisadas. test-auth/index.ts somente valida JWT via getUser; não cria
usuário, sessão, fazenda ou membership. Sem provisionador staging comprovado.

### Proposta concreta para autorização futura

1. Auth Admin de staging: dois createUser, sem SQL direto em auth.users.
   Emails sintéticos a-<run_uuid>@telemetry-cert.invalid e
   b-<run_uuid>@telemetry-cert.invalid, email_confirm=true; display_name sintético.
   app_metadata.certification_fixture=f24-5e2a-telemetry-certification,
   run_id e label A/B para identificação administrativa explícita.
2. Cada usuário faz signInWithPassword normal e INSERT self de seu user_profiles
   (user_id e display_name; restantes defaults); nenhum privilégio superadmin.
3. Cada sessão chama create_fazenda somente com _nome e _codigo:
   Telemetry Certification A/B <run_uuid>, tc-a/b-<run_uuid>.
   Nenhuma localização/área/tipo pecuário inventada. Registrar IDs retornados.
4. Efeitos persistentes esperados: 2 auth users, 2 profiles, 2 farms,
   2 memberships owner, 2 fazenda_sanidade_config e 24 finance_categories,
   além de identidades/sessões mantidas pelo Auth. Nenhum animal, evento,
   agenda, estoque ou transação financeira. Os efeitos automáticos precisam
   constar da autorização; não desabilitar triggers ou contornar a RPC.
5. SELECT dirigido aos IDs para comprovar created_by, perfis, memberships ativas,
   roles e ausência de vínculos cruzados. Contagem total de memberships ativas
   de cada usuário deve ser 1. Inventariar efeitos automáticos; sem D1–D7.

Credencial administrativa de staging deve ser disponibilizada por canal seguro
ao processo servidor, sem Git/URL/argv/terminal/log. Não procurá-la em arquivos
ou secrets existentes. Disponibilidade desse canal ainda NOT_PROVEN. Gerar
senhas fortes distintas e manter senhas/JWTs apenas em memória na execução;
sessões normais para probes futuros. Para retomada em outro processo, definir
custódia segura explicitamente antes de criar; não gravar secrets em manifestos.
Manifesto contém só project, run_id, IDs, labels e origem da fixture.

### Cleanup e gate

Cleanup futuro separado: confirmar marcadores e IDs, revogar sessões das fixtures,
inventariar dependências/FKs e dados dos tenants, conferir que não há dados fora
da certificação, então propor remoção dirigida de registros e Auth users.
Não confiar somente no cascade: há FKs RESTRICT/NO ACTION e SET NULL; qualquer
dependência inesperada exige parada. Nenhum cleanup automático, inclusive após
falha parcial de provisioning; registrar IDs já criados para decisão posterior.

`F24_5E2A = READY_FOR_AUTHORIZATION` para o plano, não para execução imediata.
`AUTHORIZATION_GATE = AWAIT_EXPLICIT_AUTHORIZATION`.
A seção 14 da solicitação E2A exige STOP antes de criação real. Além da autorização,
o canal seguro administrativo e a custódia das sessões precisam ser resolvidos.
Nenhuma mutação remota, alteração RLS, commit, push, PR, merge, deploy ou migration.

### E2A — autorização recebida / preflight de execução

Em 2026-10-07 o usuário autorizou explicitamente o provisioning proposto em
`zqloazqzhwauamcejmuz`, incluindo perfis, duas RPCs create_fazenda, memberships,
configurações sanitárias, 24 categorias financeiras, autenticação normal e
SELECTs dirigidos. Não é necessário repetir o gate de autorização acima, que
preserva o planejamento anterior. Cleanup e probes D1–D7 continuam não autorizados
nesta execução; falha parcial exige interromper novas mutações e inventariar IDs.

fetch origin --prune reconfirmou branch/HEAD anteriores; origin/main avançou para
`d76543b06bb4b398c79d38db58a75115ce0e91ee` (PR #188, animal detail overview).
git diff HEAD origin/main nos diretórios supabase/migrations, telemetry-ingest,
test-auth e src/lib/telemetry retornou vazio. Alteração documental preservada,
sem checkout, reset ou integração automática. get_project reconfirmou alvo ativo.

Inventário das ferramentas disponíveis e busca de integração Supabase não
encontraram operação Auth Admin createUser. O conector disponível oferece SQL,
gestão de projetos e Edge, mas não expõe esse endpoint. Nenhum canal seguro com
credencial administrativa foi disponibilizado ao executor; não procurados secrets
em arquivos, logs, histórico ou ambiente. SQL direto em auth.users não substituiu
o caminho Auth Admin aprovado. Solicitado somente o canal/nome da variável a
injetar de forma segura, nunca o valor da credencial no chat.

`PROVISIONING_AUTHORIZATION = GRANTED`; `EXECUTION = BLOCKED_CREDENTIAL_CHANNEL`;
`F24_5E2A = BLOCKED`. Não declarar FIXTURES_READY. Inventário desta execução:
zero usuários, perfis, fazendas, memberships, configurações ou categorias criados;
zero IDs novos. Não houve tentativa de mutação nem falha parcial de provisioning.
Matriz de memberships ainda não executada. E2/G09/retention/G10 inalterados.

### E2A — provisioning confirmado / FIXTURES_READY

Execução em 2026-10-07 após as variáveis injetadas se tornarem efetivamente
acessíveis ao executor. As tentativas anteriores não criaram objetos; o bloqueio
de canal acima foi resolvido nesta execução. Autorização humana anterior preservada.

Preflight: SUPABASE_SECRET_KEY/SUPABASE_URL presentes; URL comparada sem exibir
valores e confirmada exclusivamente para staging `zqloazqzhwauamcejmuz`.
get_project confirmou ACTIVE_HEALTHY. Branch/HEAD permanecem os da E2A;
origin/main=d76543b06bb4b398c79d38db58a75115ce0e91ee; diff dos contratos de
provisioning/telemetry contra HEAD vazio. Documento anterior preservado.

`run_id = 2bb64200-772a-486a-964a-5bea77172145`.

| Objeto | ID técnico persistido |
| --- | --- |
| USER_A / PROFILE_A | `693647f3-9043-437e-bf18-924d39b882aa` |
| USER_B / PROFILE_B | `ca19dafc-488e-4c15-8613-1b05e7b37a73` |
| FARM_A | `71d3bd9f-fec1-4439-a96b-6536ebb20cb4` |
| FARM_B | `11a63edd-ebc7-4be2-9c65-84f5228f25f2` |

Auth Admin createUser usado somente para os dois usuários sintéticos, email
confirmado e app_metadata.certification_fixture=f24-5e2a-telemetry-certification,
run_id e labels A/B. Nenhum usuário real reutilizado. Senhas fortes distintas
geradas em memória. Depois, clientes separados com chave publishable pública e
signInWithPassword normal; INSERT self em user_profiles e RPC create_fazenda,
sem SQL direto em auth.users/fazendas/membership e sem simulação de auth.uid().
SDK @supabase/supabase-js 2.95.0 já instalado; nenhuma dependência adicionada.

Perfis ativos confirmados por receipt SELECT self e consulta dirigida posterior.
created_by de FARM_A=USER_A, FARM_B=USER_B; ambas deleted_at NULL. Memberships
geradas pela RPC com role owner, is_primary=true, accepted_at preenchido e
deleted_at NULL. Consulta administrativa dirigida por IDs encontrou exatamente
essas duas memberships e nenhuma adicional para os usuários sintéticos.

| Actor | FARM_A membership | FARM_B membership |
| --- | --- | --- |
| USER_A | owner ativa / PROVEN | ausente / PROVEN |
| USER_B | ausente / PROVEN | owner ativa / PROVEN |

SELECT normal de fazendas filtrado aos dois IDs retornou somente a própria
fazenda para cada sessão. SELECT normal das próprias memberships retornou
exatamente uma. Essa evidência trata das fixtures e fronteira de fazendas;
não promove os critérios de isolamento de metrics_events da E2, não executados.
A consulta administrativa demonstra estado persistido, não substitui teste RLS.

| Efeito persistente | FARM_A | FARM_B | Total |
| --- | --- | --- | --- |
| fazenda_sanidade_config | 1 | 1 | 2 |
| finance_categories | 12 | 12 | 24 |
| categorias financeiras is_default=true | 12 | 12 | 24 |
| animais / eventos / agenda_itens / insumos | 0 cada | 0 cada | 0 cada |
| finance_transactions / metrics_events | 0 cada | 0 cada | 0 cada |

Consultas de efeitos filtradas exclusivamente aos IDs das duas fazendas. Nenhuma
mutação adicional para corrigir ou completar defaults; não houve falha parcial.
Nenhum cleanup. Registros ficam em staging para certificação futura autorizada.

Segurança: secret administrativo consumido somente pelo SDK servidor Auth Admin,
sem impressão ou persistência. Senhas/JWTs não gravados no Git, arquivos,
relatório, URLs ou saída. persistSession=false/autoRefreshToken=false; sessões
normais permanecem somente na memória do processo executor desta execução
(session_id 38368). Não há custódia durável nem garantia de retomada após término
do processo/expiração; acesso autenticado deve ser reconfirmado antes da E2.
Nenhum timer faz requests: processo mantido ocioso, sem probes automáticos.

Validações observadas: dois receipts createUser; dois logins normais com identidade
correspondente; dois receipts de INSERT self; duas RPCs create_fazenda com IDs;
SELECTs normais de fazendas/memberships; SELECTs dirigidos de auth markers,
profiles, created_by, matriz completa de membership e contagens dos efeitos.
git diff --check sem erros antes do registro final; verificação documental final
executada após esta seção. Nenhuma suíte local reexecutada: runtime inalterado.

`F24_5E2A = FIXTURES_READY`; `PROVISIONING = CONFIRMED`.
`F24_5E2 = PARTIAL`; `G09 = PARTIAL`; `REMOTE_RETENTION = GAP_CONFIRMED`;
`RETENTION_POLICY_REQUIRED = YES`; `G10 = PROVEN` no escopo E1 preservado;
`F24_5 = NOT_CLOSED`. Nenhum D1–D7, deploy, migration, alteração RLS/Edge,
produção, DELETE/TRUNCATE/reset, commit, push, PR, force-push ou merge.

## F24.5E2B — Authenticated Remote Telemetry Probes

Atualizado em: 2026-10-07. Modo VERIFICATION; autorização humana explícita somente
para staging e fixtures do run_id `2bb64200-772a-486a-964a-5bea77172145`.
Esta seção substitui os limites de disponibilidade/execução E2/E2A anteriores
para os probes aqui observados; não reescreve os respectivos resultados históricos.

### Decisão / baseline / ambiente

`REMOTE_ENDPOINT = PROVEN` no escopo autenticado exercitado;
`CLIENT_EDGE_CONTRACT = MATCH` estático e dinâmico;
`CLIENT_REMOTE_CHECKPOINT_FLOW = PROVEN` no harness de módulos reais descrito abaixo.
`G09 = PARTIAL`: retenção continua sem política comprovada ou decisão de aceitação.
Nenhum SECURITY_BLOCKER observado nas tentativas executadas.

fetch origin --prune executado. Branch:
`codex/f24-5e2-remote-telemetry-certification`; HEAD:
`f4c90e89a94b4a1b27032411c678569579b13dd1`; origin/main:
`d76543b06bb4b398c79d38db58a75115ce0e91ee`.
Worktree: C:/Users/mares/dyad-apps/GestaoAgro. Alteração documental anterior
preservada; nenhum runtime, staged ou untracked novo no preflight/final.

get_project reconfirmou staging `zqloazqzhwauamcejmuz`, ACTIVE_HEALTHY,
Postgres 17.11.0.002. Classe STAGING/DISPOSABLE_INTEGRATION conforme tarefa atual
e reclassificação autoritativa F24.1C/D. Endpoint:
https://zqloazqzhwauamcejmuz.supabase.co/functions/v1/telemetry-ingest.
get_edge_function reconfirmou v2, verify_jwt=true e bundle SHA-256
`003e31e62f80dd2953327a1e5a0af9d78907320d55402800b7b0bf4b89f37bc8`.
Fonte publicada novamente comparada com index.ts integrado: equivalente após
normalização CRLF/LF. Sem deploy ou alteração de fonte.

### Fixtures / segurança / método

USER_A=`693647f3-9043-437e-bf18-924d39b882aa`;
USER_B=`ca19dafc-488e-4c15-8613-1b05e7b37a73`;
FARM_A=`71d3bd9f-fec1-4439-a96b-6536ebb20cb4`;
FARM_B=`11a63edd-ebc7-4be2-9c65-84f5228f25f2`.
Memberships persistidas e finalidade sintética comprovadas na E2A acima.
getUser/getSession normais reconfirmaram identidades A/B antes dos probes.
Nenhum novo usuário, fazenda ou membership; nenhuma modificação de vínculo.

O processo isolado E2A (session_id 38368, PID 24572) mantinha os clientes normais
em memória. Instrumentação Node Inspector local acessou esses clientes sem
exportar tokens; canal usado somente no harness, sem leitura de secrets em
arquivos/logs/histórico. Requests usaram chave publishable pública e Authorization
da sessão normal correspondente. Admin/service-role não usados nos probes nem
nos SELECTs de métricas. Nenhuma consulta SQL administrativa para provar RLS.
Nenhuma senha, JWT, refresh token, cookie ou secret key impresso/persistido.

Telemetria usa UUID novo, event_name=page_view, status=info,
reason_code=F24_5E2B_SYNTHETIC, payload={synthetic:true,run_id}; D7 adiciona probe=D7.
Sem PII ou conteúdo de operação de domínio. SELECTs normais filtrados aos IDs
exatos dos eventos sintéticos, em metrics_events. Não ler dados alheios ao teste.

Houve dois erros de resolução de UUID na inicialização da instrumentação isolada,
antes de qualquer request de telemetria. Resolvidos no harness em memória;
nenhum defeito de runtime atribuído e nenhuma mutação remota nesses erros.

### D1 / D2 / D3 — delivery e replay

ID A: `c2b1cd02-80a4-4367-8354-8dc4620c15d0`.

| Probe | Request / receipt publicado | Persistência observada |
| --- | --- | --- |
| D1 USER_A→FARM_A | HTTP 200; success=true, inserted=1 | SELECT de USER_A: 1 linha; ID, fazenda, page_view/info e marcador sintético corretos |
| D2 mesmo evento/mesmo ID | HTTP 200; success=true, inserted=0 | SELECT de USER_A: exatamente 1 linha |
| D3 ACK local não usado para decidir reenvio | HTTP 200; success=true, inserted=0 | SELECT de USER_A: exatamente 1 linha |

D3 é replay determinístico equivalente quando o cliente não pode confiar no ACK
anterior. Não foi destruída conexão nem induzida perda física de ACK.
`REMOTE_LOST_ACK_REPLAY = PROVEN` somente no método equivalente autorizado;
`LOST_ACK_REMOTE = PARTIAL` para perda física, não executada. D7 abaixo fortalece
a evidência de efeito remoto confirmado com receipt local deliberadamente inválido.

### D4 / D5 — tenant isolation

ID tentativa USER_A→FARM_B: `03a1eecc-5671-40c8-bacd-bd1e11b544db`.
Resposta HTTP 500, sem receipt válido. SELECT normal de USER_B (proprietário
autorizado de FARM_B) para esse ID retornou zero linhas. Rejeição comprovada por
resposta e ausência persistida observável pelo tenant proprietário.

Para o controle positivo das leituras D5, criada métrica própria de USER_B em
FARM_B: `7280bb89-8d5a-4117-93ab-d7695cbaa7da`; HTTP 200,
success=true/inserted=1; SELECT próprio: uma linha, page_view/info/fazenda corretos.
Essa fixture de telemetria permite distinguir ocultação cross-tenant de ausência
do registro. Não foi criado dado pecuário.

| Actor | FARM_A insert | FARM_A select | FARM_B insert | FARM_B select |
| --- | --- | --- | --- | --- |
| USER_A | PROVEN permitido: D1 | PROVEN permitido: 1 linha | PROVEN negado: HTTP 500 e proprietário vê 0 | PROVEN negado: 0 linhas para ID B existente |
| USER_B | NOT_PROVEN: inverso não executado | PROVEN negado: 0 linhas para ID A existente | PROVEN permitido: controle D5 | PROVEN permitido: 1 linha |

Insert cross-tenant certificado na direção expressamente autorizada USER_A→FARM_B.
Não promover a célula inversa por inspeção de RLS nem por simetria. Select
cross-tenant executado em ambas as direções, com controles próprios positivos.
Nenhuma persistência nem retorno indevido cross-tenant observado; nenhuma
correção de segurança implementada.

### D6 / D7 — cliente, receipt e checkpoint real

D6: contratos estáticos de batch máximo 100, shape, stable ID/fazenda,
upsert onConflict=id/ignoreDuplicates e failures preservados. Dinamicamente
observados receipts success=true/inserted=1 no primeiro envio e inserted=0 em
replays; D4 não produziu receipt válido. Não executado teste de 101 eventos/carga.
D7 usa validação real de receipt de pilotMetrics, complementando a comparação.

D7 executou Chromium headless/contexto novo isolado, com Vite programático
configFile=false/envFile=false, alias existente para src. Não carregou .env nem
o app/scheduler/UI completo. Sem trace, screenshots ou storageState.
Módulos reais sem patch: trackPilotMetric, flushPilotMetrics, ownership,
localReadBoundary, db Dexie v33 e telemetryFlushCursor. Apenas env.ts/supabase.ts
foram fornecidos por interceptação de módulos NO HARNESS: destino staging e
getSession/refreshSession obtêm sessão normal real de USER_A por IPC em memória,
sem auth persistida no browser. Não se trata de login UI/startup autenticado pleno.

O transporte de telemetry usa route.fetch para o endpoint real com o JWT normal
do request do cliente. Receipts reais observados são registrados sem headers.
Na primeira fase, o harness substitui somente o receipt entregue ao cliente por
success=false; não altera endpoint/banco nem diz que esse receipt é o remoto real.
Na segunda fase entrega o receipt remoto válido, incluindo inserted=0 de replay.

ID D7: `cb7f71fc-41b6-42a0-b3aa-8b46086181a7`;
created_at=`2026-10-07T21:28:24.446Z`.

| Etapa | Resultado observado |
| --- | --- |
| trackPilotMetric real | Uma métrica local; UUID e timestamp gerados pelo produto |
| Primeiro flush, ACK local deliberadamente inválido | Dois POSTs reais: HTTP 200/inserted=1 e HTTP 200/inserted=0; ambos success=true remotamente |
| Guard de receipt do cliente | Flush rejeitado; cursor antes=NULL e após receipts locais inválidos=NULL |
| Persistência antes de receipt local válido | SELECT REST normal de USER_A: uma linha remota correspondente |
| Flush com receipt remoto válido | HTTP 200, success=true/inserted=0; cliente aceita o replay |
| Store telemetry_flush_cursors | fazenda_id=FARM_A; created_at igual à métrica; ids_at_cursor=[ID D7]; updated_at=2026-10-07T21:28:26.735Z |
| Flush posterior | Zero requests adicionais; evento confirmado não reenviado |
| SELECT remoto final | Exatamente uma linha para ID D7 |

`CLIENT_REMOTE_CHECKPOINT_FLOW = PROVEN` e
`CLIENT_TO_REMOTE_FULL_PATH = PROVEN` no harness de módulos reais configurado
com sessão normal e endpoint publicado. O dado persistiu antes de ACK local válido;
checkpoint só foi observado após receipt válido e commit na autoridade Dexie v33.
Não recertifica crash/restart, login UI, scheduler automático, session expiry,
mobile ou eviction. G10 continua PROVEN somente no escopo E1 já certificado.
Browser e servidor Vite encerrados após o cenário, sem cleanup remoto.

### Matriz G09 / retenção / veredito

| Critério | Status | Evidência / limite |
| --- | --- | --- |
| REMOTE_TELEMETRY_DELIVERY | PROVEN | D1 + SELECT normal correspondente; D7 confirma integração |
| REMOTE_TELEMETRY_REPLAY | PROVEN | D2: mesmo ID, inserted=0 e exatamente 1 linha |
| REMOTE_LOST_ACK_REPLAY | PROVEN no equivalente | D3 e D7; perda física de ACK permanece PARTIAL |
| REMOTE_TENANT_INSERT_ISOLATION | PROVEN na direção autorizada | D4 A→B rejeitado e proprietário confirma ausência; B→A NOT_PROVEN |
| REMOTE_TENANT_SELECT_ISOLATION | PROVEN | Leituras cruzadas zero em ambos os sentidos, próprias uma linha |
| CLIENT_EDGE_CONTRACT | PROVEN / MATCH | Fonte v2 equivalente, receipts reais 1/0 e cliente aceita/rejeita corretamente |
| CLIENT_REMOTE_CHECKPOINT_FLOW | PROVEN no harness | D7: receipt inválido não avança; válido avança; próximo flush não reenvia |
| REMOTE_RETENTION | GAP_CONFIRMED | Sem mudança/provisioning de retenção; evidência E2 preservada |
| G09 agregado | PARTIAL | Nenhuma política temporal comprovada nem aceitação explícita do gap para closeout |

`RETENTION_POLICY_REQUIRED = YES`. A autorização dos probes não aceita o gap
de retenção para fechamento. Nenhum prazo inventado ou mecanismo implementado.
Jobs externos continuam NOT_PROVEN nos limites já documentados.

### Inventário remoto deixado / patches / validações

| ID sintético | Destino / estado final observado |
| --- | --- |
| c2b1cd02-80a4-4367-8354-8dc4620c15d0 | FARM_A, 1 linha, D1–D3 |
| 7280bb89-8d5a-4117-93ab-d7695cbaa7da | FARM_B, 1 linha, controle D5 |
| cb7f71fc-41b6-42a0-b3aa-8b46086181a7 | FARM_A, 1 linha, D7 |
| 03a1eecc-5671-40c8-bacd-bd1e11b544db | FARM_B tentada por USER_A, zero linhas observadas por USER_B |

Total: três métricas remotas persistidas, identificadas pelo run_id; tentativa
cross-tenant não persistida. Oito POSTs de telemetria: sete 200 (três inserts,
quatro replays inserted=0), um 500 rejeitado. Sem concorrência, stress/load test,
DELETE/TRUNCATE/reset, cleanup ou novos objetos fora dessas métricas sintéticas.

Runtime patch=NONE; nenhum harness/dependência nova versionado. Apenas este
relatório atualizado. Validações: preflight Git/projeto, comparação Edge v2,
sessões normais, requests D1–D7 descritos e SELECTs dirigidos; diff tracked,
staged e untracked inspecionado, git diff --check sem erros antes deste registro
final e repetido após atualização. Não reexecutados 42 testes E1, restart
Playwright, suíte global, lint/build: runtime não mudou.

Riscos residuais: decisão de retenção pendente; inverso B→A INSERT não executado;
lost ACK físico e aplicativo completo autenticado não certificados. Sessões
continuam somente em memória, sem custódia durável após término/expiração.
G06 inalterado, sem nova prova de session expiry/UNKNOWN/MISMATCH real.

`F24_5E2B = PARTIAL`; `F24_5E2 = PARTIAL`; `F24_5E = PARTIAL`;
`F24_5 = NOT_CLOSED`. Probes autorizados concluídos no escopo observado; não
promover G09 nem fechar fase enquanto a decisão de retenção permanecer pendente.
Sem commit, push, PR, merge, deploy, migration, RLS/Edge/membership alterados
ou operação de produção.

### Complemento E2B — USER_B → FARM_A INSERT

Executado em 2026-10-07 sob autorização explícita para apenas a célula inversa
faltante. Baseline branch/HEAD e alteração documental preservados; get_project
reconfirmou staging zqloazqzhwauamcejmuz ACTIVE_HEALTHY. Sessões normais existentes
de USER_B e USER_A reconfirmadas antes da tentativa; nenhum admin/service-role
usado no POST ou no SELECT. run_id=2bb64200-772a-486a-964a-5bea77172145.

| Campo | Evidência observada |
| --- | --- |
| Actor | USER_B = ca19dafc-488e-4c15-8613-1b05e7b37a73 |
| Fazenda tentada | FARM_A = 71d3bd9f-fec1-4439-a96b-6536ebb20cb4 |
| ID sintético novo | e0a4237b-a8fc-4747-a21f-5292bc760c39 |
| Payload | page_view/info; reason_code=F24_5E2B_SYNTHETIC; payload synthetic=true e run_id existente |
| POST telemetry-ingest | HTTP 500; request rejeitado; error presente, sem receipt success/inserted |
| Verificação autorizada | SELECT REST normal de USER_A, proprietário de FARM_A, filtrado exclusivamente ao ID sintético |
| SELECT / remote row count | HTTP 200; array vazio; exatamente zero linhas |
| Classificação da célula | PROVEN negado; SECURITY_BLOCKER=NO no probe observado |

Executados somente um POST cross-tenant B→A e um SELECT dirigido de ausência;
nenhuma repetição de D1/D2/D3/D5/D7 ou G10. Nenhuma persistência factual desse ID
observada pelo proprietário autorizado. Tentativa registrada para auditabilidade,
sem cleanup ou novos usuários/fazendas/memberships. Senhas/JWTs/secret keys/cookies
não impressos nem persistidos. Instrumentação local encerrada após leitura.

Matriz vigente abaixo incorpora o complemento; a célula NOT_PROVEN e o risco
inverso no registro E2B anterior preservam o snapshot anterior a esta autorização.

| Actor | FARM_A insert | FARM_A select | FARM_B insert | FARM_B select |
| --- | --- | --- | --- | --- |
| USER_A | PROVEN permitido (D1) | PROVEN permitido (D5) | PROVEN negado (D4) | PROVEN negado (D5) |
| USER_B | PROVEN negado (complemento) | PROVEN negado (D5) | PROVEN permitido (controle D5) | PROVEN permitido (D5) |

`REMOTE_TENANT_INSERT_ISOLATION = PROVEN` em ambas as direções exercitadas.
`G09 = PARTIAL`; remaining blocker=`REMOTE_RETENTION = GAP_CONFIRMED`, sem
decisão explícita de aceitação/política. `RETENTION_POLICY_REQUIRED = YES`.
`F24_5E = PARTIAL`; `F24_5 = NOT_CLOSED`. Lost ACK físico/aplicativo completo
permanecem limites de evidência anteriores, sem recertificação nesta execução.

Patch: somente este relatório. Validação documental: git diff --check após
atualização; resultado final registrado na resposta desta execução. Sem runtime,
RLS, Edge, migration, cleanup, produção, commit, push, PR, merge ou deploy.

## F24.5E3 — Durable Remote Telemetry Retention (patch local)

Implementação local autorizada em 2026-10-08. Política aprovada: 30 dias desde
a primeira ingestão no servidor; um lote de até 1.000 por dia. Telemetry
operacional não é histórico canônico do domínio. Os snapshots E2/E2B acima
permanecem preservados; esta seção não representa aplicação remota.

### Precheck e escopo

| Item | Evidência |
| --- | --- |
| Branch | `codex/f24-5e2-remote-telemetry-certification` |
| HEAD | `f4c90e89a94b4a1b27032411c678569579b13dd1` |
| origin/main local | `c9c72922c97ec1a83f84bf3ff8553285aa63a892`; sem fetch/rebase nesta execução |
| Worktree | `C:\Users\mares\dyad-apps\GestaoAgro`; mesma branch e HEAD antes/depois |
| Alteração preexistente | Este relatório; preservada sem descartar evidência anterior |
| Schema interno | Catálogo staging consultado somente para schemas: nenhum namespace interno de aplicação apropriado; não reutilizar auth/storage/vault/extensions |
| Banco local | PostgreSQL 17.6; pg_cron 1.6.4 disponível, inicialmente não instalado; cron.database_name=postgres, cron.log_run=on |
| Staging baseline | PostgreSQL 17; server_received_at ausente em metrics_events; pg_cron 1.6.4 disponível e não instalado, conforme diagnóstico anterior |

Não presumida igualdade de instalação local/remota. Dois arquivos gerados pelo
mecanismo real `supabase migration new`, CLI 2.117.0. Sem alteração de Edge,
frontend, runtime, RLS, memberships ou fixtures remotas; nenhum novo schema,
ledger, tombstone ou tabela de auditoria. Artefato temporário cli-latest gerado
pela CLI removido do diff desta execução.

### Contrato e implementação versionada

- `supabase/migrations/20261008202000_f24_5e3_remote_telemetry_retention.sql`
  (nome físico alinhado no closeout; criado originalmente como 20261008120753):
  coluna `server_received_at timestamptz NOT NULL DEFAULT now()`; registros
  existentes recebem o timestamp da transação da migration, inclusive os com
  created_at antigo/futuro. `created_at` permanece intocado e representa o tempo
  declarado pelo cliente. Não reconstruída chegada histórica.
- Trigger `metrics_events_stamp_server_received_at`, BEFORE INSERT, impõe
  PostgreSQL `now()` mesmo quando o payload fornece timestamp antigo, futuro ou
  NULL. O DEFAULT mantém compatibilidade com clientes antigos; não é a única
  defesa. Replay `ON CONFLICT(id) DO NOTHING` não modifica a linha existente,
  inclusive seu relógio de retenção. Authenticated continua sem UPDATE/DELETE.
- Índice `idx_metrics_events_server_received_id (server_received_at,id)`;
  índices anteriores preservados. DDL aditiva convencional, sem index concorrente.
- `public.purge_expired_metrics_events()` retorna integer deleted_count;
  SECURITY INVOKER, search_path vazio, owner postgres. CTE materializada ordena
  por timestamp/id, limita 1.000 e usa FOR UPDATE SKIP LOCKED. DELETE revalida
  `server_received_at < now() - interval '30 days'`. Execuções concorrentes
  ignoram candidatos bloqueados; nenhuma espera por esses locks nem dupla remoção
  foi observada no teste. Ausência de candidatos retorna zero.
- Funções de trigger/purge sem EXECUTE para PUBLIC, anon, authenticated e
  service_role. Purge fica em public porque não há schema interno apropriado;
  namespace novo não é necessário. Manutenção executada como owner postgres,
  sem mudar as policies nem conceder capacidade de limpeza aos usuários finais.
- `supabase/migrations/20261008202024_f24_5e3_remote_telemetry_retention_cron.sql`
  (nome físico alinhado no closeout; criado originalmente como 20261008120800):
  `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog`; job nomeado
  `metrics-events-retention-daily`, `0 3 * * *`, SQL
  `SELECT public.purge_expired_metrics_events();`. Uma execução diária às 03:00
  UTC (00:00 America/Sao_Paulo), um lote por execução. Agendamento exige executor
  postgres, timezone cron GMT/UTC e cron.log_run=on; falha explícita se divergirem.
  Repetir cron.schedule com mesmo nome/owner atualiza o job, sem duplicação.

Auditoria mínima: cron.job_run_details (status, start_time/end_time e duração),
retorno integer e RAISE LOG resumido com deleted_count/cutoff. Nenhum payload
nem ID individual registrado pelo purge. O job não depende do frontend, de
Edge continuamente ativa ou do aplicativo aberto.

### Validação local observada

`node tests/codex/telemetry-retention-postgres.integration.mjs` aplica as 58
migrations anteriores em banco PostgreSQL novo, descartável, com schema Auth
real copiado somente como DDL e infraestrutura extensions/pgcrypto local.
Fixture sintética exclusiva deste teste. Nenhum dado/credencial Auth copiado.
Credencial do container local consumida somente em memória, sem saída ou arquivo.
O banco criado pelo teste é descartado no finally; stack e fixtures compartilhadas
não são resetadas. Nenhum cleanup remoto.

| Critério | Resultado observado |
| --- | --- |
| Backfill conservador | Timestamp igual ao now() da transação da migration; created_at 100 dias antigo preservado; purge inicial zero |
| Autoridade de INSERT | Authenticated envia 1900, 2200 e NULL; os três substituídos por now() PostgreSQL |
| Mais jovem que 30 dias | Mantido (limite +1 microsegundo) |
| Mais velho que 30 dias | Removido (limite -1 microsegundo) |
| Exatamente 30 dias | Mantido, na mesma transação do purge; operador estrito confirmado |
| Lote/ordenação | 1.005 elegíveis: 1.000 removidos; sobreviventes são os últimos cinco por timestamp/id; próximo purge remove cinco |
| Idempotência vazia | Próxima execução retorna zero; tabela vazia |
| Replay antes de purge | Mesmo ID, DO NOTHING, zero retornados; timestamp original preservado |
| Concorrência | Primeiro purge mantém locks de 1.000 linhas; segundo remove outras 500 sob timeout 1.500ms; terceira chamada zero; commits sem dupla remoção |
| Inserts recentes concorrentes | INSERT recente aceito enquanto primeiro purge ainda mantém locks; linha permanece após commits e purge posterior zero |
| anon/authenticated | Chamadas diretas ao purge rejeitadas com PostgreSQL 42501 em ambas as roles |
| RLS/ACL | Snapshot de policies, RLS, FORCE RLS, owner e privilégios de tabela antes/depois idêntico; INSERT/SELECT presentes, UPDATE/DELETE ausentes |
| Telemetry existente | INSERT sem coluna nova e SELECT próprio permitidos; SELECT cross-tenant de linha existente zero; INSERT cross-tenant rejeitado |
| Edge/receipts | Handler atual executado sem edição em harness, com ponte SQL no banco real sob authenticated; payload antigo aceito, receipts HTTP 200 success=true inserted=1 e replay inserted=0 |
| Clientes/migrations antigos | 58 migrations prévias aplicadas; INSERT sem server_received_at funciona; nenhum campo novo obrigatório no cliente |
| Replay após purge | ID removido reinserido pelo caminho authenticated DO NOTHING; novo timestamp de ingestão |
| Cron | SQL exato de extensão/agendamento aplicado duas vezes em transação no postgres local: um job ativo, postgres, 0 3 * * *, command correto; audit relation presente; rollback restaura extensão/job |

Teste PostgreSQL: 13 casos agrupados aprovados, cobrindo os 15 critérios e os
limites adicionais acima. Teste de cron valida instalação/configuração em
transação não commitada; não comprova disparo diário real. Harness Edge valida
handler/SQL/receipt, não recertifica transporte REST, login real ou staging.

`pnpm exec vitest run src/lib/telemetry/__tests__/pilotMetrics.test.ts`:
25 testes aprovados, incluindo guards de receipt/checkpoint, retry e replay.
Mensagens esperadas de delivery unconfirmed nos cenários de falha controlada.
`node --check tests/codex/telemetry-retention-postgres.integration.mjs`,
`pnpm run gates:docs` (headers, continuidade e contrato documental) e
`git diff --check`: aprovados. Diff tracked/staged e os três arquivos novos
revisados; staged vazio. Delta E3: duas migrations, um teste de integração e
esta seção acrescentada; o restante do diff documental precede E3.
Sem suíte global, build ou regressão de domínio.
`validate-supabase-baseline-functional.mjs` não executado: cria fixtures de
domínios não afetados na stack compartilhada, que não recebeu as migrations
novas; substituído nesta execução pela cadeia completa em banco descartável e
provas funcionais diretamente afetadas.

### Riscos residuais e próxima validação

1. `DEDUPLICATION_WINDOW = bounded by retention`: após exclusão, replay muito
   tardio do mesmo ID poderá inserir novamente, com novo server_received_at.
   Telemetry não fornece deduplicação permanente nem verdade histórica.
   Inferência PostgreSQL: replay do mesmo ID durante sua exclusão não commitada
   pode aguardar a transação por unicidade; SKIP LOCKED protege candidatos do
   purge concorrente, não elimina essa espera normal de conflito do INSERT.
2. 30 dias é o limiar de elegibilidade, não SLA de exclusão no instante exato:
   cadence diária acrescenta até um intervalo quando não há backlog; mais de
   1.000 expirados/dia pode acumular atraso. Monitorar deleted_count, backlog
   elegível, status/duração e falhas antes de ajustar lote/cadência. Logs cron
   também acumulam histórico; eventual política própria exige decisão separada.
3. DDL de coluna/trigger/índice requer locks e construção de índice. Planejar
   aplicação monitorada em staging primeiro; medir duração/custo/WAL/vacuum
   com volume real. Teste local não é benchmark nem execução remota do scheduler.

Próxima etapa, somente após autorização separada: aplicar ambas as migrations
em staging, confirmar ACL/RLS/clock/index, observar execução real do job e seu
audit trail, validar contagens dirigidas de dados sintéticos elegíveis/recentes
e receipts/replay. Não aplicar em produção por inferência desta evidência local.

`F24_5E3_IMPLEMENTATION = READY_FOR_STAGING_VALIDATION`.
`REMOTE_RETENTION = GAP_CONFIRMED` até aplicação/execução remota observada;
`G09 = PARTIAL`; `F24_5E = PARTIAL`; `F24_5 = NOT_CLOSED`.
Sem commit, push, PR, merge, deploy, migration remota, extensão/cron remoto,
DELETE remoto ou cleanup das fixtures de certificação.

## F24.5E3 — STAGING VALIDATION (aplicação parcial)

Autorização remota específica recebida em 2026-10-08, exclusivamente para
`zqloazqzhwauamcejmuz`. Etapas A/B executadas; C–F pendentes por indisponibilidade
do canal de sessão normal da fixture. Nenhum resultado de purge foi inferido
da instalação do scheduler. Não houve falha SQL nem bloqueador de segurança
observado; esta execução ainda não atende aos critérios de STAGING_CERTIFIED.

### Precheck e BEFORE

`git fetch origin --prune` concluído. Branch e HEAD preservados:
`codex/f24-5e2-remote-telemetry-certification`,
`f4c90e89a94b4a1b27032411c678569579b13dd1`;
origin/main=`c9c72922c97ec1a83f84bf3ff8553285aa63a892`.
Nenhum avanço/diff de main nas migrations, telemetry, telemetry-ingest ou
contrato RLS relevante. Worktrees e alterações locais E2/E3 preservadas.

Projeto reconfirmado por get_project: ref/id exatos, ACTIVE_HEALTHY,
PostgreSQL remoto `17.11.0.002`. BEFORE às 20:17:21.485877 UTC:
server_received_at ausente; pg_cron não instalado; cron.job ausente;
funções E3 ausentes. Extensão 1.6.4 disponível; cron.database_name=postgres,
cron.timezone=GMT, cron.log_run=on. Owners sintéticos A/FARM_A e B/FARM_B ativos.

Tabela com 37 métricas preexistentes. Snapshot sem payloads individuais:
digest agregado dos registros originais
`a2d1e2d4c6b4086d71f902503211aaeb`. RLS enabled=true, FORCE=false,
owner postgres. ACL da tabela: postgres=arwdDxtm, authenticated=ar;
policies metrics_insert_member WITH CHECK has_membership(fazenda_id) e
metrics_select_member USING has_membership(fazenda_id), ambas para public.

### Aplicação exata e contrato AFTER

Os dois arquivos locais foram lidos como bytes e enviados sem edição ao
apply_migration do connector Supabase. Nenhuma credencial administrativa de
processo foi usada como sessão de usuário final.

| Arquivo / identificação | Resultado observado |
| --- | --- |
| 20261008120753_f24_5e3_remote_telemetry_retention.sql | success=true; SHA256 `0FC59FAE328862B98E66F25126A40E8DDE06DF6581DE31EEC88679FD90E5E2DB` |
| 20261008120800_f24_5e3_remote_telemetry_retention_cron.sql | success=true; SHA256 `FD8CA0CECA2D6C1FD70ABE2A8A9B0D7E383F9EB0BB4B78364953F4EB66A5AACC` |
| Histórico remoto pelo connector | name=f24_5e3_remote_telemetry_retention, version=20261008202000; name=f24_5e3_remote_telemetry_retention_cron, version=20261008202024 |

O connector atribuiu versões de aplicação diferentes dos timestamps dos nomes
locais. Conteúdo SQL aplicado sem alteração; nenhuma renumeração/repair de
histórico ou alteração dos arquivos locais executada. Alinhamento da identidade
de migrations para futuro uso da CLI fica pendente do rebaseline autorizado;
não executar db push presumindo que timestamps local/remoto já coincidem.

AFTER migration 1: coluna timestamptz, NOT NULL, DEFAULT now(); trigger
metrics_events_stamp_server_received_at ativo (tgenabled=O), BEFORE INSERT.
Índice (server_received_at,id) presente; os dois índices anteriores preservados.
Função purge owner postgres, SECURITY INVOKER (prosecdef=false), search_path
vazio, definição correspondente ao lote/cutoff/SKIP LOCKED versionados.
ACL da função exclusivamente postgres=X: PUBLIC, anon, authenticated e
service_role sem EXECUTE, confirmado por catálogo/has_function_privilege.
RLS, policies e ACL de tabela idênticas ao BEFORE.

Backfill: todas as 37 linhas com
server_received_at=`2026-10-08T20:20:00.791056+00:00`; min=max, zero NULL e zero
elegíveis a 30 dias. Digest dos dados sem a coluna nova igual ao BEFORE,
confirmando preservação de created_at e dos demais campos originais.

AFTER migration 2 às 20:20:38.3734 UTC: pg_cron 1.6.4 instalado;
job definitivo único, jobid=1, name=metrics-events-retention-daily,
schedule=`0 3 * * *`, command=`SELECT public.purge_expired_metrics_events();`,
username=postgres, database=postgres, active=true. Sem execução registrada
nesse instante; 37 métricas totais e zero elegíveis. Nenhum purge manual.

### Advisors e limite de execução

Advisors security/performance coletados antes e depois do DDL. Comparação por
categoria/detalhe/objeto, ignorando observed_at: nenhum novo achado de segurança.
Único novo achado performance relevante: INFO unused_index para
idx_metrics_events_server_received_id, recém-criado e ainda sem purge observado.
Manter índice necessário ao contrato; aviso não comprova defeito.
[Referência do advisor unused_index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
Achados preexistentes não são atribuídos a E3 nem corrigidos nesta execução.

Canal administrativo de processo presente, mas sem sessão normal disponível
para as fixtures. Verificação de presença, sem ler/imprimir valores:
F24_USER_A_ACCESS_TOKEN=MISSING; F24_USER_A_EMAIL=MISSING;
F24_USER_A_PASSWORD=MISSING. Solicitação de canal normal apresentada ao usuário.
Não buscar credenciais em repositório/histórico/logs, não fabricar JWT, resetar
senha nem substituir a sessão normal por admin/service-role.

Assim, nenhum METRIC_EXPIRED_TEST/METRIC_RECENT_CONTROL criado, nenhum aging,
job temporário, execução de certificação ou replay após purge nesta execução.
Inventário criado: coluna/trigger/índice/funções/ACLs E3, extensão pg_cron e
job definitivo 1; zero métricas de teste novas. Fixtures E2A/E2B preservadas.

| Gate | Estado observado |
| --- | --- |
| MIGRATION_1 | APPLIED |
| MIGRATION_2 | APPLIED |
| SERVER_RECEIVED_AT | Catálogo/trigger confirmados; prova dinâmica remota NOT_EXECUTED |
| BACKFILL | PROVEN |
| RETENTION_FUNCTION_ACL | PROVEN |
| RLS_PRESERVED | PROVEN |
| PERMANENT_CRON_INSTALLED | PROVEN |
| TEMP_VALIDATION_CRON_EXECUTED | NOT_EXECUTED |
| CRON_JOB_RUN_DETAILS | Relação instalada; execução real NOT_PROVEN |
| EXPIRED_SYNTHETIC_REMOVED | NOT_EXECUTED |
| RECENT_SYNTHETIC_PRESERVED | NOT_EXECUTED |
| DEDUPLICATION_WINDOW | bounded by retention, contrato/teste local; replay remoto pós-purge NOT_EXECUTED |

`F24_5E3 = PARTIAL`, pendente de sessão normal para completar C–F.
`REMOTE_RETENTION = PARTIAL` (instalada, execução real ainda não certificada);
`G09 = PARTIAL`; `F24_5E = PARTIAL`; `F24_5 = NOT_CLOSED`.
Não promover STAGING_CERTIFIED, PROVEN agregado ou READY_FOR_CLOSEOUT.
Somente este relatório alterado nesta etapa; migrations/teste local preservados.
Gates documentais e diff check finais registrados na resposta desta execução.
Sem testes locais repetidos, produção, Edge/runtime/RLS/membership alterados,
DELETE de dados, cleanup remoto, commit, push, PR ou merge.

## F24.5E3 — STAGING_CERTIFIED (complemento C–F)

Continuação em 2026-10-08 sob a mesma autorização de staging, acrescida da
autorização explícita para recuperar exclusivamente a senha da fixture USER_A.
A aplicação parcial anterior é um snapshot preservado; este complemento resolve
a pendência de sessão e prova execução real de retenção.

### Recuperação do canal normal e segurança

Auth Admin getUserById confirmou ID exato
`693647f3-9043-437e-bf18-924d39b882aa`, app_metadata.certification_fixture=
f24-5e2a-telemetry-certification e run_id=
`2bb64200-772a-486a-964a-5bea77172145`, além do email sintético esperado,
comparado somente em memória. Marcadores verificados antes da mutação.
Uma senha temporária forte gerada em memória e um updateUserById somente com
password; email, app_metadata e user_metadata retornados idênticos ao BEFORE.
Sem usuários novos, alteração de FARM_A ou memberships.

Cliente separado com chave publishable moderna, persistSession=false,
autoRefreshToken=false, detectSessionInUrl=false; signInWithPassword normal e
getUser confirmaram exatamente USER_A. USER_A_NORMAL_SESSION=PRESENT observado
no processo executor, não inferido da credencial administrativa.
Auth Admin limitado à verificação/recuperação; INSERTs, leituras das duas métricas
e replay realizados pelo cliente da sessão normal de USER_A.
SQL administrativo separado limitado ao aging explicitamente autorizado,
gestão dos jobs e verificações de catálogo/integridade agregada.

O primeiro executor persistente não herdou as variáveis do shell e parou antes
de acessar Auth Admin. Resolvido por canal local transitório em memória, fechado
logo após transferência; sem arquivo de credenciais. Senha, email, JWT, refresh
token e cookies não impressos/persistidos em Git, relatório, arquivo, argv ou URL.
Executor encerrado após a leitura final; memória descartada, sem custódia durável
da senha/sessão e sem revogação/cleanup remoto adicional.

### Fixtures, autoridade de relógio e aging

| Fixture | UUID novo | Estado observado |
| --- | --- | --- |
| METRIC_EXPIRED_TEST | `7e8fcc8f-99e9-4903-af52-ed98ba7a2510` | Inserida, aging dirigido, removida pelo cron, reinserida pelo replay autorizado |
| METRIC_RECENT_CONTROL | `0c8d41bc-adc2-46b4-9982-976e87b124d8` | Inserida e preservada durante purge e replay |

Ambas pertencem a FARM_A=`71d3bd9f-fec1-4439-a96b-6536ebb20cb4`, payload mínimo
explicitamente synthetic=true, run_id existente e probe identificador. Eventos
synthetic.f24_5e3.retention.expired/recent, status info. INSERT REST normal
HTTP 201, duas linhas retornadas. Tentativas de server_received_at em 1900 e
2200 ignoradas: ambas receberam `2026-10-08T20:55:32.001886+00:00` do servidor.
created_at cliente=`2026-10-08T20:55:38.901+00:00` permaneceu intacto; diferença
de relógio local/servidor não controla retenção.

Aging SQL administrativo com WHERE de ID, FARM_A, run_id, probe e synthetic
atingiu exatamente METRIC_EXPIRED_TEST. server_received_at após aging=
`2026-09-07T20:56:03.054567+00:00`; created_at não alterado. Leitura normal
HTTP 200 confirmou as duas linhas e o controle recente intacto.
Isso é manipulação de fixture temporal, não comportamento normal do produto.
Precheck de purge: uma elegível, zero elegíveis fora da fixture autorizada,
nenhum job temporário prévio. Nenhum aging em métrica histórica.

### Execução real e remoção do job temporário

Criado job `2`, name=
`cert-temp-f24-5e3-2bb64200-772a-486a-964a-5bea77172145`,
schedule=`* * * * *`, command=`SELECT public.purge_expired_metrics_events();`,
username=postgres, database=postgres. Guard SQL exigiu executor esperado,
ausência de outra métrica elegível e ausência de job temporário homônimo.
Schedule definitivo não alterado.

| cron.job_run_details | Resultado real |
| --- | --- |
| jobid / runid | 2 / 1 |
| username / database | postgres / postgres |
| status | succeeded |
| start_time UTC | 2026-10-08 20:57:00.103342+00 |
| end_time UTC | 2026-10-08 20:57:00.110041+00 |
| duração | 6,699 ms |
| return_message | 1 row; significa uma linha de resultado do SELECT, não contagem de DELETE |

Após a execução, SELECT REST normal de USER_A filtrado aos dois IDs retornou
somente o controle recente (HTTP 200): vencida zero linhas, controle uma linha,
timestamp original preservado. Total 39→38 linhas; as 37 anteriores conservam
contagem e digest `a2d1e2d4c6b4086d71f902503211aaeb`. Remoção da fixture e
preservação dos demais dados comprovadas conjuntamente; nenhum DELETE genérico
nem chamada manual do purge. Não inferida exclusão apenas de HTTP ou do receipt
do cron.

cron.unschedule executado somente para jobid=2 com guard de nome e username;
retornou true. Zero jobs temporários correspondentes no catálogo após remoção;
job_run_details preservado. Job definitivo `1` continua único, active=true,
postgres, command correto e schedule `0 3 * * *`.

### Replay pós-purge e inventário final

Após comprovar ausência e remover o job temporário, mesmo ID vencido reenviado
por USER_A com ON CONFLICT(id) DO NOTHING, HTTP 201, uma linha retornada.
Novo server_received_at=`2026-10-08T20:57:44.718517+00:00`, posterior à primeira
ingestão; created_at original preservado. SELECT normal final HTTP 200 confirma
as duas métricas, controle ainda com timestamp inicial. Não é falha da retenção:
`DEDUPLICATION_WINDOW = bounded by retention`, agora também observado remotamente.

Inventário final: 39 métricas (37 originais preservadas + duas fixtures E3),
zero elegíveis, zero jobs temporários, job diário 1 preservado. As fixtures
E2A/E2B não sofreram cleanup. Coluna/trigger/índice/funções/pg_cron permanecem.
RLS/policies/grants finais iguais aos BEFORE; SECURITY INVOKER mantido e EXECUTE
ausente para PUBLIC, anon, authenticated e service_role. Nenhum bloqueador de
segurança observado no escopo autorizado. Probes de isolamento antigos não
repetidos; suas evidências G09 e as policies preservadas continuam aplicáveis.
Advisors após DDL registrados na seção anterior: nenhum novo achado security;
INFO unused_index do índice novo, sem alteração de contrato para silenciar aviso.

### Gates e classificação vigente

| Gate | Classificação / evidência |
| --- | --- |
| MIGRATION_1 / MIGRATION_2 | APPLIED / APPLIED, SQL exato conforme seção anterior |
| SERVER_RECEIVED_AT | PROVEN_SERVER_AUTHORITY: 1900/2200 substituídos pelo relógio remoto |
| BACKFILL | PROVEN: 37 registros, timestamp da migration, dados originais preservados |
| RETENTION_FUNCTION_ACL | PROVEN: quatro roles restritas sem EXECUTE |
| RLS_PRESERVED | PROVEN: snapshot final idêntico |
| PERMANENT_CRON_INSTALLED | PROVEN: job 1 único, postgres, 0 3 * * * |
| TEMP_VALIDATION_CRON_EXECUTED | PROVEN: job 2 / run 1, succeeded |
| CRON_JOB_RUN_DETAILS | PROVEN: start/end/duração reais preservados |
| EXPIRED_SYNTHETIC_REMOVED | PROVEN: zero linhas por leitura normal antes do replay |
| RECENT_SYNTHETIC_PRESERVED | PROVEN: uma linha e relógio original intacto |
| DEDUPLICATION_WINDOW | bounded by retention: mesmo ID reinserido com novo relógio remoto |

`REMOTE_RETENTION = PROVEN`; `G09 = PROVEN`;
`F24_5E3 = STAGING_CERTIFIED`; `F24_5E = READY_FOR_CLOSEOUT`;
`F24_5 = READY_FOR_CLOSEOUT`, ainda não CLOSED.
Prova do scheduler por job temporário usando a função definitiva; o disparo
diário do job permanente não foi antecipado nem alegado como observado.
Evidência de escala/custo permanece limitada ao teste sintético e à política
inicial de 1.000/dia, sem stress/load test. Preservados os limites anteriores
de lost ACK físico e app completo; não ampliados por esta certificação.

Pendências reais de closeout: revisão final do diff, autorização futura para
commit/PR/merge e rebaseline; alinhar versões local/remota de migrations antes
de usar db push, conforme inventário anterior. Nenhum repair automático,
alteração de SQL/migration local, produção, Edge/frontend/runtime, RLS,
membership, novo usuário/fazenda, cleanup de fixtures, commit/push/PR/merge.
Somente este relatório atualizado. git diff --check e pnpm run gates:docs
executados ao final; resultados registrados na resposta, sem repetir suítes
locais que a aplicação remota não poderia afetar.

## F24.5E — Closeout técnico local / migration history gate

Execução em 2026-10-08, sem commit/push/PR/merge, aplicação remota ou repair.
Precheck: git fetch origin --prune concluído; branch
codex/f24-5e2-remote-telemetry-certification, HEAD
f4c90e89a94b4a1b27032411c678569579b13dd1 e origin/main
c9c72922c97ec1a83f84bf3ff8553285aa63a892 preservados. Sem avanço nas áreas
relevantes. Worktree C:/Users/mares/dyad-apps/GestaoAgro e diff E2/E3 preservados;
sem reset/rebase. Projeto vinculado reconfirmado no project-ref como staging
zqloazqzhwauamcejmuz, antes de executar migration list.

### Rename autorizado e hashes

| Nome original de criação local | Nome físico alinhado ao histórico remoto | SHA256 antes = depois |
| --- | --- | --- |
| 20261008120753_f24_5e3_remote_telemetry_retention.sql | 20261008202000_f24_5e3_remote_telemetry_retention.sql | 0FC59FAE328862B98E66F25126A40E8DDE06DF6581DE31EEC88679FD90E5E2DB |
| 20261008120800_f24_5e3_remote_telemetry_retention_cron.sql | 20261008202024_f24_5e3_remote_telemetry_retention_cron.sql | FD8CA0CECA2D6C1FD70ABE2A8A9B0D7E383F9EB0BB4B78364953F4EB66A5AACC |

SQL byte-equivalent; nenhum comentário/DDL alterado. Harness atualizado somente
nas duas constantes de filename. Referências físicas da seção de implementação
apontam para os nomes novos; nomes e horários originais de criação/aplicação nas
evidências históricas preservados. As duas migrations continuam untracked;
rename físico não foi apresentado como rename já indexado/commitado no Git.

### Migration list: E3 alinhada, divergência adicional descoberta

`supabase migration list` executado com exit 0 contra staging vinculado.

| LOCAL | REMOTE | Resultado |
| --- | --- | --- |
| 20261008202000 | 20261008202000 | E3 alinhada |
| 20261008202024 | 20261008202024 | E3 cron alinhada |
| 20261005175412 | ausente | Outra divergência, fora do patch E3 |

As demais 57 entradas retornadas estão alinhadas. Aviso benigno da CLI:
Skipping migration AGENTS.md, pois não corresponde ao padrão de arquivo SQL.

A migration divergente é
supabase/migrations/20261005175412_f24_4e_lot_pasture_subject_boundary.sql.
git ls-tree confirma que já existe em HEAD e origin/main; git log -1 desse
arquivo aponta o commit 2f8ba2d2824d8c09d52f3412fad75ecb7f977c2e,
fix(f24.4e): preserve lot pasture movement boundary. Não introduzida pelo rename
E3. A ausência remota foi observada agora no gate; não há evidência anterior
nesta certificação que permita alegar quando ocorreu ou que seja aceita.

Condição de parada aplicada conforme o pedido: ao encontrar outra divergência,
registrar e parar para análise, sem repair automático. Nenhuma mudança desse
arquivo, do histórico remoto ou de staging foi feita. Este achado bloqueia o
gate de closeout solicitado, sem afirmar regressão ou falha de segurança E3.

`LOCAL_MIGRATION_HISTORY = ALIGNED` e `REMOTE_MIGRATION_HISTORY = ALIGNED`
somente no recorte E3; histórico global não pode receber ALIGNED enquanto houver
a linha local-only acima. Pendente determinar o tratamento autorizado da
divergência F24.4E, sem ampliá-lo implicitamente para esta execução.

### Revisão e validação interrompidas

Escopo local após rename: duas migrations E3, harness PostgreSQL de retenção e
este relatório. Staged vazio; nenhum runtime/Edge/RLS alterado por este closeout.
Revisão integral e aprovação final não declaradas: interrompidas no migration
history gate. Teste PostgreSQL pós-rename e node --check não executados após a
condição de parada; não alegar os testes anteriores como execução pós-rename.
Nenhum E2B/G10/probe remoto/cron real, regressão global ou build repetido.
git diff --check e gates:docs limitados à verificação documental do registro de
bloqueio; resultado final registrado na resposta desta execução.

Certificação observada permanece:
`REMOTE_RETENTION = PROVEN`; `G09 = PROVEN`; `F24_5E3 = STAGING_CERTIFIED`;
`DEDUPLICATION_WINDOW = bounded by retention`.
Snapshots PARTIAL/GAP_CONFIRMED anteriores são fatos históricos superados pela
certificação E3, sem exclusão nem alteração retroativa de suas evidências.

`F24_5E_CLOSEOUT_REVIEW = BLOCKED`;
`F24_5E = BLOCKED` no closeout;
`F24_5 = BLOCKED` no closeout, ainda não CLOSED.
Sem commit, push, PR, merge, deploy, mutation/repair remoto ou cleanup de fixtures.

## Reconciliação staging — drift preexistente F24.4E

Executada em 2026-10-08 sob autorização específica para aplicar somente
20261005175412_f24_4e_lot_pasture_subject_boundary em zqloazqzhwauamcejmuz.
Não é nova certificação de retenção nem retomada automática do closeout local.

### Precheck e aplicação

git fetch origin --prune concluído; branch/HEAD/origin/main e worktree
permaneceram os do closeout anterior. Diff local F24.5E preservado.
get_project reconfirmou ref exato, ACTIVE_HEALTHY e PostgreSQL 17.11.
BEFORE confirmou version 20261005175412 ausente e definição antiga do guard:
o detalhe era classificado por from_lote_id IS NOT NULL OR to_lote_id IS NOT NULL
OR pai factual animal. SCHEMA_DRIFT=CONFIRMED, não apenas drift de histórico.

Arquivo SQL local idêntico a HEAD/origin/main; SHA256
253562A0B6C1CFC77924F8DDA86444B4A169A09AD94F727345B88655792478A7.
`supabase db push --linked --include-all --skip-vault --dry-run` mostrou
exclusivamente essa migration pendente, sem seeds/roles. Executado depois
`supabase db push --linked --include-all --skip-vault --yes`:
exit 0, aplicada somente 20261005175412, sem vault/seed/roles, repair,
substituição de SQL ou reaplicação E3. Nenhuma alteração local do arquivo SQL.

AFTER: definição real de guard_animal_lot_fact_insert_v1() corresponde à
migration. Eventos parentais de movimentação com animal_id classificam Animal;
eventos_movimentacao consulta esse pai por evento_id/fazenda_id. A decisão não
depende isoladamente de from_lote_id/to_lote_id. Bypass privado do executor
especializado preservado conforme contrato existente.

### Probes funcionais reais, escopo DB, rollback

Caminho determinado antes da criação: teste factual subject guard em
supabase/tests/animalLotMovementFoundation.test.ts e scaffolding existente em
scripts/codex/validate-movement-server-foundation.mjs. O runner local bloqueia
alvos remotos e não foi relaxado nem executado contra staging.
Adaptados somente seus casos mínimos para um bloco transacional SQL remoto,
com IDs novos e objetos exclusivamente sintéticos; sem dados reais reutilizados.

Fixture transitória: um usuário Auth sem senha, uma fazenda, membership cowboy,
dois lotes, dois pastos e um animal. UUIDs de rastreabilidade:
user=e66ff815-f5b3-42b7-8aa2-8e6043f1debf;
farm=fa35f06f-69ee-4718-ac0e-3c21070a43ce. Nenhuma fixture permaneceu.
Setup administrativo restrito à subtransação de teste; inserts funcionais e
RPC executados sob SET LOCAL ROLE authenticated e auth.uid() sintético
correspondente à membership. Prova PostgreSQL de trigger/RLS/RPC, não login
HTTP/SDK nem recertificação de Auth E2. Nenhuma policy/grant desabilitada.

| Contrato | Resultado efetivamente observado |
| --- | --- |
| Lote→Pasto | Parent movimentacao/lote + detalhe com from_lote_id=to_lote_id e destino pasto aceitos; SELECT confirma endpoints |
| Lote→sem pasto | Mesmo fluxo com to_pasto_id NULL aceito; SELECT confirma NULL e demais endpoints |
| Animal→Lote genérico, parent | INSERT bloqueado com 42501 e mensagem exata GENERIC_ANIMAL_MOVEMENT_WRITER_DISABLED |
| Animal→Lote genérico, detalhe | INSERT sobre parent animal real também bloqueado com a mesma mensagem/SQLSTATE, não apenas conflito de unicidade |
| apply_animal_lot_movement_v1 | STATE_APPLIED, actor_id esperado, fato/detalhe/receipt únicos, lote de destino correto, movement_version=1 e head_event correspondente |

No final, exceção controlada capturada reverteu toda a subtransação de fixtures;
as assertivas e o relatório de resultado foram preservados somente em memória.
Verificados current_user restaurado a postgres e ausência de user/farm/membership,
animais/lotes/pastos/eventos/detalhes/receipts vinculados aos IDs sintéticos.
rollback_verified=true observado; nenhum DELETE/TRUNCATE/reset ou cleanup geral.
Falha inesperada teria propagado erro e abortado a transação, sem deixar setup.

### Segurança e histórico AFTER

Snapshots estruturados BEFORE/AFTER idênticos: 10 triggers relevantes,
RLS/FORCE/owner/grants das cinco tabelas (eventos, eventos_movimentacao, animais,
lotes, pastos), 18 policies, metadados do guard e da RPC especializada.
Guard owner postgres, SECURITY INVOKER, search_path=pg_catalog e ACL
postgres=X/postgres preservados. RPC privada manteve owner/SECURITY DEFINER/
search_path/ACL existentes, e MD5 da definição
513bda9b41c0c9e09d16b49b21322a32 inalterado.
Somente o corpo do guard mudou conforme SQL autorizado; nenhuma alteração RLS,
grants, triggers ou Edge fora da migration.

`supabase migration list` AFTER, exit 0: 60 entradas, zero divergências.

| LOCAL | REMOTE |
| --- | --- |
| 20261005175412 | 20261005175412 |
| 20261008202000 | 20261008202000 |
| 20261008202024 | 20261008202024 |

`LOCAL_MIGRATION_HISTORY = ALIGNED`; `REMOTE_MIGRATION_HISTORY = ALIGNED`.
Artefato cli-latest gerado pela CLI retirado do diff; trabalho E2/E3 preservado.
Somente este relatório atualizado para registrar evidência e superar o bloqueio
de histórico anterior. Diff check e gates documentais finais na saída desta
execução; nenhuma suíte global, build, E2B/G10 ou cron de retenção repetidos.

`MIGRATION_20261005175412 = APPLIED`; `SCHEMA_DRIFT = RESOLVED`;
`LOTE_TO_PASTURE_DB = PROVEN`; `LOTE_TO_NO_PASTURE_DB = PROVEN`;
`GENERIC_ANIMAL_TO_LOTE_DB = PROVEN_BLOCKED`; `MOVEMENT_V1 = PRESERVED`;
`RLS_ACL = PRESERVED`; `MIGRATION_HISTORY = ALIGNED`.

`F24_4E_STAGING_DRIFT = RESOLVED`;
`F24_5E_CLOSEOUT_REVIEW = READY_TO_RESUME`, não APPROVED neste recorte.
Preservados `REMOTE_RETENTION = PROVEN`, `G09 = PROVEN`,
`F24_5E3 = STAGING_CERTIFIED`, `DEDUPLICATION_WINDOW = bounded by retention`.
Retomar separadamente os gates locais interrompidos após rename; não declarar
READY_FOR_COMMIT nem CLOSED apenas pela resolução deste drift.
Sem produção, repair, reset, cleanup geral, commit, push Git, PR ou merge.

## F24.5E — Closeout Review retomado / APPROVED

Verificação em 2026-10-08 após a reconciliação F24.4E. Escopo: diff integral
contra HEAD, incluindo os três arquivos untracked, e gates locais pós-rename.
Somente este relatório atualizado nesta retomada; SQL e harness preservados.

### Baseline e histórico

git fetch origin --prune concluído. Branch
`codex/f24-5e2-remote-telemetry-certification`; HEAD
`f4c90e89a94b4a1b27032411c678569579b13dd1`; origin/main
`c9c72922c97ec1a83f84bf3ff8553285aa63a892`; worktree
`C:/Users/mares/dyad-apps/GestaoAgro`. Nenhum avanço nas áreas relevantes;
nenhum checkout/rebase/reset ou alteração dos demais worktrees. Staged vazio.

`supabase migration list` reconfirmado, exit 0, exclusivamente no staging
vinculado `zqloazqzhwauamcejmuz`: 60 entradas, zero divergências. As versões
20261005175412, 20261008202000 e 20261008202024 possuem LOCAL = REMOTE.
Histórico global ALIGNED; não apenas o recorte E3. Aviso de AGENTS.md ignorado
pela CLI é benigno. Nenhuma mutação remota nesta retomada.

### Revisão integral e segurança

Revisados o diff documental completo e os três arquivos novos completos:

- `supabase/migrations/20261008202000_f24_5e3_remote_telemetry_retention.sql`;
- `supabase/migrations/20261008202024_f24_5e3_remote_telemetry_retention_cron.sql`;
- `tests/codex/telemetry-retention-postgres.integration.mjs`;
- `docs/review/F24_5E_INTEGRATED_OBSERVABILITY_CERTIFICATION.md`.

Hashes SQL iguais aos registrados no rename e na aplicação certificada.
Relógio server_received_at imposto no INSERT; backfill conservador e created_at
preservado. Cutoff estrito de 30 dias, lote 1.000, ordem timestamp/id e SKIP LOCKED
coerentes. SECURITY INVOKER, search_path vazio, owner postgres e revokes para
PUBLIC/anon/authenticated/service_role mantidos; nenhuma mudança de RLS ou grants
de tabela. Cron versionado único, diário às 03:00 UTC, sem fixtures/jobs temporários.

Harness limitado ao Docker/PostgreSQL local: banco aleatório exclusivo, credencial
local somente em memória, finally encerra conexões e descarta o banco criado.
Cron validado em transação revertida no postgres local, sem agendamento persistente.
Nenhum caminho remoto ou mudança de runtime para facilitar teste.

Scan das linhas adicionadas do relatório e conteúdo integral dos arquivos novos,
com revisão dos usos de credenciais: nenhum valor de secret key, JWT, refresh
token, senha, email completo das fixtures ou credencial PostgreSQL encontrado.
PGPASSWORD="$POSTGRES_PASSWORD" é referência literal à variável do container;
Authorization Bearer synthetic-harness é dado fictício local, sem token real.
Nomes de variáveis e padrões de email com placeholder não são segredos.
Findings: BLOCKER = 0; IMPORTANT = 0; MINOR = 0.

### Gates observados após rename

| Comando | Resultado |
| --- | --- |
| node tests/codex/telemetry-retention-postgres.integration.mjs | Exit 0; PostgreSQL 17.6, 58 migrations anteriores, 13 casos agrupados PASS; banco exclusivo DISPOSED |
| node --check tests/codex/telemetry-retention-postgres.integration.mjs | Exit 0 |
| pnpm run gates:docs | PASS: headers, continuidade e contrato documental |
| git diff --check | Exit 0; sem erros de whitespace |

Teste pós-rename executado efetivamente nesta retomada. Gates documentais e diff
check repetidos após este registro final. Não repetidos E2B, G10, cron remoto,
provisioning, retenção staging, suíte global ou build: fora do escopo solicitado.

### Classificação e limites

`REMOTE_RETENTION = PROVEN`; `G09 = PROVEN`; `F24_5E3 = STAGING_CERTIFIED`;
`F24_4E_STAGING_DRIFT = RESOLVED`; `LOCAL_MIGRATION_HISTORY = ALIGNED`;
`REMOTE_MIGRATION_HISTORY = ALIGNED`; `DEDUPLICATION_WINDOW = bounded by retention`.
Snapshots anteriores PARTIAL/GAP_CONFIRMED/BLOCKED preservados como históricos.

Riscos aceitos no escopo: replay após purge pode reinserir o mesmo ID; cadence de
1.000/dia pode acumular backlog; lost ACK físico e aplicativo completo autenticado
continuam além da evidência certificada. Nenhum desses limites foi promovido
a prova adicional nesta revisão. Produção não foi validada nem alterada.

`F24_5E_CLOSEOUT_REVIEW = APPROVED`; `F24_5E = READY_FOR_COMMIT`;
`F24_5 = READY_FOR_COMMIT`. Não CLOSED. Aprovação técnica não executa nem autoriza
automaticamente stage/commit/push/PR/merge. Nenhuma migration, repair, deploy,
mutação staging ou cleanup remoto nesta retomada.
