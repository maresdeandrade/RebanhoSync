# Pendências abertas — RebanhoSync

Atualizado em: 2026-10-03

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

Status: `IN_PROGRESS — F24.4E1 INTEGRATED / F24.4E2 ANIMAL_TO_LOTE CLOSED / G3_ANIMAL_TO_LOTE RESOLVED`
Release blocker: `SIM`

F24.4A–F24.4D estão encerradas e a F24.4E está ativa. O CAS de `UPDATE animais` e `DELETE animais`, replay de lost ACK, cross-device reconnect, farm-switch e clock authority foram comprovados nos escopos documentados. Permanecem abertos: demais `state_*` sem política de revisão, conflito cross-domain Evento→estado em sucesso parcial fora da vertical Animal→Lote certificada, duplicidade humana ad hoc sem causa compartilhada, certificação em dispositivo físico real, reconciliação de fazenda não ativa e transporte E2E do conflito Sanitário v2. `AUTO_MERGE = NOT_AUTHORIZED`. Animal→Lote foi recertificada na [seção 18 da F24.4E2](./F24_4E2_MOVEMENT_EVENT_STATE_CONVERGENCE.md); Lote→Pasto/occupancy continuam fora desse gate. O próximo passo da entrega é review final do diff, push/PR autorizado e merge/rebaseline.

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

Status: `EXTERNAL_BLOCKED`

Código: `SANITARIO_V2_E2E_PLATFORM_BLOCKED`

Release blocker do Sanitário v2: `SIM`

- manter gate remoto desligado;
- manter feature flag local `false`;
- não autorizar rollout;
- não aumentar timeout nem alterar RPC/SQL sem nova evidência;
- reexecutar os E2Es somente quando a plataforma estiver estável.

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
- bloqueio sanitário: `EXTERNAL_BLOCKED`, preservado sem reabrir a Fase 12.
