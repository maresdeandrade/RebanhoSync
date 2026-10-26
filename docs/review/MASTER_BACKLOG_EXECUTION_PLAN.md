# MASTER-BACKLOG-01/02 — dependências, squads e próximos incrementos

Atualizado em: 2026-10-25
Estado: proposta de planejamento; nenhuma implementação iniciada.

## Decisão de desenho proposta

Aplicação de Superpowers: descoberta com `repository-context-retrieval`; leitura independente por responsabilidade com `dispatching-parallel-agents`; desenho por `brainstorming` e plano por `writing-plans`, adaptados ao pedido documental explícito. A especificação já define os entregáveis e a alternativa candidata; não se exige aprovação redundante para escrevê-los. A aprovação arquitetural para mudar o produto permanece futura. Nenhum plano autoriza commit ou integração.

**Recomendação:** Alternativa B, consolidação incremental com estruturas físicas preservadas inicialmente. Manter coexistência legada/V2 até inventário de callers, ownership, compatibilidade e clientes pendentes. Alternativa A (reestruturação ampla/limpeza) tem risco de perder contratos e extrapola o pedido; Alternativa C (camada externa independente do domínio) criaria mapeamentos concorrentes. A escolha definitiva de B e seus contratos ainda depende do Product Owner e revisão técnica.

## Normalização das relações — MASTER-BACKLOG-02

A matriz de relações é a coluna **Dep.** do [índice mestre](./MASTER_BACKLOG.md), sem cópia concorrente em outro backlog. Esta seção explica a semântica e os critérios. A ordem de portfólio abaixo é proposta, não aresta implícita: somente `BLOCKING` e `CONDITIONAL` ativada pelo escopo geram pré-requisito. `RELATED`/`HISTORICAL` preservam contexto e podem ser recíprocas sem bloquear execução. Prioridade e squad também não criam arestas.

| Relação | Interpretação verificável |
| --- | --- |
| `BLOCKING` | Artefato prévio obrigatório para o próximo escopo descrito. Ex.: A03 exige inventário/baseline A02 para não transportar versão superada; E03 utiliza rebaseline A07 antes de selecionar seu refactor |
| `CONDITIONAL` | Pré-requisito apenas no escopo `@...`; a condição tem de constar da tarefa concreta. Um estudo ou reprodução não ativa automaticamente condições de escrita, certificação ou liberação |
| `RELATED` | Referência informativa sem ordenação obrigatória: não obriga encerrar o item relacionado |
| `HISTORICAL` | Entrega ou fonte existente usada como baseline; não significa trabalho a repetir, nem nova certificação |

### Referências externas e escopos condicionais

Destinos fora dos 71 IDs têm prefixo `EXT-` explícito. Não são iniciativas novas. Sua presença distingue pré-requisito externo de ID ausente; tampouco afirma que autorização, fonte técnica ou critério já existem para qualquer execução futura.

| Referência externa | Fonte / condição de satisfação |
| --- | --- |
| EXT-BASELINE | SHA/HEAD/status/touch set confirmados; nesta revisão `main@2f4e218c33b40b48524db721019186ddb2f3a70b`, checkout em `4b43fc10…` |
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
| seed | Integrar/rodar Fazenda Modelo que depende do delta reprodutivo/seed indicado; não exige recriar evidência histórica |
| retry | Seed/patch utiliza retry afetado pelo hunk local; caracterizar a revisão persistida e guard #245 |
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
| A03 / B02 | A03 depende de A02; I01/I02 e I04 são condicionais ao writer/contrato remoto realmente tocado. B02/D02 podem ser estudados/caracterizados independentemente e integrar um candidato conjunto, sem concluir auditoria global |
| C02 | Curadoria pode iniciar pela fonte e pelo recibo existente; I03 é `RELATED`. Não há pré-requisito de encerrar a coexistência legado/V2 para pesquisar ou revisar produto/campo |
| I05 | Pesquisa de fontes oficiais pode iniciar imediatamente; mapa do domínio e isolamento só condicionam adapter/contrato concreto. Não se exige encerrar I01–I04 para estudar legislação |

A checagem mecânica considera os 71 nós e destinos `EXT-*` registrados, valida sintaxe/escopos e testa ciclos em dois grafos: `BLOCKING` e a união conservadora `BLOCKING + CONDITIONAL` (todas as condições simultaneamente ativas). `RELATED/HISTORICAL` são excluídas apenas da ordenação obrigatória, nunca do inventário de vínculos. Resultado observado e ordem topológica estão na [evidência do grafo](./evidence/MASTER_BACKLOG_DEPENDENCIES_02.json) e no [registro de validação](./MASTER_BACKLOG_VALIDATION.md#master-backlog-02--verificação-da-revisão-documental).

## Dependências e critérios de passagem

| Ordem | Incremento / IDs | Depende de | Entregável e critério de aceite futuro | Limite |
| --- | --- | --- | --- | --- |
| 1 | Reconciliação A02, baseline A01/C01 | Main confirmada | Inventário e classes por arquivo; preservar blobs; não reabrir #240–#246 | Realizado documentalmente nesta entrega, sem integrar deltas |
| 2 | Inventário arquitetural I01/I02, investigações específicas I03/I04 | A02 para baseline; mapa específico antes da decisão por contrato | Matriz entidade→reader→writer→persistência→RPC/Edge→responsabilidade; distinguir caminho montado, writer retido e dependência histórica | Recorte I01/I02 aprofundado nesta revisão; não inicia auditoria global I03/I04 |
| 3 | Integração seletiva A03, A06, B01/B02/D02 | A02; análise do writer/contrato somente quando tocado | Candidato isolado por contrato; testes focados de retry/replay, revisão e gate antes de PR | Não exige conclusão global da Frente I; não transportar ops antigo nem perder #245 |
| 4 | Curadoria C02/C03 e certificação C05/C06 | Catálogo/fonte adequada; para C05 baseline pós-#245 e harness isolado | Curadoria auditável por campo; composição provider/UI/fila/backend local com controles negativos | Curadoria e certificação são entregas distintas; 39 publicados não são 39 aprovados |
| 5 | Estudos I05/I06 e futuros adapters G01–G08 | Pesquisa independente; domínio/isolamento específicos condicionam somente adapter concreto | Matriz de requisitos/fontes e, quando delimitado, mapeamento IDs/documentos→comando canônico | Sem esperar auditoria global; sem tabelas PNIB/SISBOV/GTA ou API externa neste plano |
| 6 | Evolução funcional B/F/G e E02–E07 | Aceite específico e baseline de cada frente | Incrementos pequenos com cenários observáveis e evidência proporcional | Roadmap não vira automaticamente pendência técnica |
| 7 | Compatibilidade I07 e migrations futuras I08 | Para depreciação/DDL: decisão e evidência do contrato afetado, inclusive D08 | Plano forward-only, replay de clientes antigos, rollback/compensação e autorização explícita por mudança | Elaborar proposta não depende de aprová-la previamente; nenhum DDL já aprovado |
| 8 | F24.8 / H01 | Gates F24, produção, canário e rollback; decisão humana | Critérios go/no-go e evidência de produção no envelope definido | Produção/rollout não autorizados por esta entrega |

A sequência é prioridade proposta, sem acrescentar arestas à matriz. A06 documental, estudo/caracterização de B02/D02, curadoria C02 e pesquisa I05 podem avançar independentemente, respeitando o touch set. Só o patch que alterar writer/contrato depende da análise específica correspondente. F24.6A2 continua proposta no plano canônico; esta revisão não a inicia nem substitui sua formalização.

## Matriz de paralelismo

| Trilhas candidatas simultâneas | Compartilhamento proibido / coordenação | Condição |
| --- | --- | --- |
| Curadoria documental C02/C03 × inventário estático I01–I04 | Publicador, payload canônico e recibos têm owner único | Somente leitura/artefatos separados; sem publicação ou banco mutativo |
| Contratos externos I05/I06 × formalização F24.6A2/E02 | Sem edição de adapters/writers; cada plano em arquivo próprio | Fontes técnicas/regulatórias identificadas; plano não vira benchmark |
| Governança A06 × pesquisa produto H02–H08 | Não modificar dispatcher durante outra execução que dependa dele | Propostas documentais revisadas; adoção coordenada |
| Delta reprodutivo B02/D02 × UI independente já delimitada | `ops.ts`, AuthProvider, db.ts, tipos e writer compartilhados bloqueiam paralelismo de escrita | Só após análise de imports e touch set disjunto, executores isolados |
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

**Gates independentes propostos:** QA verifica cenários e evidências; revisão arquitetural verifica ownership/fontes e compatibilidade; segurança verifica auth/RLS/fazenda e superfície de dados. O executor não autoatribui essas aprovações. O gate canônico do repositório continua sendo `rebanhosync-verification-gate`; preparação de PR só após classificação pertinente. Os dois agentes desta consolidação apenas pesquisaram evidências, sem simular QA, revisão de produto ou certificação.

## Próximo incremento independente recomendado

**C02 — revisão documental de identidade e fontes de um produto do lote F6**, sem publicação, aplicação ou alteração de catálogo remoto. É uma fatia útil que não depende da conclusão global de I01/I02/I03; a investigação pode inclusive concluir que a fonte é insuficiente.

- **Entrada:** baseline/touch set confirmados; produto identificado no recibo/candidato F6 existente; referência técnica localizável ou ausência registrada; um executor responsável pelo artefato curatorial, sem editar publicador/payload/harness compartilhados.
- **Entrega:** uma decisão por campo (identidade comercial, espécie, dose/via, apresentação, carência e força da fonte quando aplicáveis), com proveniência, data/versão e desconhecidos explícitos. Não preencher campo sem fonte para produzir aparência de completude.
- **Aceite:** fontes e vínculo ao produto auditáveis; aprovação de protocolo, estado curatorial e autorização operacional separados; nenhum campo/flag de execução liberado por esta revisão; links/checks documentais e revisão independente focada no artefato.
- **Limite:** não alterar status remoto, publicar lote, criar Evento/Agenda/estoque ou certificar produto operacionalmente. Decisão técnica de aprovação segue `CONDITIONAL:EXT-SOURCE@approve`; pesquisa pode começar sem ela.
