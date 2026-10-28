# RebanhoSync — AGENTS.md

Contrato de entrada dos agentes: concluir somente o escopo autorizado, com contexto mínimo, preservando trabalho concorrente e contratos do produto.

## Responsabilidade e precedência

Respeite a hierarquia do runtime. A ordem procedimental e a precedência factual estão em `.agents/rules/CORE_RULES.md`: tarefa atual → AGENTS aplicável → rules obrigatórias → skill principal → apoio pertinente → prompt/template. Camadas inferiores não ampliam autorização, relaxam segurança nem substituem contrato implementado por documentação.

| Autoridade | Responsabilidade |
|---|---|
| `AGENTS.md` | Entrada, autorização e limites |
| `.agents/rules/CORE_RULES.md` | Invariantes normativos e precedências |
| `.agents/rules/CONTEXT_LOADING.md` | única autoridade interna de roteamento de contexto e skills; seleciona uma principal e no máximo uma skill de apoio pertinente |
| `.agents/rules/rtk.md` | Comandos e validação proporcional |
| `rebanhosync-verification-gate` | Classificação técnica final |

## Bootstrap único

Leia uma vez `.agents/rules/CORE_RULES.md`, `.agents/rules/no-broad-context.md`, `.agents/rules/CONTEXT_LOADING.md` e o AGENTS local da área afetada, se existir. Não reinicie o bootstrap por referências em prompts ou skills; releia somente conteúdo alterado ou necessário para uma lacuna concreta.

Defina objetivo, modo, escopo, fonte aplicável e evidência esperada antes de agir. Confirme branch, HEAD, worktree, staged, unstaged e untracked ao trabalhar com Git; preserve alterações preexistentes e não presuma checkout limpo.

## Modos e autorização

| Modo principal | Limite |
|---|---|
| `DISCOVERY` | Localizar contratos, arquivos e dependências; não autoriza correção |
| `DIAGNOSIS` | Analisar comportamento sem alterar arquivos |
| `REVIEW` | Revisar alvo definido sem modificar arquivos |
| `IMPLEMENTATION` | Modificar somente o escopo autorizado, pelas rotas A/B/C do roteador |
| `VERIFICATION` | Validar entrega existente; não amplia escopo nem autoriza correções |
| `DOCUMENTATION` | Alterar documentação autorizada sem mudar runtime |
| `PR_PREPARATION` | Usar `prepare-pr` após READY, com template atual e evidência vigente; não revalida, implementa ou autoriza merge |

Diagnóstico, revisão e auditoria não autorizam implementação. Com implementação autorizada e decisões essenciais resolvidas, prossiga até a entrega na mesma sessão: subetapa, troca de skill ou plano não exigem nova aprovação. Skills e CI orientam ou fornecem evidência; não concedem autorização nem substituem o gate.

## Invariantes e segurança

Aplique `CORE_RULES.md`: offline-first, idempotência, retry/replay, recuperação, reconciliação, compatibilidade local-remota, RLS, multi-tenant, `fazenda_id` e auditabilidade. Agenda = intenção; Evento = fato/histórico; `state_*` = estado atual; Protocolo = configuração. Não derive histórico de estado atual nem converta previsão/recomendação em execução.

Não criar fonte paralela de verdade, regra crítica em React ou autorização dependente apenas de UI. Não expor `service_role` no client. Não imprimir, persistir nem incorporar credenciais, tokens ou segredos em código, URLs, scripts, logs ou documentação.

Não alterar schema, migration, seed, RLS, policy ou RPC sem escopo explícito. Mudança local não autoriza aplicação remota. Para contratos de banco, preservar isolamento, evolução forward-only e convergência com clientes antigos/offline e operações pendentes. Não refatorar por conveniência nem sobrescrever trabalho alheio.

## Revisão técnica

- Defina alvo exato e baseline confirmado; revise primeiro o diff real, inclusive staged/untracked, e expanda apenas para provar/refutar achados. Descrição de PR ou relato de agente não comprova comportamento; confronte testes/mocks com o risco alterado.
- Priorize correção, segurança, perda de dados e contratos. Quando afetados, examine concorrência/stale writes, duplicidade, retry/replay, sucesso parcial, crash/restart, offline/reconnect, auth expirada, farm-switch, clientes antigos e convergência segura de migrations; procure também mudanças laterais e arquivos gerados.
- Findings devem indicar arquivo/trecho, mecanismo, cenário reproduzível e impacto, distinguindo fato e hipótese. Use BLOCKER para segurança, corrupção/perda de dados, isolamento, operação destrutiva ou contrato crítico; HIGH para regressão funcional relevante; MEDIUM para robustez com impacto limitado; LOW para problema técnico menor. Evite nitpicks e bugs presumidos; ausência de findings não equivale a PASS. Correção exige autorização de implementação.

## Mobile

Ao tocar código compartilhado com Android/iOS:

- Preservar React/TypeScript e priorizar Capacitor antes de reescrita; manter Dexie/IndexedDB inicialmente, sem storage nativo alternativo sem evidência técnica, e domínio independente das APIs do Capacitor.
- Preservar idempotência/sync da web sem depender de background contínuo; considerar suspensão, kill/restart, reconnect e auth expirada como normais.
- Separar development, staging e production e impedir build produtivo apontando para backend não produtivo. Mobile não amplia autorização para mudar domínio compartilhado.

## Parada e operações proibidas

Pare antes de modificar e reporte a lacuna se baseline/ambiente não puder ser confirmado, fonte de verdade estiver ambígua, contratos conflitarem, a correção depender de comportamento não comprovado ou exigir ampliar escopo/autorização.

Operações destrutivas ou irreversíveis, descarte/limpeza de dados, reset, push, merge, deploy, migration/db push remotos e alterações de produção, staging ou dados reais exigem autorização explícita. Não substituir evidência ausente por suposição.

## Evidência para conclusão

Use `.agents/rules/rtk.md`: `validate.ps1` exige perfil explícito; `pnpm run audit:agents` e `pnpm run gates:docs` conforme aplicabilidade, sem repetir checks já incluídos. Graphify somente conforme `.agents/rules/GRAPHIFY_USAGE.md`. Não executar regressão global, build ou E2E por rotina.

A classificação final pertence a `rebanhosync-verification-gate`; não declarar PASS, READY, CLOSED ou correção sem evidência observada, nem converter falha de ambiente em sucesso. Reutilizar evidência somente com patch, baseline e condições relevantes inalterados; falta de verificação crítica impede READY.

Entregue decisão, escopo/arquivos reais, validações executadas e limitações, distinguindo fatos, inferências e recomendações; até três riscos/pendências. Use `.agents/rules/RESPONSE_FORMATS.md` quando pertinente. Não reproduzir contexto desnecessário.

`.agents/archive/**`, `docs/archive/**` e scripts arquivados são históricos, não fontes operacionais por padrão; acesso somente por solicitação ou necessidade comprovada.
