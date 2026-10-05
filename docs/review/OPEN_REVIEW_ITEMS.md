# Pendências abertas — RebanhoSync

Atualizado em: 2026-10-05

## Objetivo

Registrar somente itens abertos e acionáveis. O backlog detalhado, critérios e dependências
estão na [baseline F24.0](./F24_RELEASE_READINESS_BASELINE.md).

F24.1 foi fechada após a reconstrução remota, convergência ACL, `sync-batch` e a correção
F24.1D.1 do `sanitario-reconcile`. O fechamento inclui matriz negativa, consumidor
`service_role`, E2E 1/1, replay e limpeza. A F24.2 também está fechada no
[closeout autoritativo](./F24_2_CLOSEOUT_AND_REBASELINE.md). Não existe produção operacional.

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

## P0 — F24.4 Multi-device + Conflitos

Status: `IN_PROGRESS — F24.4E CLOSED / INTEGRATED / F24.4F READY_TO_START`
Baseline de integração / entrada F24.4F: `main@bc84040d17e704b30df4c5f34f9d20337d54a631`; PR #178 `MERGED`.
Release blocker: `SIM`

F24.4A–F24.4D estão encerradas; E está [CLOSED / INTEGRATED pelo PR #178](./F24_4E_CONFLICT_RESOLUTION_CONTRACT.md#estado-operacional-atual). G1, G4, G5 e G3 Animal→Lote estão resolvidos; a regressão do guard Lote→Pasto também foi corrigida, validada localmente e integrada. Animal→Lote permanece integrada pelo PR #175. Permanecem deferidos: demais `state_*` e resíduos Evento→estado no backlog F24.4; matriz integrada, dispositivos físicos, non-active farm cross-device e clock transversal em F24.4F; observabilidade em F24.5. CAS de lote/occupancy e atomicidade universal não foram certificados. Duplicidade humana exige resolução explícita, sem dedup/merge automático. O blocker stale Sanitário foi fechado em 05/10; certificação sanitária completa continua F24.7, sem rollout. A F24.4 permanece release blocker até seu gate integrado; isso não reabre E.

## P1 — Certificação E2E de process kill

Status: `REAL_PROCESS_KILL = NOT_PROVEN`

A F24.3 certificou restart lógico por reabertura Dexie, mas não kill/restart real do
browser/processo com o mesmo perfil persistente e IndexedDB sobrevivente. A dívida não bloqueia
o closeout F24.3; sua incorporação em gate posterior exige decisão explícita.

## P1 — F24.5 Observabilidade + Reconcile + Diagnóstico

Status: `NOT_STARTED`
Release blocker: `SIM_PARA_PRODUCAO_AMPLA`

Faltam correlação de operação, identidade de dispositivo se adotada, tentativa/status/erro,
ACK remoto, resultado de reconcile, saúde de fila/reconcile, retenção e redaction. Telemetria
não é fonte factual nem regra de domínio.

## P1 — F24.6 Performance / Escala

Status: `NOT_STARTED`
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
