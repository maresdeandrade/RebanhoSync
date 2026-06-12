# ACTIVE_PHASE_PLAN - Fase 12E0

**Status:** Fase 12E0 concluída — Diagnóstico técnico e contrato de implementação para conectar a Fundação Sanitária v2 ao fluxo offline/sync.
**Foco:** Planejamento e mapeamento das estruturas de ProductClass e Agenda Sanitária v2 no Dexie, sync-batch, pull e RLS.
**Criado:** 2026-06-11
**Atualizado:** 2026-06-11
**Plano base:** 12E0 — Offline/sync da Fundação Sanitária v2, incluindo ProductClass e Agenda Sanitária v2 (Diagnóstico e Contrato)

---

## Objetivo em 1 parágrafo

Executar a Fase 12E0 como diagnóstico e contrato técnico de implementação, mapeando as 17 estruturas sanitárias v2 Supabase/Dexie divididas em dois blocos (Catálogo vs Operação), alinhando as estratégias de pull/push para registros globais (pull-only) vs tenant (`scope = 'tenant'`), tratando o fluxo de soft-delete e RLS, sem alterar código funcional, migrations, Dexie, sync-batch ou UI nesta subfase.

---

## Decisão 12E0

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta fase:
- criar plano técnico e diagnóstico de sincronização/offline em `docs/review/PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md`;
- atualizar documentação de status, roadmap e handoff da fase.

Implementação não autorizada nesta fase:
- alteração de esquemas Dexie locais;
- alteração da Edge Function `sync-batch` ou das tabelas no banco de dados;
- alteração na UI ou em arquivos TypeScript funcionais;
- criação de seeds, agendas ou eventos.

---

## Evidência técnica

Arquivos gerados/alterados:
- `docs/review/PLANO_FASE_12E0_OFFLINE_SYNC_FOUNDATION.md` (novo)
- `docs/review/ACTIVE_PHASE_PLAN.md` (alterado)
- `docs/review/CURRENT_PHASE_HANDOFF.md` (alterado)
- `docs/review/LAST_PHASE_RESULT.md` (alterado)
- `docs/context/PROJECT_STATUS.md` (alterado)
- `docs/product/ROADMAP.md` (alterado)
- `docs/domain/SANITARIO.md` (alterado)

---

## Critérios de aceitação da fase

- [x] Nenhum código funcional, UI, Dexie ou sync-batch alterado.
- [x] Nenhuma migration criada.
- [x] Mapa de lojas remotas → locais proposto no plano técnico (17 estruturas no total).
- [x] Estratégia de sincronização global (pull-only) vs tenant (`scope = 'tenant'`) documentada.
- [x] Fatiamento da Fase 12E em 4 subfases (12E1 a 12E4) e Fase 12F estabelecido.
- [x] Baseline P1 catalogado e riscos mapeados.

## Próxima fase segura

`12E1 — Dexie schema/stores para ProductClass v2`
