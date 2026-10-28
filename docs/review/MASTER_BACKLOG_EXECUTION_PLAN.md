# MASTER-BACKLOG-01/02/03 — dependências, squads e próximos incrementos

Atualizado em: 2026-10-28
Estado: proposta atualizada com fechamentos técnicos reportados e UX-DISCOVERY-02; nenhuma próxima frente iniciada nesta atualização. Baseline local confirmada: `main@d6f035fbe1a8d00aadcf78ac2af813e4eb223be8`. Baselines históricas: portfólio 01/02 em `2f4e218c`; UX em `8878cc9`. Não houve consulta remota nova.

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

A coluna **Dep.** do [backlog mestre](./MASTER_BACKLOG.md) continua a única matriz de arestas A–I. A tabela abaixo prioriza **unidades futuras**, sem duplicar iniciativas ou transformar ordem em bloqueio. Estados técnicos/certificação e relações UX estão no índice; somente condições aplicáveis ao gesto/contrato bloqueiam a unidade.

**Critério:** maior risco de corromper fato ou perder pendências primeiro; aproveitar evidência existente, reduzir incerteza com fatia pequena e separar decisões de produto. Valor percebido, frequência e esforço são **hipóteses/estimativas qualitativas**, sem pesquisa ou orçamento aprovados. P1/P2/P3 UX têm significado de investigação sugerida, não prioridade técnica aprovada. A aprovação de Etapa 3 não libera execução sanitária ou rollout. A direção estabelecida C02/C07 é preservada; a ordenação proposta dos demais trabalhos não é prioridade autorizada pelo PO. Os seis P0 encerrados não integram a fila de implementação; I03/D06 ficam condicionais inativos, sem impedir esta frente por ausência de certificação universal.

| Ordem proposta / prioridade de desenvolvimento | Unidade futura / IDs preservados | Impacto e prioridade UX sugerida | Entrada / dependência específica | Entrega mínima e aceite futuro | Implementação / certificação / decisão UX | Gate UX e esforço estimado |
| --- | --- | --- | --- | --- | --- | --- |
| 1 / P1 — próxima frente técnica estabelecida | C02/C07 — um campo/regra residual do F6; C03 separado | JOR-018/019 P2, suporte a JOR-015/016 P1; evitar aplicação por aprovação cadastral | S11 seção 16 e candidata/recibos existentes; escolher P05/P06/P33/P38/P40/P41 ou uma regra crítica identificada; fonte técnica do campo | Decisão auditável de aproveitar/reter regra/contexto, com fonte e lacuna explícitas; não repetir 39 cadastros/aplicação e não ativar regra automaticamente | Cadastros aprovados historicamente; 39 doses/38 carências/39 espécies pendentes. Uso/rollout não certificado | Curadoria independe do gate UX; aplicação/alteração exige escopo e aceite técnico próprios. Esforço pequeno a médio por regra |
| 2 / P1 — investigação recomendada | A05/B02 — investigar pesagem neonatal repetida, sem reabrir replay P0 | JOR-021/025 P1; risco factual de registrar duas pesagens sem nova medição | S11 reproduz limitação em memória; inspecionar formulário e identidade do comando no HEAD, preservando dois deltas locais de calfJourney | Diagnóstico focado que delimite edição, nova medição e identidade persistida; não dispensa eventual correção necessária. Patch somente em tarefa autorizada, com testes de novo fato legítimo, replay e reabertura | Replay P0 integrado; novo horário não é replay. E2E da limitação não comprovado; ator/UX ainda pendentes | Investigação/correção factual independe de GATE-03; mudança de intenção/interação exige decisão delimitada. Esforço médio/incerto |
| 3 / P1 | C05/C06 — matriz de composição sanitária/recuperação | JOR-001/015/016/031/032/033 P1; risco de sessão/fazenda/ACK incorretos | Reutilizar guards #245, ownership I01/I02 e revisão localizada I04. Primeiro delimitar matriz; executar só com harness/ambiente/atores autorizados | Matriz provider/UI/fila/backend real com sessão expirada, farm-switch, retry, rejeição/sucesso parcial e resultado esperado por store; não repetir suites isoladas como prova composta | Guards integrados; composição e F24.7 completa pendentes. Sem HTTP negativo/E2E novo nesta revisão | Desenho de matriz técnica independente; teste de variante sanitária depende do alvo e gates aplicáveis, inclusive DEC-004 se adotado no cenário UX. Esforço médio, dependente de ambiente |
| 4 / P2 em F02; P1 de investigação UX, sem criar ID A–I | UX-DISCOVERY-02 — decisões em F02/H02/D06/C07 | As 14 P1 candidatas, inclusive JOR-034 rara/crítica; valor/frequência hipotéticos | Pacotes e reconciliação BLQ no índice; responsável humano de produto/engenharia a identificar | Registrar DEC-001 (escopo), DEC-002 (ator/gesto), DEC-003 (fato/fechamento/cancelamento), DEC-004 (variante/gate/ambiente), e condições DEC-006/007 quando aplicáveis | Vínculos mapeados, zero homologação nova. Quatro BLQ abertos, dois com esclarecimento técnico parcial | Unidade produz decisões para reconsiderar GATE-03; não executa Etapa 3. Esforço documental pequeno; prazo depende de decisão humana |
| 5 / P1 | B01/F07 — extensão mínima da Fazenda Modelo | JOR-002 P2 como onboarding relacionado; seed não tem RS/JOR próprio. Valor demonstrativo hipotético | Base testFarm já versionada; revisar somente delta local service.ts, ambiente DEV e dependências efetivamente tocadas | Candidato residual com identificação de seed/gestos/replay e proteção DEV; sem carga, backend ou homologação ampla por inferência | Onboarding/base integrados, extensão P1 retida e não certificada; demo não é piloto comercial | Revisão técnica independe de GATE-03; nova experiência guiada depende de escolha de produto. Esforço médio/incerto |
| 6 / P1 | A06 — delta de governança | Habilitadora, sem RS/JOR exclusivo; menor custo de coordenação é hipótese | Três arquivos locais preservados; comparar somente diff vigente e identificar dois achados Fallow reportados no conjunto P1 sem presumir sua localização | Um delta coerente, sem dispatcher paralelo; checks documentais/de governança proporcionais em tarefa própria | Parcial local, não integrado; não é certificação funcional nem decisão de UX | Independente de GATE-03; coordenar alteração de regras com executores ativos. Esforço pequeno |
| 7 / P1 | A04 e restante A05 — dívida/bugs específicos | JOR-014 e ficha/registro relacionadas; prioridades UX não classificam severidade técnica | Recontagem TypeScript focada no escopo histórico ou reprodução de óbito antes de patch; não tratar candidato estático como bug provado | Unidade por defeito ou diagnóstico real; preservar limites e distinguir falha preexistente | 38 diagnósticos VF5 são históricos, sem contagem atual; óbito sem reprodução E2E nesta tarefa | Independente para diagnóstico/correção já autorizados; redesign depende de produto. Esforço incerto até reproduzir |
| 8 / P1 | E02 — formalizar inventário F24.6A2 | Habilita leitura/feedback de JOR-004/031/035; sem requisito exclusivo de performance | EXT-SCOPE e plano/handoff F24 existentes; não reabrir reconnect 1k E01 | Escopo/aceite estático de startup/histórico/bundle/queries/índices; medição e otimização só depois em envelope próprio | Planejada; reconnect 1k historicamente certificado apenas no seu envelope | Independe de GATE-03; sem benchmark/build nesta atualização. Esforço documental pequeno a médio |
| 9 / P1 D04; P2 D05/F04–F06 | Estado/recovery e alvo mobile, em unidades separadas | JOR-011/031/032/033/034 P1; risco offline/kill/isolamento; benefício mobile hipotético | Writer/estado específico para D04; perfil persistente/harness para kill web D05. Capacitor/alvo para F04 e execução mobile F05/F06; não tornar kill web dependente de mobile | Inventário residual por estado, critério de kill real e proposta de alvo Android/iOS preservando React/Dexie; certificações só no ambiente escolhido | Parcial web, mobile planejado; kill/dispositivos reais não comprovados universalmente | Diagnóstico técnico independente; nova distribuição/interação e aceitação de risco requerem produto. Esforço médio a alto/incerto |
| 10 / acompanhamento P0 condicional inativo I03/D06; demais conforme índice | Legado/segurança, I05/I06, depreciação I07/I08 e release H01 | JOR-015/016 e autorização transversais; GTA/IATF ampla sem jornada executável | Somente se houver retirada/substituição de contrato legado (I03) ou comando/ator e operação remota/liberação delimitados (D06); então mapear contrato, falha/risco demonstrado, impacto na entrega e menor ação. Sem bloqueador ativo comprovado para C02/C07 | Menor mapa de coexistência/ação×role/proveniência pertinente. Produção F24.8 depende dos gates canônicos e autorização humana | I03/D06 universal não certificados; acompanhamento condicionado, sem fechamento universal. A03/B02/D02 e I01/I02/I04 são P0 concluídos no recorte; nenhuma migration ou release aprovada | Pesquisa independente; mutação/retirada/release condicionadas ao contrato e decisão aplicáveis. Esforço não estimável sem escopo |

As **próximas cinco unidades** são as linhas 1–5. A direção estabelecida, reafirmada pelo usuário nesta correção, mantém C02/C07 como próxima frente técnica independente; isso não autoriza escrita remota, promoção de regra ou implementação nesta tarefa. As posições 2–5 são recomendações novas de sequência, sem aprovação pelo Product Owner presumida; a investigação A05/B02 não é dispensada nem reabre replay P0. Não se somam jornadas ou candidatas como tarefas pendentes. A06, A04 e E02 podem ser delimitadas independentemente. C02 não depende de User Flows aprovados; C03 mantém seus três candidatos fora do lote.

### Frentes independentes e condicionadas

- **Podem ser delimitadas sem GATE-03:** investigação factual A05/B02, curadoria residual C02/C03/C07, matriz técnica C05/C06, revisão da extensão B01/F07, governança A06, dívida A04, inventário E02, caracterização de writer/kill D04/D05 e pesquisa de alvo F04–F06/I05/I06. Isso é independência de produto/UX, não autorização para executar além desta tarefa documental.
- **Dependem de decisão de produto específica:** seleção/atores/terminologia/variante das jornadas para Etapa 3; novo fluxo de onboarding/mobile; adoção estrutural da Alternativa B; depreciação e alvo de release. Implantação, teste remoto ou execução factual exigem ainda ambiente e autorização correspondentes.
- **Permanecem entregues:** reconciliação P0 A03/B02/D02 e ownership localizado I01/I02/I04, #240–#246, reconnect 1k no envelope certificado, base seed/onboarding, cadastro F6 e neonatal #253 nos recortes descritos. Nenhum desses resultados vira certificação universal.

### Gates específicos de produto/UX

A reconciliação detalhada de **BLQ-001..004**, **DEC-001..007**, **AUD-001..010** e **PND-001..013** está no [índice mestre](./MASTER_BACKLOG.md#reconciliação-dos-bloqueadores-e-decisões), sem outro backlog. **GATE-03 = BLOQUEADO**: dois BLQ parcialmente esclarecidos tecnicamente (002/003), nenhum encerrado, nenhuma decisão aprovada. A revisão de RLS/membership em I04 não equivale à matriz ação×role para PER; gate remoto OFF não equivale a cenário sanitário aprovado.

Para reconsiderar o gate, produto deve registrar responsável, data, baseline, escopo incluído/excluído, atores concretos e evidências aceitas em DEC-001..004, resolver as condições adicionais aplicáveis e emitir novo parecer com aprovação explícita. JOR-027 só adiciona condição específica de rastreabilidade se entrar no escopo; DEC-005 pode aguardar se a navegação implementada for a referência. DEC-007 depende do nível de afirmação exigido por store. Não promover PND a impedimento global nem inferir autorização para Etapa 3 por este documento.

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

**C02/C07 — uma regra ou campo residual identificado**, usando S11 seção 16 como estado histórico vigente. O ensaio do primeiro produto e o cadastro dos 39 F6 já têm evidência; não são trabalho novo. Escolher um dos campos retidos ou uma regra filha pendente e registrar fonte, contexto, restrição e decisão técnica, sem promover automaticamente dose/carência/espécie, mudar catálogo remoto ou criar Evento/Agenda/estoque.

A próxima frente C02/C07 é independente de GATE-03 e pode coexistir com a investigação factual A05/B02 da linha 2, se o touch set for disjunto. Escolha não equivale a autorização de execução; esta entrega termina na atualização documental. Não iniciar próxima frente, commit, push, merge, banco, Docker, E2E, build ou protótipos.

## Limites e verificação documental da revisão 03

A atualização modifica somente este plano e o índice mestre. Arquitetura, reconciliação, OPEN_REVIEW_ITEMS, PROJECT_STATUS, SOURCE_OF_TRUTH, ROADMAP e evidências anteriores permanecem canônicos em seus respectivos escopos/datas; não foram reescritos para simular recertificação. Os ZIPs continuam externos, com proveniência e hashes no índice.

Verificação desta entrega: preservar 71 IDs, conferir referências UX usadas contra os pacotes, coerência entre estado/prioridade/decisão, destinos/escopos e ausência de ciclos obrigatórios, links internos alterados e `git diff --check`; comparar hashes dos seis arquivos locais e inventário Git antes/depois. Resultados efetivamente observados são comunicados na entrega, sem atribuir testes funcionais a checks documentais. Nenhum gate adicional de runtime é iniciado por este plano.
