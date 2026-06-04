# Codex Prompt — Feature Pequena

Use para implementar uma funcionalidade pequena, delimitada e sem refatoração ampla.

## Prompt

Você é o arquiteto técnico sênior do RebanhoSync.

Implemente a seguinte funcionalidade:

```txt
[DESCREVER_FEATURE]
```

## Contexto obrigatório

Siga:

- `AGENTS.md`
- `.agents/rules/CORE_RULES.md`
- `.agents/rules/CONTEXT_LOADING.md`
- `.agents/rules/no-broad-context.md`
- `.agents/rules/rtk.md`
- `.agents/prompts/reusable/VALIDATION_CHECKLIST.md`

## Escopo

### Escopo permitido

```txt
[LISTAR_O_QUE_PODE_SER_ALTERADO]
```

### Escopo proibido

```txt
[LISTAR_O_QUE_NAO_PODE_SER_ALTERADO]
```

### Arquivos-alvo prováveis

```txt
[LISTAR_ARQUIVOS_OU_PASTAS]
```

## Diagnóstico obrigatório antes do patch

Antes de alterar arquivos, entregar:

1. objetivo funcional;
2. fonte de verdade envolvida;
3. fluxo impactado;
4. arquivos a ler;
5. arquivos candidatos a alteração;
6. risco operacional;
7. risco de regressão;
8. impacto em offline-first;
9. impacto em RLS/multi-tenant;
10. necessidade ou não de schema/RLS/RPC/migration;
11. plano mínimo de patch;
12. testes obrigatórios.

## Regras

- Patch incremental.
- Não ampliar escopo.
- Não refatorar por conveniência.
- Não criar fonte paralela de verdade.
- Não colocar regra de negócio crítica em componente React.
- Não reabrir fase fechada sem evidência objetiva.
- Não automatizar decisão crítica sem fonte técnica explícita.
- Se tocar Supabase/RLS/schema/migration/RPC/sync, justificar antes do patch.
- Preservar Agenda/Eventos/`state_*`/Protocolo separados.
- Preservar offline-first, idempotência e auditabilidade.

## Estratégia obrigatória

1. Identificar a fonte de verdade.
2. Mapear arquivos afetados.
3. Propor patch mínimo.
4. Implementar em etapas pequenas.
5. Criar ou ajustar testes proporcionais.
6. Validar impacto em domínio, UI, sync e RLS conforme escopo.
7. Atualizar documentação apenas se houver novo contrato, nova limitação ou mudança de fase.

## Validação proporcional

Verificar estado do repositório:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

Teste relacionado:

```bash
rtk pnpm test -- [TESTE_RELACIONADO]
```

Lint:

```bash
rtk pnpm run lint
```

Se a alteração tocar domínio crítico, fluxo transversal ou build:

```bash
rtk pnpm run build
```

Se a alteração tocar Supabase, RLS, RPC, migration ou sync-batch:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs
```

## Critérios de aceite

- funcionalidade implementada dentro do escopo delimitado;
- sem nova fonte paralela de verdade;
- sem regressão nos contratos do domínio;
- comportamento coberto por teste proporcional;
- validação proporcional executada;
- riscos/pendências declarados;
- `git diff --check` passa.

## Entrega

Responder com:

1. **Resumo executivo**
2. **Arquivos criados/alterados**
3. **Decisões técnicas**
4. **Testes/validações**
5. **Validações não executadas e motivo**
6. **Riscos/pendências**, no máximo 3