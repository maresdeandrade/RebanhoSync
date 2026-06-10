# Active Review Index — RebanhoSync

Atualizado em: 2026-06-10
**Baseline Commit:** `a180854`

## Objetivo

Listar revisões ativas ou ainda relevantes do RebanhoSync.

Este arquivo é o índice de `docs/review/`.

---

## Regra de permanência

Uma revisão fica em `docs/review/` somente enquanto ainda orienta ação atual.

Quando deixar de orientar ação:

| Situação | Destino |
|---|---|
| Virou contrato estável | Pasta normativa correspondente |
| Foi resolvida e só resta histórico | `docs/archive/` |
| Está obsoleta | `docs/archive/` ou remoção controlada |
| Ainda tem pendências | `docs/review/` |

---

## Revisões ativas

| Revisão | Arquivo | Status | Prioridade | Próxima ação |
|---|---|---:|---:|---|
| Checklist padrão de revisão | `REVIEW_CHECKLIST.md` | Ativo | P0 | Usar em toda revisão documental/técnica. |
| Pendências abertas | `OPEN_REVIEW_ITEMS.md` | Ativo | P0 | Atualizar conforme itens forem resolvidos. |
| Otimização de contexto/agentes | `AI_CONTEXT_OPTIMIZATION_REPORT.md` | Ativo | P1 | Incorporar recomendações em `.agents/` e docs. |
| Reconciliação documental | `DOCS_RECONCILIATION_REPORT.md` | Ativo | P1 | Validar estrutura, baseline, links e archive. |

---

## Revisões por área

## Documentação

### Reconciliação documental

**Arquivo:** `DOCS_RECONCILIATION_REPORT.md`
**Status:** Ativo
**Baseline:** `3664395`

### Objetivo

Consolidar a nova estrutura de documentação:

```txt
docs/context/
docs/technical/
docs/domain/
docs/product/
docs/ux/
docs/finance/
docs/manuals/
docs/review/
docs/archive/
```

### Critério para fechar

- estrutura criada;
- docs ativos com baseline;
- archive separado;
- links internos validados;
- contradições sanitárias resolvidas;
- `OPEN_REVIEW_ITEMS.md` sem P0/P1 documental aberto.

---

## Agentes e contexto

### Otimização de contexto/agentes

**Arquivo:** `AI_CONTEXT_OPTIMIZATION_REPORT.md`
**Status:** Ativo
**Baseline:** `3664395`

### Objetivo

Reduzir consumo de tokens e evitar carregamento amplo desnecessário.

### Critério para fechar

- `AGENTS.md` consolidado;
- `.agents/rules/` consolidado;
- `.agents/skills/` indexado;
- `.agents/prompts/` enxuto;
- `CONTEXT_LOADING.md` atualizado;
- `no-broad-context.md` aplicado;
- prompts sem repetição extensa.

---

## Revisão operacional

### Checklist padrão

**Arquivo:** `REVIEW_CHECKLIST.md`
**Status:** Ativo permanente
**Baseline:** `3664395`

### Objetivo

Padronizar revisão de alterações documentais, técnicas e operacionais.

### Critério para fechar

Não fechar enquanto estiver sendo usado como padrão ativo.

---

## Pendências

### Itens abertos

**Arquivo:** `OPEN_REVIEW_ITEMS.md`
**Status:** Ativo permanente
**Baseline:** `3664395`

### Objetivo

Controlar pendências de revisão.

### Critério para fechar

Não fechar enquanto houver ciclo ativo de revisão.

---

# Histórico de revisões fechadas

Nenhuma revisão fechada registrada nesta versão.

Quando houver revisão fechada, registrar:

| Revisão | Data de fechamento | Destino |
|---|---|---|
| - | - | - |

---

# Como adicionar nova revisão

Criar arquivo em `docs/review/` somente se:

- a revisão ainda orienta ação;
- há pendências reais;
- o relatório não é apenas histórico;
- o conteúdo não pertence melhor a `docs/context/`, `docs/technical/`, `docs/domain/`, `docs/product/`, `docs/ux/`, `docs/finance/` ou `docs/manuals/`.

Adicionar entrada na tabela:

```md
| Nome da revisão | `ARQUIVO.md` | Ativo | P1 | Próxima ação |
```

---

# Como fechar revisão

Antes de fechar:

- confirmar pendências em `OPEN_REVIEW_ITEMS.md`;
- mover regras estáveis para pasta normativa;
- mover histórico para `docs/archive/`;
- atualizar este índice;
- registrar destino.

---

## Critério de qualidade

Este índice é aceitável quando:

- mostra apenas revisões ativas;
- aponta arquivo correto;
- define status;
- define prioridade;
- informa próxima ação;
- não duplica o conteúdo dos relatórios;
- ajuda agentes a decidir o que carregar.
