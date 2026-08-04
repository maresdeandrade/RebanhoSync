# Codex Prompt — Reconciliar Documentação

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para alinhar documentação ativa ao comportamento confirmado no código e nas migrations. Não use para fechar fase; nesse caso, use `.agents/prompts/continuity/UPDATE_FINAL_DE_FASE.md`.

## Prompt

Você está reconciliando a documentação do RebanhoSync.

### Objetivo

```txt
[DESCREVER_O_DRIFT_OU_RESULTADO_ESPERADO]
```

### Documentos-alvo

```txt
[LISTAR_DOCUMENTOS]
```

### Código, migrations ou testes de referência

```txt
[LISTAR_AREAS_MINIMAS_DE_REFERENCIA]
```

## Contexto e skill

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Use `reconcile-docs` como skill principal.
4. Para comandos e validações, siga `.agents/rules/rtk.md`.
5. Expanda o contexto somente se houver conflito ainda não resolvido.

Em conflito, siga a precedência definida nas rules: código + migrations ativas → `PROJECT_STATUS.md` → documentos normativos ativos → documentos derivados → histórico.

## Restrições

- Alterar somente documentação, prompts ou skills explicitamente incluídos no escopo.
- Não alterar código, testes, migrations, seed, RLS, RPC ou schema.
- Não usar `docs/archive/**` como fonte operacional.
- Não duplicar contratos já centralizados em rules ou documentos normativos.
- Não reabrir fase fechada nem transformar roadmap em backlog técnico.
- Não mover ou arquivar documento ativo sem confirmar que foi substituído e que suas referências foram atualizadas.
- Preservar `LAST_PHASE_RESULT.md`, `CURRENT_PHASE_HANDOFF.md`, `ACTIVE_PHASE_PLAN.md`, `OPEN_REVIEW_ITEMS.md` e o plano ativo da fase.
- Se o escopo exigir mudança funcional, parar e relatar a expansão necessária.

## Procedimento

1. Confirmar o drift com evidência no código, migration ativa, teste ou documento de maior precedência.
2. Separar fato confirmado, inferência e recomendação.
3. Identificar duplicações, referências quebradas, status obsoletos e documentos ativos apontando para archive.
4. Propor o patch documental mínimo.
5. Aplicar somente após o diagnóstico.
6. Revisar arquivos tracked, staged e untracked.
7. Validar conforme `.agents/rules/rtk.md`.

## Critérios de aceite

- Documentação ativa coerente com as fontes de maior precedência.
- Nenhum contrato duplicado ou nova fonte paralela de verdade.
- Nenhuma referência operacional depende de `docs/archive/**`.
- Pendências fechadas não permanecem como abertas.
- Nenhum arquivo funcional foi alterado.
- Cercas Markdown, links e whitespace estão válidos.
- Validações executadas e não executadas foram relatadas sem invenção.

## Entrega

1. **Diagnóstico**
2. **Fatos confirmados**
3. **Arquivos alterados/movidos**
4. **Referências atualizadas**
5. **Validações executadas**
6. **Validações não executadas e motivo**
7. **Riscos/pendências**, no máximo 3
