# Documentacao RebanhoSync

Este diretorio concentra a documentacao normativa, os inventarios vivos do codigo e alguns materiais historicos de auditoria.

## Comece por aqui

- [CURRENT_STATE.md](./CURRENT_STATE.md)
  - Snapshot operacional do repositorio e do produto.
- [ARCHITECTURE.md](./ARCHITECTURE.md)
  - Arquitetura geral, Two Rails e fluxo offline-first.
- [OFFLINE.md](./OFFLINE.md)
  - Detalhes de Dexie, fila local, rollback e sync worker.
- [CONTRACTS.md](./CONTRACTS.md)
  - Contrato do `sync-batch`, statuses e erros.
- [DB.md](./DB.md)
  - Schema, enums e relacoes.
- [RLS.md](./RLS.md)
  - Tenant isolation, RBAC e RPCs.

## Inventarios vivos

- [STACK.md](./STACK.md)
- [ROUTES.md](./ROUTES.md)
- [REPO_MAP.md](./REPO_MAP.md)
- [E2E_MVP.md](./E2E_MVP.md)

## Backlog e governanca

- [PROCESS.md](./PROCESS.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [TECH_DEBT.md](./TECH_DEBT.md)
- [ROADMAP.md](./ROADMAP.md)

## Historico e governanca

- `review/`: relatorios ainda ativos no processo de reconciliacao e nos gates documentais
- `archive/`: analises, auditorias e baselines antigos preservados apenas como historico
- `ADRs/`: decisoes de arquitetura

Observacao: o retrato operacional atual do repositorio deve ser lido primeiro em `CURRENT_STATE.md`, `STACK.md`, `ROUTES.md` e no `README.md` da raiz. Material em `archive/` nao representa o estado vivo do produto.
