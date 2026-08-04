# Plano ativo — Fase 12 / Sync Remoto Sanitário v2

Atualizado em: 2026-08-04
Status: **Fase 12 ativa; Sync Sanitário v2 em andamento**
Próximo incremento: **3.13 — Recalcular Conformidade após pull**

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
| 3.8 Push/pull de histórico externo/documental | Implementado e validado localmente; E2E remoto não executado |
| 3.9 Push/pull de movimento de estoque sanitário | Implementado e validado localmente; E2E remoto não executado |
| 3.10 Retry/replay/idempotência | Implementado; validação remota parcial |
| 3.11 Sucesso parcial | Validado localmente; E2E remoto pendente |
| 3.12 Conflito multi-dispositivo | Código e SQL validados; plataforma bloqueada |
| 3.13 Recalcular Conformidade após pull | Pendente de integração explícita |

O item 3 não está concluído e a Fase 12 não está encerrada.

## Resultado do incremento 3.8

O histórico sanitário de entrada faz round-trip por `apply_factual_core` e pela fila compartilhada como `standalone_fact`, sem ser convertido em execução realizada pela fazenda.

Resultado comprovado:

- `external_declared` permanece não comprobatório;
- nova entrada `external_documented` exige referência e cobertura explícita; legado incompleto permanece legível como pendência;
- origem, evidência, snapshots e relação canônica Evento–Animal sobrevivem ao push/pull;
- replay é idempotente e identidade com conteúdo divergente produz conflito;
- pull incremental preserva operação local pendente e trata tombstone remotamente de modo conservador;
- ativação futura faz backfill idempotente dos históricos locais elegíveis criados com o gate desligado;
- a Conformidade usa somente o campo documentalmente coberto, sem recálculo global do item 3.13;
- tenant e `fazenda_id` permanecem isolados;
- nenhuma migration ou alteração de RPC foi necessária.

## Resultado do incremento 3.9

Quando o gate estiver habilitado, o consumo sanitário acompanha a execução factual `primary_execution` no mesmo gesto offline, após evento, detalhe e relações, reutilizando `insumo_movimentacoes`, fila compartilhada, worker e pull incremental existentes. Com gates desligados, o comportamento local vigente permanece sem fila remota.

Resultado comprovado localmente:

- somente execução factual da fazenda com produto, insumo, lote, quantidade e unidade explícitos é elegível;
- Agenda, closure, `standalone_fact`, `external_declared` e `external_documented` não geram movimento;
- `source_evento_id`, `client_op_id`, `client_tx_id` e `domain_op_id` preservam vínculo e identidade;
- replay idêntico não reaplica saldo e conteúdo divergente produz conflito;
- persistência local de fato, movimento, saldo e fila permanece atômica;
- pull incremental protege movimento local pendente e não reaplica baixa;
- trigger existente preserva saldo não negativo e sucesso parcial continua por operação;
- nenhuma migration, alteração de RPC, carência nova ou autorização operacional foi introduzida.

O E2E remoto específico do movimento não foi executado. O bloqueio `SANITARIO_V2_E2E_PLATFORM_BLOCKED`, os gates desligados e o rollout não autorizado permanecem inalterados.

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

O bloqueio `SANITARIO_V2_E2E_PLATFORM_BLOCKED` continua impedindo rollout, sem invalidar a implementação local do item 3.8 sob gates desligados. Não aumentar timeout nem alterar RPC sem nova evidência.

## Sequência após 3.9

```txt
3.13 recálculo explícito da Conformidade após pull
→ reexecução dos E2Es remotos quando a plataforma estiver estável
→ item 4 Produto técnico e fonte por campo
→ item 5 Correção append-only sanitária
→ item 6 Carência operacional
→ item 7 Fechamento da Fase 12
```

Somente depois do fechamento formal da Fase 12 pode iniciar a Fase 13 — Reprodução Operacional v1.

## Critérios preservados após 3.8

- origem e evidência preservadas no push e no pull;
- `external_documented` sem referência não comprova regra crítica;
- replay não duplica histórico;
- conflito e sucesso parcial ficam rastreáveis;
- pull é merge não destrutivo por `fazenda_id`;
- Conformidade lê conservadoramente os fatos puxados, sem concluir o recálculo global do item 3.13;
- nenhum Evento de execução, Agenda, estoque, carência ou liberação operacional é criado por inferência;
- gate remoto e feature flag local permanecem desligados;
- validações proporcionais de domínio, sync/offline e Supabase passam.
