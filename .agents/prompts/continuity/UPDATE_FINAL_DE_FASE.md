# Update Final de Fase — RebanhoSync

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use somente após a fase ou subfase estar validada. Atualiza documentação permanente de continuidade; não inicia nova implementação.

## Modo

`MUTACAO_AUTORIZADA` somente para os documentos explicitamente permitidos abaixo.

## Prompt

Atualize a documentação ativa para registrar o fechamento validado da fase/subfase:

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

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Use `reconcile-docs` como skill principal.
4. Leia apenas os documentos ativos necessários ao fechamento.
5. Para comandos e validações, siga `.agents/rules/rtk.md`.

## Restrições

- Não alterar código funcional, testes, Supabase, migrations, RLS, RPC, schema ou edge functions.
- Não criar feature nem iniciar a próxima fase.
- Não marcar como concluído o que não foi validado.
- Não inventar commit, data, arquivo, teste ou resultado.
- Não transformar roadmap em backlog técnico.
- Não arquivar documentos ativos de continuidade.
- Não usar archive como fonte operacional.
- Não mover nem arquivar qualquer arquivo quando o campo de autorização estiver `NAO`, vazio ou sem alvo exato.

## Diagnóstico antes de editar

Confirme:

1. fase/subfase e critério de conclusão;
2. evidências de validação;
3. estado do worktree antes da edição documental, inclusive staged e untracked;
4. `HEAD` atual e data local;
5. arquivos efetivamente alterados na fase;
6. pendências abertas e fechadas;
7. documentos que exigem atualização;
8. relatórios históricos elegíveis para arquivamento e explicitamente autorizados;
9. documentos que devem permanecer ativos.

Se a conclusão ou as validações não estiverem comprovadas, não fechar a fase.

## Baseline e data

- Capture `HEAD` e data; não invente valores.
- Se houver alterações funcionais não commitadas, registre “baseline pendente de commit”.
- Se o worktree estiver limpo antes da edição documental, o `HEAD` pode ser registrado como baseline da implementação concluída.
- A sujeira criada apenas pela atualização documental posterior não invalida esse baseline, mas deve ser relatada.
- Não gravar `Baseline Commit` em `.agents/prompts/**`, `.agents/rules/**` ou `.agents/skills/**`.

## Atualizar somente quando aplicável

- `docs/review/LAST_PHASE_RESULT.md`: sempre no fechamento validado; permanece ativo.
- `docs/review/CURRENT_PHASE_HANDOFF.md`: apontar de forma curta para a próxima etapa e para o plano ativo.
- `docs/review/ACTIVE_PHASE_PLAN.md`: atualizar somente se a fase/subfase ativa mudar.
- `docs/review/OPEN_REVIEW_ITEMS.md`: manter apenas pendências abertas reais.
- `docs/context/PROJECT_STATUS.md`: somente para mudança consolidada.
- `docs/product/ROADMAP.md`: somente se a sequência macro de fases mudar.
- `docs/archive/review/**`: somente relatórios históricos fechados, já resumidos, sem função ativa e explicitamente autorizados pelo alvo exato.

Não arquivar:

- `LAST_PHASE_RESULT.md`;
- `CURRENT_PHASE_HANDOFF.md`;
- `ACTIVE_PHASE_PLAN.md`;
- `OPEN_REVIEW_ITEMS.md`;
- plano específico da fase ativa.

## Conteúdo mínimo do resultado de fase

Registrar:

- objetivo e resultado técnico;
- arquivos alterados;
- testes criados/ajustados;
- comandos e resultados reais;
- restrições preservadas;
- pendências e riscos;
- próximo passo recomendado;
- baseline/data ou motivo objetivo para não os registrar.

## Validação

Para alteração exclusivamente documental, execute a validação proporcional definida em `.agents/rules/rtk.md` e confirme:

- somente arquivos documentais esperados foram alterados;
- diffs unstaged e staged foram inspecionados;
- arquivos untracked relevantes foram revisados;
- links/referências e cercas Markdown estão válidos;
- `git diff --check` passa.

Não execute testes, lint ou build de produto sem justificativa funcional.

## Entrega

1. **Fase/subfase registrada**
2. **Arquivos criados/alterados/arquivados**
3. **Baseline e data**
4. **Pendências abertas finais**
5. **Próxima etapa**
6. **Validações executadas**
7. **Validações não executadas e motivo**
8. **Confirmação de ausência de implementação funcional**
