# Sanitario/Protocolos - Encerramento da Fase 1

## Contrato final

- `logical_item_key` identifica a etapa logica.
- `protocolos_sanitarios_itens.id` identifica a versao fisica imutavel.
- `agenda_itens.protocol_item_version_id` aponta para a versao fisica usada na geracao da agenda.
- `eventos_sanitario.protocol_item_version_id` aponta para a versao fisica usada na execucao.
- `eventos_sanitario.protocol_item_snapshot` preserva a regra aplicada no fato historico.
- UI, reports e read models exibem `item_code` e `version` quando precisam mostrar a etapa para humanos.

## O que foi removido

- Contrato operacional concorrente baseado no identificador legado de etapa.
- Fallback de `source_ref` para prefill sanitario.
- Fallback de materializacao/recompute SQL para agenda sanitaria.
- Escrita do campo antigo em builders, seeds funcionais, fixtures e scripts Codex.
- Indice/read model que tentava resolver agenda por identificador legado.

## Onde protocol_item_id ainda existe, se existir

Permanece somente como alvo de limpeza na migration `20260531001000_protocolos_sanitarios_drop_legacy_protocol_item_id.sql`.

Tambem pode aparecer em documentos de review anteriores que registram o estado pre-encerramento. Esses documentos nao sao fonte normativa depois deste encerramento.

## Justificativa para qualquer permanencia tecnica

A permanencia tecnica e necessaria apenas para permitir reset/migracao local partindo de estados intermediarios da Fase 1B. Ela remove dados JSON antigos, constraint antiga e coluna antiga. Nenhum fluxo novo consulta ou grava esse campo.

## Testes adicionados

- Varredura de contrato contra reintroducao das chaves legadas em codigo, testes, scripts e migrations ativas, exceto a migration tecnica de remocao.
- UI do `FarmProtocolManager` exibindo `item_code / vN`.

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

- Alguns nomes camelCase de estado de tela e rota ainda usam `protocoloItemId`; semanticamente eles carregam a versao fisica selecionada, nao o campo legado de schema.
- Relatorios avancados ainda nao calculam carencia, custo sanitario ou aptidao comercial.
- Concorrencia multi-tenant em staging continua fora da Fase 1.

## Proxima fase recomendada

Iniciar Fase 2 com foco em rastreabilidade sanitaria operacional: produto aplicado, lote/partida, dose efetiva, carencia calculada e consequencias comerciais.
