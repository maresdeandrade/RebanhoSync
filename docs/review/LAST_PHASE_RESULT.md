# Resultado funcional mais recente — Fase 12

Atualizado em: 2026-08-05
Baseline técnico do fechamento: `7e43248`
Decisão: **Fase 12 tecnicamente encerrada; rollout sanitário bloqueado**

## Resultado

A Fase 12 consolidou a Conformidade Sanitária v2 local, sua documentação e o Sync Sanitário v2. Foram concluídos histórico externo/documental, Evento e detalhe, movimento de estoque, retry/replay/idempotência, sucesso parcial, produto técnico e fonte por campo, correção append-only, carência operacional derivada, pull com recálculo conservador da Conformidade e hardening integrado local.

O `sync-batch` v20 foi publicado no staging `zqloazqzhwauamcejmuz`. A recertificação mínima confirmou `BLOCKED_DEPENDENCY / SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED`, sem movimento persistido e sem alteração de saldo. O cleanup terminou sem resíduos e com isolamento por `fazenda_id` preservado.

## Pendência externa aceita

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` permanece exclusivamente como bloqueio de rollout. O PostgreSQL produz `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas o caminho hospedado devolve `SANITARIO_RPC_TIMEOUT`.

Não há defeito funcional comprovado no domínio ou SQL. Não estão autorizados workaround, aumento de timeout ou reescrita preventiva. A pendência não bloqueia o início das próximas fases de desenvolvimento.

## Ambiente

- staging: `zqloazqzhwauamcejmuz`;
- `sync-batch`: v20 ativo;
- gate remoto: desligado;
- feature flag local: `false`;
- rollout: não autorizado;
- produção: não alterada;
- fixtures sintéticas residuais: zero.

## Próxima fase

Fase 13 — Reprodução Operacional v1. A transição não habilita o Sync Sanitário v2 para usuários.

Detalhes no [plano ativo](./ACTIVE_PHASE_PLAN.md) e no [handoff atual](./CURRENT_PHASE_HANDOFF.md).
