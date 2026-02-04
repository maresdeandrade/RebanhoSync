# Guia de Testes Offline

## 1. Testar Persistência Local
- Abra o DevTools -> Application -> IndexedDB.
- Execute um comando no console para criar um gesto:
```javascript
import { createGesture } from './src/lib/offline/ops';
createGesture('farm-uuid', [{ table: 'state_animais', action: 'INSERT', record: { id: crypto.randomUUID(), identificacao: 'TEST-01', sexo: 'M' } }]);
```
- Verifique se o animal aparece em `state_animais` e o gesto em `queue_gestures`.

## 2. Simular Offline
- No DevTools -> Network, mude para "Offline".
- Crie um gesto. Verifique na TopBar o contador de "pendentes".
- Mude para "Online". Verifique o SyncWorker processando (contador zera).

## 3. Simular Rejeição (Anti-Teleporte)
- Crie um gesto de UPDATE em um animal alterando o `lote_id` SEM incluir um evento de movimentação no mesmo batch.
- O servidor retornará `REJECTED`.
- Verifique se o animal voltou ao lote anterior localmente (Rollback).
- Verifique o alerta de erro na TopBar e a página `/reconciliacao`.