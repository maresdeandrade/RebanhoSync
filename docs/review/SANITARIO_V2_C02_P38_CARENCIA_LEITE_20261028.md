# C02/C07 — P38 Eprecis: carência de leite

**Atualização posterior, 29/10/2026:** o [encerramento consolidado F6](SANITARIO_V2_C02_F6_ENCERRAMENTO_CONSOLIDADO_20261029.md) acrescentou a regra pendente de corte bovino SC, 12 dias, `04012eb3-618b-5813-a387-a16f769d2a64`, vinculada à bula forte já existente. A regra anterior sem via e a regra de leite zero permaneceram intocadas. O lote não repetiu a persistência anterior de P38 nem concedeu liberação operacional.

## Integração e vigência individual — atualização de 29/10/2026

**REGULATORIO_P38: VIGENCIA_CONFIRMADA.** O [painel oficial MAPA de produtos farmacêuticos](https://mapa-indicadores.agricultura.gov.br/publico/extensions/Produtos_Farmaceuticos/Produtos_Farmaceuticos.html), atualizado em **29/10/2026 05:50:26**, apresentou a linha individual **EPRECIS / SP0001290-8 / Ativo / 20/05/2029 / SESPO INDUSTRIA E COMERCIO LTDA**. O número corresponde aos componentes do registro `SP 000129-0.000008` impresso na bula nacional P12073 V00; nome e titular coincidem. O registro homônimo `SP0001290-7` não foi utilizado como prova do registro solicitado. [Evidência estruturada](evidence/SANITARIO_V2_C02_P38_REGULATORIO_20261029.json) e [captura da tabela filtrada](evidence/SANITARIO_V2_C02_P38_MAPA_REGISTRO_20261029.png).

Esta consulta resolve a lacuna de vigência individual descrita nos registros anteriores abaixo. Não modifica a candidata imutável, a metadata remota nem os status pendentes. As condições da bula permanecem: bovinos, SC, 1 mL/100 kg em aplicação única, leite zero e abate 12 dias, com as restrições já registradas.

**INTEGRACAO: READY WITH CAVEAT local; COMPATIBILIDADE_INSUFICIENTE_PARA_ATIVAR_P38 no cliente implantado.** Deployment Vercel de produção `dpl_6P2kx5yMarubVmWsiHKGsbpmcvVQ`, estado READY, Git `main@20140c074b34857e5f4343f47778f5560e2e2482`, domínio `rebanho-sync.vercel.app`. O código desse SHA termina em Dexie v33, não espelha o vínculo regra–fonte e ainda aceita `zero` sem distinção por finalidade. A lacuna de versão implantada agora está identificada: esse cliente não contém o contrato de segurança P38. Não houve deploy, merge, push, nova persistência ou promoção operacional.

O patch runtime permanece inalterado nesta continuidade; foram reaproveitados os **397/397 testes** e a comparação TypeScript **233/233, zero novos por arquivo/código/mensagem**, registrados no recibo local do mesmo HEAD `4aacd94f`. O typecheck global continua falho. A comparação main→HEAD contém somente três arquivos de reprodução, sem conflito com os arquivos P38. [Fechamento e próximo residual F6](SANITARIO_V2_C02_INTEGRACAO_P38_F6_20261029.md).

## Fechamento executivo — 29/10/2026

**CONFIRMADO_DOCUMENTAL; PERSISTIDO COMO PENDENTE. Sem liberação operacional.** Este adendo substitui apenas o estado local/não persistido e a lacuna de proveniência do registro histórico abaixo. A candidata original permanece byte a byte inalterada (SHA256 `8b3a14846c8e0f90e7f355cf2a25b36bd10d3f8c587a22943edb57310b635330`).

### Código e compatibilidade

- `src/lib/sanitario/execution/operationalWithdrawalSnapshotV2.ts`: preservada a correção por finalidade; fonte forte agora exige simultaneamente vínculo produto/fonte/withdrawal, vínculo **regra selecionada/fonte/withdrawal**, cobertura `covers`, fonte não tombstonada e escopo global ou da fazenda solicitante. Sem vínculo específico, o resultado é conservador; não há fallback para associação em metadata.
- `src/lib/offline/{types,tableMap,db,pull}.ts`: espelho da tabela PostgreSQL existente `sanitario_produto_carencia_fontes_v2`, PK composta e Dexie **v34**, apenas aditivo. Pull-only, com paginação e substituição integral dos vínculos na mesma transação de instalação do catálogo. A tabela não tem `updated_at`/`deleted_at`: ausência no conjunto completo revoga o vínculo local. Tombstones de fonte, cobertura e regra continuam bloqueantes. Falha antes da instalação conserva o cache; não se criam operações na fila.
- `src/lib/sanitario/execution/{executedProductTechnicalSnapshotV2,sanitaryAgendaExecutionV2}.ts` e `src/lib/sanitario/reconciliation/sanitaryCorrectionV2.ts`: execução e correção leem e encaminham os vínculos da regra. Snapshots factuais já persistidos não são reescritos, inclusive no replay após revogação do vínculo no catálogo.
- `scripts/codex/import-sanitario-protocols-v2.mjs`: entrada administrativa fechada `--c02-p38`, vinculada ao digest acima e ao projeto, sem conexão remota genérica. Reutiliza `buildPlan`, `applyTransaction`, `writeOperation` e compilador MCP canônicos. Só emite pacote após ensaio em banco descartável de loopback, conferência integral do snapshot materializado sob locks e rollback. Nenhuma nova API pública de escrita foi exportada.

### Persistência e recibos

Autorização: solicitação explícita de fechamento executivo P38 nesta conversa, referência `C02-P38-20261029-EXPLICIT-USER-EXECUTIVE-CLOSURE`. Projeto confirmado `zqloazqzhwauamcejmuz`, PostgreSQL 17.11. Estado anterior lido em transação repeatable-read/read-only às **11:49:55 UTC**; estado posterior lido às **12:01:30 UTC**. O pacote usa advisory lock canônico, locks das oito tabelas, assinatura de schema/privilégios, CAS do recorte P38, contagem de escrita e pós-condições. Outros cadastros não entram no payload.

- [Antes](evidence/SANITARIO_V2_C02_P38_REMOTE_BEFORE_20261029.json): 2 fontes, 6 coberturas, 6 vínculos produto/fonte, 1 regra corte e 1 vínculo regra/fonte.
- [SQL emitido pelo writer](evidence/SANITARIO_V2_C02_P38_APPLY_20261029.sql): SHA256 `c469688995600602f2e6a605849d71b456244fa4768c06c2dc0a45240819221f`.
- [Resultado e depois](evidence/SANITARIO_V2_C02_P38_REMOTE_RESULT_20261029.json): **5 create, 0 update, 1 skip, 0 approved**. Repetição do mesmo SQL: **replay=true, 6 skip**. Agora 3 fontes, 7 coberturas, 7 vínculos produto/fonte, 2 regras e 2 vínculos regra/fonte. Cada linha anterior permaneceu integralmente igual.

IDs criados: fonte `c6ab8b68-1bbf-583c-82c9-2bfbc2ca6507`; cobertura `af5e9b44-7460-5338-a4fb-ca23bf80c27a`; regra leite `a4f5dff8-f48c-5a73-9d64-a5493ad8203c`; vínculo produto `db743728-59e2-5ecb-8b2e-211ab170618f` → fonte nova → `withdrawal`; vínculo regra leite → mesma fonte → `withdrawal`. A regra nova tem `bovino/leite/SC`, `zero`, `milk_days=0`, `meat_days=null`, **precisa_validar**. Corte `a435e33b-ab52-593a-a2ac-10393f71a88e` mantém 12 dias, fonte de apoio anterior e status pendente. Dose, autorização por espécie e flags operacionais não mudaram.

### Evidência de validação

- **Verificação final consolidada: 397/397 testes em 14 arquivos, saída 0**, incluindo todos os arquivos sanitários/pull/upgrade/writer citados abaixo e `sanitarioAgendaV2Sync.test.ts`, `executedProductTechnicalSnapshotV2.test.ts`, `sanitaryEventExecution.test.ts`. [Resumo preservado](evidence/SANITARIO_V2_C02_P38_LOCAL_RESULT_20261029.json). ESLint dos arquivos tocados, `node --check` dos dois scripts, `git diff --check` e `pnpm run gates:docs` (inclui auditoria de agentes): saída 0. A evidência sintética e os recibos remotos não certificam compatibilidade de aplicação implantada.
- `pnpm exec tsc -p tsconfig.app.json --noEmit`: **falhou**. Comparação adicional pela API TypeScript, com overlay em memória das versões HEAD somente dos oito arquivos de runtime tocados e demais alterações locais preservadas: **233 diagnósticos na base / 233 atuais, nenhum diagnóstico novo identificado** por arquivo/código/mensagem. Existem inclusive seis diagnósticos herdados em `pull.ts`; não foram corrigidos fora do escopo. Isso não equivale a typecheck global aprovado.
- Gate final: **READY WITH CAVEAT para o patch local e a persistência técnica pendente**; typecheck global permanece falho por diagnósticos reproduzidos na base. **Sem liberação operacional de P38**. Staged permanece vazio; `docs/ux/UX-DISCOVERY-02.md`, surgido durante a execução, é trabalho concorrente preservado e fora desta entrega.
- Baseline Git: branch `codex/optimize-agent-infrastructure`, HEAD `52fd311d38f7a7775982941b9406fb2bb7062656`, sem staged. Preservados o patch de zero e seus testes, candidata/relatório/harness P38 anteriores, além dos três deltas de reprodução/test farm já descritos abaixo.
- Concorrência observada no fechamento: HEAD avançou externamente para `4aacd94facbfb67dabc188c6a5df0553dfcba764` (commit de reprodução). `git diff 52fd311d..HEAD --name-status` mostrou somente `CalfInitialEditor.tsx`, `registerPostPartum.test.ts` e `postPartum.ts`, sem alteração nos arquivos P38. Também foram preservados os novos deltas de `MASTER_BACKLOG.md`, `MASTER_BACKLOG_EXECUTION_PLAN.md` e o arquivo UX já citado. Esta tarefa não criou commit, branch, worktree ou push.
- TDD: três novos controles falharam antes do patch de proveniência (vínculo ausente, de outra regra e de outro campo); passaram após a correção. Os testes anteriores de zero não foram refeitos como implementação.
- `pnpm test -- tests/codex/sanitario-v2-publisher.test.mjs tests/codex/sanitario-c02-admin.test.mjs tests/codex/sanitario-c02-p38.test.mjs src/lib/offline/__tests__/telemetryFlushCursors.upgrade.test.ts --reporter=dot`: **234 testes aprovados** na execução inicial deste fechamento; após ampliar os controles P38, o arquivo P38 isolado passou **13/13**.
- `pnpm test -- src/lib/sanitario/execution/__tests__/sanitaryAgendaExecutionV2.test.ts src/lib/sanitario/reconciliation/__tests__/sanitaryCorrectionV2.test.ts --reporter=dot`: **70/70**, incluindo cenários sintéticos equivalentes a P38 com e sem vínculo, replay factual e preservação do Evento original.
- Pull técnico, cursor incremental e store técnico: **11/11**. Snapshot de vínculos com **1001 linhas**, replay/reconnect sem duplicação, revogação por ausência e falha de rede antes do commit conservando o cache.
- `operationalWithdrawalSnapshotV2.test.ts` e `sanitarioWithdrawalSources.upgrade.test.ts`: **51/51**. Incluem atualização v33→v34, preservação de fila/registro antigo, abertura pelo cliente anterior e nenhuma associação inventada. Abertura de Dexie anterior foi exercitada com a biblioteca instalada; não certifica aparelhos físicos.
- `node tests/codex/sanitario-c02-p38.local.mjs`: PostgreSQL local com DDL/índices ativos, **5 create/1 skip**, convergência conferida pelo writer, rollback antes de emitir o SQL e descarte pelo launcher gerenciado. Dois erros de preparação do harness (tabela auth já existente e leitura do comentário compartilhado) foram corrigidos antes do ensaio aprovado; nenhum alcançou o remoto. Um contêiner próprio interrompido foi identificado por ID/label/ledger, sem volumes nem processo ativo, e encerrado; não foram removidos recursos alheios.
- ESLint dos arquivos alterados e `git diff --check`: saída 0 nas execuções observadas. Sem migration, RLS, RPC, schema remoto ou sync-batch alterados; não se executou a bateria Supabase funcional ampla, build, E2E ou regressão global.

Resultado por finalidade: **estado remoto real pendente → unknown para carne e leite**. Em cópias sintéticas ativas com os vínculos persistidos: aptidão leite → leite `explicit_absence`, carne `unknown`; corte continua `unknown` porque a fonte forte de leite não está vinculada à regra de corte; quando se fornece vínculo forte específico de corte apenas na fixture, carne calcula **12 dias**. Aptidão mista não herda autorização. Esses testes não promovem dados remotos.

### Consulta regulatória e condição de ativação

[Bula brasileira P12073 V00](https://ruminants.ceva.com/app/uploads/sites/16/2023/10/Eprecis-Bula.pdf) novamente conferida: eprinomectina 2%, bovinos, SC, aplicação única de 1 mL/100 kg (0,01 mL/kg), leite sem carência, abate 12 dias após última aplicação; segurança não avaliada abaixo de cinco meses, não usar em animais sensíveis ao ativo, prescrição/administração orientada por MV. Não se utilizaram formulações estrangeiras nem se inferiu autorização universal de aptidão/categoria.

[Portal SIPEAGRO/MAPA](https://dados.agricultura.gov.br/dataset/sipeagro/resource/7ce5fac0-9c8f-4e14-82d9-6deab9b5e2e9), recurso atualizado em 03/10/2026, foi acessado e seu CSV baixado para inspeção temporária (SHA256 `18d2908fe0d07b3f5b67afd1e9fbdb4d49731ab1d2d4993564a9af62324c421c`). O arquivo contém **estabelecimentos**: UF, município, registro de estabelecimento, status, CNPJ, razão social, atividade e classificação; não contém nome/número individual de produto. Não comprova vigência de Eprecis. [Consulta interativa SIPEAGRO](https://sistemasweb3.agricultura.gov.br/sipe/base.action) retornou **403**.

Condições concretas restantes: **vigência regulatória individual atual de P38 não comprovada** e **compatibilidade do cliente efetivamente implantado com proveniência por regra/zero por finalidade não demonstrada**. Sem essas provas não há liberação técnica operacional; dose/espécie/restrições exigem decisão curatorial específica antes de promoção. Nenhum deploy, merge ou ativação foi executado.

## Registro histórico — 28/10/2026

**Decisão: CONFIRMADO_DOCUMENTAL.** Candidata canônica local concluída, sem escrita remota ou promoção operacional. Esta entrega não resolve as demais retenções F6 nem autoriza ativar a regra.

## Baseline e consulta atual

- Checkout `C:/Users/mares/dyad-apps/GestaoAgro`, branch `codex/optimize-agent-infrastructure`, HEAD `52fd311d38f7a7775982941b9406fb2bb7062656`. A main histórica informada não foi adotada como estado atual do banco.
- Preexistentes preservados: `src/lib/reproduction/__tests__/calfJourney.test.ts`, `src/lib/reproduction/calfJourney.ts`, `src/lib/testFarm/service.ts`. Staged vazio na entrada.
- Supabase MCP `execute_sql`, projeto `zqloazqzhwauamcejmuz`, transação `READ ONLY`, captura `2026-10-28T22:48:24.262597+00:00` (19:48:24 BRT). Snapshot integral das oito tabelas restrito a P38 e fontes relacionadas, incluindo tombstones, embutido em `review_evidence.snapshot` da candidata. Não é fonte operacional ou catálogo alternativo.
- P38: produto `db743728-59e2-5ecb-8b2e-211ab170618f`, chave `COMMERCIAL_RESEARCH_F5_P38_EPRECIS`, Eprecis, eprinomectina 2%, cadastro `ativo`, `approved_for_catalog=true`; autorização operacional, seleção automática e agenda automática `false`.
- Duas fontes bibliográficas de apoio, seis coberturas e seis vínculos de produto; uma regra de corte `a435e33b-ab52-593a-a2ac-10393f71a88e`, 12 dias, `precisa_validar`, e um vínculo de fonte de apoio. Nenhuma regra de leite/mista, fonte equivalente à bula ou tombstone relacionado encontrado. Dose e autorização por espécie permanecem pendentes. Datas e metadata existentes preservados no snapshot.
- Consulta complementar por UUIDs propostos, `source_key` e URL de bula Eprecis retornou zero linhas, sem excluir tombstones. As fontes anteriores têm URL/tipo/versão distintos; não foram reclassificadas nem substituídas.

## Fonte e candidata

[Bula brasileira Ceva/Sespo, P12073 V00](https://ruminants.ceva.com/app/uploads/sites/16/2023/10/Eprecis-Bula.pdf), página única, quadro **Período de carência**: leite bovino sem prazo de carência; abate 12 dias após última aplicação. Composição e posologia confirmam eprinomectina 2% e via subcutânea. Registro impresso `SP 000129-0.000008`, licença datada de 21/05/2019; vigência atual não reconfirmada. A apresentação descrita na bula é mais ampla que o cadastro; não foi alterada por estar fora deste incremento.

Consulta documental realizada pela ferramenta web com extração por página e solicitação de screenshot. Download HTTP direto bloqueado por Cloudflare; não se produziu cópia binária/hash do PDF. `published_at`, `valid_from` e `valid_until` permanecem null: nem o caminho da URL nem a licença impressa foram tratados como publicação ou vigência.

[Candidata canônica](evidence/SANITARIO_V2_C02_P38_REVIEW_CANDIDATE_20261028.json): contrato `13.0.0-canonical-contract`, `VERSIONED_EXPLICIT_UUID`, `execute_import=false`, gates de importação/escrita remota false. O produto é referência integral ao cadastro observado, sem alteração de flags/metadados.

| Linha proposta | Identidade |
| --- | --- |
| Fonte `bula`, `forte`, `SIM_BULA`, versão `P12073 V00` | `c6ab8b68-1bbf-583c-82c9-2bfbc2ca6507` / `SRC_C02_P38_EPRECIS_P12073_V00` |
| Cobertura `withdrawal=covers`, página 1 e contexto explícito | `af5e9b44-7460-5338-a4fb-ca23bf80c27a` |
| Regra leite bovino SC | `a4f5dff8-f48c-5a73-9d64-a5493ad8203c` / `C02_P38_EPRECIS_LEITE_SC_P12073_V00` |

Identidades propostas derivadas por UUIDv5, namespace URL `6ba7b811-9dad-11d1-80b4-00c04fd430c8`, prefixo `rebanhosync:` e nomes semânticos registrados na candidata. Não são IDs persistidos. Há ainda dois vínculos compostos: produto/fonte/withdrawal e regra/fonte/withdrawal.

Regra: `species_code=bovino`, `aptitude=leite`, `route=SC`, `applicability=zero`, `milk_days=0`, `meat_days=null`, `milk_hours=null`, `zero_requires_explicit_source=true`, `status_curatorial=precisa_validar`. `dose_basis=null`, sem criar regra de dose. Nenhuma regra corte/mista é criada ou alterada; a regra de 12 dias existente continua pendente.

## Validação observada

- `pnpm test -- tests/codex/sanitario-c02-p38.test.mjs`: **10/10**. Contrato canônico; preservação do cadastro; rejeição de zero sem fonte, fonte fraca ou evidência não confirmada; cobertura específica no domínio; vínculo de carência; conflitos de identidade/tombstone; ausência de carência ativa nos três contextos.
- Dry-run chama o **buildPlan existente** sobre snapshot com transporte SQL de leitura simulado: **5 create + 1 skip**, nenhuma atualização. Projeção apenas em memória seguida do mesmo planner: **6 skip**. Regra corte, dose, autorização e produto preservados; exatamente duas regras após projeção, sem duplicação no replay.
- O controle de conflito usa `assertPublishablePlan` existente: rejeição impede publicar o plano inteiro. Na primeira execução, uma expectativa de teste incorreta exigia ausência de qualquer operação create mesmo em plano rejeitado; corrigida para verificar a barreira real. Nenhum código de produção foi alterado para satisfazer o teste.
- `pnpm exec eslint tests/codex/sanitario-c02-p38.test.mjs` e `git diff --check`: saída 0.
- `pnpm run gates:docs`: saída 0; headers, continuidade e `data_contract_audit` aprovados, sem repetir `audit:agents` já incluído.

Gate técnico: **READY exclusivamente para a entrega local da candidata pendente**. Três arquivos novos revisados (candidata, teste focado e este relatório), sem alterações tracked próprias ou staged; os três deltas preexistentes permanecem separados. Não há bloqueador para a curadoria documental solicitada. A ressalva de semântica abaixo impede interpretar este resultado como prontidão para ativação ou publicação.

O ensaio é dry-run do planner em memória, não CLI administrativa remota, aplicação SQL, integração PostgreSQL, teste de locks/CAS/RLS ou replay remoto. Os testes do runtime usam a candidata pendente e a regra corte pendente, sem ativá-las. Não houve mudança no writer, gate sanitário, publicador, schema, migrations, RPC, RLS, dose ou autorização por espécie. Build, E2E e regressão global não executados por ausência de delta de runtime.

## Pendências reais

1. Revisar antes de qualquer aprovação operacional a semântica de `zero`: em `operationalWithdrawalSnapshotV2.ts`, o estado zero é tratado para ambos os propósitos dentro da aptidão selecionada, independentemente de `meat_days=null`. Portanto esta candidata pendente **não deve ser ativada diretamente** sem avaliação específica do consumidor; isso não invalida a confirmação documental de leite e não autoriza alteração de runtime neste escopo.
2. Vigência regulatória atual não reconfirmada. Registro impresso e data da licença são somente evidência documental.
3. A fonte/regra novas ainda não estão persistidas. Qualquer aplicação futura requer nova leitura de identidade/conteúdo e autorização explícita; esta entrega não contém comando de publicação.
