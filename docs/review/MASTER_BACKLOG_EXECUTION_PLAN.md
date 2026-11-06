# MASTER-BACKLOG-01/02/03 — dependências, squads e próximos incrementos

> Fechamento C02/F6 — 29/10/2026: cadastro e curadoria documental encerrados; 288 campos confirmados, 283 representados, cinco sem representação estruturada. Integração C07 e exceções específicas constam de [integração definitiva](./SANITARIO_V2_C02_F6_INTEGRACAO_DEFINITIVA_20261029.md). Baseline sanitária bc310735/main remota c752c9a, com árvores idênticas; commit de segurança 3f3c960. Notas anteriores conservam seus recortes históricos; não reabrem a curadoria dos 39.

Atualizado em: 2026-11-05
Estado vigente: main pós-#270 em `0206d64a5c8fe8d46700a4e9312862b417e13ba0`; [fechamento F24](./CURRENT_PHASE_HANDOFF.md#f24-integrada--pr-270). Incremento neonatal autorizado nesta tarefa; nenhuma nova fase, rollout ou reestruturação iniciada.

## Decisão de desenho proposta

Método histórico da consolidação 01/02: descoberta com `repository-context-retrieval`; leitura independente por responsabilidade com `dispatching-parallel-agents`; desenho por `brainstorming` e plano por `writing-plans`, adaptados ao pedido documental explícito. A especificação já define os entregáveis e a alternativa candidata; não se exige aprovação redundante para escrevê-los. A aprovação arquitetural para mudar o produto permanece futura. Nenhum plano autoriza commit ou integração.

**Recomendação:** Alternativa B, consolidação incremental com estruturas físicas preservadas inicialmente. Manter coexistência legada/V2 até inventário de callers, ownership, compatibilidade e clientes pendentes. Alternativa A (reestruturação ampla/limpeza) tem risco de perder contratos e extrapola o pedido; Alternativa C (camada externa independente do domínio) criaria mapeamentos concorrentes. A escolha estrutural definitiva de B e mudanças novas de contrato dependem do Product Owner e revisão técnica. I01/I02 encerraram o ownership no recorte examinado segundo S10 do índice; essa adoção estrutural não exige reabrir o diagnóstico concluído.

## Normalização das relações — MASTER-BACKLOG-02

A matriz de relações é a coluna **Dep.** do [índice mestre](./MASTER_BACKLOG.md), sem cópia concorrente em outro backlog. Esta seção explica a semântica e os critérios. A ordem de portfólio abaixo é proposta, não aresta implícita: somente `BLOCKING` e `CONDITIONAL` ativada pelo escopo geram pré-requisito. `RELATED`/`HISTORICAL` preservam contexto e podem ser recíprocas sem bloquear execução. Prioridade e squad também não criam arestas.

| Relação | Interpretação verificável |
| --- | --- |
| `BLOCKING` | Artefato prévio obrigatório para o próximo escopo descrito. Ex.: E03 utiliza rebaseline A07 antes de selecionar seu refactor. A03 usa A02 como inventário histórico encerrado, revalidando apenas baseline/touch set de nova extensão |
| `CONDITIONAL` | Pré-requisito apenas no escopo `@...`; a condição tem de constar da tarefa concreta. Um estudo ou reprodução não ativa automaticamente condições de escrita, certificação ou liberação |
| `RELATED` | Referência informativa sem ordenação obrigatória: não obriga encerrar o item relacionado |
| `HISTORICAL` | Entrega ou fonte existente usada como baseline; não significa trabalho a repetir, nem nova certificação |

### Referências externas e escopos condicionais

Destinos fora dos 71 IDs têm prefixo `EXT-` explícito. Não são iniciativas novas. Sua presença distingue pré-requisito externo de ID ausente; tampouco afirma que autorização, fonte técnica ou critério já existem para qualquer execução futura.

| Referência externa | Fonte / condição de satisfação |
| --- | --- |
| EXT-BASELINE | SHA/HEAD/status/touch set confirmados; na revisão 03 `main@d6f035fbe1a8d00aadcf78ac2af813e4eb223be8`, seis alterações locais P1 preservadas; o par 2f4e218c/4b43fc10 é histórico 01/02 |
| EXT-SCOPE | Escopo/objetivo/aceite do incremento identificado. A elaboração de proposta pode começar; execução além da autorização atual não decorre deste índice |
| EXT-SOURCE | Fonte técnica/econômica explícita do campo ou decisão em exame; pesquisa e registro de ausência podem começar antes da validação da fonte |
| EXT-REGULATORY | Fonte oficial, vigência e abrangência verificadas para uma conclusão regulatória; pesquisa I05 pode começar sem decisão de schema ou auditoria global |
| EXT-HARNESS | Ambiente/perfil/portas/dados exclusivos e autorização de execução dos cenários. Exigido para executar, não para escrever sua matriz |
| EXT-DEVICE | Hardware/protocolo/alvo identificado para adapter concreto; levantamento de opções não exige dispositivo provisionado |
| EXT-PO | Decisão humana explícita aplicável à liberação, depreciação, mudança estrutural ou adoção da proposta; não bloqueia a elaboração documental da proposta |
| EXT-F24.7 | Critérios da certificação completa no plano/handoff/pendências canônicos; proposta de matriz pode ser escrita sem executar certificação |
| EXT-F24.8 | Gates de produção/canário/rollback e decisão humana do plano canônico; não bloqueia estudo de público-alvo ou modelo de negócio |
| EXT-S1 | Referência S1 do índice: PROJECT_STATUS |
| EXT-S2 | Referência S2 do índice: ROADMAP / ACTIVE_PHASE_PLAN |
| EXT-S3 | Referência S3 do índice: CURRENT_PHASE_HANDOFF / OPEN_REVIEW_ITEMS |
| EXT-S4 | Referência S4 do índice: SOURCE_OF_TRUTH / OPERATIONAL_FLOWS |
| EXT-S5 | Referência S5 do índice: publicação F6–F9 / recibo público |
| EXT-S6 | Referência S6 do índice: VF5 / triagem TypeScript histórica |
| EXT-S7 | Referência S7 do índice: reconciliação Git, PRs #240–#246 e deltas |
| EXT-S8 | Referência S8 do índice: diagnóstico arquitetural, com limites históricos/remotos explícitos |
| EXT-S9 | Referência S9 do índice: capacidades / MVP / visão de produto |

| Escopo após `@` | Quando a condição se torna obrigatória / recorte de satisfação |
| --- | --- |
| patch | Preparar candidato que transporta alteração local; A02 somente nos caminhos candidatos |
| writer | Alterar writer, invariantes, fila ou projeção; mapa I01/I02 somente do contrato tocado, com readers/dependências necessários |
| remote | Alterar/propor adoção de contrato remoto, autorização ou integridade; I04 somente no objeto/caller afetado, sem auditoria global obrigatória |
| adapter | Desenhar/implementar adapter concreto; mapear identidade, comando canônico, proveniência e fronteira externa pertinentes, sem esperar inventário transversal |
| seed | Integrar/rodar extensão da Fazenda Modelo; base testFarm e correções P0 já contempladas na main. Caracterizar só o delta indicado; não recriar evidência histórica |
| retry | Nova extensão de seed/patch toca retry; caracterizar o contrato afetado. Hunk P0 e guard #245 já reconciliados segundo S10; não portá-los novamente |
| apply | Usar produto/protocolo para execução sanitária real e seus fatos; disponibilidade técnica/autorização pertinente, não apenas publicação |
| approve | Aprovar campo técnico/produto ou adotar proposta comercial; pesquisa e hipóteses continuam independentes |
| certify | Executar matriz de certificação; ambiente e critérios prévios devem existir, sem confundir desenho da matriz com execução |
| release | Liberar alvo concreto (beta externo, produto/capacidade ou produção); critérios/gates e suporte aplicáveis, sem bloquear estudos |
| mobile | Executar no alvo mobile escolhido; kill em browser web não depende de Capacitor ou aparelho físico |
| retire | Depreciar/remover/substituir contrato; comprovar callers, história e envelopes pendentes do contrato afetado antes da decisão |
| measure | Rodar medição/benchmark do envelope delimitado; inventário/proposta podem anteceder ambiente e orçamento |
| new | Acrescentar capacidade a item integrado; o resultado integrado permanece histórico, sem reabertura |
| decision | Formalizar decisão de ownership/regulatória; evidência no objeto examinado, não conclusão global de I01–I06 |

### Tratamento dos ciclos e de bloqueios excessivos

| Relação anterior | Relação corrigida / justificativa |
| --- | --- |
| A01 ↔ C01 | `HISTORICAL` nas duas direções: #244 e #246 já integrados; documentação/publicação são resultados diferentes, não trabalho circular |
| A05 ↔ B04 | A05 usa B04 como baseline `HISTORICAL`; B04 relaciona A05 como `RELATED`. Reprodução do óbito pode iniciar sem redesign da ficha |
| A07 ↔ E03 | E03 tem `BLOCKING:A07` para rebaseline dos hotspots; A07 tem somente `RELATED:E03`, sem depender do refactor que vai orientar |
| B02 ↔ D02 | `RELATED` nas duas direções; próximo candidato pode reunir os hunks acoplados numa mesma unidade, com caracterização própria. Ambos usam A02; não exigem conclusão um do outro |
| D05 → F06 → F04 → D05 | D05 apenas relaciona mobile/aparelhos. F04 apenas relaciona D05; F06 depende condicionalmente de F04 no alvo mobile, não para kill web |
| D05 → F06 → F05 → D05 | D05/F05/F06 são relacionados; condições mobile de F06 apontam F05→F04, sem voltar a D05 |
| D08 ↔ I07 | I07 condiciona depreciação à compatibilidade D08 no contrato; D08 apenas relaciona I07. Inventário de clientes/envelopes pode iniciar sem decisão de depreciação |
| H03 ↔ H08 | H03 condiciona piloto externo à prontidão de suporte H08; H08 apenas relaciona H03. Preparar runbook não exige piloto em operação |
| A03 / B02 | A03 usa A02 como histórico encerrado; I01/I02 e I04 são condicionais ao writer/contrato remoto realmente tocado. O fechamento P0 B02/D02 foi reportado em 28/10 (S10); caracterizar somente extensão P1 nova, sem concluir auditoria global |
| C02 | Curadoria pode iniciar pela fonte e pelo recibo existente; I03 é `RELATED`. Não há pré-requisito de encerrar a coexistência legado/V2 para pesquisar ou revisar produto/campo |
| I05 | Pesquisa de fontes oficiais pode iniciar imediatamente; mapa do domínio e isolamento só condicionam adapter/contrato concreto. Não se exige encerrar I01–I04 para estudar legislação |

A checagem mecânica considera os 71 nós e destinos `EXT-*` registrados, valida sintaxe/escopos e testa ciclos em dois grafos: `BLOCKING` e a união conservadora `BLOCKING + CONDITIONAL` (todas as condições simultaneamente ativas). `RELATED/HISTORICAL` são excluídas apenas da ordenação obrigatória, nunca do inventário de vínculos. Resultado histórico 02 e ordem topológica daquela baseline estão na [evidência do grafo](./evidence/MASTER_BACKLOG_DEPENDENCIES_02.json) e no [registro de validação](./MASTER_BACKLOG_VALIDATION.md#master-backlog-02--verificação-da-revisão-documental). Esses artefatos são preservados como históricos, não como validação desta revisão 03.

## Sequência atual — MASTER-BACKLOG-03

A coluna **Dep.** do índice mestre continua a única matriz de dependências. A auditoria dos 75 arquivos foi concluída: não é backlog novo. C02/F6, C05/C06 técnicos, GTA/CAS, fundação/colaboração V3 e óbito #270 estão integrados nos seus recortes; não repetir sua implementação ou validações por rotina. Notas de ordem e baselines anteriores são históricas.

| Ordem vigente / IDs existentes | Trabalho real | Evidência / aceite | Limite |
| --- | --- | --- | --- |
| Incremento atual — B02/A05 | Identidade explícita da conclusão neonatal: eventId opcional, detalhes/Agenda vinculados e UUID distinto estável para movimento no desmame | Controle RED: três casos falhavam porque a identidade era ignorada; GREEN: 28/28 focados em calfJourney e neonatalExecutionV2. Mesmo comando/dados/horário/ID gera mesmas operações | Local, não commitado. Caller sem ID mantém comportamento anterior; não comprova replay end-to-end ou dedup da UI. Pesagem inicial #257 e parto P0 não reabertos |
| Próxima prioridade — B01/F07 | Revisar exclusivamente service.ts preservado: restrição nominal de usuário e recuperação de rejeições por revisão ausente | Justificar autorização, contexto DEV/fazenda e uso de pull/retry antes de qualquer integração | Sem integrar a restrição nominal, carregar seed ou executar backend nesta tarefa |
| Condicional — F02/H02/D06/C07 | Reconciliar a evidência UX preservada e aceitar jornadas/atores por gesto | DEC-001/002/003/004/007 documentadas; não confundir capacidades #265/#268 com homologação UX | GATE-03 bloqueado; sem Etapa 3 automática ou ACL universal presumida |
| Condicional — C07/H01/C06 | Rollout do código integrado | Schema V3 completo → Edge compatível → frontend; ambiente/SHA/autorizações próprios | Gates OFF; B2/FULL/CI não certificam F24.7/F24.8 ou produção |
| Somente por defeito/escopo concreto — A04/E02/D04/D05/F04–F06/I03/D06 | Diagnósticos herdados, inventário F24.6A2, kill/dispositivo, coexistência e segurança universal | Delimitar contrato e menor prova somente quando existir objetivo autorizado | Nenhuma nova frente iniciada; não transformar ausência de certificação ampla em bug novo |

Próxima ação recomendada após este incremento: revisão isolada B01/F07. Os deltas antigos e a evidência UX estão no snapshot indicado no handoff; 34 integrados e 36 divergentes/superados aguardam somente limpeza autorizada, não reaplicação. Preservar worktrees concorrentes.

### Incrementos candidatos da Agenda Sanitária V3

Atualização vigente #270: os seis recortes normais do design estão integrados por #265/#268; óbito e consequências por #270, B2 e CI encerrados. A sequência abaixo preserva dependências do design, não uma fila de implementação pendente. GTA/CAS #264 está encerrado no [backlog](./MASTER_BACKLOG.md#recorte-i05i06--gta-03-cas-02a-e-cas-02b).

Sequência do design aprovado preservada para rastreabilidade. V3.1/V3.2 estão integradas por #265 no recorte de proteções, writer, leitores/efeitos e recuperação homologado localmente; resolução gerencial, participação, fechamento e continuidade foram integrados por #268. O merge não autoriza implantação/ativação real nem início automático das linhas posteriores.

**Premissa ratificada pelo PO em 30/10/2026**, na solicitação “V3.1 | Simplificação de compatibilidade e preparação técnica”: nenhum cliente antigo em operação e nenhum suporte a versões antigas. A [matriz manter/substituir/retirar/verificar e sequência V3.1](../superpowers/specs/2026-10-30-sanitario-agenda-v3-design.md#v31-simplificado--transição-para-contrato-único) prevalecem sobre a recomendação anterior de preservar dois fluxos. Dependências internas: verificar dados/recibos/pendências; instalar proteções com execução progressiva OFF; migrar consumidores atuais para contrato único; somente então substituir unicidade e propor retirada de caminhos sem uso. Histórico não é suporte a cliente antigo; pendências só geram trabalho específico se comprovadas. Proteções, contrato único e writer progressivo já estão implementados no recorte V3.1/V3.2, com histórico e pendências preservados.

| Recorte do design integrado / IDs existentes | Dependências reais | Resultado e aceite do candidato |
| --- | --- | --- |
| 1. Proteções canônicas, identidade e transição interna (V3.1 integrada #265) — F02/C07/D04/I03/D06 | Design aprovado e premissa de aplicativo único; verificar fatos/recibos/pendências e consumidores atuais | Proteção por operação e obrigação/animal; contrato operacional único; sem bypass por caminho não migrado. Índice atual mantido até substituto instalado, sem ramo V2 permanente; integração não autoriza implantação/ativação em ambiente real |
| 2. Registro factual progressivo (V3.2 integrada #265) — F02/C07/D04 | Proteções/identidade, admissão única e consumidores internos migrados; transação local/remota e fontes por Evento | Três Eventos no 30/15/5/5/5, durabilidade por grupo, retomada e efeitos locais coerentes; nenhuma closure global pelo cowboy. Habilitação depende de aceites e autorização própria |
| 3. Concorrência e reconciliação — F02/D04/C05/C06 | Writer progressivo e recepção durável dos envelopes | Distintos admitidos sem CAS global isolado; sobreposição, duplicidade, repetição legítima, falha parcial e tardios preservados; resolução Owner/Manager auditável |
| 4. Participação e fechamento — F02/C05/C06/D04 | Reconciliação e todas as admissões sujeitas à mesma barreira | Consulta não cria participação; sequência final/lacunas verificadas; conhecidos incompletos bloqueiam; snapshot transacional, fechamento idempotente e tardios sem reabertura automática |
| 5. Continuidade administrativa — F02/C07/D06 | Resultado multievento consolidado e revisão da barreira; autorização gerencial | Solicitação própria; duas decisões incompatíveis não duplicam Agenda; aprovação cria no máximo uma continuidade; rejeição justificada não cria; tardios revalidam o vínculo |
| 6. Composição de leitores, efeitos e UX — F02/C07/D04/C05/C06 | Contratos anteriores; migração dos leitores atuais e preservação histórica desde a primeira linha | Histórico/métricas/estoque/carência/custo consistentes por Evento; resíduos anteriores tratados somente se encontrados; sessão/farm-switch/restart e gestos coerentes no aplicativo único, sem certificação global |

O procedimento excepcional de participação irrecuperável é extensão futura condicionada, não sétimo incremento iniciado nem autorização para forçar o fechamento normal. Proteções de fonte, estoque e leitores são requisitos desde a definição dos contratos, não correções deixadas somente para a última linha. Não se reabrem I01/I02/I04 ou P0 encerrados.

Evidência histórica #265: [consolidação local](./evidence/SANITARIO_V31_V32_LOCAL_20261101.json). BLQ-002/003 ABERTOS; GATE-03 BLOQUEADO.

## Matriz de paralelismo

| Trilhas candidatas simultâneas | Compartilhamento proibido / coordenação | Condição |
| --- | --- | --- |
| Curadoria residual C02/C03 × novo recorte estático I01–I04 | Publicador, payload canônico e recibos têm owner único | Somente leitura/artefatos separados; sem publicação ou banco mutativo |
| Contratos externos I05/I06 × formalização F24.6A2/E02 | Sem edição de adapters/writers; cada plano em arquivo próprio | Fontes técnicas/regulatórias identificadas; plano não vira benchmark |
| Governança A06 × pesquisa produto H02–H08 | Não modificar dispatcher durante outra execução que dependa dele | Propostas documentais revisadas; adoção coordenada |
| Extensão P1 B02/A05 × UI independente já delimitada | `ops.ts`, AuthProvider, db.ts, tipos e writer compartilhados bloqueiam paralelismo de escrita | Só após análise de imports e touch set disjunto, executores isolados |
| Curadoria C02 × certificação C05 | Não mudar catálogo/fixture durante cenário; congelar hashes | Um executor possui backend/portas/usuários/harness; curadoria somente em arquivos separados |
| Qualquer execução E2E/backend × outra execução E2E/backend | Banco, Docker, browser profile, portas, gates e cleanup exclusivos | Serializar; não compartilhar harness nem dados |
| I04 segurança × migration I08 | Constraints, políticas e callers pertencem ao mesmo contrato | Diagnóstico primeiro; mutação sequencial com autorização |

Em caso de overlap novo, suspender apenas a escrita concorrente, registrar owner e replanejar a unidade; worktree separada não evita colisão no banco ou contrato.

## Hierarquia e distribuição proposta

**Product Owner → Orquestrador → Líder técnico de frente → Executor.** Papéis propostos, sem nomeação automática de pessoas ou abertura de chats.

| Squad | Líder / responsabilidade proposta | IDs principais | Saída para revisão |
| --- | --- | --- | --- |
| GOV | Líder de governança/documentação | A01–A03, A06–A08; coordena índices | Baseline, allowlist, evidência e narrativa documental |
| CORE | Líder domínio/sync | A04/A05, B01–B09, D01–D05/D08 | Contratos factuais, writers, recuperação e testes |
| SAN | Líder sanitário com curadoria técnica | C01–C08; I03 | Fonte por campo, limites de autorização e composição sanitária |
| ARCH | Líder arquitetura/dados | I01/I02/I04/I07/I08; D06/D07 | Ownership, integridade e compatibilidade local-remota |
| PERF | Líder desempenho | E01–E07 | Inventário/métricas reproduzíveis no envelope aprovado |
| UX/MOB | Líder UX/mobile | F01–F07 | Jornadas e lifecycle com contratos compartilhados preservados |
| INTEROP | Líder integrações | I05/I06, G01–G08 | Adapters e proveniência sobre o domínio, sem execução implícita |
| PROD | Product Owner / líder produto | H01–H08 | Hipóteses, pilotos e critérios comerciais verificáveis |

Orquestrador congela baseline e distribui touch sets; líder resolve dependências e aceita a unidade técnica; executor implementa somente tarefa autorizada. Product Owner prioriza e aprova decisões de produto, arquitetura e risco residual.

**Gates independentes propostos:** QA verifica cenários e evidências; revisão arquitetural verifica ownership/fontes e compatibilidade; segurança verifica auth/RLS/fazenda e superfície de dados. O executor não autoatribui essas aprovações. O gate canônico do repositório continua sendo `rebanhosync-verification-gate`; preparação de PR só após classificação pertinente. Os dois agentes da consolidação histórica 01/02 apenas pesquisaram evidências. A atualização 03 foi documental, sem delegação nem revisão independente; não simula QA, revisão de produto ou certificação.

## Próximo incremento independente de decisão UX

**C02/F6 encerrado no escopo cadastral/documental realizado.** Reutilizar matriz e recibos de 29/10: 39 produtos, 288 campos confirmados, 283 representados, 43 novas linhas e replay idempotente. O procedimento concreto C07 é integrar/publicar o commit de segurança pelo fluxo existente, sob autorização explícita, e avaliar somente habilitações/exceções por produto/regra/finalidade. Nenhum novo ciclo dos 39, importação ou Evento/Agenda/estoque é necessário.

A segurança F6/C07 está integrada por [#258](https://github.com/maresdeandrade/RebanhoSync/pull/258), merge `8e89a5bd`; esse estado supera a antiga pendência de integração do commit local. Habilitação operacional, deploy e validação do alvo permanecem separados e dependem de autorização própria, assim como as exceções específicas C02/F6. GATE-03 e os escopos dos demais trabalhos são preservados.

## Limites e verificação documental da revisão 03

A atualização modifica somente este plano e o índice mestre. Arquitetura, reconciliação, OPEN_REVIEW_ITEMS, PROJECT_STATUS, SOURCE_OF_TRUTH, ROADMAP e evidências anteriores permanecem canônicos em seus respectivos escopos/datas; não foram reescritos para simular recertificação. Os ZIPs continuam externos, com proveniência e hashes no índice.

Verificação desta entrega: preservar 71 IDs, conferir referências UX usadas contra os pacotes, coerência entre estado/prioridade/decisão, destinos/escopos e ausência de ciclos obrigatórios, links internos alterados e `git diff --check`; comparar hashes dos seis arquivos locais e inventário Git antes/depois. Resultados efetivamente observados são comunicados na entrega, sem atribuir testes funcionais a checks documentais. Nenhum gate adicional de runtime é iniciado por este plano.
