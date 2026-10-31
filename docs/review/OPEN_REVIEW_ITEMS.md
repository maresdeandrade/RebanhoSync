# Pendências abertas — RebanhoSync

Atualizado em: 2026-10-30 (C05 integrado e incremento C06; demais trilhas preservadas)

## Objetivo

Registrar somente itens abertos e acionáveis. O backlog detalhado, critérios e dependências
estão na [baseline F24.0](./F24_RELEASE_READINESS_BASELINE.md).

F24.1 foi fechada após a reconstrução remota, convergência ACL, `sync-batch` e a correção
F24.1D.1 do `sanitario-reconcile`. O fechamento inclui matriz negativa, consumidor
`service_role`, E2E 1/1, replay e limpeza. A F24.2 também está fechada no
[closeout autoritativo](./F24_2_CLOSEOUT_AND_REBASELINE.md). Não existe produção operacional.

## Sanitário V2 — pendências pós-F9

Integração pública F6–F9 encerrada pelo PR #244 em `main@0e7f5137a865f2671d035e51d624609a563e441e`; não é pendência aberta. [Resultado e limites](./LAST_PHASE_RESULT.md). Prioridades abaixo são recomendações para continuidade, não novos bugs confirmados ou autorização de implementação.

| Prioridade | Item aberto e classificação | Fonte / condição de fechamento |
|---|---|---|
| P1 para uso operacional dos produtos | **Curadoria/regulatório:** os 39 produtos importados são de revisão (`precisa_validar`); registro vigente, composição, espécie, dose, via e carência não estão certificados. Três candidatos retidos fora do lote. | [Resumo F6–F9](./SANITARIO_V2_F6_F9_PUBLIC_SUMMARY.md). Exige fontes técnicas e decisão curatorial auditável por produto, em tarefa própria; cadastro comercial não libera operação. |
| P1 antes de certificação completa/rollout | **C06_TECHNICAL_CLOSED / INTEGRATED:** #259–#262 integrados em main@5d472d6. **F24.7_FULL_CERTIFICATION = NOT_CERTIFIED**; integração técnica não autoriza produção. | [Evidências consolidadas](./CURRENT_PHASE_HANDOFF.md#fechamento-técnico-c06--259262-integrados). Próximo gate F24.7: comandos do alvo, critérios PWA/kill/dispositivo e limites operacionais; não definido/executado neste fechamento. Sem nova unidade C06 ou rollout automático. |
| P2, condicionado ao alvo de liberação | **Limite de certificação:** cold start PWA sem shell/assets, crash real de processo e dispositivo físico não certificados pela VF5; nova intenção sem sessão utilizável ficou fora da VF4. | [Limites VF4](./SANITARIO_V2_VF4_VALIDACAO_20261024.md). Definir contrato/critério do alvo antes de testar; não atribuir bug ou prometer escrita sem sessão. |
| P2 independente | **Dívida TypeScript:** 38 diagnósticos preexistentes no escopo `e2e/tsconfig.json`, triados na VF5; não houve nova contagem nesta atividade. | [Triagem VF5](./evidence/SANITARIO_V2_VF5_TYPESCRIPT_TRIAGE_20261024.json). Correção própria e comparação com baseline; não bloquear artificialmente F9 nem declarar TypeScript global aprovado. |

Os guards de automação, inclusive `no_agenda_auto` dos três itens de raiva, permanecem restrições de produto; não são bugs a remover. Catálogo, configuração, planejamento e execução continuam distintos. F24.7/F24.8 e autorização operacional não são encerradas pelo merge #244. Nenhum bug novo foi reproduzido nesta revisão documental.

### F24.1B — isolamento de ambientes

Status: `SUPERSEDED_REMOTE_RECLASSIFIED_DISPOSABLE`

O [inventário histórico](./F24_1B_ENVIRONMENT_ISOLATION_TOPOLOGY.md) foi reclassificado pela
premissa autoritativa: `zqloazqzhwauamcejmuz` é integração descartável, produção não está
provisionada e `ENVIRONMENT_ISOLATION = NOT_REQUIRED_PRE_PRODUCTION`.

### F24.1C — provisionamento de staging

Status: `DEFERRED_SECOND_STAGING_NOT_REQUIRED`

O [contrato de provisionamento](./F24_1C_STAGING_PROVISIONING_CONTRACT.md) foi preservado como
evidência histórica, mas nenhum projeto foi ou deve ser criado agora. A F24.1D usou o remoto
descartável existente e está registrada em
[F24_1D_REMOTE_ACL_REHEARSAL.md](./F24_1D_REMOTE_ACL_REHEARSAL.md).

## F24.4 — fechamento integrado e resíduos aceitos

Status: `F24.4 / F24.4F CLOSED / INTEGRATED`
Baseline integrado: `main@3da8c89a5dd8c2d793d8d34af749a68c9c81f59a`; PR #181 `MERGED`.
Release blocker da matriz F24.4: `RESOLVED_IN_CERTIFIED_SCOPE`.

A [certificação F24.4F](./F24_4F_INTEGRATED_CERTIFICATION.md) concluiu a matriz
integrada e non-active farm cross-device no cenário certificado. Dispositivos
físicos, kill real e clock em todos os domínios continuam NOT_PROVEN / ACCEPTED_RESIDUAL;
demais estados/occupancy/atomicidade universal não foram generalizados. Observabilidade
permanece em F24.5 e certificação sanitária completa em F24.7, sem rollout.

**HISTORICAL_CORRECT / SUPERSEDED — entrada F24.4F em 05/10/2026:**

F24.4A–F24.4D estão encerradas; E está [CLOSED / INTEGRATED pelo PR #178](./F24_4E_CONFLICT_RESOLUTION_CONTRACT.md#estado-operacional-atual). G1, G4, G5 e G3 Animal→Lote estão resolvidos; a regressão do guard Lote→Pasto também foi corrigida, validada localmente e integrada. Animal→Lote permanece integrada pelo PR #175. Permanecem deferidos: demais `state_*` e resíduos Evento→estado no backlog F24.4; matriz integrada, dispositivos físicos, non-active farm cross-device e clock transversal em F24.4F; observabilidade em F24.5. CAS de lote/occupancy e atomicidade universal não foram certificados. Duplicidade humana exige resolução explícita, sem dedup/merge automático. O blocker stale Sanitário foi fechado em 05/10; certificação sanitária completa continua F24.7, sem rollout. A F24.4 permanece release blocker até seu gate integrado; isso não reabre E.

## P1 — Certificação E2E de process kill

Status: `REAL_PROCESS_KILL = NOT_PROVEN`

A F24.3 certificou restart lógico por reabertura Dexie, mas não kill/restart real do
browser/processo com o mesmo perfil persistente e IndexedDB sobrevivente. A dívida não bloqueia
o closeout F24.3; sua incorporação em gate posterior exige decisão explícita.

## F24.5 — reconciliada / CLOSED / INTEGRATED

PR #190 integrada em `4b1c46696c137ae3ec6a24626123804709bcb37c`. A [certificação F24.5E](./F24_5E_INTEGRATED_OBSERVABILITY_CERTIFICATION.md) comprova retenção/G09 e preserva os limites aceitos de evidência. F24.5 não permanece item aberto; volume de telemetry/retention será medido em F24.6, sem reabrir seu contrato.

## P1 — F24.6 Performance / Escala

**F24.6A1 — certificação concluída / fechamento administrativo (13/10/2026):** `RECONNECT_1K = CERTIFIED` em `main@869f006679827f3baddb0afed3c3cbf22e976fa5`: smoke aprovado, 5/5 runs sequenciais de 1.000 gestos, 1.000 animais, duas fazendas 500/500, warm, agenda vazia; mediana 146,46s. ACKs, fila/obrigações zeradas, isolamento, convergência, revisão única e cleanup comprovados no [relatório único](./F24_6A1_RECONNECT_1K_CERTIFICATION.md), com evidências versionadas e hashes auditáveis. Baseline E1/E2 e falhas anteriores preservadas; sem repetição do benchmark nesta publicação.

A F24.6A1 está integrada pelo PR #200, somente no cenário reconnect 1k certificado. O relatório [F24.6A1](./F24_6A1_RECONNECT_1K_CERTIFICATION.md) limita os resultados ao envelope testado; não declara capacidade geral de escala. F24.6A2 é uma proposta de inventário estático descrita no [handoff atual](./CURRENT_PHASE_HANDOFF.md#f246a2-e-trabalho-independente), ainda dependente de escopo e critérios formalizados. Benchmarks, otimizações e rollout não devem começar por inferência.

**F24.6A1-H — snapshot histórico substituído (12/10/2026):** PR [#196](https://github.com/maresdeandrade/RebanhoSync/pull/196) `MERGED` em `6cf239fddf6a33249dbba8ce99de180e1772280e`, head integrado `694f4921d96b4acc7c07eb347d68c2d69e98c6ed`. Patch C+D, remediações Fallow G1/G2 e compatibilidade Vitest G5/G6 integrados. CI incremental [38162109877](https://github.com/maresdeandrade/RebanhoSync/actions/runs/38162109877) e gate completo [38162234927](https://github.com/maresdeandrade/RebanhoSync/actions/runs/38162234927) aprovados; gate completo com build, cleanup, 431 arquivos/3644 testes aprovados e 3 arquivos/59 testes skipped. Os quatro testes de performance executaram seus dez casos. F24.6 permanece ACTIVE; `RECONNECT_1K = NOT_CERTIFIED`, ganho geral de latência/memória NOT_PROVEN.

Baseline operacional observado: `origin/main@cd1855dba81f06c4b49ce29621af5cc20573cae9`. O avanço após #196 é o PR #197 (`605cec2`), restrito a UI de reprodução/parentesco e tsconfig; não altera C+D, testes pós-ACK ou harness. Baseline histórica E1/E2 continua `3b3bc96db331c2917167cf8370024332f505d9f7`; séries, parâmetros, hashes e relatórios históricos preservados. Próxima execução: preparar o harness para adoção explícita do baseline integrado e retomar reconnect 1k conforme o plano no handoff; nenhum benchmark executado em H.

**F24.6A1-E2 — snapshot histórico anterior à integração (SUPERSEDED):** [Seed e comparação A/B](./F24_6A1E2_SEED_DIAGNOSIS_AND_AB_COMPLETION.md) = `READY_FOR_REVIEW`. Série independente do patch final: 5/5 originais e 5/5 otimizados, 100 gestos/duas fazendas, todos íntegros. Medianas: 4.550.194→287.621 bytes, 5200→300 linhas, 16.825,40→16.097,00ms; requests/pulls preservados e intervalos de latência sobrepostos. Instrumentação somente no harness, fontes funcionais e 93 arquivos anteriores preservados. Causa do seed antigo LIMIT_NOT_PROVEN; perda de diagnóstico do wrapper corrigida e prova artificial de captura aprovada, sem atribuir quota real. Probes pequenos e sete checks funcionais PASS; ambiente próprio removido, compartilhado inalterado. Reconnect 1k NÃO CERTIFICADO; sem otimização adicional ou integração autorizada. Checagem final: origin/main avançou para 35df487c2b21b3e98fc27fdd255cf82b80748140 (PRs #193/#194, somente layout Registrar); HEAD e benchmark preservam baseline fixa 3b3bc96d, sem impacto nos módulos exercitados.

**F24.6A1-E1 — snapshot anterior:** [Implementação restrita pós-ACK](./F24_6A1E1_POST_ACK_REFRESH_IMPLEMENTATION.md) = `PARTIAL / BLOCKED_WITH_REASON`. Dois módulos funcionais alterados; 148 testes focados e sete checks com dois clientes reais PASS, inclusive reabertura após fechamento durante o pull. Patch final: 1/5 runs originais e 2/5 otimizados de 100 gestos completos; original 2 falhou durante seed com BROWSER_OPERATION_FAILURE, antes do workload, sem causa capturada. Não substituído por retry. 5200→300 linhas e ~4.55MB→0.288MB nas amostras completas, requests/pulls preservados; sem ganho geral de latência declarado. Cinco amostras por variante ainda não comprovadas; 1k/10k não executados. Três ambientes locais próprios removidos, compartilhado/artifacts antigos preservados. Pendente diagnóstico sanitizado do seed e comparação final completa. Histórico de abertura/caracterização abaixo não substitui essa decisão.

F24.6A0-B: `F24_6A0_BACKEND = READY_FOR_P0_BENCHMARKS`. [Backend local isolado certificado](./F24_6A0B_ISOLATED_LOCAL_BACKEND_CERTIFICATION.md) com 60 migrations, schema/RLS/Auth/PostgREST/Edge verificados, probes pequenos de pull/reconnect aprovados e cleanup confirmado. Banco compartilhado com 54 migrations preservado. [F24.6A1](./F24_6A1_P0_LOCAL_BENCHMARK_CHARACTERIZATION.md): PARTIAL / BLOCKED_WITH_REASON. IndexedDB/fila 60/60; reconnect 100 gestos 5/5, 1k 4/5 com ACK_NOT_CONFIRMED no quinto run; 10k não executado pelo gate. Cleanup e preservação do compartilhado verificados. Não há capacidade geral declarada nem otimização autorizada. [F24.6A1-D](./F24_6A1D_ACK_AND_READ_AMPLIFICATION_DIAGNOSIS.md): diagnóstico PARTIAL; reprodução limitada parou em 240s após 836 ACKs, sem falha de ACK reproduzida; pulls inline consumiram 54.72% do prefixo e 99.8% das linhas em snapshots comparáveis eram equivalentes. Causa original LIMIT_NOT_PROVEN; sem otimização ou 10k. [F24.6A1-E0](./F24_6A1E0_POST_ACK_REFRESH_OPTIMIZATION_DESIGN.md): READY_FOR_IMPLEMENTATION somente para desenho C+D de UPDATE observacoes único, merge dirigido de animais e transação conjunta com agenda integral; nenhuma implementação nesta etapa.

Status: `ACTIVE — F24.6A PERFORMANCE / SCALE BASELINE`
Preparação: [F24.6A0 — Benchmark Rebaseline + Harness Contract](./F24_6A0_BENCHMARK_REBASELINE_AND_HARNESS_CONTRACT.md).
Release blocker: `SIM_PARA_ESCALA_DECLARADA`

Fixtures e workload histórico não equivalem a benchmark de IndexedDB, fila grande,
startup/bootstrap, pull, payload/batches, memória, queries/índices, bundle/chunks ou limites
de escala declarados.

## P1 condicional — F24.7 Recertificação Sync Sanitário v2

Status: `NOT_STARTED` para certificação completa; blocker de plataforma fechado em 05/10/2026.

Código: `SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED`

Release Sanitário v2: não autorizado; demais RPCs e regressão completa continuam pendentes. Ver [evidência canônica de 05/10/2026](../context/PROJECT_STATUS.md#recertificação-remota-stale-sanitário-v2--05102026): PT409, PostgREST 14.18 HTTP 409, supabase-js sem timeout, Edge v27 CONFLICT terminal, ausência de retry storm, stale sem efeitos e cleanup zero.

- manter gate remoto desligado;
- manter feature flag local `false`;
- não autorizar rollout;
- não aumentar timeout nem alterar RPC/SQL sem nova evidência;
- manter importação real não autorizada; recertificação stale não inicia nova fase nem encerra F24.

## P0 final — F24.8 Production Readiness / Canary / Rollback / Release Gate

Status: `BLOCKED_BY_PREREQUISITES`
Release blocker: `SIM`

Produção permanece `NOT_AUTHORIZED`. Canary, rollback e go/no-go dependem dos gates anteriores
e de autorização humana explícita.

## P2 — Ruído residual em testes

Status: `ABERTO_NAO_BLOQUEANTE`

Logs esperados de rollback/rejeição e avisos de Dialog/`act` devem ser controlados localmente,
sem supressão global e sem ocultar erro real.

## P2 — Warnings conhecidos de build

Status: `ABERTO_NAO_BLOQUEANTE`

Browserslist/caniuse-lite e chunks grandes permanecem como insumo de F24.6; não são, por si
sós, release blockers.

## Itens reconciliados

- F24.3 Offline Prolongado + Reconnect + Recovery: `CLOSED`; matriz e limitação residual no
  [closeout canônico](./F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md);
- validação remota de movimentação: `RESOLVED / REMOTE_CONVERGENCE_VERIFIED`;
- Trilha C C2–C7: `RESOLVED / TECHNICAL_CONVERGENCE = CLOSED`;
- promoção de migrations e backoffice: `STILL_OPEN`, preservada para F24.8;
- blocker sanitário: `SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED` em 05/10/2026, sem reabrir a Fase 12 ou autorizar rollout.
