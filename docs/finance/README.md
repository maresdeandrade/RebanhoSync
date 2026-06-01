```md
# Finance Docs — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Esta pasta concentra os contratos financeiros e econômicos do RebanhoSync.

Ela define custos, snapshots, limites financeiros e KPIs, sem transformar o MVP em ERP contábil/fiscal completo.

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `FINANCE_BASE.md` | Base conceitual financeira do MVP. |
| `FINANCIAL_LIMITS.md` | Limites: lucro, margem, ROI, custo ausente, peso, aptidão comercial. |
| `COSTING_CONTRACT.md` | Contrato de custos, custo unitário/total, custo ausente, rateio e consumo. |
| `ECONOMIC_SNAPSHOTS.md` | Regras de snapshot econômico em eventos, compra, venda e estoque. |
| `KPI_INDEX.md` | Índice curto dos KPIs prioritários. |
| `KPI_MATRIX_FULL.md` | Matriz completa de KPIs, fontes, fórmulas e limitações. |

---

## Quando usar esta pasta

Use `docs/finance/` quando a tarefa envolver:

- custo;
- receita;
- compra;
- venda;
- estoque com custo;
- snapshot econômico;
- margem;
- KPI financeiro;
- custo sanitário;
- custo por animal/lote;
- custo por produto;
- custo ausente;
- rateio;
- indicador econômico.

---

## Quando não usar

Não usar esta pasta como fonte principal para: RLS, sync/rollback, autenticação, layout visual, regra sanitária clínica, regra de reprodução, navegação ou manual de usuário.

### Guia de Pastas por Tema

| Tema | Pasta |
|---|---|
| Fonte de verdade / lacunas / status | `docs/context/` |
| Arquitetura / sync / RLS / testes | `docs/technical/` |
| Domínio agropecuário | `docs/domain/` |
| Produto / roadmap / escopo | `docs/product/` |
| UX / UI | `docs/ux/` |
| Manual / suporte | `docs/manuals/` |
| Histórico | `docs/archive/` |

---

## Contratos críticos

```txt
Custo ausente ≠ custo zero
Margem parcial ≠ lucro final
Receita de venda ≠ resultado líquido
Snapshot econômico ≠ preço atual
Último peso ≠ peso atual confiável
Carência sanitária ≠ aptidão comercial

```

---

## Leitura recomendada por tarefa

### Ajuste simples de custo

Ler:

* `COSTING_CONTRACT.md`
* `FINANCIAL_LIMITS.md`

### Snapshot econômico

Ler:

* `ECONOMIC_SNAPSHOTS.md`
* `COSTING_CONTRACT.md`

### KPI financeiro

Ler:

* `KPI_INDEX.md`
* `FINANCIAL_LIMITS.md`

> 💡 **Nota:** Só abrir `KPI_MATRIX_FULL.md` se a tarefa envolver modelagem ou implementação de KPI.

### Compra/venda

Ler:

* `FINANCE_BASE.md`
* `FINANCIAL_LIMITS.md`
* `docs/domain/COMPRA_VENDA.md`

### Sanitário com custo

Ler:

* `COSTING_CONTRACT.md`
* `ECONOMIC_SNAPSHOTS.md`
* `docs/domain/SANITARIO.md`

---

## Relação com produto

`docs/product/` define o que entra no MVP. `docs/finance/` define como tratar economicamente o que entrou.

> 💡 **Exemplo:** O Produto permite compra/venda básica. O Financeiro define que valor de venda não é lucro final.

---

## Relação com domínio

`docs/domain/` define as regras agropecuárias. `docs/finance/` define custos e indicadores.

> 💡 **Exemplo:** O Sanitário define evento sanitário como execução. O Financeiro define o snapshot de custo sanitário associado ao evento.

---

## Relação com técnico

`docs/technical/` define: offline-first, sync, rollback, RLS, migrations e testes.

O Financeiro deve respeitar:

* idempotência;
* rollback;
* snapshots;
* isolamento por `fazenda_id`;
* não duplicar baixa/custo em retry.

---

## Fora do MVP

Não tratar como suportado no MVP:

* DRE completa;
* contabilidade formal;
* NF-e;
* SPED;
* apuração tributária;
* ROI completo;
* lucro final;
* custo por arroba confiável sem peso confiável;
* aptidão comercial automática.

---

## Manutenção

Atualizar esta pasta quando houver: novo custo, nova regra de snapshot, novo KPI, nova fórmula, novo rateio, mudança em compra/venda, custo sanitário novo, capacidade financeira saindo de parcial/bloqueado, ou mudança no contrato de custo ausente.

> ⚠️ **Não atualizar por:** ajuste visual, copy sem impacto financeiro, teste isolado, refatoração interna sem mudança de regra, ou auditoria antiga.

---

## Critério de qualidade

Um documento financeiro deve:

* [ ] declarar a fonte;
* [ ] declarar a limitação;
* [ ] evitar promessa de lucro final;
* [ ] distinguir custo ausente de zero;
* [ ] preservar snapshot histórico;
* [ ] não duplicar regras de domínio;
* [ ] não duplicar regras técnicas;
* [ ] ser aplicável ao MVP.

```

```