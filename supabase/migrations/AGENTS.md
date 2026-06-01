# Supabase Migrations — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
supabase/migrations/**
```

Use este arquivo para alterações em schema, RLS, FKs, índices, constraints, triggers, funções SQL, RPCs, seeds técnicos e contratos persistidos.

Migrations são fonte crítica de verdade remota. Alterações aqui podem quebrar offline-first, sync, multi-tenant e dados já existentes.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/technical/SUPABASE_RLS.md`.
5. `docs/technical/OFFLINE_SYNC.md`.
6. `docs/technical/ARCHITECTURE.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| Sync remoto | `supabase/functions/sync-batch/AGENTS.md`, `src/lib/offline/AGENTS.md` |
| Eventos/agenda | `src/lib/events/AGENTS.md`, `src/lib/agenda/AGENTS.md`, `docs/technical/EVENTS_AGENDA_CONTRACT.md` |
| Sanitário | `src/lib/sanitario/AGENTS.md`, `docs/domain/SANITARIO.md` |
| Reprodução | `src/lib/reproduction/AGENTS.md`, `docs/domain/REPRODUCAO.md` |
| Financeiro/custos | `docs/finance/COSTING_CONTRACT.md`, `docs/finance/ECONOMIC_SNAPSHOTS.md` |
| ADR | `docs/technical/adrs/ADR_INDEX.md` |

---

## Modelo mental obrigatório

```txt
Supabase/Postgres = fonte remota persistida.
Dexie = fonte local/offline operacional.
sync-batch = ponte controlada.
RLS = isolamento obrigatório.
Migration = contrato versionado.
```

Toda mudança precisa preservar:

- multi-tenant;
- RLS;
- compatibilidade offline;
- idempotência;
- auditoria;
- rollback lógico;
- dados existentes.

---

## Foco deste diretório

- Tabelas.
- Colunas.
- Constraints.
- FKs simples e compostas.
- Índices.
- RLS policies.
- Triggers.
- RPCs.
- Funções SQL.
- Views/read models remotos.
- Contratos de eventos, agenda e state.
- Migrations corretivas.

---

## Invariantes obrigatórias

- Preservar isolamento por `fazenda_id`.
- Preservar RLS em tabelas tenant-scoped.
- Não criar tabela tenant-scoped sem política RLS.
- Não criar FK que permita cross-tenant.
- Preferir FK composta quando necessário para isolamento por fazenda.
- Não quebrar sync offline existente.
- Não remover coluna usada pelo cliente sem plano de migração.
- Não renomear coluna/tabela sem atualização coordenada do cliente.
- Não alterar tipo de coluna sem avaliar dados existentes.
- Não introduzir default que crie semântica falsa.
- Não usar custo ausente como zero.
- Não usar ausência de carência como liberação comercial.
- Não transformar protocolo em evento.
- Não transformar agenda em histórico.
- Não criar read model como fonte primária de fato.
- Não quebrar append-only de eventos.
- Não criar RPC que bypassa RLS sem justificativa e teste.

---

## Checagens antes de alterar

1. A migration é aditiva, corretiva ou destrutiva?
2. Há dados existentes que podem quebrar?
3. A tabela é tenant-scoped?
4. Existe `fazenda_id`?
5. Existe RLS?
6. Existe política por papel quando aplicável?
7. Há FK composta para evitar cross-tenant?
8. O cliente Dexie precisa de alteração?
9. O `sync-batch` precisa de alteração?
10. Há impacto em `tableMap.ts`?
11. Há impacto em evento/detail table?
12. Há impacto em agenda materializada?
13. Há impacto em read model `state_*`?
14. Há rollback ou caminho corretivo?
15. A mudança exige ADR?

---

## Evitar

- Migration destrutiva sem plano explícito.
- Drop de tabela/coluna sem validação de ausência de dados.
- RLS permissiva por conveniência.
- `security definer` sem restrição clara.
- Policy genérica que permita vazamento cross-tenant.
- Índice ou constraint que inviabilize sync parcial.
- Trigger que cria evento histórico implícito sem contrato.
- View/read model usada como fonte primária.
- Seed que introduza regra operacional oculta.
- Mudança remota sem atualização do cliente offline.
- Ajuste de domínio crítico só no banco, sem teste de fluxo.

---

## Entrega esperada

- Nome da migration claro e datado.
- Objetivo em uma frase.
- Tipo de mudança: aditiva, corretiva ou destrutiva.
- Tabelas/RPCs/policies afetadas.
- Impacto em Dexie/sync-batch.
- Risco multi-tenant/RLS.
- Estratégia para dados existentes.
- Testes/validações executados.
- Até 3 riscos remanescentes.

---

## Validação obrigatória

```bash
pnpm test
pnpm run lint
pnpm run build
```

Validação Supabase funcional:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Verificar referências no cliente:

```bash
rg "nome_da_tabela|nome_da_coluna|nome_da_rpc" src supabase
```

Verificar status:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
```

---

## Quando escalar

- Se alterar regra arquitetural: avaliar ADR.
- Se alterar sync remoto: consultar `supabase/functions/sync-batch/AGENTS.md`.
- Se alterar cliente offline: consultar `src/lib/offline/AGENTS.md`.
- Se alterar evento histórico: consultar `src/lib/events/AGENTS.md`.
- Se alterar agenda: consultar `src/lib/agenda/AGENTS.md`.
- Se alterar sanitário/reprodução/financeiro: consultar `AGENTS.md` ou docs do domínio correspondente.