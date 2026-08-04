# RebanhoSync

Plataforma offline-first para gestão pecuária, com React/TypeScript, Dexie e Supabase/Postgres/RLS.

## Estado atual

- Beta interno.
- Fase 12 ativa.
- Conformidade Sanitária v2 validada localmente como read model derivado e somente leitura.
- Documentação curta do Sanitário v2 local concluída.
- Sync Sanitário v2 em andamento, com os itens 3.9, 3.13, 4, 5 e 6 validados localmente.
- Hardening integrado local desses incrementos executado e documentado.
- E2E remoto parcial e rollout bloqueado por `SANITARIO_V2_E2E_PLATFORM_BLOCKED`.
- Gate sanitário remoto desligado; feature flag local `false`; rollout não autorizado.
- Próxima pendência: **certificação remota acumulada quando o ambiente e os gates forem liberados**.

Produção não foi alterada. O ambiente remoto usado nesta fase é o Supabase staging `zqloazqzhwauamcejmuz`.

## Contratos essenciais

- Agenda = intenção/tarefa futura.
- Evento = fato histórico executado.
- Closure administrativa = encerramento da intenção, não execução.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Conformidade = leitura derivada, não fonte primária.
- Carência, venda, abate, leite e aptidão operacional exigem fontes técnicas e factuais explícitas.
- Correção sanitária = novo Evento factual vinculado; o Evento original permanece imutável.
- Carência operacional = projeção reconstruível da cadeia factual, do `produto_snapshot`, do `withdrawalSnapshot` e de fonte forte explícita; não autoriza operação comercial.

## Navegação documental

- [Índice da documentação](./docs/README.md)
- [Estado atual](./docs/context/PROJECT_STATUS.md)
- [Roadmap](./docs/product/ROADMAP.md)
- [Plano ativo da Fase 12](./docs/review/ACTIVE_PHASE_PLAN.md)
- [Handoff técnico atual](./docs/review/CURRENT_PHASE_HANDOFF.md)
- [Arquitetura](./docs/technical/ARCHITECTURE.md)
- [Sanitário](./docs/domain/SANITARIO.md)

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Offline | Dexie/IndexedDB |
| Backend | Supabase Auth + Postgres + RLS + Edge Functions |
| Dados | TanStack React Query |
| Testes | Vitest + Testing Library + fake-indexeddb |

## Desenvolvimento

```bash
pnpm install
pnpm dev
pnpm run lint
pnpm test
pnpm run build
```

Validação funcional Supabase, quando o escopo exigir:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
