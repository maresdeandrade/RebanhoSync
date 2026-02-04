# Estratégia Offline-First

O sistema utiliza **Dexie.js** (IndexedDB) para persistência local e uma arquitetura de fila de gestos para sincronização.

## Stores Dexie
- `state_*`: Cópia local das tabelas do Supabase para leitura instantânea.
- `events_*`: Log local de eventos ocorridos.
- `queue_gestures`: Metadados do grupo de operações (TX).
- `queue_ops`: Operações individuais (Insert/Update/Delete) com snapshots para rollback.
- `queue_rejections`: Erros retornados pelo servidor que exigem ação do usuário.

## Fluxo de Escrita
1. O usuário realiza uma ação.
2. `createGesture` gera um `client_tx_id`.
3. As operações são salvas em `queue_ops` e aplicadas imediatamente em `state_*` (Otimista).
4. O `SyncWorker` detecta o gesto pendente e envia para o servidor.

## Rollback Determinístico
Se o servidor rejeitar uma operação (ex: falha na regra de negócio), o `SyncWorker` utiliza o `before_snapshot` salvo na `queue_ops` para restaurar o estado local anterior, garantindo que o que o usuário vê seja sempre consistente com a realidade do banco.