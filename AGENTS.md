# RebanhoSync — AGENTS.md

Dispatcher principal para agentes que atuam no RebanhoSync.

Objetivo: carregar apenas o contexto necessário para cada tarefa, preservar as fontes de verdade do domínio e evitar leitura ampla desnecessária.

---

## Leitura mínima

Sempre leia:

1. `.agents/rules/CORE_RULES.md`
2. `.agents/rules/CONTEXT_LOADING.md`
3. `AGENTS.md` local da pasta afetada, se existir

Não usar `docs/archive/**` como fonte operacional, salvo pedido explícito.

---

## Fonte de verdade em conflito

1. Código + migrations ativas
2. `docs/context/PROJECT_STATUS.md`
3. Docs normativos ativos
4. Docs derivados
5. Histórico em `docs/archive/**`

---

## Regras globais

- Preservar offline-first.
- Preservar RLS, multi-tenant e isolamento por `fazenda_id`.
- Não criar fonte paralela de verdade.
- Não colocar regra de negócio crítica em componente React.
- Não usar UI como única fronteira de autorização.
- Não expor `service_role` no client.
- Não alterar migrations, seed, RLS, policies ou RPCs sem tarefa explícita.
- Preferir patch pequeno, reversível e testável.
- Não refatorar por conveniência.
- Separar fato confirmado, inferência e recomendação.

---

## Contratos do domínio

Ver `.agents/rules/CORE_RULES.md` e `docs/context/SOURCE_OF_TRUTH.md`.

Resumo:

- Agenda = intenção/tarefa futura.
- Evento = fato executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Tags, sinais e insights = auxiliares; nunca fonte primária.
- Carência, peso confiável, venda/abate e aptidão operacional exigem fonte técnica explícita.

---

## Carregamento de contexto

Use `.agents/rules/CONTEXT_LOADING.md`.

Regra prática:

- tarefa local: leia só arquivos-alvo, testes relacionados e AGENTS local;
- tarefa UX/UI: leia contexto de UX e tela afetada;
- tarefa sanitária: leia contexto sanitário e skill sanitária aplicável;
- tarefa sync/offline: leia contexto técnico de sync;
- tarefa documental: leia contexto de status e reconcile-docs;
- auditoria ampla: comece por índices, depois expanda sob demanda.

---

## Graphify

Use Graphify quando a tarefa exigir relação entre módulos, dependências ou impacto transversal.

Se `graphify-out/` existir, consulte `.agents/rules/GRAPHIFY_USAGE.md`.

Não é obrigatório para patch local em arquivo já conhecido.

---

## Validação

Use validação proporcional ao escopo:

- patch local: teste específico do módulo;
- domínio crítico: preflight + validate;
- entrega ampla: `pnpm run lint`, `pnpm test`, `pnpm run build`;
- Supabase/RLS: `node scripts/codex/validate-supabase-baseline-functional.mjs`.

Não inventar scripts. Conferir `package.json` quando necessário.

---

## Resposta final

Formato preferido:

1. Resumo executivo
2. Arquivos criados/alterados/movidos
3. Conteúdo principal
4. Impacto em Supabase/RLS/migrations, se houver
5. Validações executadas
6. Escopo confirmado
7. Riscos/pendências, no máximo 3