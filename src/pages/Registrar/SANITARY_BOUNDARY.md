# Boundary Registrar x Sanitário

Status: contrato operacional vigente.
Fonte primária: código atual em `src/pages/Registrar/**` e `src/lib/sanitario/**`.

## Boundary atual

| Camada | Responsabilidade | Arquivos |
|---|---|---|
| UI/React | Estado visual, entradas, prefill, refresh, navegação e feedback. | `src/pages/Registrar/index.tsx`, componentes e helpers do Registrar |
| Registrar orchestration | Preflight, carregamento de contexto, composição do fato sanitário independente de Agenda, planos offline e commit. | `src/pages/Registrar/createRegistrarFinalizeController.ts`, `src/pages/Registrar/effects/sanitaryContext.ts`, `src/pages/Registrar/effects/nonFinancialFinalize.ts` |
| Sanitário | Resolver pacote, payload, produto, protocolo e compliance. | `src/lib/sanitario/**`, `src/pages/Registrar/helpers/sanitaryFinalize.ts` |
| Offline/sync | Persistir evento factual por gesture/ops e sincronizar sem alterar Agenda sanitária legada. | `src/lib/offline/**`, `src/pages/Registrar/effects/finalizeGesture.ts`, `supabase/functions/sync-batch/**` |
| Agenda Sanitária V3 | Planejamento, consulta e execução exclusivamente pela Central Sanitária e seus writers autorizados. | `src/pages/ProtocolosSanitarios/**`, `src/lib/sanitario/agenda/**`, `src/lib/sanitario/execution/**` |

## Contratos

- O Registrar pode registrar um fato sanitário independente de Agenda quando o preflight permitir.
- O Registrar não conclui, cancela, reconcilia ou materializa `agenda_itens` sanitária.
- Itens sanitários exibidos na Agenda operacional são encaminhados para a Central Sanitária; itens sem identidade V3 não recebem correspondência inventada.
- A execução originada na Agenda Sanitária V3 usa exclusivamente o writer autorizado da Central Sanitária.
- Agenda é intenção; evento sanitário é fato histórico. O fato não deve ser usado para inferir ou atualizar uma Agenda legada.
- Não existe fallback do Registrar para a RPC `sanitario_complete_agenda_with_event`.

## Limites do Registrar

O Registrar pode compor preflight, payload e plano factual, persistir eventos por operações offline, navegar e emitir feedback. Não deve decidir deduplicação, calendário, sequenciamento, materialização de Agenda, nem acessar RPC de fechamento de Agenda sanitária.

## Validação arquitetural

As regras sanitárias profundas permanecem em `src/lib/sanitario/**`; o Registrar consome adapters e builders. Mudanças futuras na execução V3 devem preservar a separação entre planejamento manual, writer factual autorizado, sync offline-first, idempotência e auditabilidade.
