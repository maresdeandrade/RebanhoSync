# Codex Prompt — Feature Pequena

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use para implementar uma funcionalidade nova, pequena e delimitada. Para corrigir comportamento existente em um ponto conhecido, prefira `PATCH_LOCAL.md`.

## Modo

`MUTACAO_AUTORIZADA` somente dentro do escopo preenchido neste prompt e da tarefa atual.

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
3. Se o ponto de intervenção estiver incerto, usar `repository-context-retrieval`, concluir a descoberta e encerrar essa fase antes de selecionar a skill de implementação.
4. Depois da descoberta, escolher uma skill principal pelo risco dominante da feature.
5. Usar no máximo uma skill de apoio quando houver interseção técnica concreta; não acumular a skill de descoberta com duas skills de implementação.
6. Para comandos e validações, seguir `.agents/rules/rtk.md`.

## Antes do patch

Confirme de forma breve:

- fonte de verdade e fluxo afetado;
- arquivos mínimos a ler e alterar;
- impacto em domínio, offline-first, sync e RLS — apenas quando aplicável;
- necessidade de migration/RPC/RLS/schema;
- plano incremental e testes proporcionais.

Se a descoberta não delimitar o ponto de intervenção, parar sem implementar e relatar a lacuna mínima.

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
