# Review Docs — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `91e0775`

## Objetivo

Esta pasta concentra revisões ativas do RebanhoSync.

Use `docs/review/` para relatórios, checklists e pendências que ainda orientam ação atual.

---

## Regra central

```txt
Se ainda orienta ação atual → docs/review/
Se virou contrato estável → pasta normativa correspondente
Se é histórico/fechado/substituído → docs/archive/
```

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `REVIEW_CHECKLIST.md` | Checklist padrão para revisão documental, técnica e operacional. |
| `OPEN_REVIEW_ITEMS.md` | Pendências abertas das revisões. |
| `AI_CONTEXT_OPTIMIZATION_REPORT.md` | Relatório ativo de otimização de contexto, agentes, prompts e tokens. |
| `DOCS_RECONCILIATION_REPORT.md` | Relatório ativo de reorganização documental. |
| `ACTIVE_REVIEW_INDEX.md` | Índice das revisões ativas. |
| `README.md` | Explica a pasta. |
| `PLANO_FASE_11_5_SANITARIO_AGENDA_V2.md` | Plano ativo da Fase 11.5 — Agenda Sanitária v2. |

---

## Quando usar esta pasta

Use `docs/review/` quando a tarefa envolver:

- auditoria ativa;
- reconciliação documental;
- revisão de agentes;
- otimização de contexto;
- pendência aberta;
- checklist de revisão;
- validação pré-PR;
- análise transversal ainda não convertida em contrato estável.

---

## Quando não usar

Não usar `docs/review/` como fonte primária para:

- regra de domínio;
- arquitetura final;
- fonte de verdade;
- escopo de produto;
- UX final;
- regra financeira final;
- manual de usuário.

Usar:

| Tema | Pasta |
|---|---|
| Fonte de verdade/lacunas/status | `docs/context/` |
| Arquitetura/sync/RLS/testes | `docs/technical/` |
| Domínio agropecuário | `docs/domain/` |
| Produto/roadmap/escopo | `docs/product/` |
| UX/copy/telas | `docs/ux/` |
| Financeiro/KPI | `docs/finance/` |
| Manual/suporte | `docs/manuals/` |
| Histórico fechado | `docs/archive/` |

---

## Relação com `docs/archive/`

`docs/review/` é temporário e acionável.

`docs/archive/` é histórico.

Uma revisão deve ser arquivada quando:

- foi concluída;
- foi substituída;
- virou contrato estável em outra pasta;
- não orienta mais ação atual.

---

## Relação com `docs/context/`

Se uma conclusão de review virar regra central, mover ou consolidar em:

```txt
docs/context/SOURCE_OF_TRUTH.md
docs/context/PROJECT_STATUS.md
docs/context/KNOWN_GAPS.md
docs/context/CONTEXT_LOADING_MATRIX.md
```

`docs/review/` não deve competir com `docs/context/`.

---

## Relação com `.agents/`

Revisões podem orientar ajustes em:

```txt
AGENTS.md
.agents/rules/
.agents/skills/
.agents/prompts/
```

Mas regras permanentes devem ficar em `.agents/rules/`, não apenas em relatório de review.

---

## Baseline

Toda revisão ativa deve declarar:

```md
Atualizado em: 2026-05-31  
**Baseline Commit:** `3664395`
```

Motivo:

- rastrear o marco de reorganização;
- facilitar auditoria;
- separar antes/depois;
- permitir comparação por diff.

---

## Validações úteis

### Estado do repo

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
```

### Baseline nos documentos

```bash
rg "Baseline Commit" docs .agents AGENTS.md
```

### Contradições sanitárias

```bash
rg "livre de carência|livre_carencia|carencia_ativa|sem_carencia_vigente|apto para abate|pronto para venda|liberação sanitária" docs .agents
```

### Archive referenciado

```bash
rg "docs/archive" AGENTS.md .agents docs/context docs/technical docs/domain docs/product docs/ux docs/finance docs/manuals docs/review
```

---

## Manutenção

Atualizar esta pasta quando:

- nova revisão ativa surgir;
- pendência for aberta;
- pendência for fechada;
- relatório virar contrato estável;
- revisão for arquivada;
- baseline de reorganização mudar.

Não manter aqui:

- relatório antigo fechado;
- conversa copiada;
- prompt substituído;
- handoff superado;
- auditoria sem ação atual.

---

## Critério de qualidade

A pasta `docs/review/` está saudável quando:

- contém apenas revisões ativas;
- cada revisão tem próxima ação;
- pendências estão em `OPEN_REVIEW_ITEMS.md`;
- regras estáveis foram movidas para docs normativos;
- histórico fechado foi movido para `docs/archive/`;
- nenhum agente precisa carregar review por padrão em tarefa simples.
