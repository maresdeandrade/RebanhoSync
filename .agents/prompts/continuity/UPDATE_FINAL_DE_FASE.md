# Update Final de Fase — RebanhoSync

Atualizado em: 2026-11-06
Versão: 1.3.0

Use quando uma fase/subfase validada exigir atualização documental autorizada. O fechamento não exige, por si só, alteração de arquivo; não inicie outra implementação.

## Modo

`MUTACAO_AUTORIZADA` somente para os documentos explicitamente permitidos abaixo. Se não houver mudança durável a registrar em documento canônico autorizado, não altere arquivos.

## Prompt

Registre o fechamento validado da fase/subfase somente nos documentos canônicos afetados e autorizados:

```txt
[IDENTIFICAR_FASE_OU_SUBFASE]
```

### Escopo documental permitido

```txt
[LISTAR_DOCUMENTOS_QUE_PODEM_SER_ALTERADOS]
```

### Arquivamento ou movimentação autorizados

```txt
[NAO | SIM: LISTAR_ALVOS_EXATOS]
```

## Contexto e skill

1. Aplique o bootstrap único definido em `AGENTS.md`; não releia rules já carregadas nesta sessão por referência neste prompt ou na skill.
2. Use `reconcile-docs` como skill principal, sem reiniciar o bootstrap.
3. Consulte somente as fontes necessárias para confirmar os critérios e o estado que o documento autorizado precisa registrar. Handoff e plano ativo são condicionais, não leituras padrão.
4. Para comandos e validações, siga `.agents/rules/rtk.md`.

## Restrições

- Não alterar código funcional, testes, Supabase, migrations, RLS, RPC, schema ou edge functions.
- Não criar feature nem iniciar a próxima fase.
- Não marcar como concluído o que não foi validado.
- Não inventar commit, data, arquivo, teste ou resultado.
- Não transformar roadmap em backlog técnico.
- Não arquivar documentos ativos de continuidade.
- Não usar archive como fonte operacional.
- Não mover nem arquivar qualquer arquivo quando o campo de autorização estiver `NAO`, vazio ou sem alvo exato.
- Não atualizar automaticamente `LAST_PHASE_RESULT.md`, handoff, plano, status ou roadmap.
- Não criar relatório, ADR, handoff ou outro documento para satisfazer um rito de fechamento; só propor ADR quando houver decisão normativa durável, sem criá-lo sem autorização explícita.

## Diagnóstico antes de editar

Confirme apenas os itens necessários para a decisão documental autorizada:

1. fase/subfase e critério de conclusão;
2. evidências de validação;
3. documentos canônicos existentes que de fato precisam de atualização;
4. estado do worktree e `HEAD`, somente se forem relevantes ao conteúdo autorizado;
5. pendências ou arquivos alterados apenas quando o documento autorizado precisar registrá-los.

Se a conclusão ou validações necessárias não estiverem comprovadas, não registrar o fechamento como validado. Se não houver delta documental durável, mantenha os arquivos intactos e relate o fechamento sem criar um artefato.

## Baseline e data

- Registre `HEAD` e data somente se forem necessários ao conteúdo autorizado e houver fonte verificável.
- Se houver alterações funcionais não commitadas e o documento autorizado exigir baseline, registre “baseline pendente de commit”.
- Não gravar `Baseline Commit` em `.agents/prompts/**`, `.agents/rules/**` ou `.agents/skills/**`.

## Atualizar somente quando aplicável

- Alterar apenas documentos canônicos listados no escopo autorizado e cujo conteúdo precise mudar em razão do fechamento validado.
- `docs/review/LAST_PHASE_RESULT.md`, handoff, plano, itens de revisão, status e roadmap não são atualizações automáticas: tocar somente se o arquivo estiver autorizado e houver mudança factual pertinente.
- Não criar relatório de fase, ADR, handoff ou arquivo de archive. Arquivamento ou movimentação exige autorização para o alvo exato.

Não arquivar:

- `LAST_PHASE_RESULT.md`;
- `CURRENT_PHASE_HANDOFF.md`;
- `ACTIVE_PHASE_PLAN.md`;
- `OPEN_REVIEW_ITEMS.md`;
- plano específico da fase ativa.

## Conteúdo do registro autorizado

Quando um documento autorizado precisar de atualização, registrar somente os dados relevantes e confirmados, por exemplo:

- objetivo e resultado técnico;
- arquivos alterados;
- testes criados/ajustados;
- comandos e resultados reais;
- restrições preservadas;
- pendências e riscos;
- próximo passo recomendado, se necessário ao documento;
- baseline/data somente quando exigidos e verificáveis.

## Validação

Para alteração exclusivamente documental, execute a validação proporcional definida em `.agents/rules/rtk.md` e confirme:

- somente arquivos autorizados e documentalmente afetados foram alterados;
- diffs unstaged e staged foram inspecionados;
- arquivos untracked relevantes foram revisados;
- links/referências e cercas Markdown estão válidos;
- `git diff --check` passa.

Não execute testes, lint ou build de produto sem justificativa funcional.

## Entrega

Relate de forma concisa os documentos efetivamente alterados (ou a ausência de delta), evidências e validações executadas, limitações e riscos relevantes, distinguindo fato confirmado, inferência e recomendação quando pertinente. Não crie arquivo para registrar esta resposta.
