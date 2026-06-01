# RebanhoSync

Plataforma offline-first para gestão pecuária de corte.

Stack principal:

- React + TypeScript + Vite
- Dexie/IndexedDB
- Supabase/Postgres/Auth/RLS
- TanStack React Query
- Vitest + Testing Library

---

## Estado atual

Beta interno. MVP operacional.

A fase atual prioriza consolidação SLC:

- preservar comportamento atual;
- reduzir fricção nos fluxos centrais;
- manter offline-first e sync confiável;
- estabilizar regressões;
- melhorar UX sem criar nova fonte de verdade.

Detalhes vivos do estado do produto:

- `docs/context/PROJECT_STATUS.md`
- `docs/product/CAPABILITY_MATRIX.md`
- `docs/context/KNOWN_GAPS.md`

---

## Contratos centrais

Resumo:

- Agenda = intenção/tarefa futura.
- Evento = fato executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Tags, sinais e insights = auxiliares; nunca fonte primária.
- Decisões críticas como carência, peso confiável e venda/abate exigem fonte técnica explícita.

Detalhes:

- `docs/context/SOURCE_OF_TRUTH.md`
- `docs/technical/EVENTS_AGENDA_CONTRACT.md`
- `docs/domain/TAGS_SIGNALS_CONTRACT.md`

---

## Arquitetura

Documentos principais:

- `docs/technical/ARCHITECTURE.md`
- `docs/technical/OFFLINE_SYNC.md`
- `docs/technical/SUPABASE_RLS.md`
- `docs/technical/TESTING_GATES.md`

---

## Domínios

- `docs/domain/SANITARIO.md`
- `docs/domain/REPRODUCAO.md`
- `docs/domain/ANIMAIS_TAXONOMIA.md`
- `docs/domain/LOTES_PASTOS.md`
- `docs/domain/COMPRA_VENDA.md`

---

## UX/UI

- `docs/ux/UX_PRINCIPLES.md`
- `docs/ux/SCREEN_PATTERNS.md`
- `docs/ux/VISUAL_TOKENS.md`
- `docs/ux/NAVIGATION.md`

---

## Setup

```bash
pnpm install
pnpm dev
```
---

## Scripts principais

```bash
pnpm run lint
pnpm test
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:hotspots
pnpm run test:smoke
pnpm run quality:gate
pnpm run test:e2e
pnpm run gates
pnpm run audit:data
```
---

## Validação Supabase funcional:
```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
---

## Agentes de IA

Entrada principal:

- `AGENTS.md`

Regras compactas:

- `agents/rules/CORE_RULES.md`
- `agents/rules/CONTEXT_LOADING.md`
- `agents/rules/RESPONSE_FORMATS.md`

Skills:

- `agents/skills/README.md`

Prompts reutilizáveis:
- `agents/prompts/README.md`