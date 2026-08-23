# Graphify Usage — RebanhoSync

Use Graphify quando a tarefa envolver:

* Mapa de dependências;
* Relação entre módulos;
* Impacto transversal;
* Análise arquitetural;
* Investigação em que a descoberta dirigida não localizou um arquivo-alvo confiável.

Se `graphify-out/GRAPH_REPORT.md` existir, consulte-o antes de regenerar o grafo.

Não use Graphify por padrão para:

* Arquivo-alvo já conhecido;
* Alteração de texto ou microcopy;
* Atualização documental localizada;
* Patch visual pequeno;
* Teste unitário isolado.

Graphify auxilia a descoberta; não substitui inspeção do código, do diff ou dos testes reais.

## Comandos

Siga obrigatoriamente `.agents/rules/rtk.md`. Quando `rtk` e Graphify estiverem disponíveis:

```bash
rtk graphify query "<pergunta>"
rtk graphify path "<arquivo-ou-conceito-A>" "<arquivo-ou-conceito-B>"
rtk graphify explain "<conceito>"
```

Atualize o grafo apenas após mudança estrutural relevante:

```bash
rtk graphify update .
```

Não invente comandos nem afirme que o grafo foi atualizado sem saída confirmatória.
