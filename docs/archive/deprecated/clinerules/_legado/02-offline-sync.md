---
paths:
  - "src/lib/offline/**"
  - "src/lib/telemetry/**"
  - "src/lib/events/**"
  - "supabase/functions/sync-batch/**"
---

# RebanhoSync — Offline / Sync Rules

Leia:
1. `docs/OFFLINE.md`
2. `docs/CONTRACTS.md`
3. `docs/ARCHITECTURE.md`

Modelo mental:
- UI cria gesture -> enfileira `queue_gestures` / `queue_ops`
- cliente aplica update otimista
- `before_snapshot` sustenta rollback
- `syncWorker` envia para `sync-batch`
- servidor retorna `APPLIED`, `APPLIED_ALTERED` ou `REJECTED`
- em `REJECTED`, rollback local restaura estado anterior
- pull seletivo reflete efeitos server-side

Metadata obrigatória em records sincronizáveis:
- `fazenda_id`
- `client_id`
- `client_op_id`
- `client_tx_id`
- `client_recorded_at`

Nunca enviar como payload de escrita:
- `created_at`
- `updated_at`

Invariantes:
- preservar idempotência
- preservar rollback determinístico por `before_snapshot`
- manter coerência entre nome remoto da tabela e store local via `tableMap`
- não misturar `state_*`, `event_*`, `queue_*` e `catalog_*`
- não alterar ordem de operações sem revisar efeito no rollback e no `sync-batch`
- não aceitar localmente shape inválido que o servidor vai rejeitar de forma previsível

Checklist antes de editar:
1. Há impacto em `tableMap`?
2. Há impacto em store Dexie?
3. O rollback continua restaurando o estado correto?
4. Há novo reason code?
5. Cliente e servidor continuam alinhados?

Exigir revisão extra quando tocar:
- `src/lib/offline/db.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/syncWorker.ts`
- `supabase/functions/sync-batch/**`