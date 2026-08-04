# Codex Prompt — Patch Local

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para corrigir um defeito localizado, com alvo conhecido e sem criar funcionalidade nova ou refatoração ampla.

## Prompt

Corrija no RebanhoSync:

```txt
[DESCREVER_DEFEITO_COMPORTAMENTO_ATUAL_E_ESPERADO]
```

### Evidência ou reprodução

```txt
[ERRO_CENARIO_TESTE_OU_PASSOS_DE_REPRODUCAO]
```

### Escopo permitido

```txt
[LISTAR_ARQUIVOS_OU_AREAS]
```

### Escopo proibido

```txt
[LISTAR_LIMITES_ESPECIFICOS]
```

## Contexto e skill

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Leia o `AGENTS.md` local, se existir, o arquivo-alvo e o teste relacionado.
4. Use a skill do domínio principal somente se o defeito tocar regra crítica; não carregue skills por menção incidental.
5. Para comandos e validações, siga `.agents/rules/rtk.md`.

## Diagnóstico mínimo

Antes de editar, registre:

- causa confirmada ou hipótese a validar;
- fonte de verdade envolvida;
- menor ponto de correção;
- risco de regressão e teste que o contém.

Se a causa ou o alvo não estiverem claros, pare o patch e faça descoberta dirigida. Não mascarar sintoma sem compreender o contrato afetado.

## Regras

- Corrigir a causa com o menor patch seguro.
- Preservar comportamento fora do cenário descrito.
- Não refatorar, renomear ou mover arquivos por conveniência.
- Não criar nova fonte de verdade nem regra crítica na UI.
- Não alterar migrations, RLS, RPC, seed, schema ou testes fora do escopo.
- Preservar offline-first, idempotência, rollback e `fazenda_id` quando aplicável.
- Adicionar ou ajustar teste de regressão quando tecnicamente viável.

## Validação

Siga `.agents/rules/rtk.md` e confirme:

- estado inicial e final do worktree, inclusive staged e untracked;
- reprodução antes do patch, quando possível;
- teste relacionado após o patch;
- `git diff --check`;
- validações adicionais somente se proporcionais ao risco.

## Critérios de aceite

- Cenário defeituoso corrigido.
- Teste de regressão cobrindo o comportamento ou justificativa objetiva para sua ausência.
- Sem mudança funcional fora do escopo.
- Sem alteração acidental em contratos de banco, sync ou domínio.
- Validações e limitações relatadas com precisão.

## Entrega

1. **Causa**
2. **Correção aplicada**
3. **Arquivos alterados**
4. **Teste de regressão**
5. **Validações executadas**
6. **Validações não executadas e motivo**
7. **Riscos/pendências**, no máximo 3
