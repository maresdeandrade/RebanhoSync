# Prompts — RebanhoSync

Prompts reutilizáveis para padronizar tarefas sem repetir regras permanentes nem carregar contexto amplo.

Prompts orientam a execução; não substituem `AGENTS.md`, rules, skills, código, migrations ou documentos normativos.

---

## Bootstrap e princípios

Antes de usar qualquer prompt:

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`.
3. Use `.agents/rules/CONTEXT_LOADING.md` e `no-broad-context.md` para escolher o contexto mínimo.
4. Escolha no máximo uma skill principal; segunda somente em interseção real de domínio crítico.
5. Siga `.agents/rules/rtk.md` para comandos, testes, pnpm, Graphify, WSL/Windows ou validação local.

Regras:

- Não abrir todos os prompts, skills ou documentos por padrão.
- Não usar prompts ou documentos arquivados como fonte ativa.
- Não usar prompt de análise para executar patch.
- Não usar prompt de implementação para substituir verificação independente.
- Não transformar diagnóstico, intenção ou plano em fato concluído.
- Não declarar validação, commit, push ou arquivo alterado sem evidência.
- O prompt não amplia a autorização concedida pelo pedido atual.

---

## Economia de contexto em prompts gerados

Ao gerar prompt para Codex, Antigravity ou outro agente:

- produzir texto referencial, não enciclopédico;
- não repetir contratos já presentes em `.agents/rules/**` ou documentos normativos;
- referenciar o plano/escopo ativo em vez de copiar listas extensas;
- repetir apenas objetivo imediato, diagnóstico obrigatório, restrições específicas, aceite e validação não coberta por `rtk.md`;
- preferir entre 400 e 700 palavras para prompts de execução;
- justificar conteúdo acima de 900 palavras que ainda não esteja documentado;
- evitar cercas Markdown externas no arquivo real.

Forma preferida:

```txt
Seguir integralmente o escopo permitido e proibido definido em:
- docs/review/ACTIVE_PHASE_PLAN.md
- [PLANO_ESPECIFICO_DA_FASE]
```

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

## Escolha por etapa

| Etapa | Prompt/skill | Uso | Não usar para |
|---|---|---|---|
| Descoberta | `repository-context-retrieval` | Localizar ponto de intervenção e contexto mínimo. | Implementar ou validar entrega. |
| Análise arquitetural | `antigravity/ARCHITECTURE_REVIEW.md` | Avaliar responsabilidades, fontes de verdade e riscos estruturais. | Alterar arquivos. |
| Mapeamento | `antigravity/FLOW_MAPPING.md` | Seguir jornada, dados, persistência e falhas ponta a ponta. | Corrigir o fluxo. |
| Risco pré-implementação | `antigravity/RISK_REVIEW.md` | Avaliar mudança proposta e controles mínimos. | Revisar diff pronto. |
| Bug localizado | `codex/PATCH_LOCAL.md` | Correção pequena e testável. | Feature nova ou auditoria ampla. |
| Feature pequena | `codex/FEATURE_SMALL.md` | Comportamento novo delimitado. | Refatoração ampla. |
| Reconciliação documental | `codex/DOCS_RECONCILE.md` | Alinhar docs/prompts/skills às fontes atuais. | Alterar produto. |
| Verificação | `codex/REVIEW_DIFF.md` + `rebanhosync-verification-gate` | Revisar diff e classificar READY/NOT READY. | Corrigir o patch durante a revisão. |
| Preparação de PR | `prepare-pr` | Produzir título/corpo após verificação aprovada. | Compensar validação ausente. |
| Continuidade | `continuity/*` | Preservar ou fechar contexto documental conforme o estado real. | Implementar mudança funcional. |

Análise, implementação, verificação e preparação de PR são etapas distintas.

---

## Continuity

| Prompt | Quando usar |
|---|---|
| `continuity/START_NOVA_CONVERSA.md` | Iniciar conversa a partir de handoff, plano ativo e contexto mínimo. |
| `continuity/UPDATE_FINAL_DE_FASE.md` | Encerrar fase/subfase efetivamente validada e atualizar documentação permanente. |
| `continuity/UPDATE_CONTEXTO_EM_ANDAMENTO.md` | Preservar conversa longa sem marcar tarefa ou fase como concluída. |
| `continuity/CHECK_CONTEXT_DRIFT.md` | Diagnosticar incoerência entre handoff, plano, status e pendências. |

---

## Codex

| Prompt | Quando usar |
|---|---|
| `codex/PATCH_LOCAL.md` | Correção pequena, localizada e testável. |
| `codex/FEATURE_SMALL.md` | Funcionalidade nova, pequena e delimitada. |
| `codex/REVIEW_DIFF.md` | Revisão somente leitura de alterações staged, unstaged e untracked. |
| `codex/DOCS_RECONCILE.md` | Reconciliação documental com o estado confirmado do repositório. |

---

## Antigravity

Todos os prompts desta pasta são somente leitura.

| Prompt | Quando usar |
|---|---|
| `antigravity/ARCHITECTURE_REVIEW.md` | Revisar arquitetura e hardening possível antes de patch. |
| `antigravity/FLOW_MAPPING.md` | Mapear fluxo funcional e de dados ponta a ponta. |
| `antigravity/RISK_REVIEW.md` | Avaliar riscos de mudança proposta antes da implementação. |

---

## Reusable

Blocos auxiliares não substituem prompts principais.

| Arquivo | Uso |
|---|---|
| `reusable/CONTEXT_BLOCK_MINIMAL.md` | Contexto compacto para IA externa ou tarefa curta. |
| `reusable/VALIDATION_CHECKLIST.md` | Checklist proporcional para patch, revisão ou fechamento. |

---

## Archive

Não use `.agents/prompts/archive/**` como fonte ativa. Consulte apenas quando o pedido exigir histórico.

---

## Fonte de verdade

Em conflito, siga:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Documentos normativos ativos.
4. Documentos derivados.
5. Histórico em `docs/archive/**`.
6. Definições procedimentais de rules, skills e prompts.
