# Documentação RebanhoSync

Este diretório concentra a documentação normativa, snapshots vivos do código e materiais históricos de auditoria.

**Estado do produto:** Beta interno — MVP completo conforme matriz de capacidades atual.  
**Última atualização:** 2026-04-28

## Comece por aqui

- [`../AGENTS.md`](../AGENTS.md) — Entrada rápida para agentes e dispatcher de contexto.
- [`AGENT_CONTEXT.md`](AGENT_CONTEXT.md) — Contexto ampliado para agentes, fontes de verdade, baseline Supabase e comandos reais.
- [`CURRENT_STATE.md`](CURRENT_STATE.md) — Snapshot executivo do repositório e do produto.
- [`PROCESS.md`](PROCESS.md) — Processo de desenvolvimento capability-centric.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Arquitetura operacional, Two Rails, boundary sanitário, idempotência e baseline Supabase.

## Fontes atuais confirmadas

- [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) — Matriz derivada de capacidades e estado efetivo.
- [`HANDOFF_SANITARIO_REFACTOR.md`](HANDOFF_SANITARIO_REFACTOR.md) — Handoff atual do recorte sanitário e baseline pós-squash.
- [`PRODUCT.md`](PRODUCT.md) — Produto e domínio.
- [`SYSTEM.md`](SYSTEM.md) — Visão sistêmica.
- [`REFERENCE.md`](REFERENCE.md) — Referência de domínio/uso.
- [`../supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`](../supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql) — Baseline Supabase canônica ativa.
- [`../supabase/seed.sql`](../supabase/seed.sql) — Seed técnico/mínimo/idempotente; não é fonte normativa oficial.

## Backlog e governança

- [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) — Matriz de capacidades.
- [`TECH_DEBT.md`](TECH_DEBT.md) — Gaps residuais e histórico de fechamentos.
- [`ROADMAP.md`](ROADMAP.md) — Milestones e próximos passos.

## Documentos ausentes na raiz atual

Estes nomes não existem como documentos ativos em `docs/` na inspeção atual:

- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/DB.md`
- `docs/RLS.md`
- `docs/STACK.md`
- `docs/ROUTES.md`
- `docs/REPO_MAP.md`
- `docs/E2E_MVP.md`
- `docs/EVENTOS_AGENDA_SPEC.md`
- `docs/MATRIZ_CANONICA_EVENTOS_SCHEMA.md`
- `docs/PLANO_UNIFICACAO_EVENTOS.md`

Versões com esses nomes existem em `docs/archive/**`; elas são históricas e não devem ser tratadas como fonte operacional atual.

Para offline/sync, DB/RLS e contratos atuais, use:

- [`AGENT_CONTEXT.md`](AGENT_CONTEXT.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- código atual
- migrations ativas

## Histórico e governança

- `review/` — relatórios ativos no processo de reconciliação e nos gates documentais.
- [`AUDIT_CAPABILITY_MATRIX.md`](AUDIT_CAPABILITY_MATRIX.md) — Capability score pós-fechamento.
- [`RECONCILIACAO_REPORT.md`](RECONCILIACAO_REPORT.md) — Reconciliação documental pós-auditoria abril/2026.
- `archive/` — análises, inventários e auditorias históricas sem valor operacional atual.
- `ADRs/` — decisões de arquitetura:
  - [`ADR-0001-taxonomia-canonica-bovina.md`](ADRs/ADR-0001-taxonomia-canonica-bovina.md)
  - [`ADR-0002-catalogo-produtos-veterinarios-global.md`](ADRs/ADR-0002-catalogo-produtos-veterinarios-global.md)

## Observação

O retrato operacional atual deve ser lido primeiro em:

- [`../AGENTS.md`](../AGENTS.md)
- [`AGENT_CONTEXT.md`](AGENT_CONTEXT.md)
- [`CURRENT_STATE.md`](CURRENT_STATE.md)
- [`../README.md`](../README.md)

Material em `archive/` não representa o estado vivo do produto.