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

## Fluxo 8: Nutrição (Registro Offline→Sync→Histórico)

**Escopo MVP:** Registro operacional de eventos de nutrição (alimento fornecido) para animais e/ou lotes. **Não inclui** gestão de estoque, inventário ou compras.

**Requisitos:**

1. **Registro Offline:**
   - Formulário de Nutrição permite registrar evento offline (animal ou lote, alimento_nome, quantidade_kg).
   - Grava em `state_eventos` (rail mutável) e `event_eventos_nutricao` (rail append-only).
   - Cria gesture em `queue_gestures` + `queue_ops` para sync futuro.

2. **Sincronização:**
   - Ao recuperar conexão, sync-batch processa gesture e aplica evento no servidor.
   - Server valida schema (alimento_nome, quantidade_kg > 0) e constraints de tenant.
   - Retorna `APPLIED` ou `REJECTED` com motivo.

3. **Rollback Local:**
   - Em caso de rejeição, syncWorker reverte alterações locais (state*\* + event*\*).

4. **Histórico:**
   - UI de histórico de eventos mostra eventos de nutrição sincronizados.
   - Filtro por domínio "Nutrição" funcional.

**Validação de Aceite:**

- [ ] Formulário Nutrição renderiza em `/registrar` (tipoManejo === "nutricao").
- [ ] Evento criado offline aparece em `state_eventos` e `event_eventos_nutricao`.
- [ ] Gesture criado com status `PENDING`.
- [ ] Sync aplica evento no servidor (200 OK, status `APPLIED`).
- [ ] Histórico mostra evento de nutrição após sync.
- [ ] Rejeição (ex: quantidade_kg <= 0) aciona rollback local.

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**DB.md**](./DB.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md)
