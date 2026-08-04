# No Broad Context — RebanhoSync

Regra: não abrir contexto amplo sem necessidade objetiva.

---

## Proibido por Padrão

Não fazer sem justificativa explícita:

* Ler o repositório inteiro;
* Abrir todos os documentos de `docs/`;
* Abrir `docs/archive/**` como fonte operacional;
* Abrir todos os arquivos `AGENTS.md`;
* Abrir todos os arquivos `SKILL.md`;
* Usar mais de uma skill principal;
* Rodar busca global genérica antes de delimitar a dúvida;
* Carregar manual completo para uma tela específica;
* Carregar matriz KPI completa para tarefa não financeira;
* Carregar compliance sanitário para ajuste visual ou formulário simples;
* Carregar migrations legadas como fonte ativa;
* Usar auditorias antigas como contrato atual.

---

## Fluxo Correto

Antes de expandir o contexto:

1. Classificar o tipo real da tarefa.
2. Identificar arquivos-alvo prováveis.
3. Ler o `AGENTS.md` local da área afetada, se existir.
4. Escolher no máximo uma skill principal.
5. Ler apenas documentos específicos do domínio.
6. Expandir somente se permanecer uma lacuna técnica relevante.

Se o ponto de intervenção não estiver claro, usar `repository-context-retrieval` para descoberta dirigida, sem substituir a busca por leitura ampla.

---

## Quando Pode Expandir

Expandir contexto somente se:

* O ponto de intervenção não está claro;
* Há risco de regressão transversal;
* Há conflito entre código e documentação;
* Envolve sync/offline, RLS, migrations ou RPC;
* Envolve a fonte de verdade do domínio;
* Envolve arquitetura entre módulos;
* A tarefa pede explicitamente uma auditoria ampla.

Uma segunda skill só é permitida se a expansão revelar interseção real de domínio crítico. Menção incidental a outro domínio não basta.

---

## Como Justificar Expansão

Ao expandir, registrar de forma curta:

```txt
Expandi contexto porque:
- Dúvida: [dúvida técnica]
- Arquivos já verificados: [caminhos]
- Risco: [impacto potencial]
- Próximo arquivo necessário: [caminho]
```

---

## Regra de Ouro

> Se a tarefa pode ser resolvida com uma regra global, um documento específico, um arquivo-alvo e um teste relacionado, não carregue mais nada.
