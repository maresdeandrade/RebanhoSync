# Pendências abertas — RebanhoSync

Atualizado em: 2026-09-14

## Objetivo

Registrar somente itens abertos e acionáveis. O backlog detalhado, critérios e dependências
estão na [baseline F24.0](./F24_RELEASE_READINESS_BASELINE.md).

F24.1 foi fechada após a reconstrução remota, convergência ACL, `sync-batch` e a correção
F24.1D.1 do `sanitario-reconcile`. O fechamento inclui matriz negativa, consumidor
`service_role`, E2E 1/1, replay e limpeza. Não existe produção operacional.

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

## P0 — F24.2 RLS / Auth / Tenant Isolation Final Gate

Status: `READY_NOT_STARTED`
Release blocker: `SIM`

O gate local passou, mas o inventário e os testes finais por ambiente ainda não existem.
Inclui RLS, grants/revokes, `fazenda_id`, convites, SuperAdmin, RPCs privilegiadas e
`SECURITY DEFINER`.

## P0 — F24.3 Offline Prolongado + Reconnect + Recovery

Status: `NOT_STARTED`
Release blocker: `SIM`

Implementação e testes locais parciais existem; longa desconexão, fila grande, token expirado,
crash/restart e upgrade com pending ainda não estão certificados como jornada.

## P0 — F24.4 Multi-device + Idempotência + Conflitos

Status: `NOT_STARTED`
Release blocker: `SIM`

Movimentação foi certificada remotamente, mas não há matriz transversal para concorrência,
stale writes, replay, sucesso parcial e pull concorrente.

## P1 — F24.5 Observabilidade + Reconcile + Diagnóstico

Status: `NOT_STARTED`
Release blocker: `SIM_PARA_PRODUCAO_AMPLA`

As identidades e os estados existem em superfícies distintas, sem correlação canônica por
dispositivo, ACK remoto e resultado de reconcile.

## P1 — F24.6 Performance / Escala

Status: `NOT_STARTED`
Release blocker: `SIM_PARA_ESCALA_DECLARADA`

Fixtures e workload histórico não equivalem a benchmark de IndexedDB, fila, bootstrap, pull,
payload, memória ou chunks.

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

Status: `BLOCKED_BY_F24_1_TO_F24_7`
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

- validação remota de movimentação: `RESOLVED / REMOTE_CONVERGENCE_VERIFIED`;
- Trilha C C2–C7: `RESOLVED / TECHNICAL_CONVERGENCE = CLOSED`;
- promoção de migrations e backoffice: `STILL_OPEN`, absorvida por F24.1/F24.2/F24.8;
- bloqueio sanitário: `EXTERNAL_BLOCKED`, preservado sem reabrir a Fase 12.
