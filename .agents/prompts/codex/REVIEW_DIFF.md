```markdown
# Codex Prompt — Review de Diff
Atualizado em: 2026-06-04  
Versão: 1.1.0

Use para revisar alterações já feitas.

## Tarefa

Revise o diff atual e classifique a entrega.

## Regras

Siga estritamente as diretrizes contidas em:
* `AGENTS.md`
* `.agents/rules/CORE_RULES.md`
* `.agents/rules/no-broad-context.md`
* `.agents/rules/rtk.md`

> **Atenção:** Não implementar patch novo, salvo se a correção for mínima e explicitamente necessária.

## Comandos Iniciais

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat

```

*Nota: Arquivos novos podem aparecer apenas no `git status`.*

## Revisar

Verifique minuciosamente os seguintes pontos:

* Escopo real vs. escopo pretendido;
* Arquivos alterados e *untracked*;
* Regressão de domínio;
* Alteração indevida em migrations, RLS, RPC, seed ou testes;
* Regra de negócio colocada na UI;
* Duplicidade de fonte de verdade;
* Impacto em *offline-first/sync*;
* Impacto *multi-tenant*/RLS;
* Necessidade de teste adicional.

### Contratos Obrigatórios

* **Agenda:** Não pode virar histórico.
* **Evento:** É fonte factual.
* **`state_*`:** Representa o estado atual.
* **Protocolo:** Não é execução.
* **Tags/Sinais/Insights:** Não são fonte primária.
* **Métricas Críticas:** Carência, peso confiável e venda/abate exigem fonte técnica explícita.

## Classificação

Classifique a entrega estritamente sob um dos seguintes status:

* 🟢 **READY**
* 🟡 **READY WITH CAVEAT**
* 🔴 **NOT READY**

## Entrega

Responder com a seguinte estrutura de tópicos:

1. **Classificação:** [Status]
2. **Resumo do diff:** [Breve descrição das mudanças]
3. **Achados críticos:** [Problemas graves encontrados]
4. **Achados menores:** [Melhorias pontuais ou avisos]
5. **Validações executadas:** [O que foi testado/verificado]
6. **Validações pendentes:** [O que ainda precisa ser avaliado]
7. **Recomendação final:** [Ação sugerida para o próximo passo]

```

```