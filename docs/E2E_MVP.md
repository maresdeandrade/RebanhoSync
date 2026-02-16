# Roteiro de Testes E2E (MVP)

> **Status:** Normativo
> **Fonte de Verdade:** Requisitos de Produto
> **Última Atualização:** 2026-02-16

Este documento define os fluxos críticos de validação do sistema.

---

## Fluxo 0: Autenticação e Fazenda

- Login e redirecionamento correto.
- Persistência da fazenda ativa (`user_settings` + `localStorage`).
- Bootstrapping automático de fazenda para novos usuários (via `create_fazenda`).

## Fluxo 1: RBAC (Member Management)

- Owner tem controle total.
- Manager não pode alterar owner.
- Bloqueio de remoção do último owner (Safeguard).
- Soft delete de membros.

## Fluxo 2: Offline → Online → Sync

- Criação de evento offline (Active Record + Queue).
- Sincronização automática ao recuperar conexão.
- Validação de dados no servidor e consistência local.

## Fluxo 3: Anti-Teleporte

- Movimentação mágica (UPDATE sem INSERT evento) deve ser **REJEITADA** (Atomicidade).
- Movimentação correta (Evento + Detalhe + Update) deve ser **ACEITA**.
- Rollback local correto em caso de rejeição.

## Fluxo 4: Deduplicação de Agenda

- Tarefas com mesmo `dedup_key` não duplicam.
- Retorno `APPLIED_ALTERED` tratado como sucesso pelo cliente.

## Fluxo 5: Setup de Fazenda

- RPC `create_fazenda` cria tenant e membership corretamente.

## Fluxo 6: Hardening de Eventos

- Validação de constraints financeiros (valor > 0).
- Validação de movimentação (origem != destino).
- Validação de integridade de chaves.

## Fluxo 7: Operacional

- Feature flags de fazenda.
- Dashboard de monitoramento de rejeições (Planejado - M2).

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**DB.md**](./DB.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md)
