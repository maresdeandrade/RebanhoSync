# Prompts — RebanhoSync

Prompts reutilizáveis para reduzir contexto repetido e padronizar execução por tipo de tarefa.

## Princípios

- Não colar documentação longa sem necessidade.
- Não usar prompts arquivados como fonte ativa.
- Sempre respeitar `AGENTS.md`.
- Sempre respeitar `.agents/rules/CORE_RULES.md`.
- Usar `.agents/rules/CONTEXT_LOADING.md` para decidir o contexto mínimo.
- Usar `.agents/rules/no-broad-context.md` para evitar leitura ampla.
- Usar `.agents/rules/rtk.md` quando envolver comandos, validação, pnpm, Graphify, WSL ou Windows.
- Usar `reusable/CONTEXT_BLOCK_MINIMAL.md` apenas quando precisar fornecer contexto compacto para uma IA externa.
- Não usar prompt de auditoria para executar patch local.
- Não usar prompt de patch local para auditoria ampla.

---

## Estrutura

```txt
.agents/prompts/
  README.md

  continuity/
    START_NOVA_CONVERSA.md
    UPDATE_FINAL_DE_FASE.md
    UPDATE_CONTEXTO_EM_ANDAMENTO.md
    CHECK_CONTEXT_DRIFT.md

  codex/
    PATCH_LOCAL.md
    FEATURE_SMALL.md
    REVIEW_DIFF.md
    DOCS_RECONCILE.md

  antigravity/
    ARCHITECTURE_REVIEW.md
    FLOW_MAPPING.md
    RISK_REVIEW.md

  reusable/
    CONTEXT_BLOCK_MINIMAL.md
    VALIDATION_CHECKLIST.md

```

---

## Continuity

Use para transição de conversa, fechamento de fase e coerência documental.

| Prompt | Quando usar |
|---|---|
| `continuity/START_NOVA_CONVERSA.md` | Iniciar nova conversa a partir de handoff, plano ativo e contexto colado. |
| `continuity/UPDATE_FINAL_DE_FASE.md` | Encerrar fase/subfase validada e atualizar documentação permanente. |
| `continuity/UPDATE_CONTEXTO_EM_ANDAMENTO.md` | Conversa ficou longa, mas a fase/tarefa ainda não terminou. |
| `continuity/CHECK_CONTEXT_DRIFT.md` | Verificar se handoff, plano ativo, roadmap e pendências estão coerentes. |

---

## Codex

Use para implementação, correção, revisão de diff e documentação.

| Prompt | Quando usar |
|---|---|
| `codex/PATCH_LOCAL.md` | Correção pequena, localizada e testável. |
| `codex/FEATURE_SMALL.md` | Funcionalidade pequena, delimitada e sem refatoração ampla. |
| `codex/REVIEW_DIFF.md` | Revisar alterações já feitas. |
| `codex/DOCS_RECONCILE.md` | Reconciliar documentação com estado real do repositório. |

---

## Antigravity

Use para análise antes de patch ou para mapear riscos/fluxos.

| Prompt | Quando usar |
|---|---|
| `antigravity/ARCHITECTURE_REVIEW.md` | Revisão arquitetural sem executar patch automaticamente. |
| `antigravity/FLOW_MAPPING.md` | Mapear fluxo funcional ou jornada do app. |
| `antigravity/RISK_REVIEW.md` | Revisar riscos antes de implementar ou aprovar mudança. |

---

## Reusable

Blocos auxiliares, não substituem prompts principais.

| Arquivo | Uso |
|---|---|
| `reusable/CONTEXT_BLOCK_MINIMAL.md` | Contexto mínimo para IA externa ou tarefa curta. |
| `reusable/VALIDATION_CHECKLIST.md` | Checklist de validação para revisão, patch ou fechamento. |

---

## Archive

Prompts substituídos ou históricos.

Regra:

```txt
Não usar `.agents/prompts/archive/**` como fonte ativa.
```

Prompts arquivados podem ser consultados apenas para histórico.

---

## Escolha rápida

```txt
Conversa nova:
  continuity/START_NOVA_CONVERSA.md

Final de fase:
  continuity/UPDATE_FINAL_DE_FASE.md

Conversa longa em andamento:
  continuity/UPDATE_CONTEXTO_EM_ANDAMENTO.md

Checar coerência documental:
  continuity/CHECK_CONTEXT_DRIFT.md

Bug localizado:
  codex/PATCH_LOCAL.md

Feature pequena:
  codex/FEATURE_SMALL.md

Revisar diff:
  codex/REVIEW_DIFF.md

Reconciliar documentação:
  codex/DOCS_RECONCILE.md

Revisar arquitetura:
  antigravity/ARCHITECTURE_REVIEW.md

Mapear fluxo:
  antigravity/FLOW_MAPPING.md

Revisar risco:
  antigravity/RISK_REVIEW.md
```

---

## Fonte de verdade

Em caso de conflito, seguir:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico em `docs/archive/**`.

Prompts ajudam a executar tarefas; não substituem contratos de domínio.