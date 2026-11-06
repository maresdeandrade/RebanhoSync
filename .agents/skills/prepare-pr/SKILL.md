---
name: prepare-pr
description: Usar para redigir título e corpo de PR do RebanhoSync após patch concluído, verification gate READY vigente para o mesmo conteúdo/escopo e template atual disponível. A redação não autoriza criar ou integrar PR, fazer push, merge ou deploy.
role: lifecycle
---

# Prepare PR

## Missão

Converter o resultado do `rebanhosync-verification-gate` em uma narrativa final de PR curta, auditável e aderente ao template atual do repositório. A autorização READY se aplica à preparação do texto, não à criação, publicação ou integração do PR. Ressalvas e riscos confirmados pelo gate devem permanecer explícitos na narrativa.

Dentro de `PR_PREPARATION`, esta skill é a autoridade interna para gerar título e descrição do PR. O workflow de CI pode validar a estrutura da descrição, mas não substitui esta etapa nem fornece evidência semântica adicional.

## Entradas obrigatórias

Usar somente após a classificação `READY`, conforme `AGENTS.md`, e com:

- resumo do diff e arquivos alterados;
- contratos afetados;
- comandos realmente executados e resultados;
- ressalvas e riscos;
- `.github/pull_request_template.md` atual.

Se as informações estiverem incompletas, a classificação for `READY WITH CAVEAT`/`NOT READY` ou o patch tiver mudado após o gate, não apresentar a narrativa como pronta para PR; apontar a lacuna ou ressalva sem convertê-la em autorização para integrar. Reexecutar o verification gate somente quando patch ou evidência precisarem de reclassificação.

## Leitura inicial

Reutilize o bootstrap único de `AGENTS.md`; não releia rules já carregadas por referência nesta skill. Leia `.agents/rules/RESPONSE_FORMATS.md`, o template atual `.github/pull_request_template.md` e o resultado vigente do verification gate.

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
- Preparar o texto não autoriza integração, publicação, push, merge ou deploy; cada operação exige autorização explícita separada.

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
- registrar riscos e caveats confirmados em campo apropriado do template; se não houver campo, incluí-los de forma concisa sem alterar as seções ou a ordem do template;
- não criar seções alternativas em inglês ou um segundo formato concorrente.

Se o template mudar, prevalece o arquivo atual do repositório.

## Saída obrigatória

Retornar somente o título e o corpo solicitados, usando as seções/ordem do template e incluindo ressalvas confirmadas. Notas de revisão são opcionais quando necessárias; a saída não inicia nem autoriza operação remota.

Ser conciso e não superestimar o impacto.
