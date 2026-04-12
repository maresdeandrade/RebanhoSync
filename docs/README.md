# Documentacao RebanhoSync

Este diretorio concentra a documentacao normativa, os inventarios vivos do codigo e os materiais historicos de auditoria.

> **Estado do produto:** Beta interno — MVP completo (7/7 dominios operacionais).  
> **Ultima Atualizacao:** 2026-04-11

---

## Comece por aqui

- [CURRENT_STATE.md](./CURRENT_STATE.md)
  — Snapshot executivo do repositorio e do produto.
- [ARCHITECTURE.md](./ARCHITECTURE.md)
  — Arquitetura geral, Two Rails, Offline-First, Taxonomia Canonica, Dexie v11.
- [OFFLINE.md](./OFFLINE.md)
  — Dexie stores (state/event/queue/metrics_events), fila, rollback e sync worker.
- [CONTRACTS.md](./CONTRACTS.md)
  — Contrato do `sync-batch`, statuses, tabelas bloqueadas, retry e post-sync pull.
- [DB.md](./DB.md)
  — Schema, enums, views (`vw_animal_gmd`, `vw_animais_taxonomia`) e relacoes.
- [RLS.md](./RLS.md)
  — Tenant isolation, RBAC, RPCs e nota sobre `produtos_veterinarios`.

---

## Inventarios vivos

- [STACK.md](./STACK.md) — dependencias e tecnologias
- [ROUTES.md](./ROUTES.md) — todas as rotas implementadas
- [REPO_MAP.md](./REPO_MAP.md) — mapa de diretorios e modulos
- [E2E_MVP.md](./E2E_MVP.md) — fluxos E2E (inclui Fluxo 9: pos-parto neonatal)

---

## Backlog e governanca

- [PROCESS.md](./PROCESS.md) — processo de desenvolvimento capability-centric
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) — matriz de capacidades
- [TECH_DEBT.md](./TECH_DEBT.md) — gaps residuais e historico de fechamentos
- [ROADMAP.md](./ROADMAP.md) — milestones e proximos passos

---

## Especificacoes tecnicas

- [EVENTOS_AGENDA_SPEC.md](./EVENTOS_AGENDA_SPEC.md) — invariantes e regras de negocio de eventos e agenda
- [MATRIZ_CANONICA_EVENTOS_SCHEMA.md](./MATRIZ_CANONICA_EVENTOS_SCHEMA.md) — schema canonico das tabelas de eventos
- [PLANO_UNIFICACAO_EVENTOS.md](./PLANO_UNIFICACAO_EVENTOS.md) — proposta v2 de unificacao (status: prospectivo)

---

## Historico e governanca

- `review/`: relatorios ativos no processo de reconciliacao e nos gates documentais
  - `AUDIT_CAPABILITY_MATRIX.md` — capability score pos-fechamento (baseline b69d35f)
  - `RECONCILIACAO_REPORT.md` — reconciliacao documental pos-auditoria abril/2026
- `archive/`: analises e auditorias historicas sem valor operacional
- `ADRs/`: decisoes de arquitetura
  - `ADR-0001-taxonomia-canonica-bovina.md`
  - `ADR-0002-catalogo-produtos-veterinarios-global.md`

---

Observacao: o retrato operacional atual deve ser lido primeiro em `CURRENT_STATE.md` e no `README.md` da raiz. Material em `archive/` nao representa o estado vivo do produto.
