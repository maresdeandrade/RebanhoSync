```markdown
# Rules — RebanhoSync

Regras compactas para agentes atuarem no RebanhoSync com baixo consumo de contexto.

Esta pasta define **como carregar contexto, executar comandos, responder e evitar leitura ampla**.

Não substitui o `AGENTS.md`; complementa o dispatcher principal.

---

## Arquivos

| Arquivo | Quando usar |
|---|---|
| `CORE_RULES.md` | Sempre. Núcleo fixo do domínio e contratos críticos. |
| `CONTEXT_LOADING.md` | Sempre que precisar decidir quais docs/contextos carregar. |
| `no-broad-context.md` | Sempre que houver risco de leitura ampla ou investigação sem escopo claro. |
| `rtk.md` | Quando envolver comandos, testes, pnpm, Graphify, WSL/Windows ou validação local. |
| `RESPONSE_FORMATS.md` | Quando precisar padronizar saída, revisão, auditoria ou fechamento. |
| `GRAPHIFY_USAGE.md` | Quando houver Graphify e a tarefa exigir relação entre módulos ou impacto transversal. |

---

## Ordem prática

1. Leia `CORE_RULES.md`.
2. Use `CONTEXT_LOADING.md` para escolher o contexto mínimo.
3. Use `no-broad-context.md` para evitar expansão desnecessária.
4. Use `rtk.md` se houver comandos ou validação.
5. Use `RESPONSE_FORMATS.md` para estruturar a resposta.
6. Use `GRAPHIFY_USAGE.md` apenas quando Graphify for necessário.

---

## Regras de economia de contexto

* Não abrir todos os arquivos desta pasta por padrão.
* Não abrir `docs/archive/**` como fonte operacional.
* Não carregar manuais completos para tarefa localizada.
* Não carregar matriz KPI completa sem tarefa financeira/KPI.
* Não carregar compliance sanitário para ajuste visual ou formulário simples.
* Não usar auditorias antigas como contrato atual.

---

## Fonte de verdade

Em caso de conflito, seguir a ordem de precedência:
1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico em `docs/archive/**`.

---

## Objetivo da pasta

Reduzir:
* Prompts longos repetidos;
* Regras duplicadas;
* Leitura ampla do repositório;
* Uso indevido de docs antigos;
* Respostas extensas para tarefas simples.

---

## Estrutura final da pasta

```txt
.agents/rules/
  ├── README.md
  ├── CORE_RULES.md
  ├── CONTEXT_LOADING.md
  ├── no-broad-context.md
  ├── rtk.md
  ├── RESPONSE_FORMATS.md
  └── GRAPHIFY_USAGE.md

```

---

## Comando

```powershell
New-Item -ItemType File -Force .agents/rules/README.md

```

```

```