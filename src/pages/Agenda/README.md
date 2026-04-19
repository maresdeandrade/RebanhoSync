# Agenda Hotspot

## Status estrutural (2026-04-19)
- Hardening estrutural principal concluido.
- Shell deixou de concentrar controller de acoes, shell state, interaction state e blocos macro de composicao (overview/compliance/lifecycle).
- `AgendaGroupedContent` foi fatiado em subcomponentes locais.
- Residual atual: leitura/preparacao de dados no shell (sem acoplamento macro de composicao).

## Papel do modulo
- Superficie operacional para leitura, priorizacao e conclusao de pendencias da agenda.
- Orquestra filtros, agrupamentos, navegacao contextual e acoes rapidas de registro.

## Limites de responsabilidade
- `index.tsx`: composicao de UI, estado de interacao e orquestracao de chamadas existentes.
- `helpers/`: funcoes puras de formatação e filtros da tela (sem side effects).
- `types.ts`: contratos locais de filtro/estado para reduzir acoplamento no entrypoint.
- Regra de elegibilidade, prioridade e semantica sanitaria deve permanecer em `src/lib/**`.
- Persistencia/sync/efeitos continuam fora da camada de pagina.

## Dependencias permitidas
- Componentes de apresentacao em `src/components/**`.
- Leitura de dados e servicos em `src/lib/agenda/**`, `src/lib/sanitario/**` e `src/lib/offline/**` ja existentes.
- Helpers locais de tela em `src/pages/Agenda/helpers/**`.

## Nao alterar sem rodada propria
- Contratos de item de agenda e estrutura de agrupamento.
- Semantica de prioridade critica e buckets de calendario.
- Fluxo de conclusao que grava evento sanitario e reconcilia pendencias.

## Invariantes
- Preservar trilho Two Rails (agenda como intencao futura mutavel).
- Nao introduzir acoplamento forte agenda <-> evento por FK/logica destrutiva.
- Manter comportamento de navegação para `/registrar` e concluicao de pendencia.

## Anti-patterns
- Embutir regra sanitaria normativa diretamente na UI.
- Duplicar calculos de prioridade/metadata que ja existem em `src/lib/agenda` ou `src/lib/sanitario`.

## Backlog local imediato
1. Extrair/normalizar montagem de dados residual do shell para artefatos locais dedicados.
2. Preservar semantica de dominio em `src/lib/**` sem duplicar regra de prioridade/elegibilidade.
3. Refinar estados de experiencia (empty/loading/error/feedback) para consolidacao da fase SLC.
