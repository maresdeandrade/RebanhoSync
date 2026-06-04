# ACTIVE_PHASE_PLAN - Fase 9 Subfase 9B

**Status:** Subfase 9B concluida localmente; Fase 9 em andamento
**Commit Baseline:** `8cd5534`
**Criado:** 2026-06-04
**Atualizado:** 2026-06-04

---

## Objetivo em 1 paragrafo

Fechar relatorio operacional parcial de custo usando a base consolidada na 9A, mantendo inventario, movimentacoes e snapshots como fontes primarias existentes e expondo apenas leitura derivada/read model. Nao avancar para DRE, ROI, venda, abate, margem, custo por arroba ou motor comercial avancado.

---

## Escopo permitido

- Leitura operacional parcial de custo no relatorio existente.
- Uso de `state_insumo_lotes`, `state_insumo_movimentacoes`, snapshots de custo e custo persistido dos lotes.
- Separacao de custo conhecido vs custo ausente.
- Testes proporcionais do read model e da tela de relatorios.
- Documentacao do contrato implementado.

---

## Escopo proibido

- Alteracao de Supabase, migrations, RLS, RPC, edge functions ou seed.
- Mudanca de contrato de Agenda/Eventos/Protocolo.
- Mudanca de logica de inventario, baixa ou snapshot economico de origem.
- Calculo de regra na UI.
- DRE, ROI, venda, abate, margem, custo por arroba ou motor comercial avancado.
- Marcar a Fase 9 inteira como concluida.

---

## Fechamento local da 9B

- `src/lib/reports/operationalSummary.ts` expõe `inventory.partialCost`.
- Entradas com custo conhecido ficam separadas de entradas com custo ausente.
- Saidas/consumos com custo conhecido ficam separados de saidas com custo ausente.
- Saldo economico parcial conhecido e saldo sem custo ficam separados por lote ativo.
- Custo `0` explicito permanece valido e diferente de `null`/ausente.
- `null`/`undefined` sao tratados como custo ausente.
- Custo nao e inferido quando o snapshot esta ausente.
- `src/pages/Relatorios.tsx` apenas apresenta o read model derivado.

---

## Validacao obrigatoria

1. `git status --short --untracked-files=all`
2. `git diff --check`
3. `pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts`
4. `pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx`
5. `pnpm test`
6. `pnpm run lint`
7. `pnpm run build`

---

## Criterio de aceite - 9B

1. Relatorio mostra custo parcial operacional derivado de inventario.
2. Entradas com custo conhecido aparecem separadas.
3. Saidas/consumos com custo conhecido aparecem separados.
4. Saldo economico parcial conhecido aparece separado.
5. Movimentacoes/lotes com custo ausente aparecem separados.
6. `0` explicito permanece diferente de `null`/ausente.
7. Calculo fica fora da UI.
8. Nenhuma regra comercial avancada e criada.
9. Validacoes proporcionais passam.

---

## Resultado esperado

Subfase 9B concluida localmente com relatorio operacional parcial de custo, sem fechar a Fase 9 inteira.
