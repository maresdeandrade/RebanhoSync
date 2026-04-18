# PROTOCOLOS SANITARIOS — LOCAL AGENT

Escopo:
- Tela de orquestracao de pack oficial, overlay regulatorio e protocolos operacionais.

Regras:
- Preservar separacao entre base oficial, overlay e operacao local.
- Nao introduzir regra normativa nova na UI se ja existir servico dedicado.
- Preferir patch pequeno sem alterar comportamento consolidado.

Nao fazer sem rodada propria:
- Reestruturar contratos sanitarios ou regras regulatórias canônicas.
- Alterar invariantes de compliance.

Validacao:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
