# Guia de Testes Offline

## 1. Simular Offline
- No Chrome DevTools, aba **Network**, mude de "No throttling" para **Offline**.
- Realize uma ação no app (ex: registrar animal - via console por enquanto).
- Verifique na aba **Application > IndexedDB** que o gesto está como `PENDING`.

## 2. Sincronização
- Volte para **Online**.
- O `SyncWorker` deve disparar em até 5 segundos.
- Verifique o status do gesto mudar para `DONE`.

## 3. Rejeição (Anti-teleporte)
- Tente enviar um UPDATE de `lote_id` em um animal sem um evento de movimentação no mesmo batch.
- O servidor retornará `REJECTED`.
- Verifique a página `/reconciliacao` para ver o erro e o rollback automático no store local.