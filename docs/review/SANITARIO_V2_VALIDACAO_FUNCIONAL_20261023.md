# Sanitário V2 — validação funcional integrada — 23/10/2026

**Estado: VALIDATED_WITH_CAVEATS.** Os fluxos locais executados passaram. Não há declaração de prontidão para produção nem de validação integral do catálogo publicado.

## Baseline e ambiente

- `git fetch origin main` confirmou `origin/main = 4b43fc10ec9dfd0c19527c22c4d725799d9e7969`, merge do PR #239.
- Checkout inicial: `codex/sanitario-v2-integration`, HEAD `3492b6d8bec140e5bad92d579786ce37bd1cfeb0`. `git diff HEAD origin/main --stat` vazio: árvores versionadas equivalentes.
- Branch de trabalho criada a partir de `origin/main`: `codex/sanitario-v2-functional-validation`.
- Alterações preexistentes preservadas: `AGENTS.md`, `.agents/rules/CONTEXT_LOADING.md`, `.agents/rules/no-broad-context.md`, `supabase/.temp/cli-latest`. Nenhuma alteração staged inicial.
- Outro worktree existente, `superpowers-pilot`, não foi utilizado nem modificado.
- Playwright/Chromium + Vite local em `127.0.0.1:4187`; telas reais `SelectFazenda`, Central Sanitária e catálogo, serviços reais e IndexedDB real. Identidade e HTTP sintéticos em `127.0.0.1:59997`. O interceptor bloqueia destinos externos e identifica escritas inesperadas.
- O relógio da fixture é 04/07/2026. Os testes de elegibilidade também exercitam datas próprias. Não representam a elegibilidade de um rebanho real em 23/10/2026.
- A fixture integral normalizada concede aprovação sintética, usa 20 itens e não replica as versões, fontes, grupos técnicos ou decisões exatas dos 12 itens do bootstrap. Por exemplo, a captura mostra aftosa com aprovação sintética, embora continue retirada. Os indicadores da captura não comprovam a configuração publicada.
- Duas consultas Supabase somente leitura confirmaram nove famílias `active/approved`, aftosa `retired/draft`, protocolos versão 1 e três etapas ativas de raiva versão 2, todas com `allows_agenda_auto=false`. A consulta de raiva também encontrou versões 1 retiradas. Não foram consultados animais nem modificados dados remotos.
- O resultado remoto anterior permanece em `evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_REMOTE_RESULT_20261023.json`. Bootstrap e migration não foram repetidos. Gates não foram alterados; seu estado remoto atual e o deploy frontend não foram reconfirmados nesta execução.

## Matriz de cenários

`PASS` indica execução observada no nível informado. Teste unitário/componente não equivale a fluxo completo de navegador; consulta SQL não equivale a validação da UI remota. Nenhum PASS resulta apenas de leitura de código.

| Cenário | Resultado | Evidência e limite |
|---|---|---|
| A — nove famílias ativas/aprovadas e aftosa retirada no remoto | PASS | SELECT somente leitura; estado do catálogo, sem teste de deploy |
| A — navegação entre as nove famílias e consulta de limitações | PASS | Chromium, telas reais, fixture sintética; desktop e mobile; navegação offline |
| A — aftosa identificada como retirada e fora das escolhas automáticas | PASS | Catálogo e plano integral no navegador |
| A — versões e fontes exatas do bootstrap visíveis ao usuário | NOT_RUN | Navegador usa fixture anterior normalizada; não reproduz o catálogo publicado nem valida apresentação completa de fontes/versões |
| B — sexo e nascimento ausentes não tornam B19 selecionável | PASS | Novo caso Chromium altera dois animais sintéticos, verifica seleção individual/coletiva bloqueada e nenhuma escrita operacional |
| B — sexo, idade, espécie, histórico ausente/inválido, doses e registros documentais | PASS | 30 testes de elegibilidade, 31 de janelas e 51 de pré-checagem; parte da cobertura é unitária/local |
| B — condição materna conhecida/desconhecida e contexto reprodutivo | PASS | Pré-checagem executada, incluindo fonte materna explícita e evidência ausente; não exercitado por formulário no navegador |
| C — seleção, revisão, desistência e confirmação manual | PASS | Chromium; preview não grava; confirmação grava intenção em IndexedDB |
| C — animal/fazenda, duplo clique, reagendamento e cancelamento | PASS | Chromium e testes focados de janela; fazenda estrangeira não aparece |
| C — revalidação após mudanças de catálogo, UF ou pertencimento | PASS | Testes de serviço/IndexedDB executados; sem cenário de alteração concorrente pela UI |
| C — planejamento não cria Evento, estoque nem carência | PASS | Asserções de contagens no navegador e testes de fronteira; fixture integral preserva quatro Eventos preexistentes |
| C — geração condicional por regra autorizada e replay idempotente | PASS | B19 e plano integral sintéticos; não ativou gate remoto |
| C — tentativa de automação remota com gate OFF | NOT_RUN | Ambiente de navegador intercepta HTTP; nenhum envio real ao backend foi efetuado |
| D — consulta de raiva e indicação de agenda automática não permitida | PASS | Navegador desktop/mobile; etapas remotas também verificadas por SELECT |
| D — UF/município/vigência, sem inferir obrigação/foco/perifoco | PASS | Três testes de planejamento/região; cobertura incompatível ou vencida permanece não resolvida |
| D — planejamento manual nacional sem dados regionais | PASS | Serviço de bloqueios contextuais testado; não constitui confirmação de Agenda de raiva pela UI |
| D — confirmação manual de Agenda de raiva usando versões homologadas | NOT_RUN | Fixture de navegador não reproduz metadata/versões homologadas de raiva |
| E — reforço depende de Evento compatível; Agenda não substitui fato | PASS | Testes de janelas, pré-checagem e histórico executados |
| E — meses/anos de calendário, ano bissexto e condição materna | PASS | Pré-checagem inclui aniversário anual entre 2023 e 2024 e limites maternos por meses/dias |
| E — aplicação multiprotocolo não gera duas Agendas concorrentes | PASS | Teste local de janelas executado; sem aplicação real nem produto remoto |
| F — consulta/planejamento offline, reconnect e reload | PASS | Chromium/IndexedDB; reconexão ao HTTP sintético; não comprova convergência com servidor real |
| F — troca de fazenda e retorno preservam separação de agendas/seleções | PASS | Fluxos manuais e de plano no navegador |
| F — fila, falha de rede, retry/replay, conflito e sucesso parcial | PASS | Nove testes do worker de closures e cinco de ordenação/CAS; dependências HTTP simuladas |
| F — sessão expirada e resposta atrasada durante farm-switch | NOT_RUN | Não exercitados nesta suíte; identidade sintética permanece válida |
| F — kill/restart completo do browser ou app e convergência com backend | NOT_RUN | Reload foi executado; não equivale a encerrar processo ou aplicativo |
| G — vazio e tentativa explícita de atualização | PASS | Chromium; catálogo vazio não fabrica produto, Agenda ou fato; componente cobre erro local |
| G — catálogo desktop 1440px/mobile 390px | PASS | Sem transbordamento horizontal, sem pageerror e capturas inspecionadas; não equivale a aparelho físico nem às demais telas mobile |
| G — distinção entre consultar, planejar e executar | PASS | Navegador e oito testes da Central; catálogo não oferece confirmação de Agenda/execução |
| G — erro real de autenticação/backend e recuperação pela UI | NOT_RUN | Não injetado no shell de navegador |

Nenhum cenário ficou BLOCKED por indisponibilidade de ferramenta. Os itens NOT_RUN são lacunas de execução/fixture explícitas e permanecem pendentes.

## Defeitos e alterações

Nenhum bug do runtime foi confirmado. Não foram alteradas regras de domínio, persistência, sync, UI de produção, aprovações, schema ou gates.

**Falha preexistente de testes — severidade MEDIUM para a confiabilidade da validação:** dois testes de plano esperavam controles de configuração imediatamente visíveis e um painel de cobertura que a Central atual não monta. A primeira execução produziu dois FAILs. Snapshots e componentes demonstraram configuração recolhida, fechamento após salvar/reload e 14 escolhas disponíveis, com seis itens restritos/bloqueados excluídos. Os testes foram corrigidos para seguir a interação real e verificar a exclusão de raiva/aftosa. A reexecução passou sem alterar o produto.

A primeira tentativa do novo teste de dados ausentes antecipou a preparação assíncrona da fixture e não alterou os registros. Isso foi erro do teste, não bug de elegibilidade: passou a aguardar a tela inicial e confirmar o retorno de duas atualizações antes de avaliar a seleção. Com os dados efetivamente ausentes, a seleção ficou bloqueada.

Arquivos da entrega:

- `e2e/fixtures/sanitary-planning.tsx`: registra a rota do componente real de catálogo no shell local existente.
- `e2e/sanitary-planning.spec.ts`: três novos cenários (dados ausentes e catálogo em dois viewports) e atualização dos dois testes de plano.
- Este relatório, JSON de resultados e duas capturas em `docs/review/evidence/`.

## Comandos e resultados observados

1. `pnpm exec playwright test --config e2e/sanitary-planning.config.ts --reporter=json`: **8 aprovados, 0 falhas, 0 ignorados, 0 flaky**, 34,53s. Reexecução adicional de `--grep 'plano integral'` após ajuste final da asserção: **1 aprovado**, 36,36s incluindo servidor. Não são nove cenários distintos.
2. `pnpm test -- src/lib/sanitario/eligibility/__tests__/sanitaryEligibility.test.ts src/lib/sanitario/windows/__tests__/sanitaryProtocolWindowsV2.test.ts src/lib/sanitario/agenda/__tests__/sanitaryRabiesManualPlanningV2.test.ts src/lib/sanitario/agenda/__tests__/sanitaryPublishedCatalogV2.test.ts src/pages/__tests__/ProtocolosSanitarios.test.tsx src/pages/__tests__/SanitarioCatalogoV2.test.tsx`: **85 aprovados, 15 ignorados**, cinco arquivos passaram e um ignorado. Os 15 dependem de `SANITARIO_APPROVED_CATALOG`, não fornecido nesta execução; não contam como PASS. Warnings do React Router sobre v7, sem falha.
3. `pnpm test -- src/lib/sanitario/agenda/__tests__/sanitaryNormalizedAutomationV2.test.ts src/lib/sanitario/agenda/__tests__/sanitaryPlanningSyncV2.test.ts src/lib/offline/__tests__/sanitarioAgendaV2Sync.test.ts src/lib/sanitario/history/__tests__/sanitaryExecutedHistoryV2.test.ts src/lib/sanitario/checks/__tests__/sanitaryProtocolPrecheckV2.test.ts`: **139 aprovados**, cinco arquivos, 7,66s.
4. `pnpm exec eslint e2e/sanitary-planning.spec.ts e2e/fixtures/sanitary-planning.tsx`: código de saída **0**, sem diagnóstico.
5. `git diff --check`: sem diagnóstico. Inspeção de tracked/staged/untracked separou alterações preexistentes dos arquivos desta entrega.

Não foram executados build, lint global, regressão global, E2E amplo, bootstrap, migrations, deploy, push ou merge. A entrega altera testes/evidências e não justifica build global. Não houve revisão independente por outro agente.

## Evidências

- [Resultados dos oito cenários Chromium](evidence/SANITARIO_V2_FUNCTIONAL_LOCAL_BROWSER_20261023.json).
- [Captura mobile](evidence/SANITARIO_V2_FUNCTIONAL_MOBILE_20261023.png).
- [Captura desktop](evidence/SANITARIO_V2_FUNCTIONAL_DESKTOP_20261023.png).
- Saídas brutas locais: `scratch/sanitary-functional-final.json`, `scratch/sanitary-functional-integral.json`, `scratch/sanitary-functional-domain.log`. `scratch/` é ignorado pelo Git; os resumos e capturas acima fazem parte da entrega.

## Veredito e próxima ação

**VALIDATED_WITH_CAVEATS**, limitado ao ambiente local e aos níveis explicitados na matriz. Classificação do patch de testes/evidências: **READY WITH CAVEAT**. Não há defeito crítico reproduzido pendente; há cobertura funcional incompleta. Os resultados não autorizam ativação nem comprovam prontidão de produção.

Três pendências prioritárias:

1. Reproduzir em ambiente descartável as versões/fontes/decisões exatas do catálogo publicado e executar pela UI planejamento manual de raiva, variantes incompletas e consulta completa de fontes/versões.
2. Exercitar sessão expirada, farm-switch com resposta atrasada e kill/restart; validar convergência real em ambiente de teste quando autorizado.
3. Confirmar a versão do frontend publicado e os gates efetivos antes de qualquer avaliação de ativação controlada.

**Recomendação:** manter a configuração atual; fechar essas lacunas com dados sintéticos e backend descartável. Só então decidir uma ativação controlada, mediante autorização específica. Nenhuma ativação foi realizada nesta tarefa.
