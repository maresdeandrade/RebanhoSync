# Sanitário V2 — Integração do pacote na main atual

> Esta página registra a rodada inicial de integração. A revisão posterior e a validação em Supabase nativo estão em [revisão para PR e gate remoto](SANITARIO_V2_PR_REVIEW_20261014.md), com aprovação local e limites remotos separados. O estado Git e as limitações abaixo referem-se à rodada inicial.

Atualizado em: 2026-10-14
Classificação: `READY WITH CAVEAT`
Escopo: integração local revisável, sem publicação, importação operacional ou ativação.

## Estado Git confirmado

- Raiz original: `C:/Users/mares/dyad-apps/GestaoAgro`.
- Checkout original preservado: branch `codex/f24-5e2-remote-telemetry-certification`, HEAD `4be672390b78feffa1e81fdbada7b1e14c19805c`, alteração local em `.codex/config.toml`.
- Worktrees existentes foram inventariadas com `git worktree list`; nenhuma foi reutilizada, resetada ou removida.
- Worktree desta integração: `C:/Users/mares/.codex/worktrees/sanitario-v2-integracao/GestaoAgro`.
- Branch: `codex/sanitario-v2-integracao`.
- HEAD e `origin/main` observada por fetch e reconfirmada por `git ls-remote origin refs/heads/main`: `dbcbee9c14d168b70b598bf46b922bee69017369`.
- Referências históricas do pacote: baseline `bd7193fd52e5b6d5851f33e89139205003dfa8b9`, main `236066e32b58e9849738bbff93e2980ac7dc87d7`.
- Nenhum dos 25 destinos do patch apresentava mudança entre a baseline histórica e a main atual. Nenhum já continha as alterações recebidas.
- Resultado final: 18 arquivos tracked modificados e 8 novos untracked, incluindo este relatório; nenhum staged, removido ou commit criado. Os novos arquivos integram a entrega e o diff exportado.

## Origem, extração e inventário completo

ZIP: `C:/Users/mares/Downloads/RebanhoSync_Sanitario_V2_Pacote.zip`.
SHA-256: `43a056b9b325a2a79d5f2f2c7ab90033e6c3b0db8343499ce170bb19a9c8100d`.

Diretório externo de extração e logs desta integração:
`C:/Users/mares/AppData/Local/Temp/sanitario-v2-7aaa8c862e5c4f8ba3161a86797cb12d`.

Patch SHA-256: `2ccd59ba403027daf370a4d21b8224eabc227b7a4a1d34ce1e13e9ae33727f2b`, igual ao manifest.

Todos os 19 arquivos, incluindo subpastas, foram classificados. `E/` significa `docs/review/evidence/`. Auxiliares e logs permanecem no diretório externo; não são arquivos do produto.

| Arquivo no ZIP | Destino/classificação | Tratamento e justificativa |
|---|---|---|
| `LEIA_ME.md` | Auxiliar externo | Orientação lida; não é instalador nem conteúdo de runtime. |
| `manifest.json` | Auxiliar externo | Inventário/hash/política conferidos; resultados nele são históricos. |
| `rebanhosync_sanitario_v2_revisao.patch` | Fonte de integração externa | Inspecionado; aplicado aos seus 25 destinos após check estrito. Não versionado como segunda cópia do código. |
| `MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` | `E/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` | Já incluído pelo patch, cópia avulsa idêntica byte a byte; não reaplicada. |
| `RebanhoSync_Sanitario_V2_Relatorio.md` | `E/SANITARIO_V2_RESEARCH_REMEDIATION_20261014.md` | Idêntico ao relatório incluído pelo patch; acrescentada identificação explícita como histórico e link para esta integração. Não duplicado. |
| `SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json` | `E/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json` | Incluído pelo patch, avulso idêntico; candidato documental, sem seed/import. |
| `SANITARIO_V2_PRODUCTS_RESEARCH_20261014.csv` | `E/SANITARIO_V2_PRODUCTS_RESEARCH_20261014.csv` | Incluído pelo patch, avulso idêntico; evidência de pesquisa por campo. |
| `SANITARIO_V2_RESEARCH_SOURCES_20261014.csv` | `E/SANITARIO_V2_RESEARCH_SOURCES_20261014.csv` | Incluído pelo patch, avulso idêntico; fontes históricas e seus limites. |
| `SANITARIO_V2_SQL_DRY_RUN_20261014.json` | `E/SANITARIO_V2_SQL_DRY_RUN_20261014.json` | Incluído pelo patch, avulso idêntico; preservado como evidência anterior, sem substituir nova execução SQL. |
| `SANITARIO_V2_VALIDATION_REVIEW_20261014.csv` | `E/SANITARIO_V2_VALIDATION_REVIEW_20261014.csv` | Incluído pelo patch, inicialmente idêntico; ajustada nota VAL-RAI-004 para distinguir bloqueio prospectivo de registro factual. |
| `tests/codex/sanitario-v2-pglite.integration.mjs` | `tests/codex/sanitario-v2-pglite.integration.mjs` | Incluído pelo patch, avulso idêntico; revisado e executado, sem alteração do harness. |
| `validacao/sanitary_followup_tests.log` | Evidência histórica externa | Não entra no runtime nem comprova esta integração. |
| `validacao/sanitary_followup_validate.log` | Evidência histórica externa | Não entra no runtime nem comprova esta integração. |
| `validacao/sanitary_proportional_build.log` | Evidência histórica externa | Novo build executado; log recebido não é sua prova. |
| `validacao/sanitary_proportional_lint.log` | Evidência histórica externa | Arquivo vazio; lint desta integração foi executado separadamente. |
| `validacao/sanitary_proportional_tests_final.log` | Evidência histórica externa | Os 76 testes anteriores não certificam esta versão. |
| `validacao/sanitary_proportional_typecheck.log` | Evidência histórica externa | Typecheck e comparação com main refeitos localmente. |
| `validacao_anterior_SQL/canonical-dry-run.log` | Evidência histórica externa | Dry-run atual executado somente no banco novo em memória do harness. |
| `validacao_anterior_SQL/verification.log` | Evidência histórica externa | Não certifica SQL atual, Supabase, RLS ou concorrência. |

## Alterações integradas

O comando `git apply --check --whitespace=error-all <diretório-externo>/rebanhosync_sanitario_v2_revisao.patch` terminou com exit 0 antes da aplicação. `git apply --whitespace=error-all` também terminou com exit 0. Não houve conflitos nem aplicação forçada, substituição integral de arquivos ou reaplicação de duplicatas.

Os 25 destinos recebidos abrangem:

- `docs/domain/SANITARIO.md`, inventário C0.1, fila técnica, matriz, payload, decision record, relatório e quatro evidências CSV/JSON novas;
- `scripts/codex/import-sanitario-protocols-v2.mjs`, contrato e testes de publisher;
- `SanitaryAgendaExecutionConfirmV2.tsx` e testes da UI;
- listagem de Agenda, precheck, execução, autorização compartilhada e janelas sanitárias, com testes diretamente relacionados;
- harness SQL isolado `tests/codex/sanitario-v2-pglite.integration.mjs`.

A execução manual usa `registrationMode=executed_fact`, confirmação explícita e data não futura. Preserva produto, dose, unidade, via, responsável informado e rastreabilidade. Curadoria/contexto pendentes geram aviso auditável; `prospective_authorization=false`. Não há consulta MAPA síncrona como condição de registrar fato. Carência desconhecida permanece desconhecida. Guardas prospectivos, vínculos de identidade/fazenda, confirmação, estoque, fila atômica e replay foram preservados nos caminhos testados.

Payload candidato: 10 protocolos, 20 itens, 16 fontes, 71 coberturas, 8 classes, 4 grupos, 12 members e 4 rejeições. Três correções técnicas usam novas versões físicas, preservando identidade anterior por `supersedes`; publisher só planeja aposentar predecessor draft exato. Nenhum payload foi importado operacionalmente.

### Adaptações adicionais comprovadas por testes

1. Seletor: resolução UUID de classe → `class_key` continua tolerando cache parcial e agora filtra classes e members por escopo real `global`/`tenant` e `fazenda_id`. Member estrangeiro não amplia os produtos da fazenda atual.
2. Execução: revalidação curatorial dentro da transação agora atualiza avisos do mesmo payload compartilhado por Evento, detalhe e operação enfileirada. Mudança entre preflight e transação não perde evidência.
3. Autorização: `somente_alerta`/`alerta` no snapshot continua rejeitado quando o item não está no cache. Falta de cache não transforma alerta em vacinação.
4. Concorrência local: duas conclusões da mesma agenda retornam o único evento efetivamente persistido; a segunda não retorna ID inexistente nem declara nova baixa de estoque. A falha de retorno já estava no código da main, no mesmo ponto alterado pelo pacote.

Os três primeiros cenários falharam antes dos ajustes (`integration-regressions-before.log`); o caso de concorrência também foi reproduzido antes da correção (`integration-concurrency-before.log`). Foram adicionados quatro casos. O teste de atomicidade com sync habilitado também passou a mudar a curadoria durante o preflight e conferir os avisos na fila.

Documentação adaptada: contrato sanitário registra esses limites; fila e CSV explicitam que draft bloqueia uso prospectivo; relatório recebido está identificado como histórico. Demais conteúdos recebidos foram preservados. Nenhuma migration, policy, RLS, RPC, flag, dependência ou lockfile foi alterado. Animal Detail V2 e demais fases não foram reabertos.

## Validação observada nesta integração

Ambiente: Windows/PowerShell, Node `22.15.0`, pnpm `11.23.0`; dependências instaladas com `pnpm install --frozen-lockfile`, exit 0. Testes/build usaram os valores fictícios do CI (`example.supabase.co`, `example-publishable-key`), sem backend operacional.

### Testes focados

Chamada inicial executada com `pnpm exec vitest run` e os nove caminhos explícitos abaixo: 366 testes passaram. Depois dos ajustes, somente as superfícies cujo código/contrato mudou foram repetidas. Resultados mais recentes compatíveis com a versão final: **370 testes distintos em nove arquivos**; não é soma de reexecuções.

| Caminho explícito | Testes aprovados |
|---|---:|
| `src/lib/sanitario/execution/__tests__/sanitaryAgendaExecutionV2.test.ts` | 49 |
| `src/lib/sanitario/agenda/__tests__/sanitaryLocalAgendaManagementV2.test.ts` | 5 |
| `src/components/sanitario/__tests__/SanitaryLocalAgendaPanelV2.test.tsx` | 10 |
| `src/lib/offline/__tests__/sanitarioV2Cutover.test.ts` | 7 |
| `src/lib/offline/__tests__/sanitarioV2Worker.test.ts` | 9 |
| `src/lib/sanitario/checks/__tests__/sanitaryProtocolPrecheckV2.test.ts` | 40 |
| `src/lib/sanitario/windows/__tests__/sanitaryProtocolWindowsV2.test.ts` | 9 |
| `tests/codex/sanitario-v2-contract.test.mjs` | 92 |
| `tests/codex/sanitario-v2-publisher.test.mjs` | 149 |

Reexecuções relevantes, todas via `pnpm exec vitest run <caminhos>`:

- execução/listagem/UI/cutover/worker após as três primeiras correções: 79 testes, exit 0;
- execução após correção de concorrência e cobertura de avisos na fila: 49 testes, exit 0;
- UI após ajuste de escopo `tenant`: 10 testes, exit 0.

Logs atuais externos: `integration-tests.log`, `integration-final-tests.log`, `integration-final-execution.log`, `integration-final-ui.log`. Os avisos de futura migração do React Router não impediram os testes.

### Demais comandos e resultados

| Comando | Resultado observado |
|---|---|
| `node scripts/codex/import-sanitario-protocols-v2.mjs --validate` | Exit 0, contagens canônicas acima, `execute_import=false`. |
| `pnpm exec eslint <todos os .ts/.tsx/.mjs alterados e novos>` | Exit 0, sem diagnósticos. Lista obtida de `git diff --name-only` e `git ls-files --others --exclude-standard`. |
| `git diff --check` | Exit 0. Novos arquivos também incluídos na exportação e no check do diff completo. |
| `pnpm run build` | Exit 0 na versão final, 14,17 s. Warning de chunks acima de 500 kB permanece. |
| `pnpm exec tsc -p tsconfig.app.json --noEmit --pretty false` | Exit 2: 241 diagnósticos, nenhum em arquivo alterado. Comparação com main limpa: nenhum diagnóstico novo; um TS2554 removido. |
| `pnpm run gates:docs` | Exit 0: headers, continuidade e contrato de governança aprovados; não muda o status de outras fases. |
| `node tests/codex/sanitario-v2-pglite.integration.mjs` com módulos externos fixados | Exit 0, seis verificações SQL. Plano canônico `create=141`, `update=0`, `skip=0`, `reject=4`; dry-run sem escrita nas 14 tabelas. |

PGlite `0.5.10` e socket `0.2.13` foram instalados com `npm install --prefix <diretório-externo> --ignore-scripts --no-audit --no-fund`, sem mudar dependências do produto. `SANITARIO_PGLITE_MODULE_ROOT` apontou para esses módulos; `SANITARIO_SQL_EVIDENCE_DIR` para o diretório de extração. O harness só usa loopback e banco novo em memória, fixtures sintéticas e migrations existentes; não aceita banco externo nem executa CLI `--apply`. Evidências atuais: `integration-pglite.log`, `pglite-evidence.json`, `canonical-dry-run.log`, fora do repositório.

### Comparação do typecheck

Main limpa extraída por `git archive dbcbee9c14d168b70b598bf46b922bee69017369`, fora do projeto, usando a mesma versão do compilador e dependências: **242 diagnósticos**. O comando efetivo foi `node <worktree>/node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --pretty false`, cwd da cópia limpa.

A primeira tentativa com `pnpm exec` nessa cópia temporária foi interrompida pela proteção `ERR_PNPM_UNSAFE_MODULES_DIR` contra a junction de dependências; a comparação foi realizada com o executável Node acima. A proteção não foi desabilitada e não removeu dependências.

Comparação de todos os diagnósticos por caminho, código e mensagem, desconsiderando somente deslocamento de linha: os 241 restantes já existiam na main; foi removido `TS2554` em `sanitaryAgendaExecutionV2.ts` (`eventIdFor` sem o segundo argumento). Não há aprovação global do typecheck. Logs: `baseline-typecheck.log`, `integration-final-typecheck.log`; resumo `typecheck-comparison.json`, externos.

## Diff, limites e recomendação

Diff completo exportado, incluindo os oito arquivos novos: `sanitario-v2-integracao-final.patch`, no diretório externo acima. Captura final de status/worktrees: `integration-git-state.txt`. O relatório histórico SQL do ZIP permanece separado do resultado SQL atual.

FATOS CONFIRMADOS: escopo integrado, 370 testes distintos e seis verificações SQL aprovados, lint/build/docs/checks aprovados; nenhuma operação remota de escrita. O checkout original e as worktrees concorrentes foram preservados.

Classificação `READY WITH CAVEAT`, por estas limitações reais:

1. Typecheck global continua falhando com 241 diagnósticos preexistentes; nenhum diagnóstico novo nos arquivos alterados.
2. PGlite tem auth/tenant em stubs e um backend; não certifica Supabase nativo, RLS real, múltiplos servidores ou dispositivos físicos. Nenhum teste remoto foi executado.
3. Pesquisa recebida mantém lacunas documentais por produto/campo. A integração não recertifica registros MAPA, não autoriza usos prospectivos e não infere carência zero.

Não foram executados regressão global, E2E, importação operacional, migration remota, push, merge, deploy ou ativação de flags. Não eram necessários para a integração local ou foram explicitamente vedados. Recomenda-se revisar o diff local; publicação e importação permanecem fora desta autorização.
