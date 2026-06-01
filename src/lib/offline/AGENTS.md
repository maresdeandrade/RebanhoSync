# Offline / Sync — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
src/lib/offline/**
```

Também pode tocar, somente se necessário:

```txt
src/lib/telemetry/**
src/lib/events/**
supabase/functions/sync-batch/**
```

Não expandir para UI ampla sem necessidade explícita.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/technical/OFFLINE_SYNC.md`.
5. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| RLS, tenant ou RPC | `docs/technical/SUPABASE_RLS.md` |
| Arquitetura ampla | `docs/technical/ARCHITECTURE.md` |
| Status atual | `docs/context/PROJECT_STATUS.md` |
| Lacuna conhecida | `docs/context/KNOWN_GAPS.md` |
| ADR | `docs/technical/adrs/ADR_INDEX.md` |

---

## Foco deste diretório

- Dexie schema.
- `queue_gestures`.
- `queue_ops`.
- `queue_rejections`.
- optimistic apply.
- rollback por `before_snapshot`.
- `tableMap.ts`.
- pull seletivo.
- `syncWorker`.
- telemetria local/remota de sync.

---

## Invariantes obrigatórias

- Preservar idempotência do sync.
- Preservar rollback determinístico em ordem reversa.
- Preservar metadados obrigatórios:
  - `fazenda_id`;
  - `client_id`;
  - `client_op_id`;
  - `client_tx_id`;
  - `client_recorded_at`.
- Não enviar `created_at` / `updated_at` como autoridade do cliente.
- Nomes remotos continuam sendo a API de escrita; Dexie traduz via `tableMap`.
- Manter separação:
  - `state_*`;
  - `event_*`;
  - `queue_*`;
  - `catalog_*`.
- Não criar nova store ou alterar schema sem justificar impacto de migração local.
- Não quebrar pull pós-sync de entidades sensíveis.
- Não quebrar upload remoto periódico de `metrics_events`.
- Não apagar dado local por falha de autenticação, RLS ou rede.
- Não resolver conflito crítico silenciosamente.

---

## Checagens antes de alterar

1. A mudança afeta shape local ou só fluxo?
2. Pode gerar drift entre Dexie e Supabase?
3. O rollback restaura exatamente o `before_snapshot`?
4. Retry de rede continua seguro?
5. A mudança deveria estar no cliente, no `sync-batch` ou nos dois?
6. Há impacto multi-tenant ou RLS?
7. Há risco de duplicar evento, agenda ou baixa de estoque?
8. Há sucesso parcial? Como ele é reconciliado?
9. A rejeição remota fica auditável?

---

## Evitar

- Refatoração ampla de múltiplas camadas no mesmo patch.
- Lógica de domínio sanitário/reprodutivo enterrada no worker sem necessidade.
- Leitura de docs derivados se a tarefa não tocar estado funcional.
- Alterar RLS/migration a partir daqui sem escopo explícito.
- Resolver conflito crítico silenciosamente.
- Apagar dado local por falha de autenticação ou sync.
- Misturar UI, regra de domínio e sync no mesmo patch sem necessidade.

---

## Entrega esperada

- Diff mínimo.
- Invariantes tocadas.
- Até 3 riscos.
- Testes focados.
- Impacto em offline/sync descrito em bullets.
- Estratégia de rollback/retry quando aplicável.

---

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se tocar Supabase/RLS/sync-batch:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## Quando escalar

- Se mudar envelope do `sync-batch`, status code ou ordem de aplicação: revisar `supabase/functions/sync-batch/**`.
- Se mudar tenant/RLS/RPC: revisar `docs/technical/SUPABASE_RLS.md`.
- Se mudar regra normativa de sync: avaliar ADR.
- Se mudar schema local: justificar impacto de migração local e compatibilidade offline.