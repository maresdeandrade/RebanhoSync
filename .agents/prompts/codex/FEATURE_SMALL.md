```markdown
# Codex Prompt — Feature Pequena
Atualizado em: 2026-06-04  
Versão: 1.1.0

Use para implementar uma funcionalidade pequena, delimitada e sem refatoração ampla.

## Objetivo

Implementar:

```txt
[DESCREVER_FEATURE]

```

### Escopo permitido

* `[LISTAR_O_QUE_PODE_SER_ALTERADO]`

### Escopo proibido

* `[LISTAR_O_QUE_NAO_PODE_SER_ALTERADO]`

### Arquivos-alvo prováveis

* `[LISTAR_ARQUIVOS_OU_PASTAS]`

## Regras do RebanhoSync

### Contratos do Domínio:

* **Agenda:** Representa estritamente uma intenção ou tarefa futura.
* **Evento:** Representa um fato estritamente executado e consolidado.
* **`state_*`:** Atua como o estado atual / *read model*.
* **Protocolo:** Representa uma regra ou configuração pré-definida.
* **Tags/Sinais/Insights:** São elementos auxiliares, nunca a fonte primária de dados.

### Arquitetura e Segurança:

* Preservar a arquitetura *offline-first*.
* Preservar regras de RLS, *multi-tenant* e isolamento estrito por `fazenda_id`.
* Não colocar regra de negócio crítica dentro de componentes React.
* Não criar fontes paralelas de verdade.
* Não automatizar carência, peso confiável, venda/abate ou aptidão operacional sem uma fonte técnica explícita.

## Estratégia Obrigatória

1. Identificar a fonte de verdade a ser utilizada.
2. Mapear e identificar todos os arquivos afetados.
3. Implementar um patch incremental minimalista.
4. Criar ou ajustar testes unitários/integração mínimos.
5. Validar exaustivamente o impacto no domínio, UI, sincronização (*sync*) e RLS.
6. Manter o escopo restrito, sem expandir para outros domínios da aplicação.

## Validação

Verifique o estado do repositório local:

```bash
git status --short --untracked-files=all

```

Execute a validação local obrigatória:

```bash
rtk pnpm test -- [TESTE_RELACIONADO]
rtk pnpm run lint

```

Se a alteração tocar em fluxos críticos do sistema:

```bash
rtk pnpm run build

```

Se a alteração tocar na camada do Supabase, regras de RLS ou sincronização (*sync*):

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

## Critérios de Aceite

* Feature completamente implementada dentro do escopo delimitado.
* Ausência de nova fonte paralela de verdade.
* Sem regressão nos contratos e invariantes do domínio.
* Todos os testes relacionados passando com sucesso.
* Validação proporcional executada e formalmente relatada.

## Entrega

Responder com a seguinte estrutura de tópicos:

* **Resumo executivo:** [Descrição da funcionalidade entregue]
* **Arquivos criados/alterados:** [Lista de arquivos modificados ou novos]
* **Decisões técnicas:** [Justificativa das escolhas de implementação]
* **Testes/validações:** [Resultados dos comandos e coberturas validadas]
* **Riscos/pendências:** [No máximo 3 pontos identificados para atenção futura]

```

```