# Sanitário — Exceções, Correções e Reconciliação — Fase 5

## Problema resolvido

A Fase 5 cria um fluxo auditável para identificar exceções sanitárias, registrar correções/complementos/estornos e resolver ocorrências reais sem editar destrutivamente o evento histórico original.

## Contrato de exceções sanitárias

O read model `buildSanitaryExceptionsReadModel` lista exceções abertas, resolvidas ou ignoradas a partir de fontes primárias carregadas por parâmetro. Os códigos cobertos incluem rastreabilidade incompleta, custo ausente/inconsistente, baixa de estoque ausente/duplicada, lote vencido, ocorrência aberta, suspeita notificável aberta e pendência corretiva vencida.

## Fonte primária das exceções

Fontes permitidas: `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, `agenda_itens.source_evento_id` e `eventos.payload.biosseguranca_ocorrencia`.

Fontes excluídas como primárias: agenda geral, protocolo isolado, checklist regulatório contextual, tag, marcador e insight.

## Tipos de correção/complemento/estorno

O contrato `SanitaryCorrectionType` cobre:

- `complemento_rastreabilidade`
- `correcao_custo`
- `correcao_lote_estoque`
- `estorno_baixa_estoque`
- `contra_lancamento_estoque`
- `resolucao_ocorrencia_biosseguranca`
- `cancelamento_ocorrencia_biosseguranca`
- `encerramento_pendencia_corretiva`

## Como o evento original é preservado

Correções geram novo evento `conformidade` com `corrige_evento_id`, `sanitary_correction.evento_origem_id`, `tipo_correcao`, `motivo`, `payload_correcao`, `created_by` e `created_at`. O builder de eventos deixou de emitir `UPDATE eventos` para marcar `superseded_by`; o evento original permanece intacto.

## Como estoque é reconciliado

Estorno e contra-lançamento geram novo evento corretivo e uma nova `insumo_movimentacoes` vinculada ao evento corretivo, com `payload.evento_origem_id` apontando para o evento original. O helper bloqueia quantidade inválida e ajuste negativo que deixaria saldo abaixo de zero.

## Como ocorrências são resolvidas/canceladas

Resolução e cancelamento de biossegurança criam evento corretivo vinculado. O read model de biossegurança considera esses eventos para projetar status efetivo `resolvida` ou `cancelada`, sem alterar `payload.biosseguranca_ocorrencia` do evento original.

## Como pendências corretivas são encerradas

O helper de resolução recebe explicitamente `agendaItemIds` específicos. Somente esses itens são atualizados para `concluido` ou `cancelado`; agenda geral não é concluída por esse fluxo.

## UI/superfícies ajustadas

A tela `Eventos` ganhou um painel operacional mínimo de exceções sanitárias com tipo, fonte, gravidade, ação recomendada e ações para complementar evento ou resolver/cancelar ocorrência vinculada.

## Sinais e relatórios adicionados

Relatórios agora expõem `sanitaryExceptions` com total aberto, agrupamentos por tipo/gravidade/animal/lote, estoque inconsistente, custo ausente, pendência vencida e tempo médio de resolução quando há data estruturada.

Sinais adicionados:

- `sanitario:excecao_aberta`
- `sanitario:rastreabilidade_incompleta`
- `sanitario:custo_inconsistente`
- `biosseguranca:ocorrencia_aberta`
- `biosseguranca:ocorrencia_resolvida`
- `biosseguranca:pendencia_corretiva_vencida`

## Testes adicionados

Foram adicionados testes para correções append-only, estorno/contra-lançamento, bloqueio de saldo negativo, resolução/cancelamento de ocorrência, encerramento de pendência específica, preservação do evento original, fechamento de exceções por evento corretivo, agrupamentos de relatório e sinais de exceção.

## Comandos executados

- `pnpm test -- src/lib/sanitario/reconciliation/__tests__/sanitaryExceptions.test.ts src/lib/sanitario/reconciliation/__tests__/sanitaryCorrections.test.ts src/lib/events/__tests__/buildEventGesture.test.ts src/lib/sanitario/__tests__/biosecurityOccurrence.test.ts src/lib/insights/__tests__/sanitaryWithdrawalSignals.test.ts src/lib/reports/__tests__/operationalSummary.test.ts src/pages/__tests__/Eventos.test.tsx` — passou.
- `pnpm test` — executado duas vezes; falhou por timeout em testes de UI quando a suíte roda inteira em paralelo. Os testes reportados como timeout passaram quando rodados isoladamente.
- `pnpm test -- src/lib/sanitario/__tests__/protocolItemLegacyContract.test.ts src/pages/__tests__/OnboardingInicial.e2e.test.tsx src/pages/__tests__/PastosP2.test.tsx src/pages/__tests__/Relatorios.e2e.test.tsx src/components/layout/__tests__/SideNav.test.tsx src/components/sanitario/__tests__/FarmProtocolManager.test.tsx src/pages/__tests__/AnimalPosParto.e2e.test.tsx` — passou.
- `pnpm test -- src/pages/__tests__/Animais.test.tsx` — passou.
- `pnpm run lint` — passou.
- `pnpm run build` — passou.
- `powershell -File scripts/codex/validate.ps1 -TouchedPaths "src/lib/sanitario","src/lib/events","src/lib/reports","src/lib/insights","src/features/operationalInsights","src/pages/Eventos.tsx","src/pages/Agenda","src/pages/Registrar","src/components/sanitario","src/lib/offline","supabase/migrations"` — falhou no passo interno `pnpm test` pelos mesmos timeouts de UI em suíte ampla.
- `graphify update .` — passou.
- `git diff --check` — passou.

## Riscos remanescentes

1. A UI ainda é operacional mínima; estorno e contra-lançamento estão implementados como helpers testados, mas não têm formulário completo dedicado.
2. O fechamento de exceções é por tipo de correção vinculado, não por reconciliação materializada em banco.
3. Sem migration nesta fase; persistência depende do contrato atual de `eventos.payload` e operações offline existentes.

## Próxima fase recomendada

Fase 6: robustez sanitária em staging, cobrindo concorrência, retry/sync, RLS, baseline Supabase e operação real de reconciliação em múltiplos dispositivos.
