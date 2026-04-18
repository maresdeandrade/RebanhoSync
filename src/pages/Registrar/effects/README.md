# Registrar Effects

Coloque aqui efeitos com IO (local/remoto) usados pelo hotspot `Registrar`.

Effects atuais:
- `sanitaryRpc.ts`: tenta confirmar pendencia sanitaria no servidor (RPC + pull) e sinaliza fallback para fluxo offline quando necessario.
- `sanitaryContext.ts`: carrega contexto sanitario para finalize (lookup de item de protocolo + composicao de payload/metadata).
- `animalLookup.ts`: carrega `animalsMap` em lote (bulkGet) para evitar N+1 no submit.
- `reproductionFinalize.ts`: executa finalize reprodutivo com elegibilidade, `prepareReproductionGesture` e redirect de pos-parto.
- `nonFinancialFinalize.ts`: orquestra finalize dos trilhos nao financeiros (sanitario/pesagem/movimentacao/nutricao/reproducao).
- `contraparteCreate.ts`: cria contraparte via gesture offline no fluxo financeiro do Registrar.
- `localQueries.ts`: concentra queries Dexie/adapters locais usados pelo entrypoint (animais, protocolos, contrapartes, catalogo, regulatory source e bull lookup).
- `bootstrap.ts`: concentra refresh inicial de protocolos sanitarios e catalogo veterinario.
- `sourceTaskPrefill.ts`: carrega prefill sanitario vindo de `agenda_itens` (source task).
- `finalizeGesture.ts`: concentra commit final de `createGesture` no fluxo de finalize.
