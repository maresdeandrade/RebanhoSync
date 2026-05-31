# Sanitario/Protocolos - Fase 1C

## Contrato final

- Agenda sanitaria referencia etapa por `protocol_item_version_id`.
- Evento sanitario referencia etapa por `protocol_item_version_id` e grava `protocol_item_snapshot`.
- Identidade logica da etapa e `logical_item_key`.
- Versao fisica da etapa e `protocolos_sanitarios_itens.id`.
- Exibicao humana usa `item_code` e `version`.

## O que foi removido

- Coluna legada de identidade operacional em `protocolos_sanitarios_itens`.
- Fallback de `source_ref` para abrir Agenda -> Registrar.
- Fallback SQL em recomputes de agenda sanitaria.
- Campo legado nos builders de etapa customizada, materializacao oficial, fixtures, read models e scripts de validacao.
- Uso ambiguo em read models: filtros e inputs internos passam a falar em `protocolItemVersionId`.

## Onde protocol_item_id ainda existe, se existir

Existe apenas na migration tecnica `20260531001000_protocolos_sanitarios_drop_legacy_protocol_item_id.sql`, que remove chaves antigas de JSON e derruba constraint/coluna antigas quando presentes.

As referencias em documentos historicos de review descrevem estado anterior ou a propria remocao; nao sao contrato operacional.

## Justificativa para qualquer permanencia tecnica

A migration de contracao precisa citar os nomes antigos para limpar `agenda_itens.source_ref`, `agenda_itens.payload`, `eventos_sanitario.payload`, `eventos_sanitario.protocol_item_snapshot`, derrubar constraint antiga e remover a coluna antiga em ambientes que tenham passado pela fase intermediaria.

## Testes adicionados

- `src/lib/sanitario/__tests__/protocolItemLegacyContract.test.ts`: impede reintroducao das chaves operacionais antigas fora da migration tecnica de contracao.
- `src/components/sanitario/__tests__/FarmProtocolManager.test.tsx`: cobre exibicao de `item_code` e `version`.

## Testes ajustados

- Agenda -> Registrar valida que `source_ref` legado nao preenche versao de protocolo.
- Prefill sanitario usa somente `protocol_item_version_id`.
- `buildEventGesture` grava versao fisica e snapshot.
- Operational insights resolvem item por versao fisica e nao por identificador legado.
- Insights sanitarios renomeiam filtros internos para `protocolItemVersionIds`.

## Comandos executados

- `pnpm exec vitest run src/lib/sanitario/__tests__/protocolItemLegacyContract.test.ts src/lib/insights/__tests__/agendaNeeds.test.ts src/lib/insights/__tests__/sanitarySupplyNeeds.test.ts src/lib/insights/__tests__/tagSignals.test.ts src/lib/insights/__tests__/historicalActivitySummary.test.ts src/features/operationalInsights/__tests__/operationalInsightsAdapter.test.ts src/components/sanitario/__tests__/FarmProtocolManager.test.tsx`
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`
- `supabase db reset`
- `node scripts/codex/validate-supabase-baseline-functional.mjs`
- `powershell -File scripts/codex/validate.ps1 -TouchedPaths "src/lib/sanitario","src/lib/offline","src/pages/Registrar","src/pages/Agenda","src/lib/events","supabase/migrations","scripts/codex/validate-supabase-baseline-functional.mjs"`
- `graphify update .`

## Riscos remanescentes

- A query param interna `protocoloItemId` no Registrar ainda representa a versao fisica (`protocol_item_version_id`) por compatibilidade de rota local. Ela nao le `source_ref` legado.
- Documentos historicos podem mencionar o contrato antigo como contexto de auditoria.
- A proxima fase ainda precisa enderecar rastreabilidade de produto/lote/dose e carencia confiavel.

## Proxima fase recomendada

Fase 2: rastreabilidade operacional sanitaria, com produto/lote/dose aplicados, carencia calculavel e base para venda/abate sem alterar o contrato fechado da Fase 1.
