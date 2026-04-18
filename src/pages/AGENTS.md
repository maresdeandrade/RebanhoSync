# PAGES — LOCAL ENTRYPOINT FOR CODEX

Escopo:
- Dispatcher local para telas em `src/pages/**`.
- Priorizar recortes pequenos, sem alterar comportamento por acidente.
- Este arquivo so define trilhos da camada de paginas; regra global permanece no `AGENTS.md` raiz.

## Leitura minima
1. `src/pages/AGENTS.md`
2. `src/pages/<Hotspot>/README.md` (quando existir)
3. `AGENTS.md` raiz (apenas para regras globais)

## Hotspots desta camada
- `src/pages/Registrar/**`
- `src/pages/Agenda/**`
- `src/pages/ProtocolosSanitarios/**`

Dispatch local por hotspot:
- `src/pages/Registrar/AGENTS.md`
- `src/pages/Agenda/AGENTS.md`
- `src/pages/ProtocolosSanitarios/AGENTS.md`

Entrypoints fisicos consolidados:
- `src/pages/Registrar/index.tsx`
- `src/pages/Agenda/index.tsx`
- `src/pages/ProtocolosSanitarios/index.tsx`

## Regras locais
- Nao misturar regra de negocio forte na UI quando ja existir servico em `src/lib/**`.
- Preservar rotas e pontos de entrada (`index.tsx`) ao folderizar paginas.
- Evitar refatoracao ampla de tela sem rodada propria.
- Preferir colocalizacao incremental (`components/`, `helpers/`, `types.ts`) por hotspot.

## Quando escalar
- Se tocar offline/sync: consultar `src/lib/offline/AGENTS.md`.
- Se tocar sanitario: consultar `src/lib/sanitario/AGENTS.md`.
- Se tocar reproducao: consultar `src/lib/reproduction/AGENTS.md`.

## Validacao minima
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
