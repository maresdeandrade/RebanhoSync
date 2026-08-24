# Operational States — RebanhoSync

Atualizado em: 2026-08-24
Status: **Contrato visual alvo da Fase 18 — documental, ainda não implementado**

## Limite do documento

Este documento padroniza apresentação. O significado técnico, writers, retries, rollback e reconciliação permanecem definidos em [OPERATIONAL_FLOWS](../architecture/OPERATIONAL_FLOWS.md). Agenda continua intenção futura; Evento, fato; `state_*`, read model; protocolo, configuração; Recommendation/Insight, derivação auxiliar.

## Prioridade de apresentação

Quando mais de um estado existir, mostrar primeiro: `REJECTED` → `CONFLICT` → `OFFLINE`/`PENDING` → `SYNCING`/`RETRYING` → `APPLIED_ALTERED` → `APPLIED`. Não converter ausência de dado em sucesso.

## Estados canônicos

| Estado | Rótulo recomendado | Papel visual | Conteúdo obrigatório | Ação típica |
|---|---|---|---|---|
| `OFFLINE` | Sem internet | offline | alcance local e o que aguarda envio | ver dados locais/tentar novamente |
| `PENDING` | Salvo neste aparelho | pending | contagem, origem e persistência local | abrir fila |
| `SYNCING` | Sincronizando | info | atividade e item/contagem | aguardar; não duplicar gesto |
| `RETRYING` | Tentando novamente | info/warning | tentativa e próxima condição | abrir detalhe/cancelar só se contrato permitir |
| `APPLIED` | Confirmado | success | confirmação factual e horário quando relevante | ver registro |
| `APPLIED_ALTERED` | Confirmado com ajuste | warning | o que foi ajustado e fonte da confirmação | revisar detalhe |
| `PARTIAL` | Concluído parcialmente | warning | aplicados, pendentes/rejeitados e impacto | revisar itens |
| `REJECTED` | Revisão necessária | error | causa por operação; nunca sucesso global | corrigir/reconciliar |
| `CONFLICT` | Conflito de versões | conflict | versões, escopo e risco de sobrescrita | reconciliar |
| `UNKNOWN` | Não determinado | unknown | fonte/cobertura ausente | completar dados |
| `AMBIGUOUS` | Resultado ambíguo | unknown/warning | alternativas e limitação | revisar evidência |
| `NOT_PERMITTED` | Não permitido | not_permitted | regra ou permissão que bloqueia | entender requisito/voltar |
| `UNAVAILABLE` | Indisponível | neutral/unknown | componente/fonte indisponível e alcance | tentar depois quando aplicável |

## Estados de interface

| Estado | Padrão |
|---|---|
| loading | skeleton para estrutura conhecida; spinner + texto para ação; `aria-busy`/`aria-live` |
| empty | explicar ausência, contexto dos filtros e uma ação segura; zero não é ausência automaticamente |
| success transitório | toast para feedback; manter confirmação persistente se afeta decisão |
| disabled | manter rótulo legível e oferecer motivo próximo para ação crítica |
| read-only | sinalizar “Somente leitura” e preservar proveniência; não aparentar campo editável |
| destructive | título com verbo/objeto, consequência, alternativa e confirmação específica |
| stale | indicar data da última fonte e limite de uso; não tratar como atual |
| unavailable | diferenciar permissão, rede, carregamento e inexistência factual |

## Padrões de superfície

- `StatusBadge`: estado curto dentro de linha/card; sempre texto, ícone quando crítico.
- `StateBanner`: estado de página ou risco que altera a próxima ação; título, descrição e CTA.
- `SyncStatusPanel`: composição para fila, rejeição e última confirmação; preservar prioridade.
- `AlertDialog`: confirmação destrutiva; `DialogTitle` e descrição obrigatórios.
- `EmptyState`/`LoadingScreen`/`Skeleton`: estados estruturais; não criar duplicatas locais sem necessidade.

## Parcialidade e decisão

`MetricResult` e `DecisionRecommendation` devem exibir cobertura, período, fontes, limitações e não-autorização. `partial`, `unknown`, `ambiguous` e `not_permitted` não usam aparência de sucesso. Recomendação não vira Evento, Agenda ou autorização comercial por apresentação visual.

## Acessibilidade

- nenhum estado crítico depende apenas de cor;
- mudanças assíncronas usam `role="status"`/`aria-live="polite"`; falha impeditiva pode usar `role="alert"`;
- spinner tem rótulo; animação é ignorada por leitor de tela;
- o foco vai para a mensagem apenas quando o fluxo exige ação imediata;
- linguagem diferencia “salvo localmente”, “enviando”, “confirmado” e “rejeitado”.

## Evidência atual

`SyncStatusBadge`, `OfflinePill`, `OfflineIndicator` e `SyncStatusPanel` já implementam parte desta hierarquia e são reutilizáveis com ajuste. Há duplicação entre pills de offline e entre lógica compacta/painel; consolidar na Fase 19 sem alterar o contrato de sync.
