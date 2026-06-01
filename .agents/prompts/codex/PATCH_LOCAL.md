```markdown
# Codex Prompt — Patch Local

Use para correção pequena, localizada e testável.

## Tarefa

Corrija o seguinte problema:

```txt
[DESCREVER_PROBLEMA]

```

## Escopo

### Arquivos-alvo prováveis:

* `[LISTAR_ARQUIVOS]`

### Escopo permitido:

* `[O_QUE_PODE_ALTERAR]`

### Escopo proibido:

* Não alterar migrations, seed, RLS, RPCs ou testes fora do escopo.
* Não refatorar por conveniência.
* Se encontrar risco fora do escopo, reporte sem corrigir.
* `[O_QUE_NAO_PODE_ALTERAR]`

## Regras Obrigatórias

### Diretrizes de Contexto e Arquitetura:

Siga estritamente as diretrizes contidas em:

* `AGENTS.md`
* `.agents/rules/CORE_RULES.md`
* `.agents/rules/CONTEXT_LOADING.md`
* `.agents/rules/no-broad-context.md`
* `.agents/rules/rtk.md`

### Instruções de Execução:

1. Não faça leitura ampla do repositório.
2. Leia apenas arquivos-alvo, testes relacionados e `AGENTS.md` local, se existir.
3. Proponha o menor patch possível.

### Preservação de Domínio:

* **Resiliência:** *Offline-first*, RLS e *multi-tenant*.
* **Isolamento:** Segregação estrita por `fazenda_id`.
* **Agenda:** Mantida estritamente como intenção.
* **Evento:** Mantido estritamente como fato histórico.
* **`state_*`:** Representa o estado atual do elemento.
* **Protocolo:** Tratado como regra ou configuração.
* **Tags/Sinais/Insights:** Atuam apenas como elementos auxiliares.

## Validação

Antes de finalizar, verifique o estado do repositório:

```bash
git status --short --untracked-files=all

```

Execute a validação proporcional:

```bash
rtk pnpm test -- [TESTE_RELACIONADO]

```

Se a alteração afetar uma entrega ampla, execute o fluxo completo:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

## Entrega

Responder com a seguinte estrutura de tópicos:

* **Resumo do problema:** [Descrição sucinta da falha corrigida]
* **Patch aplicado:** [Bloco de código ou diff do patch]
* **Arquivos alterados:** [Lista de arquivos modificados]
* **Validações executadas:** [Resultados dos testes e comandos executados]
* **Riscos/pendências:** [No máximo 3 pontos identificados]

```

```