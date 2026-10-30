# C05/C06 — composição sanitária, sessão e recuperação — 29/10/2026

## Baseline e limites

Snapshot de execução local; não altera o contrato do produto nem certifica F24.7 completa.

**C05: `READY_FOR_REVIEW` para a composição delimitada abaixo. Gate técnico do patch: `READY`. C06: matriz preparada; certificação F24.7 completa permanece `NOT_STARTED`.**

- Base: `762226630fb54abbf9303d6e292be85fb28c9df2`, HEAD destacado no worktree `C:/Users/mares/.codex/worktrees/c05-auth-sanitary/GestaoAgro`.
- Origem preservada: branch `codex/optimize-agent-infrastructure`, com deltas preexistentes nos dois backlogs, reprodução, testFarm e `docs/ux/UX-DISCOVERY-02.md`. Worktree F6 preservado.
- `main` remoto observado por `git ls-remote`: `8e89a5bd4c646f4a6d033baf9939d9f8a9d6a06a`. Não é a base desta execução. Ancestral comum: `bc31073565a3c7b15d396c610dd239f382b08db6`.
- Comparação dirigida entre a base e esse `main`: diff vazio em `useAuth.tsx`, `src/lib/offline`, `src/lib/sanitario`, `src/pages/ProtocolosSanitarios`, componentes sanitários/auth, client/env Supabase, `config/backend-targets.json`, migrations e Edge Functions. Isso confirma equivalência dessas superfícies, sem declarar equivalência global dos commits.
- Guards existentes #242 (`c9155a5`) e #245 (`20fd5c6`) encontrados no histórico da base. Nenhuma reimplementação desses guards.
- Docker local 29.8.0, Supabase CLI 2.117.0, Playwright 1.63.0. Há **65 arquivos SQL de migration**; a contagem inicial de 66 arquivos incluía um não SQL. A aplicação das 65 foi consultada no banco descartável.
- API local porta 55421, PostgreSQL 55422, Vite 8181. Rede, containers, usuários e contexto Chromium próprios; publicações verificadas em `127.0.0.1`, sem reutilização dos projetos `GestaoAgro`/`animal-v2-1762db34`.
- O provisionador VF4 é reutilizado com `--c05`. O adaptador de pipe Docker impõe bind explícito antes de criar containers com label/rede da execução. A rede tem masquerading de saída desativado; o browser bloqueia hosts externos. Não é uma API Docker TCP.
- O catálogo é o subconjunto de raiva do snapshot VF2 já usado na VF4. Nenhuma curadoria, importação F6, publicação ou alteração de `no_agenda_auto`.

## Matriz C05 e evidências

Execução final: `node tests/codex/sanitario-v2-review.supabase.mjs --c05`, exit 0, **7/7 casos PROVEN**, projeto `sanitary-review-433eac8f`. Evidência: [JSON consolidado](./evidence/SANITARIO_C05_C06_COMPOSICAO_20261029.json), com hashes das fontes, snapshots antes/depois por caso, observação anterior ao patch e tentativas preparatórias separadas. As referências C1–C7 abaixo correspondem, em ordem, a `final_run.cases[0..6]`. Não há FAILED na execução final; as falhas anteriores foram preservadas como preparação e reprodução.

| Cenário exigido | Resultado | Evidência e stores |
|---|---|---|
| Sessão válida | PROVEN — C1 | UI com usuário/fazenda A/owner; uma intenção/vínculo no Dexie, fila 1→0, Agenda/vínculo/recibo no PostgreSQL |
| Sessão expirada | PROVEN — C4/C5 | Logout: UI protegida e zero envios; UUID pendente preservado. Expiração real offline: JWT recebe 401 e zero recibos adicionais |
| Refresh | PROVEN — C5 | Um HTTP real de refresh; mesmo UUID; um recibo; fila recuperada |
| Farm-switch A→B | PROVEN — C2 | Provider B/manager e settings remoto B, sem instalação de contexto A tardio |
| Settings/papel tardios | PROVEN — C2 | Duas respostas reais retidas após leitura e liberadas depois da seleção B |
| Retry/reconnect | PROVEN — C3/C5 | Backoff/recuperação do worker existente, mesmo UUID e convergência da fila/obrigações |
| Lost ACK | PROVEN — C3 | Commit antes do aborto de transporte; reload; revisão remota 1 preservada e um recibo |
| Rejeição/sucesso parcial | PROVEN — C7, entre dois gestos | Primeiro aplicado, segundo rejeitado; sucesso preservado. Operação terminal sai da fila e rejeição/gesto continuam auditáveis |
| Usuário sem permissão | PROVEN — C6 | RLS sem linhas; mesmo envelope aceito com HTTP 200 para membro e rejeitado com 403 para outsider |
| Gate OFF | PROVEN — C7 | Segunda criação recusada com `SANITARIO_SYNC_DISABLED`; nenhuma Agenda remota correspondente nem fato sanitário |

Em cada caso, a fixture registra estados antes/depois de UI, `ops_sanitario_agenda_v2`, `ops_sanitario_agenda_animais_v2`, `queue_ops`, `queue_gestures`, `queue_rejections`, `sync_reconcile_obligations` e respectivas Agendas/vínculos/recibos PostgreSQL. Usa `processGesture` e `drainReconciliationObligations` existentes, com inspeção das identidades antes do drain. Eventos, detalhes e estoque são verificados por contagem zero nos dois lados. Não há execução legítima nessa matriz: stores factuais não são dispensadas; devem permanecer vazias. Read models de carência/aptidão, dispositivos físicos e outros domínios são NOT_APPLICABLE a estas intenções de planejamento, sem certificar seus contratos.

O controle de permissão é uma sondagem HTTP negativa direta com envelope capturado do worker, sem alegar UI de outsider. O sucesso parcial é entre dois gestos da fila; não comprova lote heterogêneo dentro de um único gesto. A perda de ACK interrompe a entrega de uma resposta real depois do commit; não substitui resposta de Auth/servidor por mock.

Estado final antes do descarte: **2 intenções locais**, sendo uma sem aceitação remota e com rejeição explícita; **1 Agenda remota**, 1 vínculo e **5 recibos** (criação + quatro reagendamentos). **0 operações pendentes**, **0 obrigações de reconciliação** e **1 rejeição preservada**. Eventos, detalhes sanitários e estoque permaneceram **0** em todos os casos nos dois lados. As duas intenções locais não são duas execuções nem duas Agendas aceitas pelo servidor.

## Defeitos e extensão do harness

**Defeito de runtime reproduzido — MEDIUM, rastreabilidade da reconciliação:** no projeto `sanitary-review-71e2a696`, após cinco ACKs sanitários reais, `sync_reconcile_obligations.diagnostics.origins[].client_op_ids` continha `[null]`. O wrapper de cada resultado contém `{ op, result }`, mas `processSanitarioCanonicalResults` lia `wrapper.op_id`, inexistente. O patch em `src/lib/offline/syncWorker.ts` usa `op.client_op_id`. Não altera identidade, payload, RLS, ordem, retry ou dedup. As Agendas/recibos estavam corretos; o impacto demonstrado é perda da referência da operação no diagnóstico da obrigação, sem perda de dados demonstrada.

A regressão em `src/lib/offline/__tests__/sanitarioV2Worker.test.ts` falhou antes com `[undefined]` e passou após a correção; o arquivo focado completo passou 12/12. A fixture real também passou a exigir IDs não vazios antes de drenar obrigações. Demais falhas preparatórias:

1. A bridge `internal` suprimiu as portas necessárias à CLI; tentativa removida. A opção de bind padrão da bridge foi ignorada pelo Docker Desktop e resultou em publicação ampla numa tentativa encerrada. O adaptador passou a impor `HostIp=127.0.0.1` antes da criação.
2. O proxy precisava encaminhar HTTP Upgrade e liberar imediatamente headers de `ContainerWait`. O teste focado cobre streaming e a dependência de headers antes do corpo.
3. Uma sessão foi interrompida com recursos próprios ainda ativos; o projeto `sanitary-review-2a35713e` foi localizado pela identidade/label, parado pela CLI e sua rede removida. Recursos externos foram preservados.
4. O carregamento inicial Vite/PostCSS ultrapassou 30 segundos no Windows. A sondagem sem Auth observou o término dos módulos pendentes e montagem do provider. A espera de prontidão da página passou a 90 segundos; timeouts de Auth/RPC/sync não mudaram. Cache Vite isolado no worktree.
5. TTL de 60 segundos herdado da VF4 é inferior à margem de refresh de 90 segundos do SDK instalado. Com o provider composto, o primeiro pull não concluiu; TTL C05 passou a 120 segundos. A execução seguinte atravessou pull e planejamento; nenhuma mudança de runtime foi inferida desse parâmetro artificial.
6. A fixture consultava `fazenda_id` diretamente na operação da fila. O contrato real o guarda no gesto e no envelope `record`; assertiva corrigida.
7. O logout global do browser revogou a sessão original Node do mesmo usuário. O controle positivo HTTP passou a usar a sessão atual real do browser, apenas em memória. A tentativa anterior preservou cinco casos comprovados, mas não validou permissão nem o caso final de gate/sucesso parcial.
8. Criação de Agenda rejeitada terminalmente sai de `queue_ops` conforme contrato; a evidência permanece em `queue_gestures.operation_results`/`queue_rejections`. A assertiva de retenção na fila foi corrigida. A primeira versão da fixture chamava somente `processGesture`; a versão final usa também o drain público existente e verifica obrigações ao concluir. Rejeição factual (`apply_factual_core`) tem outra política de retenção e não foi generalizada a partir desse caso.

Arquivos do patch: `e2e/fixtures/sanitary-auth-real.html` e `.tsx` (entrada real sem substituições de Auth); `tests/codex/sanitario-c05.fixture.mjs` (composição/matriz); `c05-loopback-docker.fixture.mjs` e `.test.mjs` (bind e transporte local); `sanitario-v2-review.supabase.mjs` (modo opt-in/provisionamento); `sanitario-v2-vf4.fixture.mjs` (reuso da preparação); `src/lib/offline/syncWorker.ts` (uma linha de runtime) e seu teste focado; este relatório e sua evidência consolidada. Nenhuma migration, seed, policy ou RPC foi alterada.

## C06 — preparação F24.7

| Contrato/ambiente | Critério concreto | Cobertura a registrar |
|---|---|---|
| Sessão e ownership | Provider real + backend real, bloqueio de ausência/expiração e retomada da mesma intenção | PROVEN — C1/C4/C5, sessão própria sintética e stores no JSON |
| Tenant e permissões | Fazenda ativa correta, respostas tardias descartadas, RLS/Edge negando outsider | PROVEN — C2/C6; owner em A, manager em B, outsider sem membership |
| Intenção e recuperação | Agenda sem fato; commit/ACK/retry/reload; rejeição auditável sem desfazer sucesso | PROVEN — C1/C3/C5/C7; fila e obrigações finais zeradas, rejeição retida |
| Lote heterogêneo em um gesto | Sucesso parcial dentro de um batch, reconciliação e retenção por operação | NOT_EXECUTED nesta composição; resultado VF4 histórico não é reexecução C05 |
| Execução factual e demais RPCs | Aplicação explícita, detalhe/relação, estoque, carência e condições de fonte técnica | NOT_EXECUTED; bloqueia certificação completa, fora da execução automática desta tarefa |
| PWA/processo/dispositivo | Cold start sem shell, kill/restart real do processo, dispositivo físico | NOT_EXECUTED; depende do alvo concreto de certificação |
| Produção e rollout | SHA implantado, configurações e gates autorizados | NOT_EXECUTED; nenhuma autorização operacional |
| Plataforma stale de 05/10 | Bloqueio já encerrado na evidência canônica | NOT_APPLICABLE como novo bloqueio; não reaberto |

Próxima unidade mínima proposta: compor **um lote heterogêneo dentro de um gesto**, com resultado/recibo/reconciliação por operação, reutilizando esta infraestrutura e a matriz VF4. Execução factual completa/F24.7 e rollout não começam automaticamente. Essa cobertura e as demais RPCs são pendências reais para certificação completa. Ausência de aparelho físico, cold start e diferenças de ambiente dependem do alvo concreto; não são dispensas universais. O patch corrige novas origens de ACK; não faz backfill de diagnósticos históricos.

## Verificações e limpeza

Verificações observadas:

- `node tests/codex/sanitario-v2-review.supabase.mjs --c05`: exit 0, 7/7 PROVEN na execução final. As repetições anteriores e suas falhas são distintas no JSON.
- `node node_modules/vitest/vitest.mjs run src/lib/offline/__tests__/sanitarioV2Worker.test.ts -t 'preserva UUID'`: RED pela ausência do ID; arquivo focado completo antes do patch: 11 passaram/1 falhou; após o patch: **12/12 passaram**, exit 0.
- `node --test tests/codex/c05-loopback-docker.test.mjs`: **3/3 passaram**, incluindo bind explícito, recusa de recurso alheio, Upgrade e headers antecipados de ContainerWait.
- `node --test tests/codex/sanitary-disposable-support.test.mjs`: **4/4 passaram**; helper existente não foi modificado.
- `node node_modules/eslint/bin/eslint.js` com os TS/TSX/MJS alterados: exit 0, sem diagnósticos finais. Lint foi repetido somente nos arquivos alterados posteriormente.
- `node scripts/antigravity/run_bash.mjs scripts/antigravity/docs_gates.sh`: exit 0, incluindo auditoria de agentes/contrato. Não houve execução duplicada separada de `audit:agents`.
- `node --check` das entradas MJS, `git diff --check`, inspeção de staged/unstaged/untracked e consolidação com hashes/checagem de ausência de tokens: aprovados nos comandos executados.

Lint e Vitest usam diretamente as ferramentas instaladas: `pnpm exec` tentou reinstalar dependências pelo junction e foi bloqueado pelo próprio pnpm, sem instalação ou alteração de dependências. Warning observado: base Browserslist/caniuse antiga; não foi atualizada nesta tarefa. Autorrevisão do patch, sem alegação de revisão independente.

Na execução C05 original não foram executados build, suíte global, validador funcional amplo de baseline, migrations remotas, deploy, commit, push ou merge. O patch não altera schema/RLS/RPC/envelope; a verificação real focada cobre o contrato modificado sem ampliar para baseline/global.

**Cleanup confirmado:** flag local OFF, gates das duas fazendas OFF; browser/contexto e Vite fechados; CLI removeu o projeto e a rede própria foi removida. Consulta posterior por labels da execução encontrou **0 containers, 0 redes e 0 volumes próprios**. Diagnósticos temporários e artefatos de evidência são preservados; o worktree permanece para revisão. Os deltas preexistentes da origem permanecem com o mesmo escopo, sem staged.

## Revisão e transporte para integração

Após solicitação de revisão e integração, os 11 arquivos foram inspecionados e o patch foi transportado, sem stash/reset, para `codex/c05-auth-sanitary-integration`, criada em `origin/main@8e89a5bd4c646f4a6d033baf9939d9f8a9d6a06a`. Os quatro arquivos tracked tinham bases idênticas, e os sete novos caminhos não existiam na main. O worker, sua regressão, a UI, o fluxo C05 e a preparação VF4 mantêm os hashes da execução real; não houve repetição automática dos sete cenários.

A revisão identificou e fechou dois caminhos do harness:

- Publicação automática (`PublishAllPorts=true`) poderia criar bindings fora da lista normalizada. Agora é recusada antes de encaminhar a criação; attachment a rede adicional também é recusado. Resposta 403 não cria container, e uma criação válida subsequente continua com bind explícito em loopback.
- Falha no fechamento de PG podia interromper o restante do finally. O cleanup agora tenta cada etapa própria independentemente; falha em qualquer etapa é registrada, muda o resultado para FAIL e mantém exit não zero. Não há fallback para recursos compartilhados nem alegação de cleanup após SIGKILL/daemon indisponível.

`node --test tests/codex/c05-loopback-docker.test.mjs`: **5/5 passaram**, após RED pelos novos caminhos descobertos. Há injeção de falha em cada uma das cinco etapas de cleanup, teste HTTP de recusa sem forwarding, criação válida depois da recusa, Upgrade/streaming e ContainerWait. O teste de pipe também foi ajustado para Windows/Unix sem adicionar dependências. Lint focado dos três MJS alterados, syntax check do launcher e diff check passaram. A CI do PR usa o workflow existente, sem alteração de gates. Não há autorização de merge nesta etapa.

O JSON mantém os hashes históricos da execução real e acrescenta `integration_review` com os hashes finais e a justificativa de reutilização. Esta revisão não certifica F24.7 completa nem faz backfill de diagnósticos históricos.
