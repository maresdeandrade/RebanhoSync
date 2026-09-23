# Resultado funcional mais recente — F24.3 / Offline Recovery

Atualizado em: 2026-09-23
Baseline auditada para o closeout: `main@ddd1ba3c2a5fb8055027723c0b9b3c83abe449d5`
Decisão final: **F24.3 CLOSED**

## Resultado

O [closeout canônico](./F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md) confirma farm-aware replace,
reconciliação de fazenda não ativa, ownership legado fail-closed, reset explícito de
`UNKNOWN`, retry genérico/HTTP 429/reconnect e restart lógico com fila heterogênea multi-farm.

## Validação técnica

- suíte focada F24.3 reexecutada: 12 arquivos, 62 testes, aprovada;
- restart certificado: reabertura Dexie no mesmo processo;
- `REAL_PROCESS_KILL = NOT_PROVEN` e mantido como dívida E2E futura;
- gates documentais e `git diff --check` pertencem ao patch de closeout.

## Guardrails confirmados

- nenhuma nova fonte de verdade, migration, RLS, RPC ou alteração de produção;
- Agenda, Evento, `state_*` e Protocolo mantêm seus papéis;
- offline-first, idempotência, pending work, reconciliação e isolamento por fazenda/ownership
  permanecem preservados.

## Próximo estado

`NEXT = F24.4A — Conflict Inventory / Characterization`. A fase não foi iniciada por este
fechamento.
