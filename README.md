# RebanhoSync

Aplicacao offline-first para gestao pecuaria de corte, com multi-tenant por fazenda, RBAC (`owner | manager | cowboy`), sincronizacao por gestos e backend Supabase com RLS.

## Estado atual

- Estagio atual: MVP operacional em consolidacao.
- Frontend SPA em React 19 com rotas de operacao, onboarding inicial, importacao CSV, relatorios e modulo reprodutivo dedicado.
- Offline-first real com Dexie, fila local, rollback e worker de sync.
- Banco e backend com migrations Supabase, RLS hardened e Edge Function `sync-batch`.
- Qualidade local: `pnpm run lint`, `pnpm test` e `pnpm run build` passam.

## Escopo implementado

- Gestao de animais, lotes, pastos, contrapartes e categorias zootecnicas.
- Registro de eventos sanitarios, pesagem, nutricao, movimentacao, reproducao e financeiro.
- Agenda operacional, reconciliacao offline e relatorios simples.
- Onboarding guiado da fazenda e importacao inicial de animais, lotes e pastos.
- Ficha do animal com vinculos mae/cria, leitura de peso e fluxo reprodutivo dedicado por matriz.
- Pos-parto neonatal com confirmacao da cria, lote inicial e primeira pesagem.
- Lista de animais agrupando matriz e cria com badge visual por estagio de vida.

## Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS + shadcn/ui + Radix UI
- Supabase + PostgreSQL + Edge Functions
- Dexie + IndexedDB
- Vitest + Testing Library

## Scripts principais

```bash
pnpm install
pnpm dev
pnpm run lint
pnpm test
pnpm run build
```

Scripts adicionais:

- `pnpm run test:e2e`: fluxos guiados de onboarding, importacao e relatorios
- `pnpm run gates`: gates documentais do pacote Antigravity

## Ambiente

Crie um `.env` local a partir de `.env.example`.

Variaveis esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`

## Estrutura

- `src/`: frontend React
- `supabase/`: migrations e functions
- `docs/`: arquitetura, contratos, snapshot operacional e backlog
- `scripts/`: automacoes e gates

## Documentacao

Consulte [docs/README.md](./docs/README.md) para o indice completo.

Os documentos mais uteis para retomar o projeto hoje sao:

- [docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/OFFLINE.md](./docs/OFFLINE.md)
- [docs/CONTRACTS.md](./docs/CONTRACTS.md)
- [docs/STACK.md](./docs/STACK.md)
- [docs/ROUTES.md](./docs/ROUTES.md)
