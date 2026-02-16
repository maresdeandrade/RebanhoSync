# Arquitetura Offline-First (Cliente)

> **Status:** Normativo
> **Fonte de Verdade:** Implementação `src/lib/offline/`
> **Última Atualização:** 2026-02-16

Este documento define a implementação técnica da persistência local (Dexie.js) e sincronização.

---

## 1. Stores Locais (Dexie)

O banco local `RebanhoSync` espelha o servidor em duas trilhas:

### State Stores (Rail 1)

Active Record mutável. Tabela `state_*`.

- Ex: `state_animais`, `state_lotes`, `state_agenda_itens`.

### Event Stores (Rail 2)

Log append-only. Tabela `event_*`.

- `event_eventos` (Header)
- `event_eventos_sanitario`, `event_eventos_pesagem`, `event_eventos_nutricao`, `event_eventos_movimentacao`, `event_eventos_reproducao`, `event_eventos_financeiro`

### Queue Stores

Controle de transações pendentes.

- `queue_gestures`: Cabeçalho (Status: `PENDING`, `SYNCING`, `DONE`, `REJECTED`).
- `queue_ops`: Operações individuais (com `before_snapshot`).
- `queue_rejections`: Dead Letter Queue (DLQ).

---

## 2. Semântica de Delete

- **State:** Soft Delete (`deleted_at`).
- **Event:** Imutável. Correção via contra-lançamento.

---

## 3. Pipeline de Sync

1.  **Create Gesture:** Cliente grava em `queue_gestures` e `queue_ops`.
2.  **Optimistic UI:** Aplica mudança em `state_*` imediatamente.
3.  **Sync Worker:**
    - Lê `PENDING`.
    - Envia `POST /sync-batch`.
    - Processa resposta.
    - Se `REJECTED`: Executa **Rollback Local** usando snapshots.

---

## 4. Rollback Local

Mecanismo crítico para consistência eventual em caso de rejeição.

- **Snapshot:** Antes de qualquer write local, o estado anterior é salvo em `queue_ops.before_snapshot`.
- **Reversão:** Se rejeitado, o worker restaura o snapshot (LIFO).

---

## 5. Table Mapping

Mapeamento entre Domínio (Remoto) e Dexie (Local):

- `animais` → `state_animais`
- `eventos` → `event_eventos`
- `eventos_sanitario` → `event_eventos_sanitario`

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
- [**DB.md**](./DB.md)
