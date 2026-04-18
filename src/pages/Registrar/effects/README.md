# Registrar Effects

Coloque aqui efeitos com IO (local/remoto) usados pelo hotspot `Registrar`.

Effects atuais:
- `sanitaryRpc.ts`: tenta confirmar pendencia sanitaria no servidor (RPC + pull) e sinaliza fallback para fluxo offline quando necessario.
- `sanitaryContext.ts`: carrega contexto sanitario para finalize (lookup de item de protocolo + composicao de payload/metadata).
- `animalLookup.ts`: carrega `animalsMap` em lote (bulkGet) para evitar N+1 no submit.
- `reproductionFinalize.ts`: executa finalize reprodutivo com elegibilidade, `prepareReproductionGesture` e redirect de pos-parto.
- `nonFinancialFinalize.ts`: orquestra finalize dos trilhos nao financeiros (sanitario/pesagem/movimentacao/nutricao/reproducao).
- `contraparteCreate.ts`: cria contraparte via gesture offline no fluxo financeiro do Registrar.
