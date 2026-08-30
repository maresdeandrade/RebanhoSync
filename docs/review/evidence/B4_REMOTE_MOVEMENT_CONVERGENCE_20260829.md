# B4 — E2E remoto de convergência de `eventos_movimentacao`

## Decisão

`READY — B4 REMOTE_CONVERGENCE_VERIFIED / F22C UNBLOCKED`

O round-trip real Device A → staging → Device B e a reconstrução após clean install foram comprovados. A F22C não foi iniciada nesta execução.

## 1. Baseline

- branch: `test/b4-remote-movement-convergence`;
- baseline: `main@b110f0a566d9aa99c83769032d6b7ffdc7956c01`;
- worktree B4 criada limpa e isolada em `C:\Users\mares\dyad-apps\GestaoAgro-b4-remote`;
- nenhum código runtime, migration, RLS, RPC, Edge Function ou schema Dexie foi alterado.

## 2. Staging utilizado

- projeto Supabase: `zqloazqzhwauamcejmuz`;
- região: `sa-east-1`;
- estado observado: `ACTIVE_HEALTHY`;
- Edge Function: `sync-batch` v25, `verify_jwt=true`;
- execução factual: `2026-08-29T19:49:14.084Z`.

## 3. Fixtures isoladas

Execução válida: `b4-20260829-164700-925f5064`.

- fazenda A: `e9ac2a40-c68e-41fd-8f6e-5eca092071d2`;
- fazenda B: `9b8c4670-fefd-4065-b1a5-0b75123b61d7`;
- lote X: `61ac6c90-1e32-4fe3-9ae5-342ae2b71192`;
- lote Y: `3894a6d8-3fb4-4bd8-803d-87591e2e7707`;
- animal A: `91cc44ae-23ba-4fba-81de-cc3bbcc2f226`.

As fixtures receberam `run_id` e `fixture=true`. Uma primeira tentativa de preparação, `b4-20260829-163844-f88358dd`, também foi identificada e incluída no cleanup. Nenhum dado produtivo foi utilizado.

## 4. Device A

O perfil de navegador `b4-device-a` utilizou IndexedDB próprio (`RebanhoSync`). Antes do fato, o animal estava no lote X e os stores de Evento e detail estavam vazios.

O fluxo executado foi:

```txt
buildEventGesture
→ createGesture
→ queue_gestures / queue_ops
→ processGesture
→ sync-batch
→ staging
```

Evidência local antes do push:

- gesture: `PENDING`;
- operações: `animais`, `eventos`, `eventos_movimentacao`;
- Evento e detail aplicados otimisticamente;
- `state_animais.lote_id` atualizado para Y.

Evidência local após o push:

- gesture: `DONE`;
- resultado: `APPLIED`;
- operações remanescentes: `0`;
- três resultados de operação `APPLIED`.

Identidades:

- Evento: `a209d369-977c-46ee-baf0-af1821062c8a`;
- `client_tx_id`: `53460b83-1c77-4ad9-82f0-95dfc5b4ec85`;
- `client_id`: `browser:056aa16f-3bd5-48e7-bdb1-0aa0d2b66150`.

## 5. Evidência remota

Consulta direta em staging confirmou:

- pai: exatamente `1` linha em `eventos`;
- detail: exatamente `1` linha em `eventos_movimentacao`;
- `fazenda_id`: fazenda A em pai e detail;
- `animal_id`: animal A;
- origem: lote X;
- destino: lote Y;
- `occurred_at`: `2026-08-29T19:49:14.084Z`;
- mesmo `client_tx_id` no pai e no detail;
- `animais.lote_id`: lote Y.

## 6. Device B — bootstrap

O perfil independente `b4-device-b` iniciou com:

- animais: `0`;
- lotes: `0`;
- Eventos: `0`;
- details de movimentação: `0`;
- gestures: `0`;
- operações: `0`.

Após selecionar a fazenda A e executar o bootstrap/pull padrão:

- pai presente com a identidade remota;
- detail presente com X → Y;
- mesmo `client_tx_id` do Device A;
- animal presente com lote atual Y;
- contagens da fazenda A: `1` Evento e `1` detail.

Nenhum IndexedDB do Device A foi compartilhado.

## 7. Idempotência

Um segundo `pullDataForFarm` no Device B preservou exatamente:

- Eventos: `1 → 1`;
- details: `1 → 1`;
- chaves do pai e detail presentes antes e depois;
- resultado: `idempotent=true`.

## 8. Cross-farm

Com store novamente limpa, o pull da fazenda B, para a qual o usuário fixture não possuía membership, retornou:

- animais: `0`;
- lotes: `0`;
- Eventos: `0`;
- details: `0`;
- linhas da fazenda A no store: `0`.

Resultado: `noLeak=true`.

## 9. Reinstall

O IndexedDB do Device B foi apagado integralmente e reaberto com schema vazio. `pullInitialData(fazenda A)` reconstruiu:

- o mesmo Evento;
- o mesmo detail X → Y;
- o mesmo `client_tx_id`;
- o animal no lote Y;
- contagens `1` pai e `1` detail;
- resultado: `sameHistory=true`.

## 10. Retry

Foi simulado o caso permitido em que o servidor aplica o batch e o cliente repete por não ter recebido a resposta. O mesmo payload foi reenviado ao `sync-batch` com os mesmos `client_tx_id` e `client_op_id`.

- HTTP: `200`;
- três operações: `APPLIED`;
- staging após replay: `1` pai e `1` detail;
- identidades distintas observadas: `1` transação no pai e `1` no detail;
- estado atual: lote Y.

Não houve duplicidade nem perda.

## 11. Pai/detail e estado atual

Em store limpa, o detail foi puxado antes do pai:

- estado temporário: `parent=false`, `detail=true`;
- após pull do pai: `parent=true`, `detail=true`;
- vínculo: `linked=true`;
- órfãos permanentes: `0`.

Após o pull do read model, `state_animais.lote_id` coincidiu com `eventos_movimentacao.to_lote_id` e o resultado foi `coherent=true`.

## 12. Problemas encontrados e patch

Problemas operacionais do harness:

1. `.env` do checkout original declarava variáveis sem valores e a primeira tentativa administrativa foi rejeitada com HTTP 401 antes de qualquer escrita.
2. refs `@e5` sem aspas foram interpretados como splatting pelo PowerShell; a automação foi repetida com refs citados.
3. após `db.delete()`, Dexie exigiu `db.open()` explícito no harness antes do pull seguinte.

Nenhum desses pontos revelou defeito no produto. Não houve patch runtime.

## Validações remotas

- Device A real, queue e `sync-batch`: aprovado;
- consulta remota pai/detail/read model: aprovada;
- Device B limpo e bootstrap: aprovado;
- segundo pull: aprovado;
- cross-farm: aprovado;
- reinstall: aprovado;
- replay idempotente: aprovado;
- detail antes do pai: aprovado, sem órfão permanente;
- cleanup: `0` fazendas, lotes, animais, Eventos, details, memberships e usuários Auth remanescentes para os dois `run_id`.

## Cleanup

Foram removidos somente os IDs e `run_id` criados pela execução, na ordem das dependências. Os dois perfis de navegador e o servidor Vite foram encerrados. Nenhuma fixture foi intencionalmente preservada.
