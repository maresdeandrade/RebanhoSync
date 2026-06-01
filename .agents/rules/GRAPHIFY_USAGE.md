```markdown
# Graphify Usage

Use o Graphify quando a tarefa envolver:
* Mapa de dependências;
* Relação entre módulos;
* Impacto transversal;
* Análise de arquitetura;
* Investigação sem um arquivo-alvo claro.

Se o diretório `graphify-out/` existir, consulte prioritariamente:
* `graphify-out/GRAPH_REPORT.md`

Não é obrigatório para:
* Ajuste local em um arquivo já conhecido;
* Alterações de texto ou *copy*;
* Atualização de documentação;
* Patch visual pequeno;
* Teste unitário isolado.

## Comandos Úteis

Se as ferramentas estiverem disponíveis no ambiente, utilize os seguintes comandos:

```bash
graphify query "<pergunta>"
graphify path "<arquivo-ou-conceito-A>" "<arquivo-ou-conceito-B>"
graphify explain "<conceito>"
graphify update .

```

```

```