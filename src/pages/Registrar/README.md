# Registrar Hotspot

## Papel do modulo
- Tela operacional para registrar manejo (sanitario, pesagem, movimentacao, reproducao e financeiro) com suporte a agenda e contexto sanitario.
- Hotspot de alto acoplamento historico; evoluir por recortes pequenos e reversiveis.

## Limites de responsabilidade
- `index.tsx`: composicao de UI, estado de tela, fluxo wizard e orquestracao de chamadas de dominio ja existentes.
- Regras de negocio devem permanecer em `src/lib/**` (animais, sanitario, reproducao, eventos, financeiro, offline).
- Payload persistivel e validacao normativa nao devem nascer na camada de pagina.

## Dependencias permitidas
- Componentes UI em `src/components/**`.
- Hooks de autenticacao, lotes e utilitarios de formato.
- Funcoes de dominio/importacao de `src/lib/**` para montar e enviar gestos/eventos.

## Invariantes
- Preservar comportamento e roteamento atual (`/registrar`).
- Nao quebrar metadata obrigatoria de sync/offline nem contrato append-only de eventos.
- Nao introduzir regra de elegibilidade forte direto na UI quando ja existir servico de dominio.

## Anti-patterns a evitar
- Adicionar novas regras de dominio dentro da pagina sem extracao dedicada.
- Misturar IO remoto/local novo na UI quando existir adapter/servico especifico.
- Refatoracao ampla de uma vez (big-bang) neste hotspot.

## Proximos recortes recomendados
1. Extrair helpers puros de montagem de payload por dominio (`helpers/`).
2. Colocalizar componentes de secoes com estado local (`components/`).
3. Isolar orchestrators por trilho (`sanitize/select/payload/plan/effects/reconcile`) sem alterar comportamento.

## Estrutura local atual
- `index.tsx`: entrada da pagina.
- `HARDENING_PLAN.md`: metas longas, fases e criterios objetivos de conclusao.
- `components/`: scaffold para componentes locais.
- `helpers/`: scaffold para funcoes puras extraidas.
- `effects/`: efeitos com IO usados pela orquestracao (RPC/pull/adapters locais).
- `types.ts`: tipos locais de apoio ao fluxo (ex.: drafts de compra financeira).
