# Arquitetura Offline-First

## Dexie Schema
- **State Stores:** Prefixados com `state_`, mantêm a última versão conhecida do dado.
- **Event Stores:** Prefixados com `event_`, log de fatos imutáveis.
- **Queue Stores:**
  - `queue_gestures`: Agrupador de operações (transação do cliente).
  - `queue_ops`: Operações individuais (INSERT/UPDATE/DELETE).
  - `queue_rejections`: Log de erros retornados pelo servidor para reconciliação.

## Fluxo de Escrita
1. `createGesture(ops)` é chamado.
2. Operações são salvas na fila local.
3. Operações são aplicadas **imediatamente** no store local (Optimistic UI).
4. `SyncWorker` detecta o gesto pendente e envia para o servidor.

## Rollback
Se o servidor rejeitar uma operação (`REJECTED`), o worker chama `rollbackOpLocal(op)`, que restaura o `before_snapshot` salvo no momento da aplicação otimista.