# Agenda Sanitária V3 — execução compartilhada, fechamento e continuidade

Atualizado em: 2026-10-30
Decisão: **DESIGN V3 APROVADO PELO PRODUCT OWNER.**
Implementação V3.1/V3.2: **AUTORIZADA E HOMOLOGADA LOCALMENTE; PR AUTORIZADO EM 01/11/2026.** Implantação e merge não autorizados. Demais incrementos não iniciados. **BLQ-002/003: ABERTOS. UX-DISCOVERY-02 GATE-03: BLOQUEADO.**

**Autorização posterior:** a entrega V3.1/V3.2 e o bootstrap offline foram executados sob autorização explícita do PO. O registro de aprovação original abaixo conserva o escopo histórico de 30/10; os contratos de produto permanecem os aprovados. Evidências e limites na [consolidação local](../../review/evidence/SANITARIO_V31_V32_LOCAL_20261101.json).

## Autoridade e proveniência

Fonte da aprovação: solicitação explícita do PO nesta sessão, “RebanhoSync — Superpowers | Formalização V3 e Continuidade da Fase Sanitária”, em **30/10/2026**. Aprovador: PO solicitante, sem nome civil informado. A revisão técnica final anterior classificou a especificação candidata como DESIGN APTO PARA APROVAÇÃO; a autorização humana atual aprova o design e sua formalização documental, sem autorizar implementação, planejamento executável, implantação ou mudança de gate.

**Decisão posterior do PO — 30/10/2026:** na solicitação “RebanhoSync — V3.1 | Simplificação de compatibilidade e preparação técnica”, o PO solicitante declarou: **“Não existem clientes antigos em operação. Não haverá suporte a versões antigas do aplicativo.”** Essa premissa substitui as exigências anteriores de coexistência operacional V2/V3 e suporte a aplicativos antigos, inclusive no preflight V3.1 desta sessão. Não afirma banco vazio, ausência de histórico ou de operações pendentes. As recomendações técnicas de transição abaixo não são implementação aprovada; execução heterogênea, colaboração, conflitos e fechamento offline permanecem deliberados.

Baseline documental verificada: `codex/optimize-agent-infrastructure@762226630fb54abbf9303d6e292be85fb28c9df2`, checkout `C:/Users/mares/dyad-apps/GestaoAgro`; referência local `origin/main@20a7b3b673db0fbe16db31e60bc33d72350fa8a8`, sem consulta ao servidor. Cinco worktrees registrados; os outros checkouts não integram esta entrega. Na entrada: staged vazio; cinco tracked modificados (backlog, plano, reprodução e Fazenda Modelo) e `docs/ux/UX-DISCOVERY-02.md` untracked. Alterações preexistentes devem ser preservadas.

Este arquivo é a especificação canônica do design V3 aprovado. [Backlog](../../review/MASTER_BACKLOG.md), [planejamento](../../review/MASTER_BACKLOG_EXECUTION_PLAN.md#incrementos-candidatos-da-agenda-sanitária-v3), [pendências técnicas](../../review/OPEN_REVIEW_ITEMS.md#agenda-sanitária-v3--pendências-técnicas-do-design-aprovado) e `UX-DISCOVERY-02` (documento de outra frente, preservado no checkout de origem e fora deste PR) mantêm suas autoridades próprias e referenciam o design sem copiá-lo integralmente. Não são criados IDs de iniciativa, DEC, BLQ ou gate. A designação V3 não aloca automaticamente `contract_version = 3` no transporte.

## Decisões de produto aprovadas

- Agenda representa intenção; Evento representa fato histórico. Planejamento, simulação e prescrição não se convertem automaticamente em execução.
- Uma Agenda pode originar múltiplos Eventos tecnicamente distintos por produto, dose, via, lote ou momento. Cada Evento conserva seus parâmetros, animais, responsável e fonte técnica. Obrigações distintas, como vacinação e vermifugação, são Agendas distintas.
- Execução é progressiva, durável e offline-first. Dois ou mais usuários autorizados podem trabalhar simultaneamente, sem delegação prévia obrigatória.
- Presença online é informativa e não bloqueante. Offline, a presença de terceiros não pode ser considerada verificável; não há dependência crítica de Realtime.
- Conflitos por animal/obrigação preservam evidências, sem reconhecer automaticamente dois atendimentos. Cowboy apresenta evidências; Owner/Manager resolve administrativamente com auditoria.
- Conclusão individual não fecha a Agenda. Owner/Manager autoriza fechamento global limitado aos participantes e fatos conhecidos e verificáveis; participantes conhecidos incompletos impedem o fechamento normal.
- Fechamento exige barreira transacional e snapshot auditável. Não pressupõe conhecimento de dispositivos que nunca se comunicaram. Registros tardios exigem reconciliação explícita, sem reabertura automática.
- A original termina `fechada`, com resultado parcial consolidando todos os Eventos; não executados têm motivo. A data original é preservada.
- Solicitação de continuidade é independente. Aprovação/rejeição é gerencial; aprovação cria de forma transacional e idempotente no máximo uma continuidade; rejeição justificada não cria Agenda.
- Participação operacional é distinta de mera visualização. Abrir ou consultar uma Agenda não cadastra automaticamente obrigação de conclusão individual. O início de atuação operacional gera identidade de participação, inclusive localmente antes de eventual envio.
- Participação irrecuperável exige procedimento excepcional futuro, auditável e autorizado separadamente. Não há fechamento forçado automático por timeout, ausência de presença, perda de dispositivo ou remoção de membership.

A deliberação de produto sobre fechamento offline está **resolvida**. Permanecem extensões e comprovações técnicas; não é necessário submeter novamente essa política ao PO.

## Implementação observada e fronteira de evolução

As evidências abaixo são inspeção estática no baseline citado, não execução de testes nem confirmação de implantação.

| Contrato atual / evidência | Restrição observada | Evolução proposta, ainda não implementada |
| --- | --- | --- |
| [Unicidade primária por Agenda](../../../supabase/migrations/20260722102038_sanitario_sync_v2_expand_foundation.sql), `ux_eventos_sanitario_agenda_primary_execution`, linha 178 | Uma execução primária ativa por Agenda | Manter até instalar proteção substituta por operação e obrigação/animal; sem obrigação de manter execução V2 depois da transição |
| [Detalhe sanitário](../../../supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql), `eventos_sanitario`, linha 576 | Um detalhe por Evento | Um Evento por grupo homogêneo, sem remodelar detalhe como histórico por animal |
| [Relações factuais](../../../supabase/migrations/20260722102038_sanitario_sync_v2_expand_foundation.sql), `eventos_animais`, linha 228 | Unicidade por fazenda/Evento/animal, não por toda a Agenda | Reutilizar relações para múltiplos Eventos e aplicações legítimas |
| [Agenda–Animal e closure](../../../supabase/migrations/20260606090000_sanitario_agenda_v2_clean_foundation.sql), linhas 115 e 164 | Ponteiro individual e referência factual única na closure | Projeção do atendimento separada do histórico completo; resultado consolidado multievento |
| [Writer local](../../../src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts), `ExecuteSanitaryAgendaInputV2`/`executeSanitaryAgendaV2`, linhas 34, 630 e 1022 | Alvos da Agenda inteira, estado local `executada`, todos os vínculos atualizados | Evoluir para registro durável por grupo, sem encerramento global pelo writer factual e sem writer V2 paralelo |
| [RPC factual](../../../supabase/migrations/20261004210000_sanitario_sync_v2_revision_conflict_pt409.sql), `internal_sanitario_sync_v2_apply_factual_core`, linhas 151 e 228 | Igualdade integral, CAS global e fechamento automático | Admissão progressiva, controle por obrigação/animal e fechamento gerencial separado |
| [Worker](../../../src/lib/offline/syncWorker.ts), `readSanitarioCommand`/tratamento terminal, linhas 852 e 1051 | Allowlist fixa; retenção factual específica de `apply_factual_core` | Novos comandos com evidência preservada, dependências e reconciliação explícitas |
| [Edge](../../../supabase/functions/sync-batch/sanitario-v2.ts), `COMMAND_ALLOWED_ROLES`, linha 257; [SQL authorize](../../../supabase/migrations/20260722102038_sanitario_sync_v2_expand_foundation.sql), linha 410 | Papéis/gates por comando e revalidação remota | Autorizar cada operação V3 sem inferência por UI ou extensão implícita de grants |

Participação, conclusão individual, barreira compartilhada e solicitação de continuidade não foram localizadas como contratos persistentes no recorte examinado. Não se atribuem essas capacidades a metadata, tags ou ao ledger de recibos.

## Alternativas arquiteturais avaliadas

| Alternativa | Compatibilidade / risco | Decisão de design |
| --- | --- | --- |
| Subdividir Agendas por produto/dose | Reutiliza partes do V2, mas altera a obrigação planejada e o agrupamento aprovado | Não adotar para o cenário obrigatório |
| Evento único com detalhe por animal | Remodela detalhe, estoque, carência e leitores; dificulta confirmações em momentos diferentes | Não adotar |
| Múltiplos Eventos por Agenda | Reutiliza Evento/detalhe/relações; exige nova unicidade, admissão e fechamento | Adotar; a Agenda já agrupa os Eventos, sem novo agregado histórico paralelo |

Esta decisão de domínio não aprova por associação a Alternativa B de reestruturação geral da Frente I no documento de arquitetura do portfólio, que conserva seu escopo próprio.

## Identidade, reconhecimento e obrigação

Cada grupo homogêneo confirmado tem identidade estável de operação e Evento, fazenda, Agenda, ocorrência da obrigação, autor autenticado, responsável factual, instante e snapshot técnico. O conteúdo confirmado é imutável para retry. Mudança factual exige correção auditável ou outro fato efetivamente ocorrido, não alteração silenciosa do envelope.

A identidade da obrigação acompanha a continuidade. Nova Agenda ou época operacional não autoriza, por si só, novo atendimento da mesma obrigação. A escolha física de chaves e versão de protocolo pertence ao futuro contrato técnico, preservando esse invariante.

| Conceito | Significado |
| --- | --- |
| Recepção | Operação/declaração recebida duravelmente; não comprova manejo |
| Declaração factual | Usuário informa manejo ocorrido |
| Comprovação | Qualidade/alcance das evidências; não decorre de ACK |
| Reconhecimento canônico | Registro admitido por integridade/autorização ou resolução auditável |
| Atendimento | Projeção de que o fato reconhecido satisfaz a obrigação, com suas limitações técnicas |

Um manejo registrado pode ter limitação técnica. Isso não autoriza repetição automática nem declaração de conformidade. Agenda–Animal pode projetar o atendimento; todas as aplicações reconhecidas permanecem nos Eventos e relações. Não criar unicidade histórica que impeça aplicação realmente repetida.

## Execução progressiva e resultado individual

Cada confirmação deve persistir em transação local coerente o Evento provisório, detalhe, relações, efeitos locais aplicáveis e envelope operacional. Grupo posterior que falha não elimina grupos confirmados. Não exigir background contínuo para preservar fatos.

| Cenário obrigatório | Registro | Acumulado |
| --- | --- | ---: |
| 15 animais, Produto A, 2 mL | Evento 1 | 15 manejados |
| 5 animais distintos, Produto A, 5 mL | Evento 2 | 20 manejados |
| 5 animais distintos, Produto B, 2 mL | Evento 3 | 25 manejados |
| 5 não manejados, com motivos | Declarações duráveis; nenhum Evento para esses cinco | 5 remanescentes |
| Fechamento gerencial válido | Snapshot referencia três Eventos, resultados e motivos | Original `fechada`, parcial |

Doses são ilustrativas, sem autorização terapêutica. Enquanto aberta, declaração individual de não manejo não impede outro participante autorizado de manejar o animal. O resultado definitivo `nao_executado` é consolidado no fechamento.

No fechamento sem conflito impeditivo: `E ∩ N = ∅`, `E ∪ N = P`; cada animal executado tem vínculo factual, cada não executado tem motivo. Contar animais distintos por obrigação, separadamente de número de Eventos ou aplicações. Atendimento técnico é qualificação adicional ao manejo factual. A data original não é alterada.

## Conflitos e aplicações repetidas

| Caso | Resultado contratual |
| --- | --- |
| Mesmo ID/conteúdo | Mesmo recibo, nenhum novo efeito |
| Mesmo ID/conteúdo divergente | Conflito de identidade, sem substituição |
| Operações distintas, alvos/obrigações distintos | Admissão independente; CAS global stale isolado não causa conflito |
| Operações distintas, mesmo animal/obrigação | Evidências preservadas e colisão explícita; sem segundo atendimento automático |
| Duplicidade confirmada | Resolução vinculada ao fato correspondente, sem nova aplicação/consumo |
| Aplicação realmente repetida | Outro Evento, parâmetros e consumo reais, sem contar atendimento duas vezes |
| Correção | Novo registro corretivo vinculado, sem apagar o original |
| Grupos parcialmente sobrepostos | Grupo completo preservado; interseção explícita; nenhum recorte automático da parte livre |

A primeira chegada não comprova verdade factual absoluta. Contradição relevante qualifica os animais envolvidos como em disputa. Cowboy acrescenta evidências em operações próprias; Owner/Manager resolve com justificativa, identidade e revisão observada. Particionar um grupo exige decisão explícita e linhagem para a declaração original.

O servidor precisa preservar duravelmente o material de conflito, não apenas mensagem resumida. Conflito de domínio persistido deve ser distinguido de exceção que desfaz a transação. Evidências operacionais não são outra fonte histórica nem outra aplicação confirmada.

## Participação e fechamento compartilhado

Participação operacional nasce do início explícito de atuação, não de leitura da tela. Identifica usuário/dispositivo/Agenda/época, com sequência monotônica e identidade única das operações. Offline, essa identidade é local até sua comunicação; não existe delegação obrigatória.

Conclusão individual declara sequência final `S`. O servidor distingue recebimento da declaração, operações até `S`, lacunas e resultados de domínio. Retomada enquanto aberta cria segmento auditável e invalida snapshot anterior. Presença é efêmera, informativa e não bloqueante; offline não é verificável. Presença não integra o critério de completude.

O controle operacional proposto distingue abertura, drenagem e encerramento, sem exigir novo enum de Agenda: ela pode permanecer `programada` até o fechamento gerencial confirmado. Esses conceitos não são estados já implementados.

| Momento contratual | Condições e efeitos |
| --- | --- |
| Preparação | Owner/Manager autorizado solicita encerramento. Participantes conhecidos sem conclusão impedem o fechamento normal |
| Drenagem | Barreira fixa fluxos e limites declarados; recebe faltantes abrangidos por esses limites, bloqueando novas admissões ordinárias |
| Confirmação | Servidor revalida autorização, barreira, revisões, participantes, conflitos, classificações e referências; persiste snapshot e `fechada` numa transação |

Snapshot inclui Agenda, época/configuração, participantes conhecidos, sequências finais, operações/Eventos considerados, resultado por animal, motivos, conflitos/limitações, responsável e instante. Informação relevante nova antes da confirmação invalida o snapshot. Cancelar/refazer preparação não reabre Agenda já fechada.

Replay consulta o recibo antes de tratar a operação como nova admissão: ACK perdido após fechamento não transforma operação já aplicada em registro tardio. Todos os writers do fluxo único devem respeitar a barreira; durante a transição, caminhos ainda não migrados devem ser bloqueados para a nova semântica. Locks somente no comando gerencial são insuficientes. A época não reinicia a identidade da obrigação.

O fechamento é limitado ao estado conhecido e verificável. Não há garantia sobre dispositivo que nunca comunicou participação. Participantes conhecidos incompletos bloqueiam; timeout/presença ausente não os dispensam. Participação irrecuperável permanece pendência técnica de procedimento excepcional futuro, sem bypass automático e sem reabrir a decisão normal de produto.

## Registros tardios e continuidade administrativa

Nova operação da época encerrada é preservada e classificada como tardia; não é aplicada silenciosamente, enviada a outra época nem causa reabertura automática. Resolução administrativa explícita pode reconhecer fato legítimo e produzir resultado revisado ligado ao anterior. O snapshot original permanece reproduzível.

Solicitação persistente independente referencia o resultado consolidado e sua revisão, não um Evento escolhido entre os três. Guarda origem, fazenda, autor autenticado, instantes, animais/motivos estruturados, revisão observada, identidade idempotente, decisão e vínculos de continuidade. Não é closure factual, tag, cache ou ledger de sync.

Solicitar não altera data/alvos originais, não gera Evento, estoque, carência, cancelamento, reabertura ou nova Agenda. Owner/Manager decide. Aprovação revalida resultado, animais, obrigação, janela e fontes e cria no máximo uma continuidade na mesma transação da decisão; unicidade por resultado/solicitação e replay estável impedem duplicação. Rejeição exige justificativa, preserva a original e seus fatos, sem continuidade automática.

Fato tardio ou atendimento posterior invalida aprovação pendente baseada em resultado desatualizado; não remover animais silenciosamente. Havendo continuidade criada, impedir no servidor confirmação incompatível para os animais afetados até resolver a dependência, sem desfazer manejos já ocorridos. Não se promete impedir fisicamente outro manejo em dispositivo offline.

## Segurança, efeitos e compatibilidade

| Camada | Responsabilidade proposta |
| --- | --- |
| Domínio | Partição/obrigação, qualificação factual, participação, conflitos e transições |
| Dexie | Persistência transacional por grupo/participação/evidência; retomada e ownership |
| Queue/pull/reconcile | Envelopes imutáveis, dependências, recibos e instalação coerente, preservando pendências |
| PostgreSQL/RPC/Edge/RLS | Chaves/FKs por fazenda, unicidade, barreira e autorização efetiva de cada comando |
| UI | Gestos distintos; salvo localmente, enfileirado, reconhecido, em conflito e reconciliado separados |
| Leitores/relatórios | Múltiplos Eventos, resultados versionados e métricas distintas de animais, aplicações e Eventos |

Cowboy/Owner/Manager registram manejo/evidências e solicitam continuidade conforme membership; cada participante conclui sua atuação; somente Owner/Manager resolve administrativamente, fecha globalmente e aprova/rejeita. Autor canônico deriva da sessão, não da UI. Nenhuma role veterinária ou acesso global é criado. Sessão expirada impede confirmação remota; farm-switch não altera fazenda dos envelopes.

Consumo real é por Evento/grupo, sem rateio automático dos 30, sem baixa para os cinco não manejados nem por replay/duplicidade. Aplicação adicional legítima conserva seu consumo. Carência depende de produto, instante, animais e fonte; custo ausente permanece desconhecido. Aprovação gerencial não autoriza terapia ou aptidão comercial.

Transação local não prova atomicidade remota de fato e consumo companheiro. Reconhecimento factual e reconciliação de efeitos obrigatórios são distintos; falha parcial não apaga o manejo nem aparece como sucesso completo. Gate OFF continua respeitado: persistência local não promete fila ou confirmação remota.

O destino é **um único fluxo operacional V3**, evoluindo o modelo canônico existente. Não manter writers, RPCs, readers ou regras de domínio V2 paralelos para suportar aplicativos antigos. Nomes físicos com sufixo V2 podem ser mantidos quando sua troca não trouxer benefício de contrato; não copiar tabelas ou histórico apenas para renomear a versão. Versionamento de envelope/snapshot continua útil para interpretação, idempotência e rejeição de formato não suportado; não obriga suporte simultâneo a duas versões. Não elevar o máximo do gate como substituto de instalar as proteções.

Os consumidores internos atuais precisam migrar antes da habilitação; ausência de clientes antigos não torna obsoleta uma função ainda chamada pelo aplicativo atual. Preservar histórico, snapshots, recibos e efeitos reconhecidos, sem reinterpretar ou reexecutar fatos V2 como novas aplicações V3. Eventuais operações pendentes exigem tratamento somente se sua existência for comprovada: manter identidade/evidências e decidir drenagem no contrato original ou reconciliação explícita, sem conversão silenciosa ou adapter permanente. Banco remoto e stores de dispositivos não foram consultados nesta revisão; existência e volume desses dados/operações permanecem não verificados.

## V3.1 simplificado — transição para contrato único

Recomendação técnica: substituir gradualmente os contratos atuais no mesmo modelo Agenda–Evento–Animal, com execução progressiva desabilitada até completar as proteções. Coexistência permanente foi dispensada pelo PO; uma segunda arquitetura operacional não é necessária. Reset/descarte de dados não é alternativa autorizada. As etapas abaixo expressam dependências, não um plano executável.

| Contrato / evidência atual | Ação proposta | Natureza e justificativa |
| --- | --- | --- |
| Suporte a aplicativos antigos, negociação de dois fluxos e semântica V2 mantida indefinidamente | Dispensar suporte; retirar futuramente somente mecanismos comprovadamente obsoletos | Dispensável pela decisão do PO; não implica excluir código ou dados nesta tarefa |
| [Protocolos Sanitários](../../../src/pages/ProtocolosSanitarios/index.tsx), chamadas nas linhas 242 e 272; writer factual, cancelamento e planejamento atuais | Substituir pelo contrato único | Transição interna necessária: ainda possuem callers; não são caminhos comprovadamente obsoletos |
| [Agenda/Registrar legado](../../../src/lib/sanitario/infrastructure/service.ts), `concluirPendenciaSanitaria`, linha 88; [boundary](../../../src/lib/sanitario/infrastructure/executionBoundary.ts), linha 65 | Substituir chamadas sanitárias; retirar endpoint/fallback somente após provar ausência de consumidores e pendências | Transição interna; `agenda_itens` tem usos fora deste recorte e não é eliminada por associação |
| [Correção](../../../src/lib/sanitario/reconciliation/sanitaryCorrectionV2.ts), linhas 481 e 593; histórico externo e backfill do cutover | Substituir a admissão; manter fatos e linhagem | Integridade: correção pode alcançar a Agenda pelo Evento sem informar Agenda direta; histórico externo não vira atendimento automático |
| [Edge/RPCs e guards](../../../supabase/migrations/20260722102038_sanitario_sync_v2_expand_foundation.sql), linhas 346 e 410; comandos atuais | Substituir semântica; retirar futuramente endpoints sem consumidores | Transição interna: bloquear caminho não migrado e omissão de versão; autorização por comando/role/fazenda continua obrigatória |
| Índice de primário por Agenda; unicidades de operação/Evento; FKs compostas e RLS | Manter integridade; substituir somente o índice incompatível com multievento | Índice atual permanece até proteção substituta instalada e todos os writers controlados; não manter ramo V2 por suporte inexistente |
| [Fila/cutover](../../../src/lib/offline/sanitarioV2Cutover.ts), [worker](../../../src/lib/offline/syncWorker.ts), [pull](../../../src/lib/offline/pull.ts), Dexie e reconciliação | Evoluir o mecanismo existente; verificar existência de envelopes anteriores | Offline/retry/crash continuam no aplicativo único. Tratar resíduos comprovados; nenhum suporte permanente a fila antiga por hipótese |
| [Leitor da Agenda](../../../src/pages/Agenda/useAgendaPageData.ts), linha 123; [histórico](../../../src/lib/sanitario/history/sanitaryExecutedHistoryV2.ts), linha 166 | Substituir projeção singular; manter leitura fiel dos fatos históricos | Consumidores internos atuais, não clientes antigos. Migração antes de expor multievento; Evento/aplicação/animal/atendimento distintos |
| Ledger/recibos, fatos, snapshots, estoque, carência e custo existentes | Manter; verificar existência/shape e relações antes de migração | Integridade factual obrigatória independentemente da versão do aplicativo; não recalcular passado implicitamente |

**Menor sequência candidata:**

1. Verificar o estado do alvo autorizado: contratos aplicados, fatos/recibos, referências e eventuais pendências locais/remotas. Ausência comprovada de resíduos dispensa seu tratamento específico; ausência de clientes antigos não comprova ausência de dados.
2. Instalar identidade imutável de operação/Evento e ocorrência de obrigação por animal/fazenda, preservada através da continuidade, recibos e exclusividade do atendimento; fechar admissões genéricas/indiretas. Manter o índice atual e a execução progressiva desabilitada. Metadados de transição, se necessários, são temporários, sem dispatcher permanente V2/V3.
3. Migrar em conjunto admissão Edge/RPC, writers/correções/planejamento, envelopes/worker/pull e projeções internas para o contrato único. Preparar dependência de consumo por Evento, carência/custo e falha parcial. Tratar somente pendências anteriores encontradas, sem alterar seus IDs/conteúdo para aparentar replay.
4. Com consumidores migrados e evidência de integridade, substituir a unicidade incompatível pela proteção transacional de operação e atendimento. Retirar futuramente os acessos antigos comprovadamente sem uso, sem excluir histórico. Habilitação progressiva exige autorização própria e aceites V3.2; não decorre da retirada de retrocompatibilidade.

Um discriminador permanente para manter duas semânticas de execução é dispensável. Identificação de formato histórico e, se comprovadamente necessário, marcador temporário de migração permanecem possíveis. Não atualizar versões/recibos históricos em massa para fazer dados parecerem nativos V3. Confirmação de recebimento, reconhecimento factual e atendimento da obrigação continuam distintos.

**Aceites futuros da transição:** único contrato operacional alcançável pelos callers migrados; nenhuma escrita alternativa contorna autorização/obrigação; índice substituído somente com proteção instalada; replay inclusive após ACK perdido/fechamento sem novo Evento/consumo; ID divergente conflita; grupos distintos não conflitam por CAS global isolado; sobreposição não cria segundo atendimento; fatos/snapshots/recibos e efeitos históricos mantêm identidade e significado; pendências comprovadas recebem destino auditável; cowboy não ganha decisão administrativa; outra fazenda é negada. Validar leitura, restart, sessão expirada, farm-switch e reconciliação no aplicativo atual. Não se exige regressão de versões antigas inexistentes. Nesta revisão foram validados apenas diff documental e referências; nenhum teste de runtime foi executado.

## Invariantes e critérios de aceite

Critérios técnicos, ainda não demonstrados em execução nesta formalização:

- Cenário 30/15/5/5/5 produz três Eventos progressivos, cinco não executados com motivo e fechamento parcial gerencial; nenhuma execução/continuidade por dedução.
- Crash/restart entre grupos preserva os confirmados; falha de grupo posterior não remove anteriores.
- Grupos distintos são admitidos em qualquer ordem sem conflito por revisão global isolada; sobreposição é preservada e qualificada.
- Replay não gera novo Evento, consumo ou atendimento; identidade divergente conflita; correção, duplicidade e aplicação adicional têm efeitos distintos e auditáveis.
- Conclusão individual não fecha; participante conhecido ou sequência incompleta bloqueia; consulta/presença não cria participação operacional.
- Operação concorrente à barreira entra no snapshot correto ou recebe classificação explícita; snapshot stale é rejeitado; fechamento é idempotente.
- Registro tardio não é perdido nem reabre automaticamente; resolução preserva snapshot anterior e revalida continuidade.
- Duas decisões incompatíveis produzem um resultado canônico e conflito para a divergente; aprovação cria no máximo uma continuidade; rejeição motivada não cria Agenda.
- Acesso cruzado e decisão gerencial pelo cowboy são negados remotamente; sessão expirada/farm-switch preservam isolamento, identidade e evidências.
- Fluxo único V3 sem fallback de escrita à semântica substituída; consumidores internos migrados; pendências anteriores, se comprovadas, recebem tratamento auditável; readers preservam histórico e distinguem Evento, aplicação e animal.
- Estoque/carência/custo permanecem por Evento e contexto técnico; falha parcial gera reconciliação, não sucesso global presumido.
- Participação irrecuperável não é dispensada automaticamente; procedimento excepcional, quando futuramente delimitado/autorizado, exigirá auditoria, critério de entrada e efeitos sobre snapshot/continuidade.

As dez pendências e sua rastreabilidade estão em [OPEN_REVIEW_ITEMS](../../review/OPEN_REVIEW_ITEMS.md#agenda-sanitária-v3--pendências-técnicas-do-design-aprovado); a ordem candidata está no [plano existente](../../review/MASTER_BACKLOG_EXECUTION_PLAN.md#incrementos-candidatos-da-agenda-sanitária-v3). Não são plano executável nem autorização de início.

## Relação com a fase e o GATE-03

Fase 24 e seus gates mantêm autoridade no [plano ativo](../../review/ACTIVE_PHASE_PLAN.md) e no [handoff](../../review/CURRENT_PHASE_HANDOFF.md). V3 não substitui F24.6A2, não encerra F24.7/F24.8, não reabre I01/I02/I04/P0 concluídos e não certifica trabalho de outras worktrees por associação.

BLQ-002/003 permanecem abertos: design aprovado não demonstra implementação de parcialidade/múltiplos Eventos nem autorização efetiva dos comandos novos. A prova necessária depende dos gestos e do nível de afirmação da futura UX: caminho disponível exige evidência correspondente; caminho condicional exige limite explícito e aceite específico. Não impor execução global de testes ou encerramento de todo o portfólio como condição genérica da discovery.

GATE-03 permanece BLOQUEADO até suficiência de evidência no recorte aplicável e autorização posterior explícita para reconsideração da Etapa 3. Não há nova decisão pendente sobre a política normal de fechamento offline. Esta formalização não executa `superpowers:writing-plans`, implementação, migration, ativação, commit, push, merge ou deploy.
