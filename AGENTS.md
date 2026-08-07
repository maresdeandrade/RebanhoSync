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

Não abra todos os documentos, rules, skills ou arquivos `AGENTS.md` por padrão. `.agents/archive/**`, scripts arquivados e `docs/archive/**` são históricos, não fontes operacionais nem superfície normal de execução; consulte-os somente por necessidade explícita.

---

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`, subordinadas à hierarquia de instruções do runtime. Resumo procedimental: tarefa atual → `AGENTS.md` aplicável → rules obrigatórias → skill principal → no máximo uma skill de apoio → prompt/template; lifecycle ocorre separadamente. Uma camada inferior não pode ampliar autorização, relaxar segurança, converter diagnóstico em autorização de implementação nem autorizar operação destrutiva proibida.

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
- Não imprimir, persistir nem incorporar credenciais, tokens ou segredos em URLs, scripts, logs ou documentação.
- Operações destrutivas exigem autorização explícita e obediência às rules e aos scripts de segurança aplicáveis.
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

Use `.agents/rules/CONTEXT_LOADING.md` como única autoridade interna de roteamento de contexto, seleção de skill e progressão entre etapas. READMEs são catálogos; prompts não criam roteamento concorrente.

- Em implementação, escolha uma skill principal e no máximo uma skill de apoio quando houver interseção técnica concreta.
- Discovery, verification gate, reconciliação documental e preparação de PR são fases lifecycle separadas; não contam como skills simultâneas da implementação.
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
- `scripts/codex/validate.ps1` exige perfil explícito: `focused` para mudança localizada, `standard` para alteração compartilhada relevante e `full` somente quando escopo/risco exigirem e houver autorização.
- Use `pnpm run audit:agents` para governança de agentes e `pnpm run gates:docs` para contratos documentais atuais, quando aplicáveis.
- O verification gate produz o veredito técnico da entrega; scripts históricos ou restritos não são gates permanentes.
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
