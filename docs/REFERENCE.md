# Referência Rápida (RebanhoSync)

> **Status:** Derivado (Inventário)
> **Última Atualização:** 2026-04-16

Este documento consolida referências rápidas para navegação do repositório, stack, rotas, diretórios e comandos úteis.

---

## 1. Ordem de consulta recomendada

Para retomada rápida do projeto:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`
4. `docs/PRODUCT.md`
5. `docs/SYSTEM.md`
6. `docs/REFERENCE.md`

---

## 2. Stack principal

### Frontend
- React 19
- TypeScript
- Vite 6
- Tailwind CSS
- Radix UI
- shadcn/ui
- react-hook-form
- zod
- recharts

### Dados remotos
- Supabase JS
- Postgres / Auth / Edge Functions
- TanStack React Query

### Offline
- Dexie.js
- dexie-react-hooks
- IndexedDB

### Testes e qualidade
- Vitest
- Testing Library
- fake-indexeddb
- ESLint
- Prettier

### Deploy
- Vercel (frontend)
- Supabase (backend)

---

## 3. Diretórios principais

### `src/`
Frontend React.

Subáreas importantes:
- `pages/` — superfícies roteadas
- `components/` — componentes reutilizáveis por domínio e UI base
- `lib/` — lógica principal do sistema
- `hooks/` — hooks de suporte ao frontend

### `src/lib/`
Principal concentração de lógica operacional.

Subáreas críticas:
- `offline/` — Dexie, fila, worker, rollback, pull, sync
- `sanitario/` — protocolos, catálogo, compliance, trânsito, read models
- `reproduction/` — linking, status, tipos, selectors
- `animals/` — taxonomia, apresentação, ordenação, helpers de leitura
- `telemetry/` — métricas de piloto e flush remoto
- `events/` — builders, tipos, validações

### `supabase/`
Backend e evolução estrutural.

- `migrations/` — evolução do schema SQL
- `functions/sync-batch/` — validação autoritativa e aplicação do sync
- `functions/telemetry-ingest/` — ingestão remota de telemetria
- `functions/test-auth/` — diagnóstico auxiliar

### `docs/`
Documentação normativa, snapshot, derivados e referência.

### `scripts/`
Automações operacionais e gates documentais.

---

## 4. Superfícies principais

### Painéis base
- `/home`
- `/agenda`
- `/dashboard`
- `/eventos`

### Operação animal
- `/animais`
- `/animais/:id`
- `/animais/:id/reproducao`
- `/animais/:id/pos-parto`
- `/animais/:id/cria-inicial`

### Estrutura de rebanho
- `/lotes`
- `/pastos`

### Domínios auxiliares
- `/protocolos-sanitarios`
- `/financeiro`
- `/admin/membros`

### Entrada e contexto
- `/login`
- `/signup`
- `/invites/:token`
- `/select-fazenda`
- `/criar-fazenda`

---

## 5. Pontos críticos do sistema

### Offline / Sync
Arquivos centrais:
- `src/lib/offline/db.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/pull.ts`
- `src/lib/offline/syncWorker.ts`
- `src/lib/offline/tableMap.ts`

### Sanitário
Arquivos centrais:
- `src/lib/sanitario/baseProtocols.ts`
- `src/lib/sanitario/officialCatalog.ts`
- `src/lib/sanitario/compliance.ts`
- `src/lib/sanitario/complianceGuards.ts`
- `src/lib/sanitario/regulatoryReadModel.ts`
- `src/lib/sanitario/transit.ts`

### Reprodução
Arquivos centrais:
- `src/lib/reproduction/linking.ts`
- `src/lib/reproduction/status.ts`
- `src/lib/reproduction/types.ts`
- `src/lib/reproduction/selectors.ts`

### Taxonomia canônica
Arquivos centrais:
- `src/lib/animals/taxonomy.ts`
- `src/lib/animals/taxonomyFactsContract.ts`

### Hotspots atuais de hardening
- `src/pages/Registrar.tsx`
- `src/lib/offline/syncWorker.ts`

---

## 6. Fluxos operacionais que merecem atenção

- registro operacional em `Registrar`
- agenda sanitária e execução de pendências
- movimentação com anti-teleporte
- trânsito externo com GTA/e-GTA e pre-check PNCEBT
- parto → pós-parto → cria inicial
- rollback local após `REJECTED`
- flush remoto de telemetria de piloto

---

## 7. Comandos úteis

### Desenvolvimento
```bash
pnpm install
pnpm dev
```

### Qualidade
```bash
pnpm run lint
pnpm test
pnpm run build
```

### Fluxos adicionais
```bash
pnpm run test:e2e
pnpm run gates
pnpm run audit:data
```

---

## 8. Leitura complementar

- `docs/CURRENT_STATE.md`
- `docs/PROCESS.md`
- `docs/SYSTEM.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/ROADMAP.md`
- `docs/TECH_DEBT.md`
