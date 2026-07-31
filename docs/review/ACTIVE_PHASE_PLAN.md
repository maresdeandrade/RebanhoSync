# Plano ativo — Fase 12 / Sync Remoto Sanitário v2

Atualizado em: 2026-07-30
Status: **Fase 12 ativa; Sync Sanitário v2 em andamento**
Próximo incremento: **3.8 — Push/pull de histórico sanitário externo/documental**

Este documento contém o plano corrente. Estado técnico detalhado, validações e risco de plataforma ficam em [CURRENT_PHASE_HANDOFF.md](./CURRENT_PHASE_HANDOFF.md). A decisão arquitetural permanente está em [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md).

## Resultado já consolidado

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync Remoto Sanitário v2 — **em andamento**.

A Conformidade Sanitária v2 permanece um read model local derivado, somente leitura e recalculado a partir de fontes factuais. Ela não libera venda, abate, leite ou aptidão operacional.

## Estado do Sync Remoto Sanitário v2

| Subitem | Estado canônico |
|---|---|
| 3.1 Diagnóstico schema local/remoto | Concluído |
| 3.2 Migrations necessárias | Fundação concluída |
| 3.3 RLS e isolamento multi-tenant/fazenda | Concluído tecnicamente |
| 3.4 Push/pull de agenda sanitária | Implementado; E2E remoto parcial |
| 3.5 Push/pull de `agenda_animais` | Implementado; E2E remoto parcial |
| 3.6 Push/pull de evento sanitário | Implementado; E2E remoto pendente |
| 3.7 Push/pull de detalhe sanitário | Implementado; E2E remoto pendente |
| 3.8 Push/pull de histórico externo/documental | **Próximo incremento** |
| 3.9 Push/pull de movimento de estoque sanitário | Pendente |
| 3.10 Retry/replay/idempotência | Implementado; validação remota parcial |
| 3.11 Sucesso parcial | Validado localmente; E2E remoto pendente |
| 3.12 Conflito multi-dispositivo | Código e SQL validados; plataforma bloqueada |
| 3.13 Recalcular Conformidade após pull | Pendente de integração explícita |

O item 3 não está concluído e a Fase 12 não está encerrada.

## Próximo incremento — 3.8

Objetivo: sincronizar histórico sanitário de entrada sem transformar declaração ou documento em execução local.

Escopo:

- sincronizar `external_declared` e `external_documented`;
- preservar origem e evidência;
- exigir referência documental para comprovação crítica;
- reutilizar `queue_gestures` e `queue_ops`, sem fila paralela;
- manter UUID, `client_op_id`, `domain_op_id` e idempotência;
- respeitar tenant e `fazenda_id`;
- implementar pull não destrutivo;
- tratar replay, conflito e sucesso parcial;
- recalcular a Conformidade Sanitária v2 conservadoramente após pull.

Fora do escopo:

- criar Agenda Sanitária v2;
- criar Evento sanitário executado;
- movimentar estoque;
- calcular carência;
- liberar venda, abate, leite ou aptidão operacional;
- habilitar rollout, gate remoto ou feature flag local;
- alterar a semântica do bloqueio de plataforma.

## Regras de domínio do incremento

- Agenda = intenção ou tarefa futura.
- Evento = fato histórico executado.
- Closure administrativa = encerramento da intenção, não execução.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Conformidade = leitura derivada, não fonte primária.
- Agenda concluída sem Evento não comprova execução.
- Cancelamento e dispensa não criam fato sanitário.
- Execução parcial vale somente para os animais vinculados ao Evento.
- `external_declared` não comprova regra crítica.
- `external_documented` exige referência de evidência para comprovação crítica.
- Baixa de estoque depende de Evento factual.
- Carência depende de produto executado e fonte técnica explícita.
- Tags, sinais, insights e status de sync não são fontes críticas.
- Resposta de sync não libera operação.

## Gate e ambientes

- Supabase staging: `zqloazqzhwauamcejmuz`.
- Produção: não alterada.
- Gate sanitário remoto: desligado, fail-closed.
- Feature flag local: `false`.
- Rollout para usuários: não autorizado.
- Fixtures sintéticas residuais: zero.

O bloqueio `SANITARIO_V2_E2E_PLATFORM_BLOCKED` impede rollout, mas não impede o desenvolvimento do item 3.8 sob gates desligados. Não aumentar timeout nem alterar RPC sem nova evidência.

## Sequência após 3.8

```txt
3.9 Movimento de estoque sanitário
→ 3.13 recálculo explícito da Conformidade após pull
→ reexecução dos E2Es remotos quando a plataforma estiver estável
→ item 4 Produto técnico e fonte por campo
→ item 5 Correção append-only sanitária
→ item 6 Carência operacional
→ item 7 Fechamento da Fase 12
```

Somente depois do fechamento formal da Fase 12 pode iniciar a Fase 13 — Reprodução Operacional v1.

## Critérios de aceite de 3.8

- origem e evidência preservadas no push e no pull;
- `external_documented` sem referência não comprova regra crítica;
- replay não duplica histórico;
- conflito e sucesso parcial ficam rastreáveis;
- pull é merge não destrutivo por `fazenda_id`;
- Conformidade é recalculada conservadoramente;
- nenhum Evento, Agenda, estoque, carência ou liberação operacional é criado por inferência;
- gate remoto e feature flag local permanecem desligados;
- validações proporcionais de domínio, sync/offline e Supabase passam.
