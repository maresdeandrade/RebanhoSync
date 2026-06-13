# ACTIVE_PHASE_PLAN - Fase 12E2

**Status:** Fase 12E2 concluida localmente - pull remoto ProductClass v2 para Dexie.
**Foco:** Sincronizacao pull-only das 4 estruturas ProductClass v2 para stores locais `catalog_*`.
**Criado:** 2026-06-12
**Atualizado:** 2026-06-12
**Plano base:** 12E2 - Sync/Pull ProductClass v2 e correcao do baseline P1

---

## Objetivo em 1 paragrafo

Executar a Fase 12E2 implementando apenas o fluxo remoto -> Dexie local para ProductClass v2. O pull baixa registros globais com `scope = 'global'` e `fazenda_id is null`, baixa registros tenant com `scope = 'tenant'` e `fazenda_id` da fazenda atual, preserva `updated_at`, `deleted_at`, `metadata`, arrays e JSON, e aplica os dados nos stores locais criados na 12E1. A fase nao implementa push, `queue_ops`, sync-batch de ProductClass, UI, migration, seed, protocolo estruturado, agenda, evento, estoque, carencia ativa ou aptidao operacional.

---

## Decisao 12E2

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementado nesta fase:
- pull especifico `pullSanitarioProductClassV2Catalog` para as quatro tabelas ProductClass v2;
- pull global separado, sem filtro por `fazenda_id`;
- pull tenant separado, com `fazenda_id` explicito;
- aplicacao Dexie em ordem: classes, grupos, memberships e regras default;
- escrita local em modo merge, sem apagar fisicamente tombstones;
- chamada do pull ProductClass v2 apos o pull inicial padrao;
- ajuste do baseline P1 para nao escrever agenda sanitaria legada em `agenda_itens`.

Nao implementado nesta fase:
- push remoto de ProductClass v2;
- criacao de `queue_ops` para ProductClass v2;
- alteracao da Edge Function `sync-batch`;
- UI, migrations, seeds, protocolos estruturados, agenda real, evento de produto, baixa de estoque, carencia ativa, venda, abate, leite ou aptidao operacional.

---

## Evidencia tecnica

Arquivos gerados/alterados:
- `src/lib/offline/pull.ts` (alterado)
- `src/lib/offline/__tests__/sanitarioProductClassV2Pull.test.ts` (novo)
- `src/lib/offline/__tests__/baselineValidatorContract.test.ts` (novo)
- `scripts/codex/validate-supabase-baseline-functional.mjs` (alterado)
- `docs/review/ACTIVE_PHASE_PLAN.md` (alterado)
- `docs/review/CURRENT_PHASE_HANDOFF.md` (alterado)
- `docs/review/LAST_PHASE_RESULT.md` (alterado)
- `docs/review/OPEN_REVIEW_ITEMS.md` (alterado)
- `docs/context/PROJECT_STATUS.md` (alterado)
- `docs/product/ROADMAP.md` (alterado)
- `docs/domain/SANITARIO.md` (alterado)

---

## Criterios de aceitacao da fase

- [x] Pull remoto ProductClass v2 implementado.
- [x] Pull global separado do pull tenant.
- [x] Global nao depende de `fazenda_id`.
- [x] Tenant usa `fazenda_id`.
- [x] Pull respeita ordem de dependencia.
- [x] `deleted_at` e `updated_at` preservados localmente.
- [x] Nenhum push ProductClass implementado.
- [x] Nenhum `queue_ops` ProductClass criado.
- [x] Nenhum sync-batch push ProductClass criado.
- [x] Nenhuma UI alterada.
- [x] Nenhuma migration criada.
- [x] Nenhum seed criado.
- [x] Nenhum protocolo estruturado, agenda, evento ou carencia ativa criado.
- [x] Baseline P1 ajustado para nao escrever agenda sanitaria legada em `agenda_itens`.
- [x] Testes focados passaram.

## Proxima fase segura

`12E3 - Catalogo tecnico sanitario v2 ampliado`
