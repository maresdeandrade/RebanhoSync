# Gate Pos-MVP - Robustez Sanitaria + Custo/Snapshot + Isolamento Comercial

Fonte-guia: `docs/review/Relatorio Consolidado.md`
Data de auditoria: 2026-06-02

## Escopo confirmado

Este gate valida o estado real do repositorio antes de qualquer avanco para venda, abate, DRE, ROI, custo por arroba, aptidao automatica ou financeiro automatico.

Nao houve alteracao de migration, RLS, RPC, schema Supabase ou contrato de sync remoto.

## Buscas obrigatorias executadas

| Busca | Resultado operacional |
|---|---|
| `rg "retirado\|AnimalStatusEnum\|operationalHomeIndicatorsAdapter" src` | `retirado` existe em `AnimalStatusEnum`; indicadores operacionais filtram `status === "ativo"`; testes cobrem exclusao de `retirado`. |
| `rg "getCategoriaAtual\|resolveAnimalClassificationSnapshot\|classificationSnapshot" src` | `getCategoriaAtual` permanece apenas como helper legado em `src/lib/animals/categoriaHelper.ts`; metrics de occupancy passaram a usar `classificationSnapshot`. |
| `rg "sociedade\|RegistrarSociedadeSection" src` | Sociedade existe no Registrar como vinculo patrimonial, com entrada, vinculo, retirada e encerramento. |
| `rg "corrige_evento_id\|source_evento_id\|payload_correcao" src` | Correcoes sanitarias usam novo evento vinculado, pendencia corretiva por `source_evento_id` e payload corretivo. |
| `rg "insumo_movimentacoes\|eventos_sanitario\|custo_unitario\|snapshot" src` | Consumo e eventos sanitarios preservam snapshots de custo/produto/lote; lote sem custo gera snapshot parcial/ausente. |
| `rg "finance_transaction\|finance_transactions" src` | Financeiro aparece como ledger separado; testes comerciais bloqueiam criacao automatica de `finance_transactions`. |
| `rg "agenda_itens\|protocolos_sanitarios_itens\|state_animais" src` | Agenda aparece como intencao/pendencia; insights e testes declaram exclusao de agenda como historico. |

## Checklist do gate

| Criterio | Status | Evidencia |
|---|---|---|
| Relatorio consolidado lido | OK | `docs/review/Relatorio Consolidado.md` usado como fonte-guia. |
| `retirado` isolado de ativo/vendido/morto | OK | `src/lib/offline/types.ts`, `src/features/operationalInsights/operationalHomeIndicatorsAdapter.ts`, `src/features/occupancy/cockpitManejoAdapter.ts`. |
| Sociedade permanece patrimonial | OK | `src/pages/Registrar/components/RegistrarSociedadeSection.tsx`. |
| Sociedade nao gera conformidade sanitaria | OK parcial | Busca nao encontrou geracao sanitaria por sociedade; pendente validacao staging/RLS. |
| Sociedade nao gera financeiro automatico | OK | `src/lib/comercial/__tests__/commercialOperationPersistence.test.ts`. |
| `classificationSnapshot` e leitura operacional | OK | `src/features/occupancy/classification.ts`. |
| Classificacao nao autoriza venda/abate/carencia | OK | Nenhum patch criou autorizacao; `classificationSnapshot` usado apenas para categoria predominante. |
| `getCategoriaAtual` fora de metricas/KPIs | OK | Busca limitada a `src/features/occupancy src/lib/animals` retorna apenas o helper legado. |
| Correcao sanitaria append-only | OK | `src/lib/sanitario/reconciliation/sanitaryCorrections.ts` e testes relacionados. |
| Evento original preservado | OK | Testes de correcoes sanitarias validam novo evento com vinculo. |
| Agenda geral nao vira historico | OK | `src/lib/insights/sourceContract.ts`, `src/lib/sanitario/reconciliation/sanitaryExceptions.ts`. |
| Snapshot economico nao retroativo | OK | `src/lib/inventory/snapshotBuilder.ts`, `src/lib/inventory/consumoGesture.ts`. |
| Lote legado sem custo como ausente/parcial | OK | `src/lib/inventory/__tests__/costing.test.ts`, `src/lib/inventory/__tests__/consumoGesture.test.ts`. |

## Ajuste corretivo aplicado

Occupancy deixou de chamar `getCategoriaAtual` para categoria predominante e passou a resolver a leitura por `resolveAnimalClassificationSnapshot`, com propagacao de `source` e `limitation` em `categoriaStatus` tanto no adapter puro quanto nos builders usados por `useOccupancyData`.

O resolver `classificationSnapshot` agora aceita `categoria_zootecnica` direto como fato armazenado quando disponivel, antes de inferir.

## Pendencias reais

1. Fase 6 sanitaria em staging, incluindo sync/retry/replay.
2. Validacao RLS/multi-tenant para sanitario, estoque e sociedade.
3. Contrato formal de payload corretivo sanitario e politica operacional para lote legado sem custo ainda devem ser consolidados em etapa propria.

## Bloqueios preservados

- Venda.
- Abate.
- DRE.
- ROI.
- Custo por arroba.
- Aptidao automatica para venda/abate.
- Financeiro automatico.
- Carencia liberatoria como autorizacao comercial.
