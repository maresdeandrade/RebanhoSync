# RebanhoSync — AGENTS.md

Dispatcher principal para agentes que atuam no RebanhoSync.

Objetivo: carregar somente o contexto necessário, preservar os contratos do domínio e executar cada tarefa dentro do escopo autorizado.

---

## Bootstrap mínimo

Antes de atuar:

1. Leia `.agents/rules/CORE_RULES.md`.
2. Leia `.agents/rules/CONTEXT_LOADING.md`.
3. Leia `.agents/rules/no-broad-context.md`.
4. Leia o `AGENTS.md` local da pasta afetada, se existir.
5. Delimite o objetivo, os arquivos-alvo prováveis e o tipo real da tarefa.

Não abra todos os documentos, rules, skills ou arquivos `AGENTS.md` por padrão. Não use `docs/archive/**` como fonte operacional, salvo pedido explícito de análise histórica.

---

## Fonte de verdade em conflito

Siga esta ordem:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Documentos normativos ativos.
4. Documentos derivados.
5. Histórico em `docs/archive/**`.
6. Definições procedimentais de rules, skills e prompts.

Rules, skills e prompts orientam o trabalho do agente; não substituem contratos implementados nem comprovam comportamento do produto.

---

## Regras globais

- Preservar offline-first, idempotência, retry/replay, rollback e reconciliação.
- Preservar RLS, multi-tenant e isolamento por `fazenda_id`.
- Não criar fonte paralela de verdade.
- Não colocar regra de negócio crítica em componente React.
- Não usar UI como única fronteira de autorização.
- Não expor `service_role` no client.
- Não alterar migrations, seed, RLS, policies, RPCs ou schema sem tarefa explícita.
- Preferir patch pequeno, reversível e testável.
- Não refatorar por conveniência.
- Separar fato confirmado, inferência e recomendação.
- Não declarar validação que não foi executada.

---

## Contratos do domínio

Consulte `.agents/rules/CORE_RULES.md` e, somente quando pertinente, `docs/context/SOURCE_OF_TRUTH.md`.

- Agenda = intenção/tarefa futura.
- Evento = fato executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Tags, sinais e insights = auxiliares; nunca fonte primária nem regra crítica.
- Carência, peso confiável, venda/abate e aptidão operacional exigem fonte técnica explícita.

---

## Skills

Consulte `.agents/skills/README.md` para roteamento.

- Escolha no máximo uma skill principal.
- Use uma segunda somente quando houver interseção real de domínio crítico.
- Não use skill apenas porque um termo relacionado aparece incidentalmente.
- Se o ponto de intervenção estiver incerto, use `repository-context-retrieval` para descoberta dirigida.
- Após implementação, use `rebanhosync-verification-gate` para fechamento técnico.
- Use `prepare-pr` somente depois de a entrega estar validada e classificada como pronta.

Análise, implementação, verificação e preparação de PR são etapas distintas. Um pedido de revisão ou diagnóstico não autoriza alteração de arquivos.

---

## Carregamento de contexto

Siga `.agents/rules/CONTEXT_LOADING.md`.

Regra prática:

- tarefa localizada: arquivos-alvo, testes relacionados e `AGENTS.md` local;
- tarefa UX/UI: tela afetada e contexto de UX pertinente;
- tarefa de domínio: documento normativo e skill específica, se necessária;
- tarefa sync/offline: contratos técnicos de persistência, fila, retry e rollback;
- tarefa Supabase/RLS: migration ativa, policies/RPCs relacionadas e contrato de tenant;
- tarefa documental: fontes de maior precedência e documentos-alvo;
- auditoria transversal: índices primeiro; expansão somente para responder lacuna explícita.

---

## Comandos, Graphify e validação

Para qualquer comando, teste, pnpm, Graphify, WSL/Windows ou validação local, siga `.agents/rules/rtk.md`.

- Não invente scripts ou parâmetros.
- Use validação proporcional ao risco e ao escopo.
- Inspecione alterações tracked, staged e untracked quando revisar ou fechar uma entrega.
- Use Graphify apenas nos casos definidos em `.agents/rules/GRAPHIFY_USAGE.md`.
- Não altere o grafo por tarefa local sem impacto estrutural.

---

## Resposta

Use `.agents/rules/RESPONSE_FORMATS.md` quando a tarefa exigir formato padronizado.

Na resposta final, registre:

1. decisão ou veredito;
2. fatos confirmados e escopo real;
3. arquivos afetados, quando houver;
4. impacto funcional, de domínio e de banco, quando aplicável;
5. validações executadas e não executadas;
6. riscos ou pendências, no máximo 3.
