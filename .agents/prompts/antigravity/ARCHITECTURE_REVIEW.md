```markdown
# Codex Prompt — Architecture Review

Use para revisão arquitetural sem executar patch automaticamente.

## Objetivo

Auditar arquitetura da área abaixo:

```txt
[AREA_OU_FLUXO]

```

## Escopo

### Arquivos ou pastas prováveis:

* `[LISTAR]`

## Regras

### Diretrizes de Contexto:

Siga estritamente as orientações contidas em:

* `AGENTS.md`
* `.agents/rules/CORE_RULES.md`
* `.agents/rules/CONTEXT_LOADING.md`
* `.agents/rules/no-broad-context.md`

> ⚠️ **Restrição:** Não fazer leitura ampla sem justificar.

## Avaliar

Analise a estrutura com base nos seguintes critérios:

* Separação de responsabilidades;
* Fonte de verdade usada;
* Acoplamento UI ↔ regra de negócio;
* *Offline-first*;
* Idempotência;
* *Sync/rollback*, se aplicável;
* RLS/*multi-tenant*, se aplicável;
* Risco de regressão;
* Testabilidade;
* Complexidade desnecessária.

### Contratos do Domínio:

* **Agenda:** Mantida estritamente como intenção.
* **Evento:** Mantido estritamente como fato.
* **`state_*`:** Representa o estado atual.
* **Protocolo:** Tratado como regra ou configuração.
* **Tags/Sinais/Insights:** Atuam apenas como elementos auxiliares.
* **Decisões Críticas:** Exigem fonte técnica explícita.

## Saída

> ⛔ **Nota:** Não implementar sem pedido explícito.

Entregar a resposta estruturada com os seguintes tópicos:

* **Veredito:** [Status da avaliação]
* **Fatos confirmados:** [Comportamentos validados no código]
* **Inferências:** [Premissas assumidas baseadas na arquitetura]
* **Fragilidades:** [Gargalos ou riscos estruturais identificados]
* **Recomendações:** [Diretrizes para sanar os problemas]
* **Patch sugerido em etapas:** [Roteiro sequencial de alterações lógicas]
* **Testes necessários:** [Estratégia de cobertura e cenários obrigatórios]
* **Riscos:** [Mapeamento de no máximo 3 pontos de atenção]

```

```