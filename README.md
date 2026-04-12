# RebanhoSync

Plataforma **offline-first** para gestão pecuária de corte. Multi-tenant por fazenda, RBAC (`owner | manager | cowboy`), sincronização transacional por gestos e backend Supabase com RLS hardened.

> **Estado atual:** Beta interno — MVP completo e operacional.  
> Todos os 7 domínios operacionais implementados. Qualidade local verde (`lint`, `test`, `build`).

---

## Escopo implementado

- Gestão de animais, lotes, pastos, contrapartes e categorias zootécnicas.
- Registro de eventos: sanitário, pesagem, nutrição, movimentação, reprodução e financeiro.
- Agenda operacional com protocolos, deduplicação automática e recálculo por trigger.
- Onboarding guiado da fazenda e importação CSV de animais, lotes e pastos.
- Módulo reprodutivo completo: cobertura/IA → diagnóstico → parto → pós-parto → cria inicial.
- Ficha do animal com vínculos mãe/cria, curva de peso, timeline de eventos.
- Lista de animais agrupando matriz e cria com badge visual por estágio de vida.
- Transições do rebanho com histórico consolidado.
- Dashboard reprodutivo dedicado e relatórios operacionais com exportação.
- Telemetria de piloto com buffer local em `metrics_events` (Dexie v11) e flush remoto periodico.
- Taxonomia canônica bovina: 3 eixos derivados, contrato v1, SQL view de paridade.
- Sistema de convites e gestão de membros.
- Catálogo global de produtos veterinários com seed básico.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| Formulários | React Hook Form + Zod |
| Dados remotos | Supabase JS + TanStack React Query |
| Offline | Dexie v4 (IndexedDB) + dexie-react-hooks |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| Testes | Vitest + Testing Library + fake-indexeddb |
| Deploy | Vercel (frontend) + Supabase (backend) |

---

## Scripts principais

```bash
pnpm install
pnpm dev          # servidor local (Vite)
pnpm run lint     # ESLint
pnpm test         # Vitest (unitários + integração)
pnpm run build    # build de produção
```

Scripts adicionais:

```bash
pnpm run test:e2e       # fluxos guiados: onboarding, importação, relatórios
pnpm run gates          # gates documentais do pacote Antigravity
pnpm run audit:data     # auditoria de contratos de dados
```

---

## Ambiente

Crie um `.env` local a partir de `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_FUNCTIONS_URL=
```

---

## Estrutura do repositório

```
src/              Frontend React (pages, components, lib, hooks)
supabase/
  migrations/     44+ migrations SQL — evolução do schema
  functions/
    sync-batch/   Edge Function de sincronizacao transacional
    telemetry-ingest/ Edge Function de ingestao de telemetria de piloto
    test-auth/    Edge Function auxiliar de diagnostico
docs/             Documentação normativa e inventários vivos
scripts/          Automações e gates documentais
```

---

## Documentação

Para retomar o projeto rapidamente, siga a ordem:

1. [`docs/CURRENT_STATE.md`](./docs/CURRENT_STATE.md) — snapshot executivo do estado atual
2. [`docs/PRODUCT.md`](./docs/PRODUCT.md) — visão de produto, escopo e princípios
3. [`docs/SYSTEM.md`](./docs/SYSTEM.md) — arquitetura, banco, offline-first e contratos
4. [`docs/PROCESS.md`](./docs/PROCESS.md) — fluxo capability-centric e governança de release
5. [`docs/REFERENCE.md`](./docs/REFERENCE.md) — mapas do repositório, rotas, E2E e domínios
6. [`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md) — matriz de capacidade atualizada
7. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — visão de curto e longo prazo
8. [`docs/TECH_DEBT.md`](./docs/TECH_DEBT.md) — log de problemas residuais e backlog técnico

