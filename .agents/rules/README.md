# Rules — RebanhoSync

Regras compactas para agentes atuarem no RebanhoSync com baixo consumo de contexto.

Esta pasta define **como carregar contexto, executar comandos, responder e evitar leitura ampla**. Não substitui o `AGENTS.md`; complementa o dispatcher principal.

---

## Arquivos

| Arquivo | Quando usar |
|---|---|
| `CORE_RULES.md` | Bootstrap obrigatório. Núcleo fixo do domínio e contratos críticos. |
| `CONTEXT_LOADING.md` | Bootstrap obrigatório. Seleciona os documentos, arquivos e a skill mínimos para a tarefa. |
| `no-broad-context.md` | Bootstrap obrigatório. Limita expansão e leitura ampla sem justificativa. |
| `rtk.md` | Quando houver comandos, testes, pnpm, Graphify, WSL/Windows ou validação local. |
| `RESPONSE_FORMATS.md` | Quando a tarefa exigir saída padronizada, revisão, auditoria ou fechamento técnico. |
| `GRAPHIFY_USAGE.md` | Somente quando relações entre módulos, dependências ou impacto transversal justificarem Graphify. |

---

## Ordem prática

1. Leia o `AGENTS.md` do repositório.
2. Leia `CORE_RULES.md`.
3. Aplique `CONTEXT_LOADING.md`.
4. Aplique `no-broad-context.md`.
5. Escolha no máximo uma skill principal; use uma segunda apenas em interseção real de domínio crítico.
6. Use `rtk.md` se houver comandos ou validação.
7. Use `RESPONSE_FORMATS.md` apenas quando a saída precisar de estrutura específica.
8. Use `GRAPHIFY_USAGE.md` somente quando Graphify for materialmente necessário e execute seus comandos conforme `rtk.md`.

---

## Regras de economia de contexto

* Não abrir todos os arquivos desta pasta por padrão além do bootstrap obrigatório.
* Não abrir todas as skills para decidir o roteamento.
* Não abrir `docs/archive/**` como fonte operacional.
* Não carregar manuais completos para tarefa localizada.
* Não carregar matriz KPI completa sem tarefa financeira/KPI.
* Não carregar compliance sanitário para ajuste visual ou formulário simples.
* Não usar auditorias antigas como contrato atual.
* Não usar Graphify quando o arquivo-alvo já for conhecido e o impacto for local.

---

## Fonte de verdade

Em caso de conflito, seguir a ordem de precedência:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Documentos normativos ativos.
4. Documentos derivados.
5. Histórico em `docs/archive/**`.
6. Definições da skill aplicável.

As rules e skills orientam o procedimento de trabalho; não substituem contratos ativos do produto.

---

## Objetivo da pasta

Reduzir:

* Prompts longos repetidos;
* Regras duplicadas;
* Leitura ampla do repositório;
* Uso indevido de documentos antigos;
* Validações desproporcionais ao risco;
* Respostas extensas para tarefas simples.

---

## Estrutura

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

O índice e os gatilhos das skills ficam em `.agents/skills/README.md`.
