---
name: prepare-pr
description: Autoridade interna para preparar título e corpo final de PR do RebanhoSync a partir de uma verificação classificada como READY. Usa o template atual do repositório e somente evidência verificada. Não usar com READY WITH CAVEAT, NOT READY, escopo incerto, implementação em andamento ou antes do rebanhosync-verification-gate.
role: lifecycle
---

# Prepare PR

## Missão

Converter o resultado do `rebanhosync-verification-gate` em uma narrativa final de PR curta, auditável e aderente ao template atual do repositório.

Dentro de `PR_PREPARATION`, esta skill é a autoridade interna para gerar título e descrição do PR. O workflow de CI pode validar a estrutura da descrição, mas não substitui esta etapa nem fornece evidência semântica adicional.

## Entradas obrigatórias

Exigir:

- classificação `READY` do verification gate;
- resumo do diff e arquivos alterados;
- contratos afetados;
- comandos realmente executados e resultados;
- ressalvas e riscos;
- `.github/pull_request_template.md` atual.

Se essas informações não estiverem disponíveis, o resultado for `READY WITH CAVEAT`/`NOT READY` ou o patch tiver mudado depois do gate, interromper a preparação e executar novamente o `rebanhosync-verification-gate` após resolver a ressalva ou bloqueador.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/RESPONSE_FORMATS.md`;
4. `.github/pull_request_template.md`;
5. resultado atual do verification gate.

Ler contexto adicional somente se uma ressalva do gate exigir precisão de domínio. Não reabrir documentação ampla por rotina.

## Restrições

- Não inventar teste, resultado, arquivo, issue, `capability_id`, `infra_id`, risco ou comportamento.
- Não omitir ressalva do gate.
- Não dizer “todos os testes passaram” sem evidência correspondente.
- Não alterar código ou documentação nesta etapa.
- Não expandir o escopo nem introduzir decisão arquitetural nova.
- Não declarar impacto ausente sem confirmação do diff.
- Não tratar CI verde como substituto do verification gate.
- Não editar o PR remoto, criar PR, fazer merge ou push sem autorização explícita para a operação correspondente.

## Título

Usar título curto, acionável e com um único escopo principal.

Formato preferido:

```txt
<tipo>: <ação objetiva>
```

Tipos usuais: `fix`, `feat`, `refactor`, `docs`, `test`, `chore` ou `ui`.

## Corpo do PR

Use exatamente as seções e a ordem de `.github/pull_request_template.md`.

Regras de preenchimento:

- remover comentários HTML instrucionais do template na saída final;
- substituir placeholders por valor confirmado ou `N/A`;
- marcar checkboxes somente quando sustentados pelo diff/gate;
- em `Resumo`, registrar o delta real e o motivo em poucas linhas;
- em `Tipo de mudança`, marcar apenas categorias comprovadas;
- em `Capability / Infra`, não inventar IDs ou issues; usar `N/A` quando não aplicável ou não confirmado;
- em `Escopo alterado`, marcar somente superfícies efetivamente modificadas;
- em `Evidência / Governança`, usar apenas evidência do gate:
  - `PM` para path/trecho verificável;
  - `P` para comando/resultado realmente executado;
  - `N/A` quando a seção permitir e não houver evidência aplicável;
- registrar riscos/caveats apenas quando o template oferecer campo apropriado ou quando forem necessários para não ocultar ressalva real;
- não criar seções alternativas em inglês ou um segundo formato concorrente.

Se o template mudar, prevalece o arquivo atual do repositório.

## Saída obrigatória

Retornar:

1. título do PR;
2. corpo em Markdown pronto para copiar, conforme o template atual;
3. notas de revisão somente se úteis;
4. checklist pós-merge somente se houver ação imediata real.

Ser conciso e não superestimar o impacto.
