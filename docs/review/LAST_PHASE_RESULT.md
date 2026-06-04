# Last Phase Result — RebanhoSync

Atualizado em: 2026-06-04
**Baseline Commit:** `8cd5534`

## 1. Nome da fase

Fase 9 — Subfase 9B: Relatórios Operacionais de Custo Parcial.

---

## 2. Fonte de continuidade usada

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md`
- `docs/context/PROJECT_STATUS.md`

---

## 3. Objetivo

Fechar tecnicamente a Subfase 9B com relatório operacional parcial de custo apoiado na base consolidada na 9A:

- inventário;
- entradas;
- saídas/consumos;
- saldo econômico parcial conhecido;
- custo ausente separado;
- leitura derivada/read model.

---

## 4. Resultado consolidado

Subfase 9B concluída localmente no escopo técnico definido.

Entregue:

- `inventory.partialCost` em `src/lib/reports/operationalSummary.ts`;
- cálculo fora da UI;
- apresentação em `src/pages/Relatorios.tsx`;
- leitura derivada/read model;
- custo operacional parcial conhecido;
- entradas com custo conhecido;
- saídas/consumos com custo conhecido;
- saldo econômico parcial conhecido por lote ativo;
- separação explícita de custo ausente;
- `0` tratado como custo válido;
- `null`/`undefined` tratados como custo ausente;
- ausência de inferência de custo quando snapshot está ausente.

---

## 5. Arquivos principais alterados na 9B

| Arquivo | Motivo |
|---|---|
| `src/lib/reports/operationalSummary.ts` | Criar `inventory.partialCost` e calcular custo parcial derivado do inventário. |
| `src/lib/reports/__tests__/operationalSummary.test.ts` | Cobrir custo conhecido, custo ausente, `0`, `null` e `undefined`. |
| `src/pages/Relatorios.tsx` | Apresentar o bloco de custo operacional parcial sem calcular regra na UI. |
| `src/pages/__tests__/Relatorios.e2e.test.tsx` | Validar exibição do bloco de custo parcial no relatório. |
| `docs/review/CURRENT_PHASE_HANDOFF.md` | Atualizar continuidade da Fase 9 após fechamento da 9B. |
| `docs/review/ACTIVE_PHASE_PLAN.md` | Registrar 9B concluída localmente e Fase 9 em andamento. |
| `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md` | Registrar fechamento da 9B no plano específico da Fase 9. |
| `docs/context/PROJECT_STATUS.md` | Atualizar estado vivo do projeto. |

---

## 6. Validações executadas

| Comando | Resultado |
|---|---|
| `git diff --check` | Passou. |
| `pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts` | Passou. |
| `pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx` | Passou. |
| `pnpm test` | Passou (260 arquivos, 1747 testes). |
| `pnpm run lint` | Passou. |
| `pnpm run build` | Passou com warnings conhecidos de Browserslist/chunks. |

Validação Supabase/RLS não foi executada nesta subfase porque não houve alteração em Supabase, migrations, RLS, RPC, edge functions ou seed.

---

## 7. Resultado técnico da 9B

Confirmado:

- custo conhecido e custo ausente ficam separados;
- `0` explícito permanece diferente de `null`/ausente;
- movimentação sem snapshot de custo não tem custo inferido;
- saldo econômico parcial conhecido usa custo persistido no lote ativo;
- read model permanece derivado;
- UI apenas apresenta o read model;
- Fase 9 continua em andamento.

---

## 8. Restrições preservadas

Não houve avanço para:

- DRE;
- ROI;
- venda;
- abate;
- margem;
- custo por arroba;
- motor comercial avançado;
- aptidão automática para venda;
- aptidão automática para abate;
- financeiro automático.

Contratos preservados:

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico append-only.
state_* = estado atual/read model.
Protocolo = regra/configuração, não execução.
Snapshot = evidência histórica congelada/read model derivado.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
Tags/sinais/insights = auxiliares, nunca fonte primária.
```

---

## 9. Pendências remanescentes

Pendências não bloqueantes permanecem em `docs/review/OPEN_REVIEW_ITEMS.md`:

1. Ruído residual em `stderr/stdout` de testes.
2. Warnings conhecidos de build.
3. Revisão futura de avisos de Dialog/act em testes.

Não há pendência aberta conhecida para a leitura parcial de custo operacional da 9B.

---

## 10. Próximo passo recomendado

Continuar Fase 9 sem marcar a fase inteira como concluída.

Antes de nova implementação:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

---

## 11. Status final

```txt
Fase 9B Relatórios Operacionais de Custo Parcial: concluída localmente.
Suite global: verde (260 arquivos, 1747 testes).
Lint: verde.
Build: verde com warnings conhecidos.
Fase 9 completa: ainda em andamento.
```
