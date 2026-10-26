# Backlog mestre — portfólio RebanhoSync A–I

Atualizado em: 2026-10-25
Solicitações: MASTER-BACKLOG-01 e revisão MASTER-BACKLOG-02. Escopo: diagnóstico, planejamento e documentação local.
Baseline confirmado: `main@2f4e218c33b40b48524db721019186ddb2f3a70b`.

## Papel deste índice

Índice derivado de **71 iniciativas candidatas: 63 A–H e 8 I**. Cruza entregas, deltas e propostas; não cria fonte concorrente para status de fases, resultados certificados ou backlog normativo F24. Estados abaixo são snapshots dessa baseline, com certificação em coluna separada. Prioridades, responsáveis e próximas ações são **propostas**, sem autorização automática de implementação, backend, publicação ou rollout.

| Documento existente | Autoridade preservada / decisão nesta consolidação |
| --- | --- |
| [ROADMAP](../product/ROADMAP.md) | Sequência macro do produto e fases; mantido, sem trocar a F24.6A2 por Frente I |
| [PROJECT_STATUS](../context/PROJECT_STATUS.md) | Estado vivo e ponteiro de baseline/entregas; consultado na main atual, mantido |
| [ACTIVE_PHASE_PLAN](./ACTIVE_PHASE_PLAN.md) | Plano da F24 e ligação à baseline F24.0; mantido |
| [CURRENT_PHASE_HANDOFF](./CURRENT_PHASE_HANDOFF.md) | Continuidade técnica, limites e composição sanitária proposta; mantido |
| [OPEN_REVIEW_ITEMS](./OPEN_REVIEW_ITEMS.md) | Pendências técnicas acionáveis; mantido, sem reabrir entregas integradas |

**Atenção ao checkout antigo:** os documentos correntes foram lidos com `git show 2f4e218c:<path>`. As cópias locais de continuidade ainda pertencem ao HEAD anterior `4b43fc10`; links apontam para os caminhos canônicos, não atualizam seu conteúdo. Não sobrescrevemos quatro documentos locais com versões da main para simular integração. SHAs em cabeçalhos canônicos são baselines declarados de seus registros, não substitutos do Git observado.

Entregáveis associados:

- [Reconciliação Git, PRs e worktrees](./MASTER_BACKLOG_RECONCILIATION.md), com [classificação por arquivo](./evidence/MASTER_BACKLOG_WORKTREE_FILES_20261025.csv).
- [Dependências, paralelismo e squads](./MASTER_BACKLOG_EXECUTION_PLAN.md).
- [Diagnóstico preliminar da Frente I](./MASTER_BACKLOG_ARCHITECTURE.md), incluindo banco somente leitura e lacunas.
- [Validação documental e limitações](./MASTER_BACKLOG_VALIDATION.md).

## Convenções de leitura

Desenvolvimento: **integrada** = implementação/documento sustentado na main; **parcial** = capacidade presente com limite ou delta local; **planejada** = proposta registrada sem execução comprovada; **hipótese** = iniciativa candidata sem desenho/validação suficiente; **sem evidência** = buscas delimitadas não sustentaram entrega ou decisão. Não são estados de certificação.

Certificação: **hist.** = resultado histórico registrado na fonte indicada, não repetido nesta tarefa; **limitada** = envelope explícito; **não comprovada** = sem evidência suficiente localizada; **N/A doc.** = iniciativa documental sem certificação funcional aplicável. Nunca ampliar certificação por existência de código, merge ou tabela vazia.

A coluna **Dep.** é a única matriz autoritativa de relações deste índice. Sentido: `item → requisito/referência`. Sintaxe: `TIPO:destino,destino; TIPO:destino@escopo`. **BLOCKING** é pré-requisito obrigatório para o próximo escopo indicado; **CONDITIONAL** só bloqueia no escopo explícito após `@`; **RELATED** apenas relaciona iniciativas; **HISTORICAL** aponta entregas/fontes já existentes, sem reabrir sua execução. Os tipos não mudam desenvolvimento ou certificação. Referências `EXT-*` são externas aos 71 IDs e estão registradas no [plano de execução](./MASTER_BACKLOG_EXECUTION_PLAN.md#referências-externas-e-escopos-condicionais).

`@writer`, `@remote`, `@adapter` e `@retire` exigem somente análise/aceite do contrato tocado. Não exigem conclusão global de I01–I07. Estudos e reprodução de defeitos podem começar com baseline e evidência disponíveis; alteração de writer, compatibilidade ou autorização requer caracterização específica antes do patch. Evidência mecânica do grafo e tratamento dos ciclos: [normalização](./MASTER_BACKLOG_EXECUTION_PLAN.md#normalização-das-relações--master-backlog-02) e [validação](./MASTER_BACKLOG_VALIDATION.md#master-backlog-02--verificação-da-revisão-documental).

Prioridade proposta: **P0** pré-requisito da próxima decisão/risco conhecido; **P1** próximo incremento após dependências; **P2** evolução condicionada; **P3** hipótese a qualificar. Item integrado pode ter P2/P3 apenas para eventual incremento novo, não para reimplementá-lo. Squads propostos no plano; WT = códigos da matriz de reconciliação, `main` = sem delta específico atribuído. Caminhos de código entre crases são relativos à raiz; referência `S` é documento canônico abaixo.

| Ref. | Evidência / fonte canônica |
| --- | --- |
| S1 | [PROJECT_STATUS](../context/PROJECT_STATUS.md), snapshot consultado na main congelada |
| S2 | [ROADMAP](../product/ROADMAP.md) e [ACTIVE_PHASE_PLAN](./ACTIVE_PHASE_PLAN.md) |
| S3 | [CURRENT_PHASE_HANDOFF](./CURRENT_PHASE_HANDOFF.md) e [OPEN_REVIEW_ITEMS](./OPEN_REVIEW_ITEMS.md), incluindo pendências pós-F9 |
| S4 | [Fonte de verdade](../context/SOURCE_OF_TRUTH.md) e [fluxos operacionais](../architecture/OPERATIONAL_FLOWS.md) |
| S5 | [Publicação pública F6–F9](./SANITARIO_V2_F6_F9_PUBLIC_SUMMARY.md) e [recibo público](./evidence/SANITARIO_V2_F9_PUBLIC_RECEIPT.json) |
| S6 | [VF5](https://github.com/maresdeandrade/RebanhoSync/blob/2f4e218c33b40b48524db721019186ddb2f3a70b/docs/review/SANITARIO_V2_VF5_INTEGRACAO_20261024.md), [triagem TypeScript histórica](https://github.com/maresdeandrade/RebanhoSync/blob/2f4e218c33b40b48524db721019186ddb2f3a70b/docs/review/evidence/SANITARIO_V2_VF5_TYPESCRIPT_TRIAGE_20261024.json) |
| S7 | [Reconciliação desta execução](./MASTER_BACKLOG_RECONCILIATION.md); não é certificação de patches |
| S8 | [Frente I](./MASTER_BACKLOG_ARCHITECTURE.md); observação estática/remota limitada |
| S9 | [Mapa de capacidades](../product/CAPABILITY_MAP.md), [escopo MVP](../product/MVP_SCOPE.md), [visão](../product/PRODUCT_VISION.md) |

## A — Governança e qualidade

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | Fechamento documental F9 — reconciliar publicação e continuidade | Integrada #246 | Fechamento doc. hist.; sem recertificação remota | P2 | HISTORICAL:C01 | S1/S3; merge `2f4e218c`, head `7e3bbf95` | W05 | Manter entregue; consultar limites pós-F9 | GOV |
| A02 | Reconciliação de worktrees — separar deltas e histórico | Inventário documental realizado nesta entrega | Checks documentais em registro próprio; runtime N/A | P0 | BLOCKING:EXT-BASELINE | S7; 15 worktrees e CSV individual | W00–W14 | Revalidar somente worktrees alterados antes de integração futura | GOV |
| A03 | Integração seletiva — transportar somente delta exclusivo | Parcial: #240–#246 integrados; deltas exclusivos retidos | Por patch; deltas locais não certificados na main | P0 | BLOCKING:A02; CONDITIONAL:I01@writer,I02@writer,I04@remote; RELATED:B02,D02 | S7; conflito ops, reprodução/testFarm | W00/W03/W09 | Preparar candidatos independentes; resolver overlap de ops sem perder #245 | GOV/CORE |
| A04 | TypeScript — reduzir dívida comprovada | Parcial; 38 diagnósticos históricos VF5 | Contagem atual não executada | P1 | CONDITIONAL:A02@patch; RELATED:A08 | S6; `e2e/tsconfig.json` | W08 referência | Recontar no baseline escolhido e delimitar correção focada | CORE |
| A05 | Bugs operacionais — corrigir defeitos reproduzidos | Parcial; Auth/Insumos corrigidos #245; candidato estático em óbito | Fluxo óbito não reproduzido aqui | P1 | BLOCKING:EXT-BASELINE; HISTORICAL:B03,B04; RELATED:A07 | `src/pages/AnimalDetalhe.tsx::handleRegisterObito`; S3/S7 | main | Reproduzir acesso status/id no wrapper AnimalAgendaRow antes de corrigir | CORE |
| A06 | Governança Superpowers — consolidar roteamento | Parcial local; relatos de uso já integrados | N/A doc.; patch de governança não certificado | P1 | CONDITIONAL:A02@patch; RELATED:A08 | `AGENTS.md`, `.agents/rules/CONTEXT_LOADING.md`, `no-broad-context.md`; S7 | W00/W09 | Comparar dois candidatos e revisar um único delta | GOV |
| A07 | UI-STRUCT-00 — inventariar responsabilidades/hotspots | Planejada local; diagnóstico existe | N/A doc.; não autoriza refactor | P2 | BLOCKING:A02; RELATED:E03 | `docs/review/UI_STRUCT_00_ARCHITECTURAL_PLAN.md` e métricas locais | W00 | Rebaseline retirando propostas já entregues #240/#241/#243/#245 | GOV/PERF |
| A08 | CI proporcional — manter seleção por risco | Integrada | Workflows existentes; não reexecutados aqui | P2 | HISTORICAL:EXT-S7; CONDITIONAL:EXT-SCOPE@patch | `.github/workflows/antigravity-validate.yml`; `scripts/codex/validate.ps1` | main | Usar perfil explícito e testes focados na próxima mudança | GOV |

## B — Operação pecuária

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | TEST-FARM-01G — Fazenda Modelo determinística | Parcial local; seed ausente da main | Relatório local hist. de carga/replay com ressalvas; não reexecutado | P1 | BLOCKING:A03; CONDITIONAL:B02@seed,D02@retry; RELATED:F07,C04 | `src/lib/testFarm/**`; `.tmp/test-farm-01g/RELATORIO.md`; S7 | W00 | Revisar seed e patches necessários separadamente da massa histórica | CORE |
| B02 | Reprodução/cria/parto histórico — preservar fatos e vínculos | Integrada; delta local de espécie/replay/comparação | Fase 13 hist.; delta atual não certificado na main | P0 | BLOCKING:A02; CONDITIONAL:I01@writer,I02@writer; RELATED:D02,A03 | `src/lib/reproduction/register.ts`, `calfJourney.ts`, `remoteSync.ts`, testes; S7 | W00 | Caracterizar e transportar somente correções exclusivas | CORE |
| B03 | Agenda/Eventos — manter intenção e fato distintos | Integrada; limites por comando/domínio | Cobertura hist. por domínio, não universal | P1 | HISTORICAL:EXT-S4; CONDITIONAL:I01@writer,I02@writer; RELATED:A05 | `src/lib/agenda/storage.ts`; `src/lib/events/buildEventGesture.ts`; S4 | main | Delimitar eventual lacuna no comando, incluindo candidato A05 | CORE |
| B04 | Animal Detail V2 — evoluir ficha existente | Integrada, com melhorias residuais a delimitar | Integrações hist.; sem recertificação global da tela | P2 | HISTORICAL:EXT-S1; RELATED:A05,A07 | `src/pages/AnimalDetalhe.tsx`; S1/S2 | main | Separar bug reproduzido de refactor e melhoria nova | UX/MOB |
| B05 | Financeiro — fatos e resultado gerencial | Integrada; resultado econômico amplo parcial | Fase 16/#94 hist.; lucro completo não certificado | P2 | HISTORICAL:EXT-S9; CONDITIONAL:EXT-SOURCE@new | `src/lib/finance/transactions.ts`, `economicCoverage.ts`, `observedEconomicResult.ts`; S9 | main | Definir capacidade nova antes de DRE/ROI/rateio | CORE/PROD |
| B06 | Insumos — projeção, snapshot e isolamento | Integrada #241/#243/#245 | Checks hist. dos PRs; composição geral não certificada aqui | P2 | HISTORICAL:EXT-S7; CONDITIONAL:C07@apply | `src/pages/Insumos/helpers/buildInventoryViewModel.ts`, `adapters/readInventorySnapshot.ts`; S7 | W01/W02/W10–W13 | Preservar extrações e guards; não refazer entregas | CORE |
| B07 | Manejo/lotes/pastos — movimento factual e ocupação | Integrada, resíduos de estados/ocupação delimitados | Animal→Lote no envelope F24.4; CAS universal não | P2 | HISTORICAL:EXT-S3; CONDITIONAL:D04@writer,I01@writer,I02@writer | `src/lib/offline/movement.ts`, `src/features/occupancy/**`; S3/S4 | main | Inventariar resíduos por writer antes de novo incremento | CORE |
| B08 | Genealogia — filiação declarada e ordenação | Parcial | Genética/validação avançada não comprovada | P2 | HISTORICAL:B02; CONDITIONAL:I06@adapter | `src/lib/animals/familyOrder.ts::buildAnimalFamilyRows`, registration/pai_id/mae_id | main | Definir necessidade além da filiação declarada | CORE/PROD |
| B09 | Simulação produtiva/comercial — projeção sem execução | Integrada | Fase 23/#134 hist., com limites da simulação | P3 | HISTORICAL:EXT-S2; CONDITIONAL:EXT-SOURCE@new | `src/lib/simulation/productiveCommercialSimulation.ts`; `src/pages/AnimalSimulacao.tsx`; S2 | main | Manter entregue; definir demanda nova sem converter projeção em fato | CORE/PROD |

## C — Sanitário V2

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | Publicação F6–F9 — preservar integração e recibos | Integrada #244 | Publicação hist. registrada; merge não recertifica remoto | P2 | HISTORICAL:EXT-S5,A01 | S5/S7; merge `0e7f5137`, head `00f42b68` | W06 | Manter entregue; não repetir importação | SAN |
| C02 | Curadoria dos 39 produtos — completar fonte por campo | Parcial: publicação feita, curadoria pendente | Sem autorização operacional dos produtos por publicação | P1 | HISTORICAL:C01; CONDITIONAL:EXT-SOURCE@approve; RELATED:I03,C03 | S3/S5; 42 ativos precisa_validar observados em S8, lote F6 distinto | W00 histórico/main | Revisar cada produto/campo e rastrear proveniência do lote | SAN |
| C03 | Três candidatos retidos — decidir identidade/fontes | Planejada, retenção deliberada | Não certificados | P1 | CONDITIONAL:EXT-SOURCE@approve; RELATED:C02 | S5; Fortress 8, Lepto-Bac 6, Valbazen 10 Cobalto fora do lote | W00 histórico/main | Resolver fontes/identidade sem inclusão automática | SAN |
| C04 | TEST-FARM-01H — homologação sanitária local | Planejada; execução impedida no relatório local | Não concluída; dry-run hist. com zero fatos/intentos propostos | P2 | CONDITIONAL:B01@seed,C07@apply,C02@apply,EXT-HARNESS@apply | `.tmp/test-farm-01h/RELATORIO.md`; S7 | W00 | Definir pré-requisitos técnicos locais; não importar remoto por inferência | SAN/CORE |
| C05 | AuthProvider + backend real — composição de sessão/recuperação | Parcial: #242/#245 implementam guards e testes separados | Provider sintético VF3 / backend real VF4; composição não comprovada | P1 | BLOCKING:EXT-BASELINE; CONDITIONAL:EXT-HARNESS@certify; HISTORICAL:D03; RELATED:C06 | S3/S6; `src/hooks/useAuth.tsx`, `useAuth.farmContext.test.tsx` | W01/W02/W07; main | Delimitar matriz integrada local reutilizando guards existentes | SAN/CORE |
| C06 | F24.7 — certificação sanitária completa | Planejada | NOT_STARTED para completa em S3; blocker stale já fechado | P1 | CONDITIONAL:EXT-F24.7@certify,C05@certify | S2/S3; recertificação stale 05/10 em S1 | main | Formalizar matriz completa sem reabrir blocker encerrado | SAN |
| C07 | Protocolos/aplicação/carência/aptidão — fontes e guards | Parcial no produto amplo; capacidades implementadas | Fase 12 hist.; produtos novos/F24.7/rollout não liberados | P1 | HISTORICAL:EXT-S4; CONDITIONAL:C02@apply,C06@release; RELATED:I03 | `sanitaryProtocolExecutionAuthorizationV2.ts`, `operationalWithdrawalSnapshotV2.ts`, `withdrawalReadModel.ts` sob `src/lib/sanitario/`; S4/S8 | main | Delimitar lacuna real preservando fontes, no_agenda_auto e snapshots | SAN |
| C08 | Rastreabilidade sanitária — prova factual e fontes | Integrada; extensão só mediante lacuna | Evidências hist. específicas; sem garantia universal | P2 | HISTORICAL:EXT-S6; CONDITIONAL:I02@writer,I06@adapter | `src/lib/sanitario/history/sanitaryExecutedHistoryV2.ts`; TechnicalSources no catálogo; S6/S8 | W07/main | Inventariar cobertura antes de implementar novo rastreio | SAN |

## D — Arquitetura, sync e segurança

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | Contratos F24.2–F24.5 — preservar fechamento | Integrada | Closeouts hist. limitados aos envelopes descritos | P2 | HISTORICAL:EXT-S3,EXT-S4 | S1/S3; #169/#170/#178/#181/#190 | main | Trabalhar resíduos explícitos, sem reabrir fases inteiras | CORE |
| D02 | Retry offline reprodutivo — preservar revisão/identidades | Integrada com delta local exclusivo | Testes versionados; delta não executado aqui | P0 | BLOCKING:A02; CONDITIONAL:I01@writer,I02@writer; RELATED:B02,A03 | `src/lib/offline/ops.ts`, reproduction/remoteSync e testes; S7 | W00 | Reconciliar hunk retry com guards #245 e caracterizar reprocessamento | CORE |
| D03 | Farm-switch/respostas tardias — contexto correto | Integrada #245; composição C05 parcial | Hist. #245/F24.3/F24.4; C05 pendente | P1 | HISTORICAL:EXT-S7; RELATED:C05 | `farmContextRevision`, `pendingFarmSelection`, `changingFarm` em useAuth; S3 | W01/W02; W00 stale | Reutilizar implementação atual na matriz C05 | CORE |
| D04 | state_*/Evento→estado — fechar resíduos por entidade | Parcial | Animal→Lote certificado; demais estados/atomicidade universal não | P1 | CONDITIONAL:I01@writer,I02@writer,I04@remote | S3; `F24_4E_CONFLICT_RESOLUTION_CONTRACT.md` | main | Mapear lacuna factual por writer/estado, sem generalizar receipt | ARCH/CORE |
| D05 | Process kill/restart — comprovar sobrevivência real | Parcial: restart lógico implementado/certificado | REAL_PROCESS_KILL NOT_PROVEN em S3 | P2 | CONDITIONAL:EXT-HARNESS@certify; RELATED:F05,F06 | `F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md`; crashRestartCertification.test | main | Delimitar kill real e perfil persistente antes de executar | CORE/QA |
| D06 | RLS/multi-tenant — autorização efetiva por fazenda | Integrada; diagnóstico atual parcial | Evidências hist.; RLS ON em 7 tabelas não certifica políticas | P0 | HISTORICAL:EXT-S8; CONDITIONAL:I04@remote | S8; migrations/policies e sync-batch; S1/S3 | main | Revisar callers/policies/grants e controles negativos por contrato | ARCH/SEC |
| D07 | Migrations/compatibilidade — evolução segura | Parcial quanto à cobertura ampla | Baselines hist.; compatibilidade universal não comprovada | P1 | CONDITIONAL:I04@remote,I07@retire; RELATED:I08 | Migrations ativas; `src/lib/offline/db.ts`; S8 | main | Delimitar evolução forward-only e clientes afetados | ARCH |
| D08 | Clientes offline antigos — preservar envelopes/replay | Parcial; tradução legada implementada | Universalidade não comprovada | P1 | HISTORICAL:EXT-S4; CONDITIONAL:I01@writer; RELATED:I07 | `sanitarioV2Cutover.ts`, db/tableMap; `sanitaryPlanningSyncV2.ts`; S8 | main | Inventariar versões/shapes pendentes antes de depreciação | CORE/ARCH |

## E — Performance e estrutura

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | Reconnect 1k — preservar envelope aferido | Integrada #200 | Hist. CERTIFIED: 5 runs, 1k gestos/animais, 2 fazendas, warm, agenda vazia | P2 | HISTORICAL:EXT-S2 | `F24_6A1_RECONNECT_1K_CERTIFICATION.md`; mediana hist. 146,46s | main | Manter entregue; não repetir ou extrapolar capacidade | PERF |
| E02 | F24.6A2 — formalizar inventário estático | Planejada; escopo/aceite ainda propostos | N/A doc.; nenhum benchmark iniciado | P1 | BLOCKING:EXT-SCOPE; HISTORICAL:EXT-S2,EXT-S3 | Handoff seção F24.6A2; plano ativo | main | Formalizar startup/histórico/bundle/queries/índices sem otimização | PERF |
| E03 | UI-STRUCT — reduzir hotspots por responsabilidade | Planejada local; sucessores Insumos/relatórios integrados | N/A para plano; sem certificação geral de arquitetura | P2 | BLOCKING:A07; CONDITIONAL:I01@writer,I02@writer | S7; #240/#241/#243/#245 | W00/W03/W09/W10/W12 | Consolidar com A07 e retirar tarefas já entregues | PERF/ARCH |
| E04 | Histórico/listas — avaliar leitura em escala | Parcial: telas existem, evolução não delimitada | Desempenho geral não certificado | P2 | CONDITIONAL:E02@measure | `src/pages/Eventos.tsx`, `AnimalDetalhe.tsx`; S3 | main | Inventário de callers/volume antes de paginação/virtualização | PERF |
| E05 | Índices/queries — reduzir custo medido | Parcial: índices/consultas existentes | Sem benchmark específico novo | P2 | CONDITIONAL:E02@measure,I04@remote | `src/lib/offline/db.ts`; S3 | main | Mapear acesso e perfil antes de mudar índices | PERF/ARCH |
| E06 | Bundle/startup — medir envelope inicial | Parcial: rotas lazy existentes | Startup/bundle geral não certificado | P2 | CONDITIONAL:E02@measure | `src/App.tsx::lazy`; pendências de chunks S3 | main | Inventariar chunks/entrada e definir medição dirigida | PERF |
| E07 | Benchmarks adicionais — testar hipótese explícita | Planejada | 10k/capacidade geral não certificados | P2 | BLOCKING:E02; CONDITIONAL:EXT-SCOPE@measure,EXT-HARNESS@measure | S2/S3; limites do relatório E01 | main | Definir workload e gates; não iniciar por inferência | PERF |

## F — UX e mobile

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Visual V2 — manter base integrada | Integrada | Trilha D/F18–F20 hist.; sem recertificação atual | P3 | HISTORICAL:EXT-S2; CONDITIONAL:EXT-SCOPE@new | S2; #122/#125–#128; telas atuais | main | Não reabrir redesign sem necessidade comprovada | UX/MOB |
| F02 | Jornadas operacionais — evoluir fluxo real | Integrada | Cinco jornadas críticas hist.; novos cenários não certificados | P2 | HISTORICAL:EXT-S2,B03; RELATED:A05 | Home/Animais/AnimalDetalhe/Registrar/Agenda; S2 | main | Tratar defeito ou jornada nova individualmente | UX/MOB |
| F03 | Acessibilidade — remover barreiras comprovadas | Parcial | Testes dirigidos hist.; WCAG global não comprovada | P2 | BLOCKING:EXT-SCOPE | AnimalEditarAccessibility.test.tsx; aria-label/teclado RFID; S2 | main | Delimitar barreira e teste de interação acessível | UX/MOB |
| F04 | Capacitor — distribuir base compartilhada | Planejada como direção; configuração mobile não comprovada | Não certificada | P2 | BLOCKING:EXT-SCOPE; CONDITIONAL:D08@mobile; RELATED:D05 | Diretriz AGENTS; nenhuma árvore Android/iOS/config localizada na main | main | Definir alvo sem reescrita React ou storage paralelo | UX/MOB |
| F05 | Lifecycle/storage mobile — sobreviver suspensão/restart | Planejada; contratos web parciais existentes | WebView/aparelho não certificados | P2 | CONDITIONAL:F04@mobile,D08@mobile; RELATED:D05,F06 | F24.3/F24.5 em S1/S3; Dexie | main | Especificar suspend/kill/reconnect/auth expirada no alvo | UX/MOB/CORE |
| F06 | Dispositivos físicos — validar envelope real | Planejada | REAL_PHYSICAL_MULTI_DEVICE NOT_PROVEN; VF5 sem aparelho | P2 | CONDITIONAL:EXT-HARNESS@certify,F04@mobile,F05@mobile; RELATED:D05 | S3/S6 | main | Escolher modelos/OS e cenários antes da matriz | QA/UX/MOB |
| F07 | Onboarding/Fazenda Modelo — entrada guiada e demo | Parcial: onboarding integrado; seed local | Teste onboarding versionado; seed não integrado/certificado atualmente | P1 | HISTORICAL:EXT-S9; CONDITIONAL:B01@seed,A03@patch | `src/pages/OnboardingInicial.tsx`; `src/lib/farms/experienceMode.ts`; testFarm local | W00/main | Separar seed B01 do onboarding já entregue | UX/MOB/CORE |

## G — Interoperabilidade

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G01 | NF-e XML — qualificar importação candidata | Hipótese de adapter; XML não comprovado | Não comprovada | P3 | BLOCKING:EXT-SCOPE; CONDITIONAL:I05@adapter,I06@adapter | S9; fiscal NF-e/SPED amplo fora do MVP não decide importador pontual | main | Definir documento/ação canônica e fronteira fiscal | INTEROP/PROD |
| G02 | SISBOV/GTA — distinguir trânsito e registro externo | Parcial contextual; integração oficial não comprovada | Emissão/validação externa não comprovadas | P2 | HISTORICAL:EXT-S8; CONDITIONAL:I05@adapter,I06@adapter | `src/lib/sanitario/compliance/transit.ts`; RS-MOV-004 em S9; S8 | main | Separar checklist declarado, documento e validação oficial | INTEROP |
| G03 | Documentos externos — registrar fonte e proveniência | Parcial para referências; DMS amplo não comprovado | Não comprovada | P2 | HISTORICAL:EXT-S8; CONDITIONAL:I06@adapter | source_refs/source_refs_by_field, documento e histórico externo; S8 | main | Inventariar vínculos e força probatória, sem nova fonte primária | INTEROP/SAN |
| G04 | RFID — integrar dispositivo sobre identidade interna | Parcial: campo/importação e simulação de leitura | Hardware real não certificado | P2 | CONDITIONAL:EXT-DEVICE@adapter,I06@adapter | registration.ts, import CSV, AnimalEditar.tsx; S8 | main | Definir leitor/protocolo; simulação não prova driver | INTEROP/UX/MOB |
| G05 | Balanças — importar fato de pesagem com proveniência | Hipótese; integração hardware não comprovada | Não comprovada | P3 | CONDITIONAL:EXT-DEVICE@adapter,I06@adapter | `src/lib/offline/types.ts::possui_balanca` apenas metadado | main | Definir protocolo/hardware/caso de uso antes de adapter | INTEROP |
| G06 | Georreferenciamento — qualificar necessidade | Sem evidência técnica localizada | Não comprovada | P3 | BLOCKING:EXT-SCOPE; CONDITIONAL:I06@adapter | Busca dirigida geo/lat/long/polígono/GeoJSON sem implementação comprovada | main | Definir necessidade e origem dos dados | PROD/INTEROP |
| G07 | Adaptadores externos — traduzir para domínio canônico | Hipótese / direção candidata | N/A de proposta | P2 | CONDITIONAL:I01@adapter,I02@adapter,I05@adapter,I06@adapter | S8; catálogo solicitado, sem framework externo comprovado | main | Desenhar primeiro contrato concreto, sem camada genérica prematura | INTEROP/ARCH |
| G08 | Outbox/jobs — avaliar integração assíncrona externa | Parcial: fila interna existe; outbox externa não comprovada | Sync interno hist.; jobs externos não certificados | P2 | CONDITIONAL:I01@writer,D08@retire,I07@retire | queue_gestures/queue_ops/sync_reconcile_obligations em Dexie; S8 | main | Determinar necessidade sem criar segunda fila por inferência | CORE/INTEROP |

## H — Produto e comercialização

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H01 | MVP/beta — definir alvo de liberação | Integrada documentalmente: beta interno/MVP operacional | Produção/release geral não autorizados; F24.8 depende de gates | P1 | CONDITIONAL:EXT-PO@release,EXT-F24.8@release; HISTORICAL:EXT-S9 | S9/S3 | main | Especificar critérios para beta externo sem lançar automaticamente | PROD |
| H02 | Público-alvo — validar hipótese de mercado | Integrada documentalmente | Validação comercial não comprovada | P1 | HISTORICAL:EXT-S9; RELATED:H03 | PRODUCT_VISION: pequenos/médios produtores e gestores de corte | main | Confrontar hipótese com pesquisa e critérios de piloto | PROD |
| H03 | Fazendas piloto — preparar programa externo | Hipótese; pilotos/clientes reais não comprovados | Não comprovada; demo sintética não é piloto externo | P2 | CONDITIONAL:EXT-PO@release,EXT-SCOPE@release,H08@release; RELATED:H01,H02 | Telemetria piloto/seed local não provam clientes; S9 | main | Definir participantes, consentimento, suporte e aceite | PROD |
| H04 | Monetização — decidir modelo/preço | Sem evidência de modelo comercial decidido | N/A | P3 | CONDITIONAL:EXT-PO@approve; RELATED:H02,H03 | Sem plano decidido localizado nos documentos ativos consultados | main | Definir hipótese de preço antes de implementar cobrança | PROD |
| H05 | Aquisição — testar canais/funil | Sem evidência de plano decidido | N/A | P3 | BLOCKING:EXT-SCOPE; RELATED:H02,H03 | Público-alvo em S9 não prova canal/funil | main | Definir experimento comercial com métrica e prazo | PROD |
| H06 | Métricas de produto — medir uso/valor | Parcial: instrumentação integrada | Uso real/sucesso comercial não comprovados | P2 | HISTORICAL:EXT-S9; CONDITIONAL:EXT-PO@release; RELATED:H01,H03 | `src/lib/telemetry/pilotMetrics.ts`; telemetria local Dashboard | main | Definir denominadores, consentimento e metas de produto | PROD |
| H07 | Investimento — qualificar tese de captação | Sem evidência de frente decidida | N/A | P3 | CONDITIONAL:EXT-PO@approve; RELATED:H01,H04,H06 | Categoria financeira do produtor não comprova captação do produto | main | Definir objetivo/tese quando priorizado pelo PO | PROD |
| H08 | Operação/suporte — preparar rotina de atendimento | Parcial: manuais integrados | SLA/equipe/serviço real não comprovados | P1 | CONDITIONAL:EXT-PO@release; RELATED:H01,H03 | `docs/manuals/support/FAQ_SYNC.md`, FAQ_LOGIN, FAQ_SANITARIO, TROUBLESHOOTING | main | Definir canal/runbook/SLA para o alvo de liberação | PROD/GOV |

## I — Arquitetura Canônica, Integridade e Interoperabilidade

| ID | Título / objetivo | Desenvolvimento comprovado | Certificação separada | Pri. | Dep. | Evidência / referência | WT | Próxima ação concreta proposta | Squad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I01 | Inventário entidades/readers/writers/Dexie/RPC/Edge | Parcial: seis recortes críticos aprofundados na revisão 02 | N/A doc.; completude não certificada | P0 | BLOCKING:A02; RELATED:I02 | S8; tableMap, Dexie v33 e matriz de callers | main | Completar inventário por entidade e owner, incluindo writer remoto legado | ARCH |
| I02 | Ownership/fontes de verdade — decidir responsabilidades | Parcial: responsabilidades por caminho/chave mapeadas; decisões novas pendentes | N/A doc.; proposta não normativa | P0 | CONDITIONAL:I01@decision; RELATED:I03,I04 | S4/S8; metadata vs payload com writers distintos | main | Aprovar owner por entidade/chave sem fundir configurações | ARCH/CORE |
| I03 | Sanitário legado vs V2 — mapear coexistência | Parcial: readers/writers ativos confirmados | Sem certificação de retirada/compatibilidade total | P0 | CONDITIONAL:I01@retire,I02@retire; RELATED:C07 | S8; protocolos legados vazios mas ativos; produto legado com reader | main | Completar gates/callers e política de adaptação antes de descontinuar | ARCH/SAN |
| I04 | Constraints/FKs/RLS/fazenda — diagnosticar integridade | Parcial: FK NOT VALID e RLS flags revalidados | Auditoria global/policies/órfãos não executada | P0 | CONDITIONAL:I01@remote,I02@remote; RELATED:D06 | S8; SQL/JSON agregado; migration 20260722102038 | main | Diagnosticar dados/callers/policies antes de eventual migration | ARCH/SEC |
| I05 | Matriz PNIB/SISBOV/GTA — verificar exigências externas | Planejada; matriz candidata documentada | Contrato regulatório integral não validado | P1 | CONDITIONAL:I01@adapter,I02@adapter,I04@remote,EXT-REGULATORY@decision; RELATED:G02,I06 | S8; trânsito implementado não equivale a validação oficial | main | Identificar fontes oficiais, vigência, escopo e identificadores | INTEROP |
| I06 | IDs externos/documentos/proveniência — mapear evidência | Parcial: primitivas internas existem; contrato transversal pendente | Equivalência oficial/hardware não certificada | P1 | CONDITIONAL:I01@adapter,I02@adapter,I05@adapter; RELATED:G03,G04 | S8; RFID/identificação interna e histórico externo | main | Definir mapeamento, emissor, validade e força probatória | INTEROP/ARCH |
| I07 | Compatibilidade/depreciação — consolidar incrementalmente | Planejada; Alternativa B candidata | Nenhuma depreciação aprovada | P1 | CONDITIONAL:EXT-PO@retire,I01@retire,I02@retire,I03@retire,I04@retire,I05@retire,I06@retire,D08@retire; RELATED:D07 | S8; envelopes legados, receipts e leitura histórica | main | Definir critérios de convergência antes de retirar qualquer contrato | ARCH/CORE |
| I08 | Migrations futuras localizadas — evoluir após decisão | Planejada/condicionada; nenhuma migration criada | Nenhuma alteração de banco autorizada | P2 | CONDITIONAL:EXT-PO@remote,I04@remote,I07@retire; RELATED:D07 | S8; FK é diagnóstico, não autorização de VALIDATE | main | Preparar proposta forward-only por contrato somente quando aprovada | ARCH/SEC |

## Sobreposições e fronteiras de tarefa

| IDs preservados | Consolidação proposta |
| --- | --- |
| A07/E03 | Um backlog UI-STRUCT com referências cruzadas; retirar incrementos já integrados de relatórios/Insumos |
| A02/A03 | Inventário precede seleção; A02 não integra automaticamente deltas |
| B01/F07/C04 | Fazenda Modelo compartilhada; onboarding integrado e carga sanitária bloqueada permanecem resultados distintos |
| B02/D02 | Um candidato de reprodução/retry, com testes por contrato; não duplicar patch ops |
| C05/D03/C06 | Reutilizar proteção #245 numa matriz composta; F24.7 é certificação maior, não sinônimo dessa matriz |
| E02/E04/E05/E06/E07 | E02 formaliza inventários; otimizações/benchmarks dependem de hipótese e aceite próprios |
| D05/F05/F06 | Compartilhar critérios de recovery; separar restart lógico, kill real e aparelho físico |
| G02/I05; G03/G07/I06; G08/D08/I07 | Adaptadores dependem de domínio/ownership/compatibilidade; não criar contratos externos ou filas paralelas por antecipação |
| A01/C01 | Fechamento documental e integração/publicação são entregas distintas já integradas |

## Limites e decisões ainda humanas

**Fatos confirmados:** baseline e #240–#246 integrados; worktrees/deltas classificados; coexistência de readers/writers; observação remota agregada da Frente I. **Inferência:** completar ownership e reconciliação dos deltas críticos reduz risco antes de novas capacidades. **Recomendação:** ordem e squads no plano associado, com Alternativa B ainda candidata.

Não houve testes funcionais, build, E2E, auditoria global de RLS, nova certificação de produto, publicação ou execução sanitária. O candidato estático A05 foi conferido no código: `agenda` contém wrappers `{item, scheduleLabel,...}`, mas handleRegisterObito filtra `.status` e mapeia `.id` no wrapper; o impacto end-to-end precisa de reprodução própria. Não foi corrigido nesta tarefa.

O PO ainda precisa decidir Alternativa B/ownership, contratos externos e condições de depreciação; qualquer migration, integração de delta, backend de certificação ou liberação exige escopo/autorização próprios. Esta entrega não muda o estado canônico da F24 nem declara rollout.
