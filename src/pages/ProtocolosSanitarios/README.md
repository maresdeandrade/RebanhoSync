# ProtocolosSanitarios Hotspot

## Papel do modulo
- Entrada operacional para gestao de protocolos sanitarios da fazenda.
- Orquestra as tres camadas: pack oficial, overlay regulatorio e protocolo operacional.

## Limites de responsabilidade
- `index.tsx`: casca de pagina e wiring dos managers especializados.
- `helpers/useProtocolosData.ts`: carregamento/refresh local de dados e catalogo sem regra normativa.
- Regra regulatoria, catalogo oficial e compliance ficam em `src/lib/sanitario/**` e componentes dedicados.
- A pagina nao deve concentrar logica normativa nova.

## Dependencias permitidas
- Managers visuais em `src/components/sanitario/**`.
- Leituras de dados e catalogo via `src/lib/sanitario/**` e camada offline existente.
- Helper local `src/pages/ProtocolosSanitarios/helpers/useProtocolosData.ts`.

## Nao alterar sem rodada propria
- Contrato do pack oficial e sua aplicacao idempotente.
- Regras de overlay regulatorio e checagens de compliance.
- Semantica de isolamento por `fazenda_id` nas operacoes sanitarias.

## Invariantes
- Preservar separacao entre base oficial, overlay e operacao da fazenda.
- Nao reintroduzir protocolo base hardcoded na UI.
- Manter `produtos_veterinarios` como referencia estruturada do fluxo sanitario.

## Anti-patterns
- Misturar politica regulatoria com layout da pagina.
- Duplicar regras de eligibility e calendario que ja vivem em servicos sanitarios.

## Proximos recortes recomendados
1. Colocalizar wrappers visuais em `components/` se o `index.tsx` crescer.
2. Extrair helpers de carregamento/refresh para `helpers/` quando houver novo acoplamento.
