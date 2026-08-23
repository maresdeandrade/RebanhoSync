# Graphify Usage — RebanhoSync

## Objetivo

Usar Graphify para descoberta arquitetural e análise de dependências do RebanhoSync.

Graphify auxilia a investigação. **Não substitui inspeção do código, diff, contratos ou testes reais.**

---

## Quando usar

Usar Graphify quando houver:

* dependências entre módulos;
* impacto transversal;
* fluxo distribuído entre vários arquivos;
* análise arquitetural;
* origem ou destino de dados pouco claros;
* dificuldade para localizar um arquivo-alvo confiável.

Evitar Graphify quando houver:

* arquivo-alvo já conhecido;
* alteração textual ou documental localizada;
* microcopy;
* patch visual pequeno;
* teste unitário isolado.

---

## Grafo existente

Antes de regenerar:

```bash
test -f graphify-out/graph.json
test -f graphify-out/GRAPH_REPORT.md
```

No PowerShell:

```powershell
Test-Path .\graphify-out\graph.json
Test-Path .\graphify-out\GRAPH_REPORT.md
```

Se o grafo existir, reutilizá-lo.

---

## Consultas

```bash
graphify query "<pergunta>"
graphify explain "<arquivo-ou-conceito>"
graphify path "<origem>" "<destino>"
```

Preferir perguntas específicas.

Bom:

```bash
graphify query "Como MoverAnimalLote persiste uma mudança de lote e quais funções ou stores são chamadas?"
```

Evitar consultas excessivamente genéricas:

```bash
graphify query "Tudo relacionado a lote"
```

---

## Uso de `path`

Usar `path` preferencialmente entre arquivos, funções ou símbolos específicos:

```bash
graphify path "MoverAnimalLote" "AnimalMovementHistoryTable"
```

Evitar termos genéricos como:

```bash
graphify path "AnimalMovementHistoryTable" "lote"
```

porque podem resolver para variáveis, fixtures ou testes sem relevância arquitetural.

---

## Atualização

Após mudança estrutural relevante no código:

```bash
graphify update .
```

Não atualizar o grafo por alterações de:

* texto;
* microcopy;
* documentação isolada;
* CSS localizado;
* testes sem alteração estrutural.

Verificar necessidade de atualização adicional:

```bash
graphify check-update .
```

Extração completa somente quando necessária:

```bash
graphify extract . --backend gemini
```

Não executar extração completa automaticamente.

---

## Interpretação dos resultados

Resultados de `graphify query` são **candidatos de descoberta**, não escopo confirmado.

Fluxo recomendado:

1. `query` para descobrir candidatos;
2. `explain` nos candidatos relevantes;
3. `path` entre nós específicos quando necessário;
4. inspeção direta do código;
5. confirmação por busca, diff e testes.

Documentação, testes e símbolos homônimos encontrados no grafo não devem ser considerados automaticamente parte do fluxo funcional.

---

## Estratégia para repositórios grandes

Em repositórios grandes, evitar consultas com conceitos genéricos como:

- `evento`;
- `histórico`;
- `dados`;
- `animal`;
- `lote`;
- `sync`;

quando um arquivo ou símbolo específico já for conhecido.

Quando houver símbolo ou arquivo inicial confiável:

1. usar `graphify explain "<símbolo-exato>"`;
2. usar `graphify path "<origem>" "<destino>"` entre símbolos específicos;
3. usar `graphify query "<pergunta>"` apenas para descoberta adicional;
4. não considerar os nós retornados por `query` como escopo confirmado;
5. confirmar relações relevantes diretamente no código antes de definir patch ou impacto.

Preferir nomes completos de símbolos quando houver ambiguidade:

```bash
graphify explain "MoverAnimalLote()"
graphify path "MoverAnimalLote()" "createGesture()"

Evitar:

graphify explain "MoverAnimalLote"
graphify path "MoverAnimalLote()" "lote"
```

## Regras

* Não usar `rtk graphify` quando `rtk` não estiver disponível.
* A ausência de `rtk` não bloqueia Graphify.
* Não inventar comandos.
* Não regenerar o grafo sem necessidade.
* Não afirmar atualização sem saída confirmatória.
* Não tratar `GRAPH_REPORT.md` como fonte de verdade superior ao código.
* Confirmar writers, stores, eventos e persistência diretamente na implementação.
* Preservar as fontes de verdade do RebanhoSync:

  * Agenda = intenção;
  * Evento = fato;
  * `state_*` = estado atual;
  * Protocolo = regra/configuração.
