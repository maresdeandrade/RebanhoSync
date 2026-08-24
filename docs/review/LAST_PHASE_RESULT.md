# Resultado funcional mais recente — Fase 17 / Decisão Assistida

Atualizado em: 2026-08-23
Baseline de entrada observado: `main@1a4bd008d896f1f4c807aec05a3a360f73d3ae50`, alinhado a `origin/main`
Baseline solicitado como referência: `main@f1418be9f5801fec31b220a887d41a678b828900`
Decisão final: **implementação validada e integrada em `main@797f84d3aa49f424bf0b6ca013e416c61f24c41e`**

## Resultado

A primeira entrega da Fase 17 transforma snapshots canônicos locais em recomendações derivadas, explicáveis e sem persistência. Foram implementadas duas decisões de baixo risco:

- qualidade/freshness de peso por animal, usando Evento + detail de pesagem;
- revisão de Agenda aberta e vencida, usando o read model de Agenda.

O contrato `DecisionRecommendation<T>` diferencia `confirmed`, `partial`, `unknown`, `ambiguous` e `not_permitted`, registra cutoff/timezone, cobertura, fontes, convergência, campos presentes/ausentes, conflitos, limitações e ações proibidas. `MetricResult<T>` foi preservado para métricas; não foi forçado a representar semânticas que não possui.

## Guardrails confirmados

- recomendação não é Evento, autorização, execução ou fonte factual;
- Evento-base de pesagem não substitui `eventos_pesagem`;
- Agenda concluída não comprova execução;
- limite de freshness ausente retorna `not_permitted` em vez de usar default fabricado;
- ausência sem cobertura não vira zero, `false` ou certeza;
- conflito não usa last-write-wins silencioso;
- `queue_rejections` só adiciona limitação técnica temporária;
- venda, abate, aptidão e carência não são autorizados;
- registros cross-farm são excluídos dentro dos selectors puros;
- nenhum efeito escreve Evento, Agenda, `state_*`, fila ou recomendação.

## Convergência

| Fonte | Classificação | Uso |
|---|---|---|
| `eventos` | `PULL_PADRAO` | Evento-base factual de pesagem |
| `eventos_pesagem` | `PULL_PADRAO` | detail obrigatório de peso |
| `state_agenda_itens` | `PULL_PADRAO` | intenção aberta/vencida |
| `queue_rejections` | `LOCAL_DERIVADO` | limitação técnica auxiliar com TTL |
| `eventos_movimentacao` | `CONVERGENCIA_NAO_COMPROVADA` | não usado nesta entrega |

## Validação

- 20 testes do contrato de decisão;
- 2 testes do painel de apresentação;
- 47 testes focados de decisão, Home e insights;
- 467 regressões de reports/operationalSummary, insights, sanitary supply/withdrawal, Agenda, financeiro, comercial, occupancy e pull/selectors offline;
- 29 testes de integração;
- 570 testes de hotspots de Agenda/Registrar/Protocolos Sanitários;
- 5 smokes;
- lint global e build de produção aprovados;
- `git diff --check` e gates documentais executados no fechamento.

Warnings de React Router, Browserslist, import misto do Dexie e tamanho de chunks permanecem preexistentes e não bloqueantes.

## Banco, offline e ambientes

Não houve migration, RLS, RPC, Edge Function, store Dexie, queue, mecanismo de sync ou deploy. As recomendações são reconstruídas deterministicamente do snapshot local e cutoff recebidos. Staging, produção, gates remotos e rollout não foram alterados.

## Impacto arquitetural

O [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md) foi consultado e permanece **PRESERVADO**. A entrega adiciona um consumidor/read model puro sobre fontes existentes; não muda writer, truth factual, convergência ou fluxo operacional.

## Próximo estado

A Fase 17 está formalmente encerrada no baseline integrado. O próximo desenvolvimento é a Fase 18 — Rebaseline Visual 360°, cuja primeira entrega esperada é o inventário visual, o Design System documental e a matriz de migração; auditoria e implementação visual ainda não foram iniciadas.
