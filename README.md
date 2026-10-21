# RebanhoSync

Plataforma offline-first para gestão pecuária, com React/TypeScript, Dexie e Supabase/Postgres/RLS.

## Estado atual

- Beta interno; **Fase 24 — Release Hardening / Scale Readiness** está ativa.
- F24.5 está integrada. F24.6 permanece ativa; F24.6A1 foi integrada pelo PR #200.
- A certificação F24.6A1 é limitada ao reconnect 1k descrito no [relatório](docs/review/F24_6A1_RECONNECT_1K_CERTIFICATION.md); não declara capacidade geral de escala.
- F24.6A2 é proposta de inventário estático; seu escopo e critérios precisam ser formalizados antes do início.
- O Sync Sanitário v2 está implementado sob gate remoto desligado. Recertificação completa, importação real e rollout não estão autorizados.
- Produção não está provisionada. Merge em `main` não comprova implantação operacional.

Consulte o [estado canônico do projeto](docs/context/PROJECT_STATUS.md) para fase, limites e distinção entre implementação, integração e ativação.

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
- [Matriz de rastreabilidade](./docs/product/REQUIREMENTS_TRACEABILITY.md)
- [Estado atual](./docs/context/PROJECT_STATUS.md)
- [Roadmap](./docs/product/ROADMAP.md)
- [Plano ativo da Fase 24](./docs/review/ACTIVE_PHASE_PLAN.md)
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
