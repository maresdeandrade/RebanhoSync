# F24.4F — Integrated Certification

Atualizado em: 2026-10-06
Tipo: evidência de certificação local integrada; execução original preservada.

## Estado operacional atual — integração em 06/10/2026

`F24_4F = CLOSED / INTEGRATED`; `F24_4 = CLOSED / INTEGRATED` no escopo da matriz
abaixo. PR #181 MERGED em `main@3da8c89a5dd8c2d793d8d34af749a68c9c81f59a`;
candidate integrado `e7fc3b56e2c0051a84f0d54ba2364b3168d0f0b4`.
O fetch e a comparação de árvores no closeout documental de 06/10 confirmaram a
integração do patch. Testes abaixo são resultados da execução original, sem nova
certificação funcional neste closeout. Resíduos aceitos e produção não autorizada
permanecem. Próxima trilha: F24.5 IN_PROGRESS; F24.5A READY_FOR_REVIEW (review APPROVED),
F24.5B NEXT / abertura lógica. O relatório a seguir é HISTORICAL_CORRECT / SUPERSEDED
quanto a READY_FOR_REVIEW, baseline pré-merge e próximo passo de revisão.

## Decisão e baseline real

`F24_4F = READY_FOR_REVIEW`; verification gate lifecycle: `READY`.
Não constitui fechamento da F24.4F/F24.4 nem autorização de publicação.

- Branch: `feat/f24-4f-integrated-certification`.
- HEAD e `origin/main`, após `git fetch origin --prune`: `7760741c26de915cf185b033e3ffd6c29908fee7`.
- Baseline conhecido permaneceu atual; nenhum commit novo a analisar.
- Worktree inicial: tracked, staged e untracked limpos.
- Candidate: alterações locais sobre esse HEAD, sem SHA próprio e sem commit.
- Ambiente: Windows, Chromium/Playwright, BrowserContexts com IndexedDB independente,
  Auth/Edge/PostgREST/PostgreSQL do Supabase local, endpoints verificados como loopback.
- Runners de transporte/finalização executados com `REBANHOSYNC_DISPOSABLE_LOCAL_DB=1`.
  Credenciais obtidas em memória via `supabase status -o env`, sem impressão/persistência.

## Alterações e blocker demonstrado

| Arquivo | Tipo | Alteração |
|---|---|---|
| `e2e/f24-4d6-cross-device-farm-switch.spec.ts` | Teste | Estende o harness D6 para enviar e reconciliar A com B ativa; perda do pull imediato após ACK |
| `src/lib/offline/syncWorker.ts` | Runtime | Inclui `animais` no refresh e na obrigação factual após UPDATE integralmente aplicado |
| `src/lib/offline/__tests__/reconciliationObligations.test.ts` | Teste | Obligation completa sobrevive à falha do pull imediato e drena com merge em fazenda não ativa |
| `docs/review/F24_4F_INTEGRATED_CERTIFICATION.md` | Docs | Evidência permanente e limites desta execução |

`PATCH = RUNTIME_PATCH_REQUIRED`; `RUNTIME_PATCH = YES`.

FATO CONFIRMADO: antes do patch de runtime, UPDATE em A retornou HTTP 200/APPLIED,
avançou a revisão remota de 1 para 2 e preservou a identidade original. O ACK criou
obrigação factual apenas para `agenda_itens`. O drain removeu essa obrigação, mas o
snapshot local do animal permaneceu na revisão 1, embora B continuasse ativa.
O teste falhou na asserção de convergência do animal para revisão 2.

A primeira tentativa também falhou ao exigir `animais` na obrigação; essa exigência
foi retirada temporariamente para observar o drain real, que confirmou a falta de
convergência. A obrigação com `animais` voltou a ser exigida após a correção.

INFERÊNCIA: a próxima intenção baseada nesse snapshot poderia capturar
`expected_revision=1` e conflitar com a revisão 2, sem concorrência adicional.
Não foi necessário enviar uma segunda intenção para comprovar a divergência local/remota.

Correção mínima: no ramo `allApplied`, operações UPDATE cujo remote table é `animais`
adicionam essa tabela ao conjunto já usado pelo pull pós-ACK e pela obrigação durável.
Não se incrementa revisão local; a autoridade permanece no snapshot do servidor.
Não houve alteração de writer, envelope, CAS, schemas, migrations, RLS ou RPCs.
O caminho de resultado misto/rejeição e a política de conflitos permanecem existentes.

Blocker encontrado: convergência CAS incompleta após ACK de UPDATE animais.
Blocker corrigido e recertificado no escopo acima; nenhum blocker remanescente observado
nas suítes executadas. Não se aplica `NO_RUNTIME_BLOCKER_FOUND` à execução pré-patch.

## Non-active farm — cenário e resultado observado

1. Context A seleciona A pelo selector real; Context B independente seleciona B.
2. Context A cria UPDATE offline em A e captura op/tx/expected_revision originais.
3. Reabre transporte com scheduler parado para usar o selector real, que valida membership;
   troca A→B e executa replace de B preservando pending de A.
4. Exercita novo offline/reconnect com B ativa, sem retornar a A.
5. Envia a gesture original de A pelo `processGesture`, Auth/Edge/CAS reais.
6. Bloqueia apenas o GET de animais de A no pull imediato pós-ACK. Observa DONE/APPLIED,
   op consumida e obrigação factual contendo `animais`; animal local ainda na revisão 1.
7. Remove a interceptação e executa somente `drainReconciliationObligations(A)`.
8. Observa A na revisão 2, obrigação removida, B ainda ativa, cache de B idêntico,
   estado remoto de B idêntico e Context B inteiramente inalterado.
9. Somente após essas asserções retorna a A e verifica os pulls finais.

`NON_ACTIVE_FARM_RECONCILIATION_CROSS_DEVICE = PROVEN`.

Pending/identidades/revisão esperada permanecem estáveis até aplicação. A identidade
remota corresponde à op/tx original; não há write remoto em B nem contaminação cross-farm.
Membership owner é verificada nos browsers e outsider autenticado não lê nem altera
animais das fixtures via RLS. Scheduler é controlado; o teste certifica o executor e
drain reais, sem alegar despacho automático irrestrito para toda fazenda inativa.

Semântica merge: o E2E observa recuperação de A sem destruir B. A seleção explícita
de `mode: "merge"` é comprovada pela regressão de obligations e pelo código
`getReconciliationPullMode`/`executeReconciliationForScope`; o E2E não espiona módulos
nem fornece um override de modo ao drain. Replace farm-aware e merge são também
caracterizados pela suíte `farmSwitchReplace.characterization.test.ts`.

## Matriz F24.4F

Todas as evidências abaixo foram executadas nesta sessão sobre o candidate.

| Cenário | Evidência permanente | Resultado observado | Classificação |
|---|---|---|---|
| CROSS_DEVICE_INTEGRATED | D1, D2/D3, D5, D6; movimento E5 | Stores independentes, concorrência e convergência | PROVEN |
| OFFLINE_RECONNECT | D2/D3, D5, D6; movimento E2/E3 | Operações offline aplicadas após reconnect | PROVEN |
| FARM_SWITCH_CROSS_DEVICE | D6; movimento E8/R2 | Selector real preserva pending e separação A/B | PROVEN |
| NON_ACTIVE_FARM_RECONCILIATION_CROSS_DEVICE | D6 alterado + obligations | Drain de A recupera revisão com B ativa | PROVEN |
| RETRY_REPLAY | D4, D8; transporte T3/T6; movimento E6 | Identidade preservada, sem reaplicação | PROVEN |
| LOST_ACK_REPLAY | D4; transporte T3; movimento E6 | ACK perdido após commit, replay sem segundo efeito | PROVEN |
| STALE_CONFLICT_TERMINALITY | D2/D3, D5, D8; stateConflictSyncBatch | Stale terminal; nova intenção exige nova identidade | PROVEN |
| RECOVERY_RECONCILE | D6 + obligations/crashRestart; movimento R2 | Falha de pull mantém obrigação; drain/restart converge | PROVEN |
| ANIMAIS_CAS_CLOCK_AUTHORITY | D7 CAS; stateConflictConcurrency | Revisão/CAS server-side determina vencedor nas ordens testadas | PROVEN |
| MOVEMENT_CAUSAL_CLOCK_REORDERING | foundation operational-clock; completion D2 reverse/chain; E3/E4 | Selectors causais convergem sob chegada invertida; relógio não substitui CAS | PROVEN |
| QUEUE_CLOCK_BEHAVIOR | D8; crashRestart | Clock pode adiantar/atrasar retry e reordenar fila; identidade/terminalidade preservadas | CHARACTERIZED |
| ANIMAL_TO_LOTE_SPECIALIZED | Foundation/completion/transport; finalization E1–E10/R2 | Writer especializado, fatos/receipt/estado e boundary genérica | PROVEN |
| MULTI_TENANT_ISOLATION | D6 outsider; transporte T5; stateConflictSyncBatch | JWT/membership/cross-farm inválidos não produzem efeitos autorizados | PROVEN |
| OWNERSHIP_ISOLATION | D1; crashRestart ownership mismatch; stateConflictSyncBatch | Stores/sessão isolados; mismatch bloqueia replay/pull/drain | PROVEN |

Referências de arquivo: D1/D2/D3/D4/D5/D6/D7/D8 correspondem aos sete specs
`e2e/f24-4d*.spec.ts` enumerados nos comandos abaixo; E/R/T correspondem a
`e2e/f24-4e2-movement-finalization.spec.ts` e
`supabase/tests/animalLotMovementTransport.e2e.test.ts`.

## Comandos e resultados observados

| Comando | Resultado |
|---|---|
| `git branch --show-current`; `git fetch origin --prune`; `git rev-parse HEAD origin/main`; status/diff staged/untracked | Baseline confirmado; inicial limpo |
| `pnpm exec playwright test e2e/f24-4d6-cross-device-farm-switch.spec.ts --workers=1` pré-runtime | Falhou: obrigação sem animais; depois, drain deixou revisão local 1 versus remota 2 |
| Mesmo comando pós-runtime | 1/1; versão final com falha do pull imediato: 1/1 (21,7 s) |
| Matriz Playwright abaixo, `--workers=1` | 9/9; versão final 36,8 s |
| `node scripts/codex/validate-movement-server-foundation.mjs` | 58/58 em 4 arquivos; DB temporário criado e removido |
| `node scripts/codex/validate-movement-transport.mjs` | 13/13 em 2 arquivos |
| `node scripts/codex/validate-movement-finalization.mjs` | 12/12 (35,2 s) |
| Vitest focado abaixo | 34/34 em 4 arquivos |
| `pnpm exec vitest run src/lib/offline/__tests__/syncPartialBatch.test.ts src/lib/offline/__tests__/factualDetailsSyncRefresh.test.ts src/lib/offline/__tests__/animalDeletionFlow.test.ts` | 19/19 em 3 arquivos |
| `pnpm exec eslint e2e/f24-4d6-cross-device-farm-switch.spec.ts src/lib/offline/syncWorker.ts src/lib/offline/__tests__/reconciliationObligations.test.ts` | Exit 0; D6 final novamente exit 0 |
| `pnpm run gates:docs` | Exit 0; headers/baselines, continuidade e contrato de governança aprovados |
| `git diff --check` | Exit 0 no patch e na inspeção final |

```powershell
pnpm exec playwright test e2e/f24-4d1-storage-isolation.spec.ts e2e/f24-4d2-same-revision-concurrent-update.spec.ts e2e/f24-4d4-lost-ack-replay.spec.ts e2e/f24-4d5-alternating-reconnect.spec.ts e2e/f24-4d6-cross-device-farm-switch.spec.ts e2e/f24-4d7-clock-skew-authority.spec.ts e2e/f24-4d8-local-queue-clock-skew.spec.ts --workers=1
pnpm exec vitest run src/lib/offline/__tests__/reconciliationObligations.test.ts src/lib/offline/__tests__/farmSwitchReplace.characterization.test.ts src/lib/offline/__tests__/crashRestartCertification.test.ts src/lib/offline/__tests__/stateExpectedRevision.characterization.test.ts
```

Warnings observados: Browserslist desatualizado e NO_COLOR/FORCE_COLOR; não bloquearam
as execuções. Erros de rede em D6/obligations são injeções esperadas e verificadas.
O runner de finalização retém fixtures exclusivamente no ambiente local descartável,
conforme seu comportamento existente. Nenhuma limpeza adicional de dados foi executada.
O arquivo temporário tracked `supabase/.temp/cli-latest`, alterado pelo CLI, foi restaurado
ao baseline; não integra o patch. Logs transitórios de execução ficaram em TEMP;
este relatório e os testes são a evidência permanente versionável.

Validações não executadas: regressão global, build completo, E2E global, deploy,
validação de backend remoto ou rollout. O delta de runtime se limita ao conjunto de
tabelas do refresh existente; suítes focadas de sucesso parcial/refresh/exclusão foram
acrescentadas por esse risco. Não houve mudança de schema, RPC ou backend que exigisse
reexecutar baseline funcional global.

## Resíduos aceitos, fechamento e próximo passo

- `REAL_PHYSICAL_MULTI_DEVICE = NOT_PROVEN / ACCEPTED_RESIDUAL`.
- `ALL_DOMAIN_CLOCK_BEHAVIOR = NOT_PROVEN / ACCEPTED_RESIDUAL`.
- `REAL_PROCESS_KILL = NOT_PROVEN / ACCEPTED_RESIDUAL`; reabertura lógica e BrowserContext
  persistente foram testados, sem alegação de kill físico.

Não se conclui `ALL_STATE_CONFLICTS = SAFE` nem `CLOCK_SKEW_SAFE_FOR_ALL_DOMAINS`.
Sem AUTO_MERGE, field-level merge, dedup heurístico ou extensão de CAS a outros estados.
Contratos Agenda/Evento/state/Protocolo e writer especializado Animal→Lote preservados.

Critério técnico: todos os cenários obrigatórios estão PROVEN, exceto fila/relógio,
que está CHARACTERIZED conforme o aceite. Gate lifecycle: `READY`; diff tracked/staged/
untracked revisado, quatro arquivos no escopo, staged vazio e gates documentais aprovados.
Próximo passo: revisar o patch mínimo e esta evidência; nenhuma criação de PR, commit,
push, merge, migration remota, deploy, rollout ou importação real nesta execução.
