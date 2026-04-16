# OFFLINE / SYNC LOCAL AGENT

Escopo:
- `src/lib/offline/**`
- `src/lib/telemetry/**` quando a tarefa tocar flush, cursor ou health de sync
- `src/lib/events/**` apenas se a mudança mexer no envelope do gesto
- não expandir para UI ampla sem necessidade explícita

Leia primeiro:
1. `docs/CURRENT_STATE.md`
2. `docs/OFFLINE.md`
3. `docs/CONTRACTS.md`

Leia só se necessário:
- `docs/ARCHITECTURE.md`
- `docs/DB.md`
- `docs/RLS.md`

Foco deste diretório:
- Dexie schema
- `queue_gestures`, `queue_ops`, `queue_rejections`
- optimistic apply
- rollback por `before_snapshot`
- `tableMap.ts`
- pull seletivo
- `syncWorker`
- telemetria local/remota de sync

Invariantes obrigatórias:
- preservar idempotência do sync
- preservar rollback determinístico em ordem reversa
- preservar metadata obrigatória:
  - `fazenda_id`
  - `client_id`
  - `client_op_id`
  - `client_tx_id`
  - `client_recorded_at`
- não enviar `created_at` / `updated_at`
- nomes remotos continuam sendo a API de escrita; Dexie traduz via `tableMap`
- manter separação `state_*` vs `event_*` vs `queue_*` vs `catalog_*`
- não criar nova store ou alterar schema sem justificar impacto de migração local
- não quebrar pull pós-sync de entidades sensíveis
- não quebrar upload remoto periódico de `metrics_events`

Checagens mentais antes de alterar:
1. A mudança afeta shape local ou só fluxo?
2. Pode gerar drift entre Dexie e Supabase?
3. O rollback continua restaurando exatamente o `before_snapshot`?
4. Retry de rede continua seguro?
5. A mudança deveria estar no cliente, no `sync-batch`, ou nos dois?

Evitar:
- refatoração ampla de múltiplas camadas no mesmo patch
- lógica de domínio sanitário/reprodutivo enterrada no worker sem necessidade
- leitura de docs derivados se a tarefa não tocar estado funcional
- mexer em RLS/migration a partir daqui sem abrir escopo explícito

Entrega esperada:
- diff mínimo
- invariantes tocadas
- até 3 riscos
- testes focados

Validação mínima:
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`

Quando escalar:
- se mudar envelope do `sync-batch`, status codes ou ordem de aplicação -> revisar `supabase/functions/sync-batch/**`
- se mudar regra normativa de sync -> avaliar ADR