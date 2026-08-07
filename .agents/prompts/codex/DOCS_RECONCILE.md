# Codex Prompt — Reconciliar Documentação

Atualizado em: 2026-08-07
Versão: 1.3.0

Use para alinhar documentação ativa ao comportamento confirmado no código e migrations. Não use para fechar fase; nesse caso, use `.agents/prompts/continuity/UPDATE_FINAL_DE_FASE.md`.

## Modo

`MUTACAO_AUTORIZADA` somente para os documentos explicitamente listados.

## Entradas obrigatórias

### Drift ou resultado esperado

```txt
[DESCREVER_DRIFT]
```

### Documentos permitidos

```txt
[LISTAR_DOCUMENTOS_EXATOS]
```

### Fontes mínimas de referência

```txt
[LISTAR_CODIGO_MIGRATIONS_TESTES_OU_DOCUMENTOS_SUPERIORES]
```

## Dependências autoritativas

1. Aplicar `AGENTS.md`, `.agents/rules/CORE_RULES.md` e `.agents/rules/CONTEXT_LOADING.md`.
2. Usar `reconcile-docs` como skill lifecycle principal desta fase.
3. Seguir `.agents/rules/rtk.md` para comandos e validação.

## Escopo proibido

- Não alterar código, testes, migrations, seed, RLS, RPC ou schema.
- Não alterar prompt ou skill que não esteja explicitamente listado.
- Não usar archive como fonte operacional nem arquivar sem autorização explícita e alvo exato.
- Não reabrir fase fechada, transformar roadmap em backlog ou criar fonte paralela de verdade.
- Se a reconciliação exigir mudança funcional, parar e relatar o novo escopo.

## Condições de parada

Não aplicar patch se o drift não estiver comprovado por fonte de maior precedência ou se o documento necessário estiver fora da lista autorizada.

## Saída obrigatória

Usar o contrato de saída de `reconcile-docs`, acrescentando:

1. **Drift confirmado**;
2. **Escopo documental autorizado**;
3. **Confirmação de ausência de alteração funcional**.
