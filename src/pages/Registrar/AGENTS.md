# REGISTRAR — LOCAL AGENT

Escopo:
- Hotspot operacional de registro de manejo.
- Mudancas devem ser incrementais, com diff pequeno e sem regressao funcional.

Prioridades:
1. Manter `index.tsx` funcional.
2. Extrair somente funcoes puras para `helpers/`.
3. Colocalizar UI local em `components/` sem duplicar regra de dominio.

Nao fazer sem rodada propria:
- Reescrever fluxo completo da tela.
- Mudar contratos de sync/offline, payload canonico ou invariantes append-only.
- Introduzir politica de negocio forte na camada de pagina.

Validacao:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
