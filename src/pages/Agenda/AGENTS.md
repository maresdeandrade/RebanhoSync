# AGENDA — LOCAL AGENT

Escopo:
- Hotspot de agenda operacional, filtros, agrupamentos e navegação crítica.

Regras:
- Preservar semantica Two Rails (agenda = intencao futura mutavel).
- Evitar duplicar regras de prioridade/calendario ja existentes em `src/lib/agenda/**` e `src/lib/sanitario/**`.
- Mudancas de UI devem ser locais e revisaveis.

Nao fazer sem rodada propria:
- Reenquadrar modelo de dados da agenda.
- Alterar contrato de integracao com registro de eventos.

Validacao:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
