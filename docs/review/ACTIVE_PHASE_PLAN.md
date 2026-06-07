# ACTIVE_PHASE_PLAN - Fase 12C

**Status:** Fase 12C em implementacao SQL/RLS/reset controlado; Dexie, sync-batch e UI fora do escopo
**Foco:** Migration clean da Agenda Sanitaria v2 e reset controlado do legado sanitario
**Criado:** 2026-06-06
**Atualizado:** 2026-06-06
**Plano base:** `docs/review/PLANO_FASE_12B_MODELAGEM_CLEAN_PERSISTENCIA_SANITARIA_V2.md`

---

## Objetivo em 1 paragrafo

Executar a menor fundacao SQL/RLS da Agenda Sanitaria v2, baseada na decisao clean/reset da 12B. A 12C cria tabelas dedicadas para agenda sanitaria v2, animais planejados e closures administrativos; reseta apenas `agenda_itens` sanitario legado; desabilita repovoamento sanitario legado em `agenda_itens`; preserva fatos executados em `eventos`, `eventos_sanitario` e `insumo_movimentacoes`; e nao conecta Dexie, sync-batch, UI, seed ou fluxo operacional completo.

---

## Decisao 12C

Decisao: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementacao autorizada:

- criar migration SQL nova;
- criar enums v2 sem reutilizar `agenda_status_enum`;
- criar `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`;
- aplicar constraints e indices de idempotencia;
- habilitar RLS e policies por membership;
- resetar por soft-delete operacional `agenda_itens` sanitario legado;
- tornar recompute sanitario legado no-op para nao repovoar `agenda_itens`.

---

## Migration 12C

Arquivo:

- `supabase/migrations/20260606090000_sanitario_agenda_v2_clean_foundation.sql`

Tipo de mudanca:

- aditiva para as tabelas v2;
- destrutiva/controlada logicamente apenas para `agenda_itens` com `dominio='sanitario'`, via soft-delete operacional;
- corretiva para bloquear repovoamento legado.

---

## Escopo permitido nesta subfase

- SQL/RLS/reset controlado;
- documentacao de status e handoff;
- validacoes obrigatorias de SQL/RLS.

## Escopo proibido nesta subfase

- alterar Dexie;
- alterar sync-batch;
- alterar UI/pages/components;
- alterar seed funcional;
- criar evento real;
- baixar estoque;
- calcular carencia ativa/liberatoria;
- implementar venda, abate ou aptidao operacional;
- alterar fluxo operacional completo de Registrar/Agenda.

---

## Criterios de aceite

- 12B commitada antes do patch.
- Migration v2 clean criada.
- Tabelas v2 separadas de `agenda_itens`.
- `agenda_itens` sanitario legado resetado por soft-delete operacional.
- Fatos executados preservados.
- RLS definida para tabelas v2.
- Constraints minimas impedem fechamento invalido.
- Recompute sanitario legado nao repovoa `agenda_itens`.
- Validacoes obrigatorias executadas.
- Nenhuma integracao ampla com Dexie/sync/UI feita.

---

## Proxima fase segura

12D — Contrato offline/sync da Agenda Sanitaria v2, ainda sem UI ampla: mapear stores/intents e adaptar `sync-batch` de forma sentinela antes de conectar fluxos operacionais.
