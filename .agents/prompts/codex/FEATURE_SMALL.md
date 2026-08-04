# Codex Prompt — Feature Pequena

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para implementar uma funcionalidade nova, pequena e delimitada. Para corrigir comportamento existente em um ponto conhecido, prefira `PATCH_LOCAL.md`.

## Prompt

Implemente no RebanhoSync:

```txt
[DESCREVER_FEATURE_E_RESULTADO_OBSERVAVEL]
```

### Escopo permitido

```txt
[LISTAR_ARQUIVOS_AREAS_OU_COMPORTAMENTOS_PERMITIDOS]
```

### Escopo proibido

```txt
[LISTAR_LIMITES_ESPECIFICOS]
```

### Arquivos-alvo prováveis

```txt
[LISTAR_ARQUIVOS_OU_PASTAS]
```

### Critérios de aceite específicos

```txt
[LISTAR_CENARIOS_OBSERVAVEIS]
```

## Contexto e skill

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Escolha no máximo uma skill principal pelo risco dominante da feature.
4. Use uma segunda skill apenas se houver interseção real de domínio crítico.
5. Para comandos e validações, siga `.agents/rules/rtk.md`.

## Antes do patch

Confirme de forma breve:

- fonte de verdade e fluxo afetado;
- arquivos mínimos a ler e alterar;
- impacto em domínio, offline-first, sync e RLS — apenas quando aplicável;
- necessidade de migration/RPC/RLS/schema;
- plano incremental e testes proporcionais.

Se o ponto de intervenção não estiver claro, interrompa a implementação e faça descoberta dirigida com `repository-context-retrieval`.

## Regras

- Não ampliar escopo nem refatorar por conveniência.
- Não criar fonte paralela de verdade.
- Não mover regra crítica para componente React.
- Preservar idempotência, retry, sucesso parcial, rollback e isolamento por `fazenda_id` quando afetados.
- Não alterar migration, RLS, RPC, seed ou schema sem autorização explícita no escopo.
- Atualizar documentação somente se surgir contrato, limitação ou comportamento persistente novo.
- Não afirmar validação sem saída confirmatória.

## Validação

Executar validações proporcionais previstas em `.agents/rules/rtk.md`, incluindo:

- estado inicial e final do worktree, inclusive staged e untracked;
- teste diretamente relacionado;
- lint/build apenas quando o risco justificar;
- gate Supabase quando contratos de banco, RLS, RPC, migration ou sync-batch forem tocados.

## Entrega

1. **Decisão e resultado**
2. **Arquivos criados/alterados**
3. **Decisões técnicas**
4. **Testes e validações executadas**
5. **Validações não executadas e motivo**
6. **Riscos/pendências**, no máximo 3
