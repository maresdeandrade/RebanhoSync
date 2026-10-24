# Sanitário V2 — VF5: consolidação e preparação local para integração

Data: 24/10/2026. **Decisão: `READY_FOR_PR`. Verification gate do patch consolidado: `READY`.**

Os patches VF1–VF4 foram isolados sobre a `origin/main` atual, revisados de forma independente e organizados em commits locais. A dívida TypeScript foi comprovada em checkouts Git limpos; não foi atribuída ao sanitário. Quatro achados novos do gate Fallow foram corrigidos exclusivamente nos testes, sem supressões ou mudança adicional de runtime. Esta decisão prepara um PR; não certifica produção nem autoriza publicação ou ativação.

## Baseline, branch e preservação

- Checkout original preservado: `C:/Users/mares/dyad-apps/GestaoAgro`, branch `codex/sanitario-v2-functional-validation`, HEAD `4b43fc10ec9dfd0c19527c22c4d725799d9e7969`. Não havia commits próprios sobre esse HEAD; as entregas estavam unstaged/untracked, sem staging.
- Dois fetches de `origin/main`, no início e antes dos commits de documentação, confirmaram `31815a260c8aef2798e87a448dce3f973673b4c4`, merge do PR #240. Desde `4b43fc1`, o delta de main afetava relatórios operacionais; não alterava os oito arquivos de código VF1–VF4.
- Worktree dedicado: `C:/Users/mares/.codex/worktrees/sanitario-vf5-integration/GestaoAgro`.
- Branch preparada: **`codex/sanitario-vf5-integration`**, baseada em `origin/main@31815a2`.
- Worktree adicional para a triagem: `C:/Users/mares/.codex/worktrees/sanitario-vf5-types-baseline/GestaoAgro`. Primeiro checkout limpo de `4b43fc1`, depois checkout limpo de `31815a2`. Ambos com instalação própria, offline, frozen-lockfile e sem scripts; nenhum lockfile/dependência foi alterado.
- O compartilhamento inicial de `node_modules` por junction foi recusado pelo pnpm. Apenas as duas junctions recém-criadas foram removidas, sem recursão, e substituídas por instalações independentes. O diretório original não foi removido.
- Vinte e um arquivos VF1–VF4 foram transportados seletivamente e comparados por SHA-256. Os hashes desses 21 arquivos no checkout original permaneceram iguais ao inventário inicial. Nenhuma alteração concorrente foi transportada ou descartada.
- Os worktrees anteriores e os dois criados nesta fase foram preservados. Não houve reset, clean, push, merge, deploy ou operação Supabase remota.

## Inventário auditado

[Resultado e inventário de hunks](evidence/SANITARIO_V2_VF5_INTEGRATION_RESULT_20261024.json): 25 arquivos de código/fixtures/evidências anteriores, com hashes e intervalos old/new de cada hunk; mais este relatório e os dois JSONs VF5. Arquivos PNG estão identificados como binários. O inventário separa conteúdo novo, histórico e remediação de CI.

| Origem | Arquivos/símbolos incluídos |
|---|---|
| Runtime VF2 | `src/pages/SanitarioCatalogoV2.tsx`: `article` identificado por item/versão, detalhes de versões e `TechnicalSources`. Sem alteração de elegibilidade ou autorização. |
| Runtime VF3 | `src/hooks/useAuth.tsx`: `farmContextRevision`, descarte de leituras antigas em papel/metadados/settings, invalidação em seleção/logout. |
| VF1 | Shell e spec Playwright: rota real do catálogo, casos de dados ausentes/consulta em viewports, interação real com configuração e confirmação de plano. |
| VF2 | Modo `homologado` no shell, casos `VF2` no spec, `seedPublishedCatalogFixture`, teste de catálogo publicado, snapshot somente leitura e evidências correspondentes. |
| VF3 | Modo `recovery`, guardas reais, probe e helpers de observação; seis casos `VF3`, incluindo restart de contexto histórico. |
| VF4 | Modo `--vf4` no harness existente e `sanitario-v2-vf4.fixture.mjs`; relatório e resultado dos 16 cenários reais. Nenhuma migration ou função server-side alterada. |
| VF5, somente testes | Extração das asserções de fonte/item/protocolo e predicado do interceptor no spec; novo `sanitary-disposable-support.fixture.mjs`, quatro testes Node e uso compartilhado nos harnesses VF4, factual e convergence. Corrige somente quatro bloqueadores novos do Fallow. |
| Documentação | Quatro relatórios VF1–VF4, nove artefatos históricos (um snapshot necessário aos testes integra o commit de fixtures) e três artefatos VF5. Relatórios históricos não foram reescritos como se suas execuções fossem atuais. |

**Excluídos:** governança `AGENTS.md`/rules, importador/publicador e seus testes F6–F9, reprodução e formulário, `src/lib/offline/ops.ts`, `src/main.tsx`, testFarm, `.tmp/**`, `supabase/.temp/cli-latest`, relatórios/evidências F6–F9/UI_STRUCT. `package.json`, lockfile, configuração de backend, migrations e bootstrap permanecem sem delta em relação à base.

Os dois arquivos de harness já versionados (`sanitario-v2-convergence.fixture.mjs` e `sanitario-v2-remote-factual.integration.mjs`) entram apenas pela extração compartilhada da VF5. Não foram copiados deltas concorrentes desses arquivos.

## Revisão independente

Agente `vf5_review`, read-only, sem executar testes/Docker/backend ou modificar arquivos. Revisou os oito arquivos delimitados VF1–VF4 e relatórios/evidências pertinentes; revisou separadamente a exclusão do delta concorrente de `ops.ts` e a remediação posterior de CI.

**Findings demonstráveis introduzidos pelo patch:** Critical 0, Important 0, Minor 0. O parecer foi confrontado com o diff real, hashes, guard de revisão de animal e resultados locais; não foi aceito como substituto de testes.

O patch HIGH da VF3 corrige a janela reproduzida em que leitura iniciada antes da seleção de B restaura A. Não se declara solução de toda concorrência de Auth. Permanecem caminhos preexistentes não reproduzidos nesta revisão: upserts remotos de seleção sem serialização; refresh iniciado após seleção local e antes da persistência; await de ownership em `applyAuthenticatedSession`. Não são achados novos nem justificam refatoração nesta consolidação.

A revisão confirmou também que VF4 usa Auth/RLS/worker reais, mas não monta `AuthProvider`; a prova do race do provider continua sendo o browser VF3 com Auth sintético. A extração VF5 preserva todas as asserções, ordem criação confirmada → login, objetos SDK retornados e ordem dos interceptadores.

## Triagem TypeScript comprovada

[Triagem por diagnóstico](evidence/SANITARIO_V2_VF5_TYPESCRIPT_TRIAGE_20261024.json).

Comando nos quatro contextos: `pnpm exec tsc --noEmit --project e2e/tsconfig.json`.

| Contexto | Resultado |
|---|---|
| Git limpo `4b43fc1` | exit 1; 38 diagnósticos em 11 arquivos |
| Git limpo `31815a2` | exit 1; os mesmos 38, sem adição/remoção |
| Branch integrada | exit 1; os mesmos 38, inclusive após extração dos helpers |
| Checkout original concorrente | 38; quatro posições de `remoteSync.ts` deslocadas em dez linhas; mensagens/códigos semanticamente iguais |

Classificação: **38 preexistentes e independentes; 0 introduzidos por VF1–VF4/VF5; 0 introduzidos pelo trabalho concorrente; 0 não determinados**. A comparação exata nos três primeiros contextos normaliza apenas o caminho absoluto do checkout. O JSON preserva arquivo, posição, código e mensagem de cada diagnóstico. Não houve correção global, supressão ou mudança de configuração TypeScript. A checagem global continua falhando; o que foi comprovado é ausência de regressão do patch. O CI atual não executa esse comando TypeScript como gate próprio.

## Validação da árvore integrada

| Verificação | Resultado observado |
|---|---|
| Vitest focado | **31 testes distintos PASS**: ownership 1, contexto regional 2, componente de catálogo 13, catálogo publicado 15 com snapshot configurado; zero skips nos 15 antes condicionais. |
| Playwright focado | **6 cenários distintos PASS**, zero fail/skip/flaky: catálogo homologado e cinco casos VF3 de sessão, farm-switch, papel/logout, 401 e catálogo HTTP tardio. |
| Após extração de helpers | **2/2 Playwright PASS**, repetindo somente catálogo e farm-switch que tiveram estrutura de teste alterada. Não são oito cenários distintos. |
| Helper de preparação | `node --test tests/codex/sanitary-disposable-support.test.mjs`: **4/4 PASS**, cobrindo sucesso, falha de criação, falha de login e roteamento loopback. Usa SDK simulado; não equivale a Auth real. |
| ESLint | 12 arquivos de código finais; exit 0, zero diagnósticos. |
| Sintaxe Node | Harness e fixture VF4: exit 0; novos módulos também carregados pelo teste Node. |
| Build | `CI=true`, `VITE_BACKEND_ENV=ci-synthetic`, endpoints `example.supabase.co` e chave pública de exemplo, via contrato já existente do CI; `pnpm run build` exit 0. Compilação sem backend vivo. Warnings de Browserslist antigo e chunks grandes; sem alteração incidental. |
| Documentação | `pnpm run gates:docs`: exit 0; headers, continuidade e contrato de governança aprovados. `gates:docs-scope` não se aplica: é allowlist de reconciliação documental restrita, não deste patch com código. |
| Fallow obrigatório | `pnpm exec fallow audit --gate new-only`: falha inicial de 2 complexidades + 2 duplicações novas, todas nos testes. Após remediação, **PASS, zero achados introduzidos**. Dívida herdada excluída pelo gate, sem supressões ou alteração de `.fallowrc.json`. |
| Diff/escopo | Tracked, staged e untracked inspecionados; `git diff --check` e cached check aprovados. Nenhum arquivo fora da allowlist auditada na branch de integração. |

Os dois testes unitários que exigem ambiente não carregaram na primeira execução sem `.env`; foram reexecutados com endpoint loopback e chave sintética explícitos. Os outros 15 testes já aprovados não foram repetidos por esse ajuste. Não se atribuiu a falha de preparação ao produto.

Não houve nova rodada de homologação VF1–VF4, suíte global ou repetição completa da VF4. O código e os contratos server-side permanecem iguais. O hash histórico de `ops.ts` na VF4 difere da integração pela exclusão de uma chamada concorrente de persistência da revisão de animal em UPDATE; o guard retorna imediatamente para tabelas diferentes de `animais`, e operações sanitárias usam `sanitario_v2`/INSERT. Essa ausência de impacto foi revisada independentemente. A extração de preparação do harness é equivalente e foi verificada pelos quatro testes focados; não se afirma que os 16 cenários históricos rodaram no commit integrado.

Fixtures executáveis usam loopback, interceptam destinos externos ou validam estritamente API/DB locais. O `project_ref` de produção presente no snapshot/SQL/relatórios é proveniência histórica de captura somente leitura, não destino operacional da fixture. Nenhuma chave real, sessão, URL autenticada ou nova fonte canônica foi incorporada.

## Commits locais

1. `44467258128ee12935bcb99623191cfa24daaf1d` — `fix(sanitario): preserve farm context and expose catalog evidence` — dois arquivos de runtime.
2. `fb68d89a834035114d358d5a38bfdf080e9b044d` — `test(sanitario): consolidate catalog and recovery validation fixtures` — onze arquivos, incluindo o snapshot usado como fixture.
3. Commit documental desta entrega — `docs(sanitario): record VF1-VF5 evidence and integration readiness` — relatórios/evidências. Seu SHA final é consultável por `git log -1` após a gravação, evitando referência circular ao próprio conteúdo.

## Gate e recomendação

**READY_FOR_PR / READY**, limitado ao patch local consolidado. A ressalva anterior de TypeScript foi reclassificada como dívida independente após comparação com dois baselines Git limpos; a revisão independente agora foi executada; o gate obrigatório de achados novos foi resolvido. Nenhum defeito crítico demonstrado ficou pendente.

Riscos residuais: (1) 38 diagnósticos TypeScript globais preexistentes; (2) limites preexistentes e não reproduzidos de concorrência Auth fora da janela corrigida; (3) evidência VF4 histórica/local, sem certificação de produção, PWA cold start ou aparelho físico.

**Próximo passo:** revisar o PR localmente preparado e, em autorização separada, publicar a branch para CI/revisão remota. A branch e os worktrees ficam preservados. Produção e gates operacionais não foram alterados. Não há push, merge, deploy ou ativação implícitos nesta decisão.
