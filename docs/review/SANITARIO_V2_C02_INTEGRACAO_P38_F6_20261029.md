# C02/C07 — Integração P38 e próximo residual F6

**Atualização posterior, 29/10/2026:** o [encerramento consolidado F6](SANITARIO_V2_C02_F6_ENCERRAMENTO_CONSOLIDADO_20261029.md) persistiu a candidata P33 de abate SC como pendente e acrescentou a regra específica de corte P38 com prova forte. As seções abaixo preservam o estado observado antes desse lote; não indicam necessidade de repetir a persistência. Nenhuma ativação ou deploy foi realizado.

Data: 29/10/2026. Escopo: consolidação local P38, vigência individual e uma candidata F6. Sem commit, push, merge, deploy, nova escrita remota ou ativação.

| Recorte | Decisão observada |
| --- | --- |
| INTEGRACAO | **READY WITH CAVEAT local**; cliente implantado com **COMPATIBILIDADE_INSUFICIENTE_PARA_ATIVAR_P38** |
| REGULATORIO_P38 | **VIGENCIA_CONFIRMADA** na consulta individual MAPA |
| CURADORIA_PROXIMO_F6 | **CONFIRMADO_DOCUMENTAL_ABATE_SC**; P33, candidata local validada |

## Integração P38

Branch `codex/optimize-agent-infrastructure`, HEAD `4aacd94facbfb67dabc188c6a5df0553dfcba764`; main remota `20140c074b34857e5f4343f47778f5560e2e2482`. Uma worktree, staged vazio. Main→HEAD altera somente `CalfInitialEditor.tsx`, `registerPostPartum.test.ts` e `postPartum.ts`. Os deltas concorrentes de backlog, reprodução, test farm e UX foram preservados. Não foi identificado conflito de integração no recorte P38.

Arquivos do patch P38, sem novas mudanças runtime nesta continuidade:

- `src/lib/offline/{db,pull,tableMap,types}.ts`: Dexie v34 e pull-only do vínculo composto regra–fonte; snapshot completo, paginação e instalação transacional com o catálogo.
- `src/lib/sanitario/execution/{operationalWithdrawalSnapshotV2,executedProductTechnicalSnapshotV2,sanitaryAgendaExecutionV2}.ts` e `src/lib/sanitario/reconciliation/sanitaryCorrectionV2.ts`: seleção por finalidade, zero explícito e prova da regra selecionada, encaminhada por execução/correção.
- `scripts/codex/import-sanitario-protocols-v2.mjs`: entrada P38 fechada, ensaio e writer canônicos já utilizados; não foi executada novamente.
- Testes P38: `src/lib/offline/__tests__/{sanitarioIncrementalPullCursor,sanitarioTechnicalCatalogV2Pull,sanitarioTechnicalCatalogV2Store,telemetryFlushCursors.upgrade,sanitarioWithdrawalSources.upgrade}.test.ts`, `src/lib/sanitario/execution/__tests__/{operationalWithdrawalSnapshotV2,sanitaryAgendaExecutionV2}.test.ts`, `src/lib/sanitario/reconciliation/__tests__/sanitaryCorrectionV2.test.ts`, `tests/codex/sanitario-c02-p38.{test,local}.mjs`.

Deployment de produção **`dpl_6P2kx5yMarubVmWsiHKGsbpmcvVQ`**, READY, projeto Vercel `rebanho-sync`, domínio `rebanho-sync.vercel.app`, origem Git `main@20140c074b34857e5f4343f47778f5560e2e2482`. Confirmado por `list_deployments`, `get_deployment` e `get_project`. O `git show` desse SHA revela Dexie v33, ausência do espelho regra–fonte e `zero` independente da finalidade. Portanto, o cliente identificado ainda não contém os contratos P38. Isso impede ativação segura; não motivou deploy nesta tarefa.

Reutilizado [recibo local P38](evidence/SANITARIO_V2_C02_P38_LOCAL_RESULT_20261029.json), mesmo HEAD e runtime inalterado: **397/397 em 14 arquivos**, incluindo pull, upgrade, execução, correção, replay e writer. TypeScript: **233 baseline / 233 atual / zero novos identificados por arquivo, código e mensagem**; seis diagnósticos herdados em `pull.ts`. O typecheck global **falhou**, e o recibo preserva o resumo comparativo, não o inventário integral dos 233. Não foi repetido sem alteração runtime.

P38 permanece remoto pendente: carne e leite `unknown`. Cópia sintética ativa de leite com proveniência exata: leite `explicit_absence`, carne `unknown`. Corte só calcula 12 dias na fixture com prova forte especificamente vinculada à regra de corte. Persistência anterior **5 create/0 update/1 skip**, replay remoto **6 skip**; não repetidos.

## Vigência individual P38

O [painel oficial MAPA](https://mapa-indicadores.agricultura.gov.br/publico/extensions/Produtos_Farmaceuticos/Produtos_Farmaceuticos.html), acessível a partir da [página oficial de painéis](https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/produtos-veterinarios/paineis-de-bi-do-mapa), atualizado em **29/10/2026 05:50:26**, apresentou **EPRECIS / SP0001290-8 / Ativo / 20/05/2029 / SESPO INDUSTRIA E COMERCIO LTDA**. Número, nome e titular reconciliados com `SP 000129-0.000008`, da bula brasileira **P12073 V00**. O registro homônimo `SP0001290-7` não foi usado como prova. [JSON curatorial](evidence/SANITARIO_V2_C02_P38_REGULATORIO_20261029.json) e [captura oficial](evidence/SANITARIO_V2_C02_P38_MAPA_REGISTRO_20261029.png).

A bula nacional mantém bovinos, SC, eprinomectina 2%, aplicação única de 1 mL/100 kg, leite zero e abate 12 dias; segurança não avaliada abaixo de cinco meses, contraindicação em sensíveis ao ativo e orientação de MV. Não se inferiu aptidão universal. A nova consulta resolve a lacuna documental de vigência; não modifica a candidata imutável, a metadata remota ou os status operacionais.

## Próximo F6: P33 — Ripercol L 150 F

Selecionado um único campo residual: **carência de abate de bovinos por via SC, sete dias após a última aplicação**. Backlog/consolidado F6 e chats relacionados examinados não mostraram execução concorrente desse campo. A regra anterior tem prazo 7, mas fonte de apoio e via não especificada; o incremento documenta a prova primária e explicita SC. A divergência de leite **2 dias na bula / 3 dias no catálogo de 2025** permanece retida, sem regra de leite nesta candidata.

[Bula primária Zoetis](https://www.zoetis.com.br/global-assets/private/ripercol_150f_1.pdf), página única rasterizada, baixada e renderizada para exame visual. SHA256 **`606ccf62a63a3e34c4d76ce504bd46a54b011c39315cc59d3963fb1d0918ebba`**. Título Ripercol L - 150F, bovinos, modo de usar SC, quadro Período de carência com abate sete dias. Sem versão/data editorial impressa identificável: ambos null; metadata técnica do PDF não foi tratada como publicação ou vigência.

[Snapshot remoto somente leitura](evidence/SANITARIO_V2_C02_P33_REMOTE_READONLY_20261029.json), produto **`53678137-452a-5910-9bc6-67022504a6ce`**, preservado integralmente. Consulta de colisões incluiu tombstones e retornou zero para fonte por UUID/chave/URL, cobertura por UUID e regra por UUID ou produto/bovino/corte/SC. [Candidata canônica](evidence/SANITARIO_V2_C02_P33_CORTE_SC_REVIEW_CANDIDATE_20261029.json), contrato 13, UUIDv5 verificados:

| Proposta local | UUID |
| --- | --- |
| Fonte bula forte | `c0ea02f0-f18f-5084-b37d-38e454698cfe` |
| Cobertura withdrawal | `5c26551c-b2d3-5d6a-b714-a58088241843` |
| Regra bovino/corte/SC | `2651d9d7-390e-50ed-8065-4c4ba7b1ed1c` |

A candidata contém vínculos produto–fonte e regra–fonte `withdrawal`, `meat_days=7`, leite null, status **precisa_validar**, gates remotos false. A regra anterior `6fea1392-a588-569e-a520-e89827be7f14`, via null e pendente, não foi alterada. Nenhuma dose, autorização por espécie ou cadastro duplicado foi proposto.

Validação observada: `pnpm test -- tests/codex/sanitario-c02-p33.test.mjs --reporter=dot` → **7/7**. Contrato canônico, cadastro preservado, planner real **5 create/1 skip**, replay projetado em memória **6 skip**, regra anterior intacta, pendência conservadora, cópia sintética ativa com carne sete dias/leite desconhecido, prova específica ausente e contextos incompatíveis. A primeira execução falhou por arquivo candidato ainda ausente; isso é controle de preparação, não reprodução de defeito runtime. Não houve ensaio PostgreSQL ou replay remoto P33.

ESLint do novo teste, `git diff --check` e `pnpm run gates:docs` (inclui auditoria de agentes): saída 0. [Recibo consolidado](evidence/SANITARIO_V2_C02_INTEGRACAO_P38_F6_20261029.json). A entrega documental/local é **READY WITH CAVEAT** pelo typecheck global preexistente; não constitui liberação operacional.

## Pendências concretas

1. P38: integrar e comprovar implantação do contrato v34/zero por finalidade/proveniência específica antes de qualquer ativação; revisar separadamente os requisitos operacionais pendentes de dose, espécie e prova de corte. Vigência individual já confirmada.
2. P33: futura persistência exige autorização específica e nova conferência do estado remoto; o replay atual é somente projetado em memória. A divergência de leite continua impedindo conclusão desse outro campo.
