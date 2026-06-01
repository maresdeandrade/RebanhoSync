```markdown
# No Broad Context — RebanhoSync

Regra: não abrir contexto amplo sem necessidade objetiva.

---

## Proibido por Padrão

Não fazer sem justificativa explícita:
* Ler o repositório inteiro;
* Abrir todos os documentos de `docs/`;
* Abrir `docs/archive/**`;
* Abrir todos os arquivos `AGENTS.md`;
* Abrir todos os arquivos `SKILL.md`;
* Rodar grep global genérico antes de saber o escopo;
* Carregar manual completo para uma tela específica;
* Carregar matriz KPI completa para tarefa não financeira;
* Carregar compliance sanitário para ajuste visual ou formulário simples;
* Carregar migrations legadas como fonte ativa;
* Usar auditorias antigas como contrato atual.

---

## Fluxo Correto

Antes de expandir o contexto:
1. Identificar o tipo da tarefa.
2. Identificar arquivos-alvo prováveis.
3. Ler o `AGENTS.md` local, se existir.
4. Ler apenas documentos específicos do domínio.
5. Só expandir o escopo se houver lacuna real de informação.

---

## Quando Pode Expandir

Expandir contexto somente se:
* O ponto de intervenção não está claro;
* Há risco de regressão transversal;
* Há conflito entre código e documentação;
* Envolve *sync/offline*, RLS, migrations ou RPC;
* Envolve a fonte de verdade do domínio;
* Envolve arquitetura entre módulos;
* A tarefa pede explicitamente uma auditoria ampla.

---

## Como Justificar Expansão

Ao expandir, registre seguindo a estrutura:

```txt
Expandi contexto porque:
- Dúvida: [Descrever a dúvida técnica]
- Arquivos já verificados: [Listar caminhos]
- Risco: [Descrever o impacto ou regressão potencial]
- Próximo arquivo necessário: [Caminho do arquivo]

```

---

## Antipadrões vs. Boas Práticas

### Evitar (Antipadrões):

* ❌ "Vou analisar todo o repositório."
* ❌ "Vou ler todos os documentos."
* ❌ "Vou abrir todos os fluxos."
* ❌ "Vou carregar a documentação completa."
* ❌ "Vou usar todos os manuais como base."

### Preferir (Boas Práticas):

* 🟢 "Vou verificar apenas o fluxo de Agenda e os arquivos diretamente relacionados."
* 🟢 "Vou carregar o contrato de fontes e a tela afetada."
* 🟢 "Vou consultar a skill sanitária operacional, sem abrir compliance regulatório."

---

## Regra de Ouro

> 💡 Se a tarefa pode ser resolvida exclusivamente com **1 regra global**, **1 documento específico**, **1 arquivo-alvo** e **1 teste relacionado**, não carregue mais nada.

```

```